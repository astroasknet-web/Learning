import { audit } from "./audit";
import { exec, first, fromDb, pool, rows, insertId, dbTime, type Row } from "./db";
import { isCurrencyCode, MAX_MINOR } from "./money";
import { PayError } from "./orders";
import { listRefunds } from "./refunds";
import { getDocuments } from "./invoices";

/** Queries and edits for the payment console. Every function here is called only after the API layer has checked the staff member's permission. */
export interface PaymentRow {
  orderId: string; email: string; name: string; status: string; currency: string; totalMinor: number; refundedMinor: number; taxMinor: number;
  provider: string | null; paymentStatus: string | null; providerRef: string | null; method: string | null; createdAt: string; paidAt: string | null;
}

export interface SearchParams { q?: string; status?: string; provider?: string; currency?: string; from?: string; to?: string; page: number; perPage: number }

const likeEscape = (s: string): string => s.replace(/[\\%_]/g, (c) => "\\" + c);
const iso = (s: string | null): string | null => fromDb(s)?.toISOString() ?? null;

function where(p: Omit<SearchParams, "page" | "perPage">): { sql: string; params: unknown[] } {
  const w: string[] = [];
  const params: unknown[] = [];
  const add = (cond: string, v: unknown) => { params.push(v); w.push(cond.replace("?", `$${params.length}`)); };
  if (p.status) add("o.status = ?", p.status);
  if (p.currency && isCurrencyCode(p.currency.toUpperCase())) add("o.currency = ?", p.currency.toUpperCase());
  if (p.provider) add("EXISTS (SELECT 1 FROM pay_payments px WHERE px.order_id = o.id AND px.provider = ?)", p.provider);
  if (p.from) add("o.created_at >= ?", dbTime(new Date(p.from)));
  if (p.to) add("o.created_at < ?", dbTime(new Date(new Date(p.to).getTime() + 86_400_000)));
  if (p.q && p.q.trim()) {
    const like = `%${likeEscape(p.q.trim().slice(0, 100))}%`;
    params.push(like);
    const i = `$${params.length}`;
    w.push(`(o.public_id LIKE ${i} OR o.email LIKE ${i} OR o.billing_name LIKE ${i} OR EXISTS (SELECT 1 FROM pay_payments pq WHERE pq.order_id = o.id AND (pq.provider_session_ref LIKE ${i} OR pq.provider_payment_ref LIKE ${i})))`);
  }
  return { sql: w.length ? "WHERE " + w.join(" AND ") : "", params };
}

export async function searchPayments(p: SearchParams): Promise<{ rows: PaymentRow[]; total: number }> {
  const { sql, params } = where(p);
  const total = Number((await first<{ n: number }>(pool, `SELECT COUNT(*) AS n FROM pay_orders o ${sql}`, params))?.n ?? 0);
  const limit = Math.min(200, Math.max(1, Math.trunc(p.perPage)));
  const offset = (Math.max(1, Math.trunc(p.page)) - 1) * limit;
  const list = await rows(pool,
    `SELECT o.*, (SELECT provider FROM pay_payments x WHERE x.order_id = o.id ORDER BY x.id DESC LIMIT 1) AS provider, (SELECT status FROM pay_payments x WHERE x.order_id = o.id ORDER BY x.id DESC LIMIT 1) AS pstatus,
            (SELECT COALESCE(provider_payment_ref, provider_session_ref) FROM pay_payments x WHERE x.order_id = o.id ORDER BY x.id DESC LIMIT 1) AS pref, (SELECT method FROM pay_payments x WHERE x.order_id = o.id ORDER BY x.id DESC LIMIT 1) AS pmethod
       FROM pay_orders o ${sql} ORDER BY o.id DESC LIMIT ${limit} OFFSET ${offset}`, params);
  return {
    total,
    rows: list.map((o) => ({ orderId: o.public_id, email: o.email, name: o.billing_name, status: o.status, currency: o.currency, totalMinor: Number(o.total_minor), refundedMinor: Number(o.refunded_minor), taxMinor: Number(o.tax_minor), provider: o.provider, paymentStatus: o.pstatus, providerRef: o.pref, method: o.pmethod, createdAt: iso(o.created_at) as string, paidAt: iso(o.paid_at) })),
  };
}

export async function orderDetail(publicId: string) {
  const o = await first(pool, "SELECT * FROM pay_orders WHERE public_id = $1", [publicId]);
  if (!o) throw new PayError("order_not_found", "Order not found.", 404);
  const items = await rows(pool, "SELECT * FROM pay_order_items WHERE order_id = $1 ORDER BY id", [o.id]);
  const payments = await rows(pool, "SELECT * FROM pay_payments WHERE order_id = $1 ORDER BY id", [o.id]);
  const refunds = await listRefunds(Number(o.id));
  const disputes = await rows(pool, "SELECT * FROM pay_disputes WHERE order_id = $1 ORDER BY id", [o.id]);
  const docs = await getDocuments(Number(o.id));
  const ents = await rows(pool, "SELECT id, kind, ref, status, starts_at, expires_at, revoke_reason FROM pay_entitlements WHERE order_id = $1", [o.id]);
  const refs = [...payments.map((p) => p.provider_session_ref), ...payments.map((p) => p.provider_payment_ref)].filter(Boolean) as string[];
  const hooks = refs.length ? await rows(pool, `SELECT id, provider, event_id, type, status, attempts, last_error, received_at, processed_at FROM pay_webhook_events WHERE ${refs.map((_, i) => `payload LIKE $${i + 1}`).join(" OR ")} ORDER BY id DESC LIMIT 50`, refs.map((r) => `%"${r.replace(/"/g, "").replace(/[\\%_]/g, (c) => "\\" + c)}"%`)) : [];
  const timeline = await rows(pool, "SELECT at, actor_type, actor_id, action, entity, entity_id, detail FROM pay_audit_events WHERE (entity = 'order' AND entity_id = $1) OR (entity = 'payment' AND entity_id IN ($2)) OR (entity = 'refund' AND entity_id IN ($3)) ORDER BY id ASC LIMIT 200", [publicId, payments.map((p) => String(p.id)).concat(["-"]), refunds.map((r) => r.public_id).concat(["-"])]);
  return {
    order: { id: o.public_id, status: o.status, email: o.email, name: o.billing_name, country: o.country, currency: o.currency, subtotalMinor: Number(o.subtotal_minor), discountMinor: Number(o.discount_minor), taxMinor: Number(o.tax_minor), totalMinor: Number(o.total_minor), refundedMinor: Number(o.refunded_minor), taxName: o.tax_name, taxInclusive: !!o.tax_inclusive, coupon: o.coupon_code, createdAt: iso(o.created_at), paidAt: iso(o.paid_at), fulfilledAt: iso(o.fulfilled_at), userId: o.user_id },
    items: items.map((i) => ({ sku: i.sku, title: i.title, qty: Number(i.qty), unitMinor: Number(i.unit_minor), totalMinor: Number(i.total_minor) })),
    payments: payments.map((p) => ({ id: Number(p.id), provider: p.provider, status: p.status, amountMinor: Number(p.amount_minor), refundedMinor: Number(p.refunded_minor), method: p.method, sessionRef: p.provider_session_ref, paymentRef: p.provider_payment_ref, failureCode: p.failure_code, failureMessage: p.failure_message, createdAt: iso(p.created_at), settledAt: iso(p.settled_at) })),
    refunds: refunds.map((r) => ({ id: r.public_id, status: r.status, amountMinor: Number(r.amount_minor), currency: r.currency, reason: r.reason, ref: r.provider_refund_ref, requestedBy: r.requested_by, failureMessage: r.failure_message, createdAt: iso(r.created_at) })),
    disputes: disputes.map((d) => ({ ref: d.provider_dispute_ref, status: d.status, reason: d.reason, amountMinor: Number(d.amount_minor), currency: d.currency, respondBy: iso(d.respond_by) })),
    documents: docs.map((d) => ({ number: d.number, kind: d.kind, issuedAt: d.issuedAt })),
    entitlements: ents.map((e) => ({ kind: e.kind, ref: e.ref, status: e.status, expiresAt: iso(e.expires_at), revokeReason: e.revoke_reason })),
    webhooks: hooks.map((h) => ({ id: Number(h.id), provider: h.provider, eventId: h.event_id, type: h.type, status: h.status, attempts: Number(h.attempts), lastError: h.last_error, receivedAt: iso(h.received_at), processedAt: iso(h.processed_at) })),
    timeline: timeline.map((t) => ({ at: iso(t.at), actorType: t.actor_type, actorId: t.actor_id, action: t.action, detail: t.detail ? JSON.parse(t.detail) : null })),
  };
}

/**
 * Money totals, one block per currency (currencies are never added together).
 *   gross     what customers paid for orders that reached "paid" (before refunds)
 *   refunded  refunds that the provider confirmed
 *   net       gross minus refunded
 *   tax       tax included in or added to the gross amount
 */
export async function summary(p: { from?: string; to?: string }) {
  const params: unknown[] = [];
  const cond: string[] = ["o.paid_at IS NOT NULL"];
  if (p.from) { params.push(dbTime(new Date(p.from))); cond.push(`o.paid_at >= $${params.length}`); }
  if (p.to) { params.push(dbTime(new Date(new Date(p.to).getTime() + 86_400_000))); cond.push(`o.paid_at < $${params.length}`); }
  const paid = await rows<Row>(pool, `SELECT o.currency, COUNT(*) AS orders, SUM(o.total_minor) AS gross, SUM(o.tax_minor) AS tax FROM pay_orders o WHERE ${cond.join(" AND ")} GROUP BY o.currency`, params);
  const refParams: unknown[] = [];
  const refCond: string[] = ["r.status = 'succeeded'"];
  if (p.from) { refParams.push(dbTime(new Date(p.from))); refCond.push(`r.created_at >= $${refParams.length}`); }
  if (p.to) { refParams.push(dbTime(new Date(new Date(p.to).getTime() + 86_400_000))); refCond.push(`r.created_at < $${refParams.length}`); }
  const refunded = await rows<Row>(pool, `SELECT r.currency, COUNT(*) AS refunds, SUM(r.amount_minor) AS amount FROM pay_refunds r WHERE ${refCond.join(" AND ")} GROUP BY r.currency`, refParams);
  const cParams: unknown[] = [];
  const cCond: string[] = ["1=1"];
  if (p.from) { cParams.push(dbTime(new Date(p.from))); cCond.push(`created_at >= $${cParams.length}`); }
  if (p.to) { cParams.push(dbTime(new Date(new Date(p.to).getTime() + 86_400_000))); cCond.push(`created_at < $${cParams.length}`); }
  const counts = await rows<Row>(pool, `SELECT status, COUNT(*) AS n FROM pay_orders WHERE ${cCond.join(" AND ")} GROUP BY status`, cParams);
  const currencies = [...new Set([...paid.map((x) => x.currency), ...refunded.map((x) => x.currency)])].sort();
  return {
    byCurrency: currencies.map((c) => {
      const a = paid.find((x) => x.currency === c);
      const r = refunded.find((x) => x.currency === c);
      const gross = Number(a?.gross ?? 0);
      const ref = Number(r?.amount ?? 0);
      return { currency: c, paidOrders: Number(a?.orders ?? 0), grossMinor: gross, refundedMinor: ref, netMinor: gross - ref, taxMinor: Number(a?.tax ?? 0), refunds: Number(r?.refunds ?? 0) };
    }),
    orders: Object.fromEntries(counts.map((x) => [x.status, Number(x.n)])),
  };
}

export async function listWebhooks(p: { status?: string; page: number; perPage: number }) {
  const params: unknown[] = [];
  let w = "";
  if (p.status) { params.push(p.status); w = "WHERE status = $1"; }
  const total = Number((await first<{ n: number }>(pool, `SELECT COUNT(*) AS n FROM pay_webhook_events ${w}`, params))?.n ?? 0);
  const limit = Math.min(200, Math.max(1, p.perPage));
  const list = await rows(pool, `SELECT id, provider, event_id, type, status, attempts, last_error, received_at, processed_at FROM pay_webhook_events ${w} ORDER BY id DESC LIMIT ${limit} OFFSET ${(Math.max(1, p.page) - 1) * limit}`, params);
  return { total, rows: list.map((h) => ({ id: Number(h.id), provider: h.provider, eventId: h.event_id, type: h.type, status: h.status, attempts: Number(h.attempts), lastError: h.last_error, receivedAt: iso(h.received_at), processedAt: iso(h.processed_at) })) };
}

export async function listAudit(p: { entity?: string; entityId?: string; page: number; perPage: number }) {
  const params: unknown[] = [];
  const w: string[] = [];
  if (p.entity) { params.push(p.entity); w.push(`entity = $${params.length}`); }
  if (p.entityId) { params.push(p.entityId); w.push(`entity_id = $${params.length}`); }
  const where = w.length ? "WHERE " + w.join(" AND ") : "";
  const total = Number((await first<{ n: number }>(pool, `SELECT COUNT(*) AS n FROM pay_audit_events ${where}`, params))?.n ?? 0);
  const limit = Math.min(200, Math.max(1, p.perPage));
  const list = await rows(pool, `SELECT id, at, actor_type, actor_id, action, entity, entity_id, detail FROM pay_audit_events ${where} ORDER BY id DESC LIMIT ${limit} OFFSET ${(Math.max(1, p.page) - 1) * limit}`, params);
  return { total, rows: list.map((a) => ({ id: Number(a.id), at: iso(a.at), actorType: a.actor_type, actorId: a.actor_id, action: a.action, entity: a.entity, entityId: a.entity_id, detail: a.detail ? JSON.parse(a.detail) : null })) };
}

/** Add or change a price. Prices are explicit per currency; there is no automatic conversion. */
export async function setPrice(staffId: number, sku: string, currency: string, amountMinor: number, taxInclusive: boolean, active: boolean): Promise<void> {
  const cur = currency.toUpperCase();
  if (!isCurrencyCode(cur)) throw new PayError("bad_currency", "Use a three-letter currency code.", 400);
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 0 || amountMinor > MAX_MINOR) throw new PayError("bad_amount", "The amount is not valid.", 400);
  const enabled = await first(pool, "SELECT code FROM pay_currencies WHERE code = $1 AND enabled = 1", [cur]);
  if (!enabled) throw new PayError("currency_disabled", `${cur} is not enabled. Enable it first.`, 400);
  const p = await first(pool, "SELECT id FROM pay_products WHERE sku = $1", [sku]);
  if (!p) throw new PayError("unknown_item", "No such product.", 404);
  const before = await first(pool, "SELECT amount_minor, tax_inclusive, active FROM pay_prices WHERE product_id = $1 AND currency = $2", [p.id, cur]);
  await exec(pool, "INSERT INTO pay_prices (product_id, currency, amount_minor, tax_inclusive, active) VALUES ($1,$2,$3,$4,$5) ON DUPLICATE KEY UPDATE amount_minor = VALUES(amount_minor), tax_inclusive = VALUES(tax_inclusive), active = VALUES(active)", [p.id, cur, amountMinor, taxInclusive ? 1 : 0, active ? 1 : 0]);
  await audit({ actorType: "staff", actorId: staffId, action: "price.set", entity: "price", entityId: `${sku}:${cur}`, detail: { before: before ? { amountMinor: Number(before.amount_minor), taxInclusive: !!before.tax_inclusive, active: !!before.active } : null, after: { amountMinor, taxInclusive, active } } });
}

export interface NewProduct { sku: string; kind: string; title: string; description?: string; fulfilRef?: string; accessDays?: number | null; allowGuest?: boolean }

/** Add a product. It starts on sale with no price, so it cannot be bought until a price is added. Existing SKUs are never overwritten. */
export async function createProduct(staffId: number, p: NewProduct): Promise<void> {
  const sku = p.sku.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9_.-]{1,79}$/.test(sku)) throw new PayError("bad_sku", "The code may use letters, numbers, dots, dashes and underscores (2 to 80 characters).", 400);
  if (!["plan", "course", "ebook", "resume", "class", "consulting", "other"].includes(p.kind)) throw new PayError("bad_kind", "Pick a product type from the list.", 400);
  if (p.title.trim().length < 2) throw new PayError("bad_title", "Give the product a name.", 400);
  if (p.accessDays != null && (!Number.isInteger(p.accessDays) || p.accessDays < 1 || p.accessDays > 3650)) throw new PayError("bad_days", "Access days must be a whole number from 1 to 3650, or empty for lifetime.", 400);
  if (await first(pool, "SELECT id FROM pay_products WHERE sku = $1", [sku])) throw new PayError("sku_exists", "A product with this code already exists.", 409);
  await exec(pool, "INSERT INTO pay_products (sku, kind, title, description, fulfil_ref, access_days, active, allow_guest, max_qty) VALUES ($1,$2,$3,$4,$5,$6,1,$7,1)", [sku, p.kind, p.title.trim().slice(0, 190), (p.description ?? "").slice(0, 500), (p.fulfilRef ?? sku).trim().slice(0, 120), p.accessDays ?? null, p.allowGuest ? 1 : 0]);
  await audit({ actorType: "staff", actorId: staffId, action: "product.created", entity: "price", entityId: sku, detail: { kind: p.kind, title: p.title.trim(), accessDays: p.accessDays ?? null } });
}

export async function setProductActive(staffId: number, sku: string, active: boolean): Promise<void> {
  const n = await exec(pool, "UPDATE pay_products SET active = $1 WHERE sku = $2", [active ? 1 : 0, sku]);
  if (!n) throw new PayError("unknown_item", "No such product.", 404);
  await audit({ actorType: "staff", actorId: staffId, action: active ? "product.enabled" : "product.disabled", entity: "price", entityId: sku });
}

export async function setCurrencyEnabled(staffId: number, code: string, enabled: boolean): Promise<void> {
  const cur = code.toUpperCase();
  if (!isCurrencyCode(cur)) throw new PayError("bad_currency", "Use a three-letter currency code.", 400);
  await exec(pool, "INSERT INTO pay_currencies (code, minor_units, symbol, enabled) VALUES ($1, 2, '', $2) ON DUPLICATE KEY UPDATE enabled = VALUES(enabled)", [cur, enabled ? 1 : 0]);
  await audit({ actorType: "staff", actorId: staffId, action: "currency.set", entity: "price", entityId: cur, detail: { enabled } });
}

export async function setTaxRule(staffId: number, country: string, name: string, rateBp: number, active: boolean): Promise<void> {
  if (!/^[A-Za-z]{2}$/.test(country) || rateBp < 0 || rateBp > 10_000 || !Number.isInteger(rateBp)) throw new PayError("bad_tax_rule", "Check the country and the rate.", 400);
  await exec(pool, "INSERT INTO pay_tax_rules (country, name, rate_bp, active) VALUES ($1,$2,$3,$4) ON DUPLICATE KEY UPDATE name = VALUES(name), rate_bp = VALUES(rate_bp), active = VALUES(active)", [country.toUpperCase(), name.slice(0, 40), rateBp, active ? 1 : 0]);
  await audit({ actorType: "staff", actorId: staffId, action: "tax_rule.set", entity: "price", entityId: country.toUpperCase(), detail: { name, rateBp, active } });
}

export interface CouponInput { code: string; kind: "percent" | "fixed"; percentBp?: number; fixedMinor?: number; currency?: string; maxRedemptions?: number | null; perUserLimit?: number; startsAt?: string | null; endsAt?: string | null; skus?: string[] | null }

export async function createCoupon(staffId: number, c: CouponInput): Promise<void> {
  const code = c.code.trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,40}$/.test(code)) throw new PayError("bad_code", "A code is 3 to 40 letters, numbers, dashes or underscores.", 400);
  if (c.kind === "percent" && !(c.percentBp && c.percentBp > 0 && c.percentBp <= 10_000)) throw new PayError("bad_discount", "A percent coupon needs 0.01 to 100 percent.", 400);
  if (c.kind === "fixed" && !(c.fixedMinor && c.fixedMinor > 0 && c.currency && isCurrencyCode(c.currency.toUpperCase()))) throw new PayError("bad_discount", "A fixed coupon needs an amount and a currency.", 400);
  await insertId(pool, "INSERT INTO pay_coupons (code, kind, percent_bp, fixed_minor, currency, max_redemptions, per_user_limit, starts_at, ends_at, skus, active) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,1)", [code, c.kind, c.kind === "percent" ? c.percentBp : null, c.kind === "fixed" ? c.fixedMinor : null, c.kind === "fixed" ? c.currency?.toUpperCase() : null, c.maxRedemptions ?? null, c.perUserLimit ?? 1, c.startsAt ? dbTime(new Date(c.startsAt)) : null, c.endsAt ? dbTime(new Date(c.endsAt)) : null, c.skus?.length ? c.skus.join(",") : null]);
  await audit({ actorType: "staff", actorId: staffId, action: "coupon.created", entity: "coupon", entityId: code, detail: { kind: c.kind } });
}

export async function setCouponActive(staffId: number, code: string, active: boolean): Promise<void> {
  const n = await exec(pool, "UPDATE pay_coupons SET active = $1 WHERE code = $2", [active ? 1 : 0, code.toUpperCase()]);
  if (!n) throw new PayError("not_found", "No such coupon.", 404);
  await audit({ actorType: "staff", actorId: staffId, action: active ? "coupon.enabled" : "coupon.disabled", entity: "coupon", entityId: code.toUpperCase() });
}

export async function grantStaff(adminId: number, userId: number, role: "support" | "finance" | "admin" | null): Promise<void> {
  if (role === null) await exec(pool, "DELETE FROM pay_staff WHERE user_id = $1", [userId]);
  else await exec(pool, "INSERT INTO pay_staff (user_id, role, granted_by) VALUES ($1,$2,$3) ON DUPLICATE KEY UPDATE role = VALUES(role), granted_by = VALUES(granted_by)", [userId, role, adminId]);
  await audit({ actorType: "staff", actorId: adminId, action: role ? "staff.granted" : "staff.revoked", entity: "staff", entityId: userId, detail: { role } });
}
