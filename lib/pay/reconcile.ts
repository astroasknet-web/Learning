import { audit } from "./audit";
import { dbTime, exec, first, insertId, pool, rows, type Row } from "./db";
import { alertStaff } from "./notify";
import { allProviders, getProvider } from "./providers";
import type { ProviderPayment } from "./providers/types";
import { settlePayment } from "./settle";

/**
 * Reconciliation: compare what the provider says happened in a time window with what our database says, and report every difference.
 *
 *   missing_internal   the provider took a payment for one of our orders and we have no record of it
 *   missing_provider   we think a payment succeeded and the provider has no such payment
 *   status_mismatch    the provider and we disagree about success or failure (a provider "succeeded" is healed by settling it)
 *   amount_mismatch    amount or currency differ
 *   refund_mismatch    the provider has refunded a different total than we recorded
 *   stale_pending      a payment has been waiting far longer than a checkout can last
 *
 * Only provider payments that carry one of our order ids are considered, so the older Studio/CRM payments on the same Razorpay account are left alone.
 */
export interface ReconcileReport { runId: number; provider: string; checked: number; mismatches: number }

const OK_STATES = ["succeeded", "partially_refunded", "refunded", "disputed"];

async function addItem(runId: number, kind: string, detail: string, providerRef: string | null, paymentId: number | null): Promise<void> {
  await insertId(pool, "INSERT INTO pay_reconciliation_items (run_id, kind, provider_ref, payment_id, detail) VALUES ($1,$2,$3,$4,$5)", [runId, kind, providerRef, paymentId, detail.slice(0, 480)]);
}

export async function reconcileProvider(providerId: string, window: { from: Date; to: Date }, startedBy: string = "system"): Promise<ReconcileReport> {
  const provider = getProvider(providerId);
  if (!provider || !provider.configured()) throw new Error(`Provider ${providerId} is not configured`);
  const runId = await insertId(pool, "INSERT INTO pay_reconciliation_runs (provider, from_at, to_at, status, started_by) VALUES ($1,$2,$3,'running',$4)", [provider.id, dbTime(window.from), dbTime(window.to), startedBy]);
  let checked = 0;
  let mismatches = 0;
  const flag = async (kind: string, detail: string, ref: string | null, pid: number | null) => { mismatches++; await addItem(runId, kind, detail, ref, pid); };
  try {
    const theirs: ProviderPayment[] = (await provider.reconcilePayment(window)).filter((p) => p.orderPublicId && p.orderPublicId.startsWith("ord_"));
    const seen = new Set<number>();
    for (const t of theirs) {
      checked++;
      const ours = await first(pool, "SELECT * FROM pay_payments WHERE provider = $1 AND (provider_session_ref = $2 OR provider_payment_ref = $3)", [provider.id, t.sessionRef, t.paymentRef ?? ""]);
      if (!ours) {
        if (t.status === "succeeded") await flag("missing_internal", `The provider has a successful payment for order ${t.orderPublicId} that we have no payment record for.`, t.paymentRef ?? t.sessionRef, null);
        continue;
      }
      seen.add(Number(ours.id));
      if (t.amountMinor !== Number(ours.amount_minor) || t.currency !== String(ours.currency).toUpperCase()) { await flag("amount_mismatch", `Order ${t.orderPublicId}: provider ${t.amountMinor} ${t.currency}, ours ${ours.amount_minor} ${ours.currency}.`, t.paymentRef ?? t.sessionRef, Number(ours.id)); continue; }
      const oursOk = OK_STATES.includes(ours.status);
      if (t.status === "succeeded" && !oursOk) {
        await flag("status_mismatch", `Order ${t.orderPublicId}: the provider says paid, we said ${ours.status}. Settling it now.`, t.paymentRef ?? t.sessionRef, Number(ours.id));
        try { await settlePayment(Number(ours.id), { actor: "system", via: "reconcile" }); await exec(pool, "UPDATE pay_reconciliation_items SET resolved = 1, resolved_at = $1 WHERE run_id = $2 AND payment_id = $3 AND kind = 'status_mismatch'", [dbTime(), runId, ours.id]); } catch { /* left open for a person */ }
      } else if ((t.status === "failed" || t.status === "expired" || t.status === "cancelled") && oursOk) {
        await flag("status_mismatch", `Order ${t.orderPublicId}: we recorded a successful payment but the provider says ${t.status}. Check before delivering anything further.`, t.paymentRef ?? t.sessionRef, Number(ours.id));
      } else if (oursOk && t.refundedMinor !== Number(ours.refunded_minor) && !(await first(pool, "SELECT id FROM pay_refunds WHERE payment_id = $1 AND status IN ('requested','pending') LIMIT 1", [ours.id]))) {
        await flag("refund_mismatch", `Order ${t.orderPublicId}: the provider shows ${t.refundedMinor} refunded, we recorded ${ours.refunded_minor}.`, t.paymentRef ?? t.sessionRef, Number(ours.id));
      }
    }
    const mine = await rows(pool, "SELECT * FROM pay_payments WHERE provider = $1 AND created_at BETWEEN $2 AND $3 AND provider_session_ref NOT LIKE 'pending\\_%'", [provider.id, dbTime(window.from), dbTime(window.to)]);
    for (const m of mine) {
      if (seen.has(Number(m.id))) continue;
      checked++;
      const ageMin = (Date.now() - new Date(String(m.created_at).replace(" ", "T") + "Z").getTime()) / 60_000;
      if (OK_STATES.includes(m.status)) await flag("missing_provider", `Payment ${m.id} is recorded as ${m.status} but the provider returned no matching payment in this window.`, m.provider_session_ref, Number(m.id));
      else if ((m.status === "pending" || m.status === "created") && ageMin > 26 * 60) await flag("stale_pending", `Payment ${m.id} has been ${m.status} for ${Math.round(ageMin / 60)} hours.`, m.provider_session_ref, Number(m.id));
    }
    await exec(pool, "UPDATE pay_reconciliation_runs SET status = $1, checked = $2, mismatches = $3, finished_at = $4 WHERE id = $5", [mismatches ? "mismatches" : "ok", checked, mismatches, dbTime(), runId]);
    await audit({ actorType: startedBy === "system" ? "system" : "staff", actorId: startedBy, action: "reconciliation.finished", entity: "reconciliation", entityId: runId, detail: { provider: provider.id, checked, mismatches } });
    if (mismatches) await alertStaff("Reconciliation found differences", [`${provider.label}: ${mismatches} difference(s) in ${checked} payments checked.`, "Open Reconciliation in the console to see each one."]);
    return { runId, provider: provider.id, checked, mismatches };
  } catch (e) {
    await exec(pool, "UPDATE pay_reconciliation_runs SET status = 'failed', error = $1, finished_at = $2 WHERE id = $3", [(e as Error).message.slice(0, 480), dbTime(), runId]);
    throw e;
  }
}

export async function reconcileAll(hours: number, startedBy = "system"): Promise<ReconcileReport[]> {
  const to = new Date();
  const from = new Date(to.getTime() - hours * 3_600_000);
  const out: ReconcileReport[] = [];
  for (const p of allProviders().filter((x) => x.configured())) {
    try { out.push(await reconcileProvider(p.id, { from, to }, startedBy)); } catch (e) { console.error(`[pay] reconcile ${p.id} failed:`, (e as Error).message); }
  }
  return out;
}

export async function listRuns(limit = 30): Promise<Row[]> {
  return rows(pool, `SELECT * FROM pay_reconciliation_runs ORDER BY id DESC LIMIT ${Math.min(100, Math.max(1, limit))}`);
}
export async function listItems(runId: number): Promise<Row[]> {
  return rows(pool, "SELECT * FROM pay_reconciliation_items WHERE run_id = $1 ORDER BY id", [runId]);
}
export async function resolveItem(itemId: number, staffUserId: number): Promise<void> {
  await exec(pool, "UPDATE pay_reconciliation_items SET resolved = 1, resolved_by = $1, resolved_at = $2 WHERE id = $3", [staffUserId, dbTime(), itemId]);
  await audit({ actorType: "staff", actorId: staffUserId, action: "reconciliation.item_resolved", entity: "reconciliation", entityId: itemId });
}
