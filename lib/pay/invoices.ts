import { cfg } from "./config";
import { exec, first, fromDb, insertId, pool, rows, type Db, type Row } from "./db";
import { formatMoney } from "./money";

/**
 * Receipts, invoices and credit notes. A document is a frozen snapshot written at the moment it is issued and never regenerated from live
 * data. Numbers are unique and run in order within a series and a year (RCT-2026-000001).
 *
 * By default every document is a RECEIPT and says it is not a tax invoice. A "tax invoice" is only issued when PAY_INVOICE_MODE=tax_invoice
 * and the seller's tax id and address are set. Whether those documents meet the rules of your jurisdiction (for example GST invoice
 * requirements in India) is for your accountant to confirm before you switch the mode on.
 */
export type DocKind = "receipt" | "tax_invoice" | "credit_note";

export interface DocSnapshot {
  kind: DocKind;
  number: string;
  issuedAt: string;
  title: string;
  seller: { name: string; address: string; taxId: string; email: string };
  buyer: { name: string; email: string; country: string; address: Record<string, string | null> | null; taxId: string | null };
  orderId: string;
  currency: string;
  lines: Array<{ title: string; qty: number; unitMinor: number; discountMinor: number; taxMinor: number; totalMinor: number }>;
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  taxName: string;
  taxRateBp: number;
  taxInclusive: boolean;
  totalMinor: number;
  payment: { provider: string; reference: string; method: string | null; paidAt: string | null } | null;
  refund?: { amountMinor: number; reason: string; reference: string };
  notes: string[];
}

const SERIES: Record<DocKind, string> = { receipt: "RCT", tax_invoice: "INV", credit_note: "CRN" };
const TITLES: Record<DocKind, string> = { receipt: "Receipt", tax_invoice: "Tax invoice", credit_note: "Credit note" };

function kindForNewOrder(): DocKind {
  const s = cfg.seller();
  return cfg.invoiceMode() === "tax_invoice" && s.taxId && s.address ? "tax_invoice" : "receipt";
}

async function nextNumber(db: Db, kind: DocKind): Promise<{ series: string; seq: number; number: string }> {
  const year = new Date().getUTCFullYear();
  const series = `${SERIES[kind]}-${year}`;
  // The counter row is locked by this statement until the transaction ends, so concurrent issuers take turns and never share or skip a number.
  await exec(db, "INSERT INTO pay_invoice_counters (series, last_seq) VALUES ($1, 1) ON DUPLICATE KEY UPDATE last_seq = last_seq + 1", [series]);
  const r = await first<{ s: number }>(db, "SELECT last_seq AS s FROM pay_invoice_counters WHERE series = $1", [series]);
  const seq = Number(r?.s ?? 1);
  return { series, seq, number: `${series}-${String(seq).padStart(6, "0")}` };
}

/** Issue the document for a paid order (or a credit note for a refund). Idempotent: an existing document is returned unchanged. */
export async function issueDocument(db: Db, order: Row, opts: { kind?: DocKind; refund?: Row } = {}): Promise<{ number: string; created: boolean }> {
  const kind = opts.kind ?? (opts.refund ? "credit_note" : kindForNewOrder());
  const refundId = opts.refund ? Number(opts.refund.id) : 0;
  const existing = await first<{ number: string }>(db, "SELECT number FROM pay_invoices WHERE order_id = $1 AND kind = $2 AND refund_id = $3", [order.id, kind, refundId]);
  if (existing) return { number: existing.number, created: false };

  const items = await rows(db, "SELECT title, qty, unit_minor, discount_minor, tax_minor, total_minor FROM pay_order_items WHERE order_id = $1 ORDER BY id", [order.id]);
  const pay = await first(db, "SELECT provider, provider_payment_ref, provider_session_ref, method, settled_at FROM pay_payments WHERE order_id = $1 AND status IN ('succeeded','partially_refunded','refunded','disputed') ORDER BY id LIMIT 1", [order.id]);
  const billing = order.billing_json ? (JSON.parse(order.billing_json) as { address?: Record<string, string | null> | null; taxId?: string | null }) : {};
  const seller = cfg.seller();
  const notes: string[] = [];
  if (kind === "receipt") notes.push("This receipt confirms a payment. It is not a tax invoice.");
  if (kind === "credit_note") notes.push("This credit note confirms a refund against the order above.");
  if (order.tax_minor > 0) notes.push(order.tax_inclusive ? `Prices include ${order.tax_name || "tax"} of ${formatMoney(Number(order.tax_minor), order.currency)}.` : `${order.tax_name || "Tax"} of ${formatMoney(Number(order.tax_minor), order.currency)} was added.`);
  else notes.push("No tax was charged on this order.");

  for (let attempt = 0; attempt < 6; attempt++) {
    const n = await nextNumber(db, kind);
    const snap: DocSnapshot = {
      kind, number: n.number, issuedAt: new Date().toISOString(), title: TITLES[kind],
      seller, buyer: { name: order.billing_name, email: order.email, country: order.country, address: billing.address ?? null, taxId: billing.taxId ?? null },
      orderId: order.public_id, currency: order.currency,
      lines: items.map((i) => ({ title: i.title, qty: Number(i.qty), unitMinor: Number(i.unit_minor), discountMinor: Number(i.discount_minor), taxMinor: Number(i.tax_minor), totalMinor: Number(i.total_minor) })),
      subtotalMinor: Number(order.subtotal_minor), discountMinor: Number(order.discount_minor), taxMinor: Number(order.tax_minor), taxName: order.tax_name, taxRateBp: Number(order.tax_rate_bp), taxInclusive: !!order.tax_inclusive, totalMinor: Number(order.total_minor),
      payment: pay ? { provider: pay.provider, reference: pay.provider_payment_ref ?? pay.provider_session_ref, method: pay.method, paidAt: fromDb(pay.settled_at)?.toISOString() ?? null } : null,
      refund: opts.refund ? { amountMinor: Number(opts.refund.amount_minor), reason: opts.refund.reason, reference: opts.refund.public_id } : undefined,
      notes,
    };
    try {
      await insertId(db, "INSERT INTO pay_invoices (number, series, seq, order_id, refund_id, kind, snapshot) VALUES ($1,$2,$3,$4,$5,$6,$7)", [n.number, n.series, n.seq, order.id, refundId, kind, JSON.stringify(snap)]);
      return { number: n.number, created: true };
    } catch (e) {
      if ((e as { errno?: number }).errno !== 1062) throw e; // another request took this number: try the next one
      const again = await first<{ number: string }>(db, "SELECT number FROM pay_invoices WHERE order_id = $1 AND kind = $2 AND refund_id = $3", [order.id, kind, refundId]);
      if (again) return { number: again.number, created: false };
    }
  }
  throw new Error("Could not allocate a document number");
}

export async function getDocuments(orderId: number, db: Db = pool): Promise<DocSnapshot[]> {
  const r = await rows<{ snapshot: string }>(db, "SELECT snapshot FROM pay_invoices WHERE order_id = $1 ORDER BY id", [orderId]);
  return r.map((x) => JSON.parse(x.snapshot) as DocSnapshot);
}

export async function getDocument(number: string, db: Db = pool): Promise<{ orderId: number; doc: DocSnapshot } | null> {
  const r = await first<{ order_id: number; snapshot: string }>(db, "SELECT order_id, snapshot FROM pay_invoices WHERE number = $1", [number]);
  return r ? { orderId: Number(r.order_id), doc: JSON.parse(r.snapshot) as DocSnapshot } : null;
}

const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

/** A printable HTML page for a document (the browser's "Save as PDF" turns it into a PDF). Every value is escaped. */
export function renderDocumentHtml(d: DocSnapshot): string {
  const m = (n: number): string => esc(formatMoney(n, d.currency, d.currency === "INR" ? "en-IN" : "en-US"));
  const addr = d.buyer.address ? Object.values(d.buyer.address).filter(Boolean).map((v) => esc(String(v))).join(", ") : "";
  const rowsHtml = d.lines.map((l) => `<tr><td>${esc(l.title)}${l.qty > 1 ? ` x ${l.qty}` : ""}</td><td class="r">${m(l.totalMinor)}</td></tr>`).join("");
  const seller = [d.seller.name, d.seller.address, d.seller.taxId ? `Tax ID: ${d.seller.taxId}` : "", d.seller.email].filter(Boolean).map(esc).join("<br>");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(d.title)} ${esc(d.number)}</title>
<style>body{font:15px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#111;margin:0;background:#f4f4f5}main{max-width:720px;margin:24px auto;background:#fff;padding:40px;border-radius:12px;border:1px solid #e4e4e7}
h1{font-size:26px;margin:0 0 4px}.muted{color:#52525b;font-size:13px}table{width:100%;border-collapse:collapse;margin-top:24px}td{padding:10px 0;border-bottom:1px solid #e4e4e7}.r{text-align:right;white-space:nowrap}.tot td{font-weight:700;border-bottom:0}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:24px}.note{margin-top:24px;font-size:13px;color:#52525b}@media print{body{background:#fff}main{border:0;margin:0;max-width:none}}@media(max-width:560px){.grid{grid-template-columns:1fr}main{padding:24px}}</style></head>
<body><main><h1>${esc(d.title)}</h1><div class="muted">No. ${esc(d.number)} &middot; ${esc(new Date(d.issuedAt).toISOString().slice(0, 10))} &middot; Order ${esc(d.orderId)}</div>
<div class="grid"><div><div class="muted">From</div>${seller}</div><div><div class="muted">Billed to</div>${esc(d.buyer.name)}<br>${esc(d.buyer.email)}${addr ? `<br>${addr}` : ""}<br>${esc(d.buyer.country)}${d.buyer.taxId ? `<br>Tax ID: ${esc(d.buyer.taxId)}` : ""}</div></div>
<table><tbody>${rowsHtml}
${d.discountMinor > 0 ? `<tr><td>Discount</td><td class="r">-${m(d.discountMinor)}</td></tr>` : ""}
${d.taxMinor > 0 ? `<tr><td>${esc(d.taxName || "Tax")} (${(d.taxRateBp / 100).toFixed(2)}%) ${d.taxInclusive ? "included" : ""}</td><td class="r">${m(d.taxMinor)}</td></tr>` : ""}
<tr class="tot"><td>${d.kind === "credit_note" && d.refund ? "Amount refunded" : "Total paid"}</td><td class="r">${m(d.kind === "credit_note" && d.refund ? d.refund.amountMinor : d.totalMinor)}</td></tr></tbody></table>
${d.payment ? `<p class="note">Paid by ${esc(d.payment.method ?? "online payment")} via ${esc(d.payment.provider)}. Reference ${esc(d.payment.reference)}${d.payment.paidAt ? `, ${esc(d.payment.paidAt.slice(0, 10))}` : ""}.</p>` : ""}
${d.notes.map((n) => `<p class="note">${esc(n)}</p>`).join("")}</main></body></html>`;
}

export async function countDocuments(db: Db = pool): Promise<number> {
  return Number((await first<{ n: number }>(db, "SELECT COUNT(*) AS n FROM pay_invoices"))?.n ?? 0);
}

