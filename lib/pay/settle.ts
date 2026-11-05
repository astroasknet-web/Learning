import { auditIn, audit, type ActorType } from "./audit";
import { dbTime, exec, first, pool, rows, tx, txRetry, type Db, type Row } from "./db";
import { fulfilOrder, revokeOrderEntitlements } from "./fulfil";
import { issueDocument } from "./invoices";
import { alertStaff, paymentFailed, paymentReceived } from "./notify";
import { getProvider } from "./providers";
import type { ProviderDispute, ProviderEvent, ProviderPayment } from "./providers/types";
import { ProviderError } from "./providers/types";
import { assertTransition, derivePaymentStatus, deriveOrderStatus, type OrderStatus, type PaymentStatus } from "./state";

/**
 * Settlement: the only place that decides a payment succeeded.
 *
 * A webhook or a browser callback is only a hint to look. Every path ends in `settlePayment`, which
 *   1. asks the provider's API for the payment (never trusts the event body or the browser),
 *   2. checks the provider's answer against our order: same order id, same amount, same currency,
 *   3. applies the result in one transaction with the order row locked, so two requests at once cannot both fulfil it.
 * Out-of-order or repeated deliveries are harmless: a payment that already succeeded never moves back, and fulfilment is keyed on the order item.
 */
export interface Ctx { actor: ActorType; actorId?: string | number | null; via: "webhook" | "confirm" | "cron" | "reconcile" | "staff" }
export interface Outcome { orderStatus: OrderStatus; paymentStatus: PaymentStatus; newlyPaid: boolean; mismatch?: string }

export class PaymentMismatch extends Error {}

const SUCCESS_STATES = ["succeeded", "partially_refunded", "refunded", "disputed"];

async function afterCommit(fns: Array<() => Promise<void>>): Promise<void> {
  for (const f of fns) {
    try { await f(); } catch (e) { console.error("[pay] post-commit step failed:", (e as Error).message); }
  }
}

export async function findPaymentFor(ev: Pick<ProviderEvent, "provider" | "sessionRef" | "paymentRef" | "orderPublicId">, db: Db = pool): Promise<Row | null> {
  if (ev.sessionRef) {
    const p = await first(db, "SELECT * FROM pay_payments WHERE provider = $1 AND provider_session_ref = $2", [ev.provider, ev.sessionRef]);
    if (p) return p;
  }
  if (ev.paymentRef) {
    const p = await first(db, "SELECT * FROM pay_payments WHERE provider = $1 AND provider_payment_ref = $2", [ev.provider, ev.paymentRef]);
    if (p) return p;
  }
  if (ev.orderPublicId) {
    return first(db, "SELECT p.* FROM pay_payments p JOIN pay_orders o ON o.id = p.order_id WHERE o.public_id = $1 AND p.provider = $2 ORDER BY p.id DESC LIMIT 1", [ev.orderPublicId, ev.provider]);
  }
  return null;
}

/** Fetch the provider's view, verify it, and apply it. Throws ProviderError (retryable or not) when the provider cannot be asked. */
export async function settlePayment(paymentId: number, ctx: Ctx): Promise<Outcome> {
  const p = await first(pool, "SELECT * FROM pay_payments WHERE id = $1", [paymentId]);
  if (!p) throw new Error("Payment not found");
  const order = (await first(pool, "SELECT * FROM pay_orders WHERE id = $1", [p.order_id])) as Row;
  const provider = getProvider(p.provider);
  if (!provider) throw new ProviderError(`Unknown provider ${p.provider}`, "stripe", false, "unknown_provider");

  let truth = await provider.retrievePayment({ sessionRef: p.provider_session_ref, paymentRef: p.provider_payment_ref });
  if (truth.status === "authorized") {
    // Money is held but not taken: capture exactly the order amount, then look again.
    if (truth.paymentRef && truth.amountMinor === Number(p.amount_minor) && truth.currency === p.currency) {
      await provider.capturePayment({ paymentRef: truth.paymentRef, amountMinor: Number(p.amount_minor), currency: p.currency });
      truth = await provider.retrievePayment({ sessionRef: p.provider_session_ref, paymentRef: truth.paymentRef });
    }
  }

  const problem = verifyTruth(truth, p, order);
  if (problem) {
    await audit({ actorType: ctx.actor, actorId: ctx.actorId ?? null, action: "payment.mismatch", entity: "payment", entityId: p.id, detail: { problem, provider: p.provider, order: order.public_id } });
    await alertStaff("Payment did not match its order", [`Order ${order.public_id}: ${problem}.`, "The order was not fulfilled. Check the payment in the provider's dashboard."]);
    return { orderStatus: order.status, paymentStatus: p.status, newlyPaid: false, mismatch: problem };
  }
  return applyProviderTruth(Number(p.id), truth, ctx);
}

/** Does the provider's payment belong to this order, for this amount and currency? Returns a description of the problem, or null. */
export function verifyTruth(t: ProviderPayment, p: Row, o: Row): string | null {
  if (t.orderPublicId !== null && t.orderPublicId !== o.public_id) return "the provider's payment belongs to a different order";
  if (t.status === "succeeded" && t.orderPublicId === null) return "the provider's payment is not linked to an order";
  if (t.amountMinor !== Number(p.amount_minor)) return `amount differs (provider ${t.amountMinor}, order ${p.amount_minor})`;
  if (t.currency !== String(p.currency).toUpperCase()) return `currency differs (provider ${t.currency}, order ${p.currency})`;
  return null;
}

export async function applyProviderTruth(paymentId: number, truth: ProviderPayment, ctx: Ctx): Promise<Outcome> {
  let later: Array<() => Promise<void>> = [];
  const result = await txRetry(async (db): Promise<Outcome> => {
    later = []; // a retried transaction starts again from nothing
    const probe = (await first(db, "SELECT order_id FROM pay_payments WHERE id = $1", [paymentId])) as Row;
    const order = (await first(db, "SELECT * FROM pay_orders WHERE id = $1 FOR UPDATE", [probe.order_id])) as Row; // order first, then payment: one lock order everywhere
    const pay = (await first(db, "SELECT * FROM pay_payments WHERE id = $1 FOR UPDATE", [paymentId])) as Row;
    const actor = { actorType: ctx.actor, actorId: ctx.actorId ?? null } as const;

    if (truth.paymentRef && !pay.provider_payment_ref) await exec(db, "UPDATE pay_payments SET provider_payment_ref = $1 WHERE id = $2", [truth.paymentRef, pay.id]);
    if (truth.method && truth.method !== pay.method) await exec(db, "UPDATE pay_payments SET method = $1 WHERE id = $2", [truth.method, pay.id]);

    if (truth.status === "succeeded") {
      if (SUCCESS_STATES.includes(pay.status)) return { orderStatus: order.status, paymentStatus: pay.status, newlyPaid: false };
      assertTransition("payment", pay.status, "succeeded");
      await exec(db, "UPDATE pay_payments SET status = 'succeeded', settled_at = $1, failure_code = NULL, failure_message = NULL WHERE id = $2", [dbTime(), pay.id]);
      await auditIn(db, { ...actor, action: "payment.succeeded", entity: "payment", entityId: pay.id, detail: { via: ctx.via, provider: pay.provider, amountMinor: Number(pay.amount_minor), currency: pay.currency, order: order.public_id } });

      const other = await first(db, "SELECT id FROM pay_payments WHERE order_id = $1 AND id <> $2 AND status IN ('succeeded','partially_refunded','refunded','disputed') LIMIT 1", [order.id, pay.id]);
      if (other) {
        await auditIn(db, { ...actor, action: "payment.duplicate", entity: "order", entityId: order.public_id, detail: { paymentId: pay.id } });
        later.push(() => alertStaff("Duplicate payment on one order", [`Order ${order.public_id} has been paid twice (payments ${other.id} and ${pay.id}).`, "Consider refunding one of them from the console."]));
        return { orderStatus: order.status, paymentStatus: "succeeded", newlyPaid: false };
      }

      if (order.status !== "paid" && order.status !== "fulfilled") {
        assertTransition("order", order.status, "paid");
        await exec(db, "UPDATE pay_orders SET status = 'paid', paid_at = $1 WHERE id = $2", [dbTime(), order.id]);
        await auditIn(db, { ...actor, action: "order.paid", entity: "order", entityId: order.public_id, detail: { late: order.status !== "pending" } });
      }
      const fresh = (await first(db, "SELECT * FROM pay_orders WHERE id = $1", [order.id])) as Row;
      const f = await fulfilOrder(db, fresh);
      assertTransition("order", "paid", "fulfilled");
      await exec(db, "UPDATE pay_orders SET status = 'fulfilled', fulfilled_at = $1 WHERE id = $2", [dbTime(), order.id]);
      await auditIn(db, { ...actor, action: "order.fulfilled", entity: "order", entityId: order.public_id, detail: { entitlements: f.granted } });
      const doc = await issueDocument(db, fresh);
      later.push(() => paymentReceived(fresh, doc.number));
      if (f.staffTasks.length) later.push(() => alertStaff("New paid order needs action", f.staffTasks));
      return { orderStatus: "fulfilled", paymentStatus: "succeeded", newlyPaid: true };
    }

    if (SUCCESS_STATES.includes(pay.status)) return { orderStatus: order.status, paymentStatus: pay.status, newlyPaid: false }; // a later "failed" or "expired" never undoes a success

    if (truth.status === "failed" || truth.status === "expired" || truth.status === "cancelled") {
      // A finished attempt ends only that attempt. The order stays open until it is paid, cancelled or its time runs out, so the customer can try again.
      const to: PaymentStatus = truth.status;
      if (pay.status !== to) {
        assertTransition("payment", pay.status, to);
        await exec(db, "UPDATE pay_payments SET status = $1, failure_code = COALESCE($2, failure_code), failure_message = COALESCE($3, failure_message) WHERE id = $4", [to, truth.failureCode ?? null, truth.failureMessage?.slice(0, 250) ?? null, pay.id]);
        await auditIn(db, { ...actor, action: `payment.${to}`, entity: "payment", entityId: pay.id, detail: { via: ctx.via, code: truth.failureCode ?? null } });
        if (to === "failed" && order.status === "pending") later.push(() => paymentFailed(order, truth.failureMessage ? "Reason: " + truth.failureMessage.slice(0, 160) : ""));
      }
      return { orderStatus: order.status, paymentStatus: to, newlyPaid: false };
    }
    if (pay.status === "created") {
      assertTransition("payment", "created", "pending");
      await exec(db, "UPDATE pay_payments SET status = 'pending' WHERE id = $1", [pay.id]);
    }
    return { orderStatus: order.status, paymentStatus: pay.status === "created" ? "pending" : pay.status, newlyPaid: false };
  });
  await afterCommit(later);
  return result;
}

/** A failed attempt that does not end the order (the customer can try another card). Only the diagnostics are stored. */
export async function recordAttemptFailure(paymentId: number, code: string | null | undefined, message: string | null | undefined): Promise<void> {
  await exec(pool, "UPDATE pay_payments SET failure_code = $1, failure_message = $2 WHERE id = $3 AND status IN ('created','pending')", [code?.slice(0, 80) ?? null, message?.slice(0, 250) ?? null, paymentId]);
  await audit({ actorType: "provider", action: "payment.attempt_failed", entity: "payment", entityId: paymentId, detail: { code } });
}

/**
 * Recompute money state from the facts (succeeded refunds, open disputes) and move the payment and order to the status that follows.
 * Called after every refund or dispute change, inside the caller's transaction. Returns whether the order is now fully refunded or lost.
 */
export async function recomputeFinancials(db: Db, orderId: number, actor: { type: ActorType; id?: string | number | null }): Promise<{ fullyRefunded: boolean; lost: boolean; orderStatus: OrderStatus }> {
  const order = (await first(db, "SELECT * FROM pay_orders WHERE id = $1 FOR UPDATE", [orderId])) as Row;
  const pays = await rows(db, "SELECT * FROM pay_payments WHERE order_id = $1 AND status IN ('succeeded','partially_refunded','refunded','disputed') FOR UPDATE", [orderId]);
  let refundedTotal = 0;
  let disputeOpen = false;
  let lost = false;
  for (const p of pays) {
    const refunded = Math.min(Number(p.amount_minor), Number((await first<{ s: number | null }>(db, "SELECT COALESCE(SUM(amount_minor),0) AS s FROM pay_refunds WHERE payment_id = $1 AND status = 'succeeded'", [p.id]))?.s ?? 0));
    const d = await rows<{ status: string }>(db, "SELECT status FROM pay_disputes WHERE payment_id = $1", [p.id]);
    const isLost = d.some((x) => x.status === "lost");
    const open = d.some((x) => x.status === "open" || x.status === "under_review") || isLost; // a lost dispute keeps the payment and order marked as disputed: the money is gone
    disputeOpen = disputeOpen || open;
    lost = lost || isLost;
    const next = derivePaymentStatus({ current: p.status, succeeded: true, amountMinor: Number(p.amount_minor), refundedMinor: refunded, disputeOpen: open });
    if (next !== p.status) assertTransition("payment", p.status, next);
    await exec(db, "UPDATE pay_payments SET refunded_minor = $1, status = $2 WHERE id = $3", [refunded, next, p.id]);
    refundedTotal += refunded;
  }
  const next = deriveOrderStatus({ current: order.status, paymentSucceeded: pays.length > 0, fulfilled: order.fulfilled_at !== null, totalMinor: Number(order.total_minor), refundedMinor: refundedTotal, disputeOpen });
  if (next !== order.status) {
    assertTransition("order", order.status, next);
    await auditIn(db, { actorType: actor.type, actorId: actor.id ?? null, action: `order.${next}`, entity: "order", entityId: order.public_id, detail: { from: order.status, refundedMinor: refundedTotal } });
  }
  await exec(db, "UPDATE pay_orders SET status = $1, refunded_minor = $2 WHERE id = $3", [next, refundedTotal, orderId]);
  const fullyRefunded = Number(order.total_minor) > 0 && refundedTotal >= Number(order.total_minor);
  if (fullyRefunded || lost) await revokeOrderEntitlements(db, orderId, fullyRefunded ? "refunded" : "dispute lost");
  return { fullyRefunded, lost, orderStatus: next };
}

/** A dispute or chargeback update from a provider. */
export async function applyDispute(d: ProviderDispute, provider: string, ctx: Ctx): Promise<boolean> {
  const p = await first(pool, "SELECT * FROM pay_payments WHERE provider = $1 AND provider_payment_ref = $2", [provider, d.paymentRef]);
  if (!p) return false;
  let notify = false;
  await tx(async (db) => {
    const prev = await first<{ status: string }>(db, "SELECT status FROM pay_disputes WHERE provider_dispute_ref = $1 FOR UPDATE", [d.ref]);
    if (!prev) {
      await exec(db, "INSERT INTO pay_disputes (payment_id, order_id, provider_dispute_ref, status, reason, amount_minor, currency, respond_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)", [p.id, p.order_id, d.ref, d.status, d.reason ?? null, d.amountMinor, d.currency, d.respondBy ? dbTime(d.respondBy) : null]);
      notify = true;
    } else if (prev.status !== d.status) {
      await exec(db, "UPDATE pay_disputes SET status = $1, reason = COALESCE($2, reason), respond_by = $3 WHERE provider_dispute_ref = $4", [d.status, d.reason ?? null, d.respondBy ? dbTime(d.respondBy) : null, d.ref]);
      notify = d.status === "lost" || d.status === "won";
    }
    await auditIn(db, { actorType: ctx.actor, actorId: ctx.actorId ?? null, action: "dispute.updated", entity: "dispute", entityId: d.ref, detail: { status: d.status, reason: d.reason, amountMinor: d.amountMinor } });
    await recomputeFinancials(db, Number(p.order_id), { type: ctx.actor, id: ctx.actorId });
  });
  if (notify) await alertStaff(`Dispute ${d.status}`, [`Payment ${p.id} (${provider}) has a dispute marked "${d.status}" for ${d.amountMinor} ${d.currency} minor units.`, d.respondBy ? `Respond by ${d.respondBy.toISOString().slice(0, 10)}.` : "Open the provider's dashboard to respond."]);
  return true;
}


