import { audit, auditIn, type ActorType } from "./audit";
import { exec, first, fromDb, insertId, pool, rows, tx, type Db, type Row } from "./db";
import { newRefundId } from "./ids";
import { issueDocument } from "./invoices";
import { alertStaff, refundUpdate } from "./notify";
import { PayError } from "./orders";
import { getProvider } from "./providers";
import { ProviderError, type ProviderRefund } from "./providers/types";
import { recomputeFinancials } from "./settle";
import { assertTransition, type RefundStatus } from "./state";

/**
 * Refunds. Rules this module keeps:
 *  - a refund is recorded (status "requested") BEFORE the provider is called, with a unique idempotency key, so a retried request cannot
 *    create a second refund and a crash cannot lose track of one;
 *  - the refundable amount is the payment amount minus every refund that is requested, pending or succeeded;
 *  - a refund is "succeeded" only when the provider says so (in the call's answer, a webhook, or a later look-up), never before;
 *  - if the provider call times out we do not call again blindly: we look at the provider's refunds for that payment first.
 */
export interface RefundView { id: string; orderId: string; amountMinor: number; currency: string; status: RefundStatus; reason: string; createdAt: string; failureMessage: string | null }

export const refundView = (r: Row, orderPublicId: string): RefundView => ({ id: r.public_id, orderId: orderPublicId, amountMinor: Number(r.amount_minor), currency: r.currency, status: r.status, reason: r.reason, createdAt: fromDb(r.created_at)?.toISOString() ?? "", failureMessage: r.failure_message });

export async function refundableMinor(db: Db, payment: Row): Promise<number> {
  const s = await first<{ s: number | null }>(db, "SELECT COALESCE(SUM(amount_minor),0) AS s FROM pay_refunds WHERE payment_id = $1 AND status IN ('requested','pending','succeeded')", [payment.id]);
  return Number(payment.amount_minor) - Number(s?.s ?? 0);
}

export async function requestRefund(input: { orderPublicId: string; paymentId?: number; amountMinor?: number; reason: string; staffUserId: number; idempotencyKey: string }): Promise<RefundView> {
  if (!/^[A-Za-z0-9_\-:.]{8,100}$/.test(input.idempotencyKey)) throw new PayError("bad_idempotency_key", "A valid idempotency key is required.", 400);
  if (input.reason.trim().length < 3) throw new PayError("reason_required", "Give a reason for the refund.", 400);
  const order = await first(pool, "SELECT * FROM pay_orders WHERE public_id = $1", [input.orderPublicId]);
  if (!order) throw new PayError("order_not_found", "Order not found.", 404);

  const refund = await tx(async (db): Promise<Row> => {
    // One refund at a time per order: take the order's lock first, and only then look at the idempotency key, so a repeat that was waiting
    // behind the first request finds its result instead of trying to create a second refund.
    await first(db, "SELECT id FROM pay_orders WHERE id = $1 FOR UPDATE", [order.id]);
    const again = await first(db, "SELECT * FROM pay_refunds WHERE idempotency_key = $1", [input.idempotencyKey]);
    if (again) {
      if (Number(again.order_id) !== Number(order.id)) throw new PayError("key_reuse", "This idempotency key belongs to another order.", 409);
      return again; // the same request again: return the first result
    }
    const pay = await first(db, input.paymentId ? "SELECT * FROM pay_payments WHERE id = $1 AND order_id = $2 FOR UPDATE" : "SELECT * FROM pay_payments WHERE order_id = $2 AND status IN ('succeeded','partially_refunded','disputed') ORDER BY id LIMIT 1 FOR UPDATE", [input.paymentId ?? 0, order.id]);
    if (!pay) throw new PayError("no_refundable_payment", "This order has no paid payment to refund.", 409);
    if (pay.provider === "free") throw new PayError("nothing_to_refund", "This order was free.", 409);
    if (pay.status === "disputed") throw new PayError("payment_disputed", "A dispute is open on this payment. Handle it in the provider dashboard.", 409);
    if (pay.status !== "succeeded" && pay.status !== "partially_refunded") throw new PayError("not_refundable", "This payment cannot be refunded in its current state.", 409);
    const left = await refundableMinor(db, pay);
    const amount = input.amountMinor ?? left;
    if (!Number.isSafeInteger(amount) || amount <= 0) throw new PayError("bad_amount", "The refund amount must be more than zero.", 400);
    if (amount > left) throw new PayError("amount_too_high", "That is more than is left to refund.", 409, { refundableMinor: left });
    const publicId = newRefundId();
    const id = await insertId(db, "INSERT INTO pay_refunds (public_id, payment_id, order_id, amount_minor, currency, status, reason, requested_by, idempotency_key) VALUES ($1,$2,$3,$4,$5,'requested',$6,$7,$8)", [publicId, pay.id, order.id, amount, pay.currency, input.reason.trim().slice(0, 255), input.staffUserId, input.idempotencyKey]);
    await auditIn(db, { actorType: "staff", actorId: input.staffUserId, action: "refund.requested", entity: "refund", entityId: publicId, detail: { order: order.public_id, amountMinor: amount, currency: pay.currency, reason: input.reason.slice(0, 120) } });
    return (await first(db, "SELECT * FROM pay_refunds WHERE id = $1", [id])) as Row;
  });

  const done = refund.status === "requested" ? await dispatchRefund(Number(refund.id)) : refund;
  return refundView(done, order.public_id);
}

/** Send a recorded refund to the provider (once). Safe to call again: it first checks what the provider already has. */
export async function dispatchRefund(refundId: number): Promise<Row> {
  const r = (await first(pool, "SELECT * FROM pay_refunds WHERE id = $1", [refundId])) as Row;
  if (r.status !== "requested") return r;
  // Claim the refund so two requests at once cannot both call the provider (Razorpay has no idempotency header). A claim older than a minute is treated as abandoned.
  const claimed = await exec(pool, "UPDATE pay_refunds SET failure_message = 'dispatching' WHERE id = $1 AND status = 'requested' AND (failure_message IS NULL OR failure_message <> 'dispatching' OR updated_at < (UTC_TIMESTAMP() - INTERVAL 60 SECOND))", [r.id]);
  if (claimed === 0) return (await first(pool, "SELECT * FROM pay_refunds WHERE id = $1", [r.id])) as Row;
  const pay = (await first(pool, "SELECT * FROM pay_payments WHERE id = $1", [r.payment_id])) as Row;
  const order = (await first(pool, "SELECT * FROM pay_orders WHERE id = $1", [r.order_id])) as Row;
  const provider = getProvider(pay.provider);
  if (!provider || !pay.provider_payment_ref) throw new PayError("provider_unavailable", "This payment cannot be refunded through its provider.", 409);

  let result: ProviderRefund | null = null;
  try {
    const existing = (await provider.listRefunds(pay.provider_payment_ref)).find((x) => x.receipt === r.public_id);
    result = existing ?? (await provider.createRefund({ paymentRef: pay.provider_payment_ref, amountMinor: Number(r.amount_minor), currency: r.currency, refundPublicId: r.public_id, reason: r.reason, idempotencyKey: r.idempotency_key }));
  } catch (e) {
    if (e instanceof ProviderError && e.retryable) {
      await exec(pool, "UPDATE pay_refunds SET failure_message = $1 WHERE id = $2", ["The provider did not answer; it will be retried.", r.id]);
      await audit({ actorType: "system", action: "refund.provider_unreachable", entity: "refund", entityId: r.public_id, detail: { code: e.code } });
      return (await first(pool, "SELECT * FROM pay_refunds WHERE id = $1", [r.id])) as Row; // stays "requested"; the cron job resolves it
    }
    const msg = e instanceof ProviderError ? `The provider refused the refund (${e.code}).` : "The refund failed.";
    await tx(async (db) => {
      assertTransition("refund", "requested", "failed");
      await exec(db, "UPDATE pay_refunds SET status = 'failed', failure_message = $1 WHERE id = $2", [msg, r.id]);
      await auditIn(db, { actorType: "system", action: "refund.failed", entity: "refund", entityId: r.public_id, detail: { msg } });
    });
    await alertStaff("A refund was refused by the provider", [`Refund ${r.public_id} for order ${order.public_id}: ${msg}`]);
    return (await first(pool, "SELECT * FROM pay_refunds WHERE id = $1", [r.id])) as Row;
  }
  await applyProviderRefund(pay, result, { type: "system" });
  return (await first(pool, "SELECT * FROM pay_refunds WHERE id = $1", [r.id])) as Row;
}

/**
 * Record what the provider says about a refund: update ours (matched by provider id or by our receipt id), or create one for a refund
 * that was made in the provider's dashboard. Moves the money state and sends the credit note and email when it newly succeeds.
 */
export async function applyProviderRefund(pay: Row, pr: ProviderRefund, actor: { type: ActorType; id?: string | number | null }): Promise<void> {
  let credit: Row | null = null;
  let failed: Row | null = null;
  await tx(async (db) => {
    let r = await first(db, "SELECT * FROM pay_refunds WHERE payment_id = $1 AND (provider_refund_ref = $2 OR public_id = $3) FOR UPDATE", [pay.id, pr.ref, pr.receipt ?? ""]);
    if (!r) {
      const publicId = newRefundId();
      const id = await insertId(db, "INSERT INTO pay_refunds (public_id, payment_id, order_id, provider_refund_ref, amount_minor, currency, status, reason, requested_by, idempotency_key) VALUES ($1,$2,$3,$4,$5,$6,'requested',$7,NULL,$8)", [publicId, pay.id, pay.order_id, pr.ref, pr.amountMinor, pr.currency || pay.currency, "Made in the provider dashboard", `prov:${pay.provider}:${pr.ref}`]);
      r = (await first(db, "SELECT * FROM pay_refunds WHERE id = $1", [id])) as Row;
      await auditIn(db, { actorType: "provider", action: "refund.discovered", entity: "refund", entityId: publicId, detail: { ref: pr.ref, amountMinor: pr.amountMinor } });
    }
    const next: RefundStatus = pr.status;
    if (r.provider_refund_ref !== pr.ref) await exec(db, "UPDATE pay_refunds SET provider_refund_ref = $1 WHERE id = $2", [pr.ref, r.id]);
    if (r.status === next) return;
    if (r.status === "succeeded" || r.status === "failed") return; // final states never change
    assertTransition("refund", r.status, next);
    await exec(db, "UPDATE pay_refunds SET status = $1, failure_message = $2 WHERE id = $3", [next, next === "failed" ? "The provider reported the refund as failed." : null, r.id]);
    await auditIn(db, { actorType: actor.type, actorId: actor.id ?? null, action: `refund.${next}`, entity: "refund", entityId: r.public_id, detail: { ref: pr.ref } });
    if (next === "succeeded") {
      await recomputeFinancials(db, Number(pay.order_id), actor);
      const order = (await first(db, "SELECT * FROM pay_orders WHERE id = $1", [pay.order_id])) as Row;
      await issueDocument(db, order, { refund: { ...r, status: "succeeded" } });
      credit = { ...r, status: "succeeded" };
    } else if (next === "failed") failed = r;
  });
  const order = (await first(pool, "SELECT * FROM pay_orders WHERE id = $1", [pay.order_id])) as Row;
  if (credit) await refundUpdate(order, credit, "succeeded").catch(() => undefined);
  if (failed) {
    await refundUpdate(order, failed, "failed").catch(() => undefined);
    await alertStaff("A refund failed", [`Refund ${(failed as Row).public_id} for order ${order.public_id} was reported as failed by the provider.`]);
  }
}

/** Look at the provider's refunds for a payment and bring ours in line (used for `charge.refunded` style events and for the cron job). */
export async function syncRefunds(paymentId: number): Promise<number> {
  const pay = await first(pool, "SELECT * FROM pay_payments WHERE id = $1", [paymentId]);
  const provider = pay ? getProvider(pay.provider) : null;
  if (!pay || !provider || !pay.provider_payment_ref) return 0;
  const list = await provider.listRefunds(pay.provider_payment_ref);
  for (const pr of list) await applyProviderRefund(pay, pr, { type: "provider" });
  return list.length;
}

/** Refunds recorded but never confirmed by the provider (a crash or a timeout): resolve each. Called by the cron job. */
export async function resolveStuckRefunds(): Promise<{ checked: number; resolved: number }> {
  const stuck = await rows(pool, "SELECT id FROM pay_refunds WHERE status IN ('requested','pending') AND created_at < (UTC_TIMESTAMP() - INTERVAL 2 MINUTE) ORDER BY id LIMIT 50");
  let resolved = 0;
  for (const s of stuck) {
    try {
      const before = (await first(pool, "SELECT * FROM pay_refunds WHERE id = $1", [s.id])) as Row;
      if (before.status === "requested") await dispatchRefund(Number(s.id));
      else {
        const pay = (await first(pool, "SELECT * FROM pay_payments WHERE id = $1", [before.payment_id])) as Row;
        const provider = getProvider(pay.provider);
        if (provider && before.provider_refund_ref) await applyProviderRefund(pay, await provider.retrieveRefund(before.provider_refund_ref, pay.provider_payment_ref), { type: "system" });
      }
      const after = (await first(pool, "SELECT status FROM pay_refunds WHERE id = $1", [s.id])) as Row;
      if (after.status !== before.status) resolved++;
    } catch (e) {
      console.error("[pay] refund resolve failed:", (e as Error).message);
    }
  }
  return { checked: stuck.length, resolved };
}

export async function listRefunds(orderId: number, db: Db = pool): Promise<Row[]> {
  return rows(db, "SELECT * FROM pay_refunds WHERE order_id = $1 ORDER BY id", [orderId]);
}
