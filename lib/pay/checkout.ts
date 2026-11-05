import { createHmac, timingSafeEqual } from "node:crypto";
import { audit, auditIn } from "./audit";
import { cfg } from "./config";
import { exec, first, fromDb, insertId, pool, rows, tx, type Row } from "./db";
import { loadOrder, orderView, PayError, closeUnpaid, type OrderView, type Viewer } from "./orders";
import { selectProvider, getProvider } from "./providers";
import { ProviderError, type CheckoutDescriptor } from "./providers/types";
import { applyProviderTruth, settlePayment, type Outcome } from "./settle";
import { newOrderId } from "./ids";

/** Starting a payment for an order, and confirming one after the customer returns. */
export interface StartResult { order: OrderView; checkout: CheckoutDescriptor | null; paid: boolean }

async function settleFree(order: Row): Promise<Outcome> {
  const paymentId = await tx(async (db) => {
    const id = await insertId(db, "INSERT INTO pay_payments (order_id, provider, provider_session_ref, status, amount_minor, currency, idempotency_key) VALUES ($1,'free',$2,'created',0,$3,$4)", [order.id, `free_${order.public_id}`, order.currency, `${order.public_id}:free`]);
    await auditIn(db, { actorType: "system", action: "payment.free_order", entity: "payment", entityId: id, detail: { order: order.public_id } });
    return id;
  });
  return applyProviderTruth(paymentId, { sessionRef: `free_${order.public_id}`, paymentRef: `free_${order.public_id}`, status: "succeeded", amountMinor: 0, currency: order.currency, method: "free", orderPublicId: order.public_id, refundedMinor: 0 }, { actor: "system", via: "confirm" });
}

export async function startCheckout(publicId: string, viewer: Viewer, opts: { origin: string; provider?: string | null }): Promise<StartResult> {
  const order = await loadOrder(pool, publicId, viewer);

  if (order.status !== "pending") {
    if (["paid", "fulfilled", "partially_refunded", "refunded", "disputed"].includes(order.status)) return { order: await orderView(pool, order), checkout: null, paid: true };
    throw new PayError("order_closed", "This order is no longer open. Please start a new checkout.", 409);
  }
  if ((fromDb(order.expires_at)?.getTime() ?? 0) < Date.now()) {
    await tx((db) => closeUnpaid(db, order, "expired", { type: "system" }, "expired before payment"));
    throw new PayError("order_expired", "This checkout has expired. Please start again.", 409);
  }
  if (Number(order.total_minor) === 0) {
    await settleFree(order);
    return { order: await orderView(pool, (await first(pool, "SELECT * FROM pay_orders WHERE id = $1", [order.id])) as Row), checkout: null, paid: true };
  }

  const provider = selectProvider({ country: order.country, currency: order.currency, requested: opts.provider });
  if (!provider) throw new PayError("no_provider", "No payment method is available for this order right now.", 409);

  // Never start a second charge blindly: look at earlier attempts first. If one has succeeded, we are done; otherwise close the open ones.
  const attempts = await rows(pool, "SELECT * FROM pay_payments WHERE order_id = $1 ORDER BY id DESC", [order.id]);
  for (const a of attempts.filter((x) => x.status === "created" || x.status === "pending")) {
    if (a.provider_session_ref.startsWith("pending_")) { await exec(pool, "UPDATE pay_payments SET status = 'cancelled' WHERE id = $1", [a.id]); continue; }
    try {
      const out = await settlePayment(Number(a.id), { actor: "customer", actorId: viewer.userId ?? "guest", via: "confirm" });
      if (out.paymentStatus === "succeeded" || out.orderStatus === "fulfilled") return { order: await orderView(pool, (await first(pool, "SELECT * FROM pay_orders WHERE id = $1", [order.id])) as Row), checkout: null, paid: true };
    } catch (e) {
      if (e instanceof ProviderError && e.retryable) throw new PayError("provider_unavailable", "We could not check your earlier payment attempt. Please wait a minute and try again so you are not charged twice.", 503);
      throw e;
    }
    const ap = getProvider(a.provider);
    if (ap) { try { await ap.cancelPayment(a.provider_session_ref); } catch { /* a stale attempt we cannot cancel simply expires */ } }
    await exec(pool, "UPDATE pay_payments SET status = 'cancelled' WHERE id = $1 AND status IN ('created','pending')", [a.id]);
  }

  const attemptNo = attempts.length + 1;
  const idem = `${order.public_id}:${attemptNo}`;
  const placeholder = `pending_${newOrderId()}`;
  const paymentId = await tx(async (db) => {
    const id = await insertId(db, "INSERT INTO pay_payments (order_id, provider, provider_session_ref, status, amount_minor, currency, idempotency_key) VALUES ($1,$2,$3,'created',$4,$5,$6)", [order.id, provider.id, placeholder, order.total_minor, order.currency, idem]);
    await auditIn(db, { actorType: "customer", actorId: viewer.userId ?? "guest", action: "payment.started", entity: "payment", entityId: id, detail: { provider: provider.id, order: order.public_id, attemptNo } });
    return id;
  });

  const items = await rows(pool, "SELECT title, qty, total_minor, tax_minor FROM pay_order_items WHERE order_id = $1 ORDER BY id", [order.id]);
  const k = viewer.token ? `?k=${encodeURIComponent(viewer.token)}` : "";
  try {
    const session = await provider.createPaymentSession({
      orderPublicId: order.public_id, amountMinor: Number(order.total_minor), currency: order.currency,
      customer: { name: order.billing_name, email: order.email, country: order.country },
      lines: items.map((i) => ({ title: i.title, qty: Number(i.qty), totalMinor: Number(i.total_minor), taxMinor: Number(i.tax_minor) })),
      taxName: order.tax_name, taxInclusive: !!order.tax_inclusive,
      returnUrl: `${opts.origin}/checkout/status/${order.public_id}${k}`, cancelUrl: `${opts.origin}/checkout/status/${order.public_id}${k}${k ? "&" : "?"}cancelled=1`,
      expiresAt: new Date(Math.min(fromDb(order.expires_at)?.getTime() ?? Date.now() + 3_600_000, Date.now() + 23 * 3_600_000)), idempotencyKey: idem,
    });
    await exec(pool, "UPDATE pay_payments SET provider_session_ref = $1, status = 'pending' WHERE id = $2", [session.sessionRef, paymentId]);
    await audit({ actorType: "system", action: "payment.session_created", entity: "payment", entityId: paymentId, detail: { provider: provider.id, sessionRef: session.sessionRef } });
    return { order: await orderView(pool, order), checkout: session.checkout, paid: false };
  } catch (e) {
    const code = e instanceof ProviderError ? e.code : "error";
    await exec(pool, "UPDATE pay_payments SET status = 'failed', failure_code = $1 WHERE id = $2", [String(code).slice(0, 80), paymentId]);
    await audit({ actorType: "system", action: "payment.session_failed", entity: "payment", entityId: paymentId, detail: { provider: provider.id, code } });
    if (e instanceof ProviderError) throw new PayError("provider_unavailable", "The payment provider could not start the payment. You have not been charged. Please try again in a moment.", e.retryable ? 503 : 502);
    throw e;
  }
}

function razorpaySignatureValid(orderId: string, paymentId: string, signature: string): boolean {
  const secret = cfg.razorpaySecret();
  if (!secret || !signature) return false;
  const want = Buffer.from(createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex"));
  const got = Buffer.from(signature);
  return want.length === got.length && timingSafeEqual(want, got);
}

/**
 * The customer came back (or the status page is polling). Nothing the browser sends counts as proof: at most it names a Razorpay payment
 * id, which is only used to ask Razorpay about, and only when Razorpay's checkout signature on it is valid. The result comes from the provider's API.
 */
export async function confirmPayment(publicId: string, viewer: Viewer, hint: { razorpayPaymentId?: string; razorpaySignature?: string } = {}): Promise<{ order: OrderView; outcome: Outcome | null }> {
  const order = await loadOrder(pool, publicId, viewer);
  if (["fulfilled", "refunded", "partially_refunded", "disputed"].includes(order.status)) return { order: await orderView(pool, order), outcome: null };
  const p = await first(pool, "SELECT * FROM pay_payments WHERE order_id = $1 AND provider <> 'free' ORDER BY id DESC LIMIT 1", [order.id]);
  if (!p || String(p.provider_session_ref).startsWith("pending_")) return { order: await orderView(pool, order), outcome: null };
  if (p.provider === "razorpay" && hint.razorpayPaymentId && hint.razorpaySignature && !p.provider_payment_ref && razorpaySignatureValid(p.provider_session_ref, hint.razorpayPaymentId, hint.razorpaySignature)) {
    await exec(pool, "UPDATE pay_payments SET provider_payment_ref = $1 WHERE id = $2 AND provider_payment_ref IS NULL", [hint.razorpayPaymentId, p.id]);
  }
  try {
    const outcome = await settlePayment(Number(p.id), { actor: "customer", actorId: viewer.userId ?? "guest", via: "confirm" });
    return { order: await orderView(pool, (await first(pool, "SELECT * FROM pay_orders WHERE id = $1", [order.id])) as Row), outcome };
  } catch (e) {
    if (e instanceof ProviderError) return { order: await orderView(pool, order), outcome: null }; // provider unreachable: the webhook or the next poll will settle it
    throw e;
  }
}

/** Customer cancels an unpaid order. */
/**
 * Before a signed-in customer starts a new checkout with a coupon, cancel their own earlier unpaid checkouts that still hold it (after a declined
 * or abandoned payment, for example). Otherwise the coupon would stay reserved to the old order and the retry would be refused. An order that
 * turns out to have been paid is left alone and keeps the coupon.
 */
export async function releaseHeldCoupon(userId: number, code: string): Promise<void> {
  const held = await rows(pool, "SELECT o.public_id FROM pay_orders o JOIN pay_coupon_redemptions r ON r.order_id = o.id JOIN pay_coupons c ON c.id = r.coupon_id WHERE o.user_id = $1 AND o.status = 'pending' AND c.code = $2", [userId, code.toUpperCase()]);
  for (const h of held) {
    try { await cancelOrder(h.public_id, { userId }); } catch { /* paid meanwhile, or the provider could not be reached: leave it as it is */ }
  }
}

export async function cancelOrder(publicId: string, viewer: Viewer): Promise<OrderView> {
  const order = await loadOrder(pool, publicId, viewer);
  if (order.status !== "pending") throw new PayError("order_not_cancellable", "Only an unpaid order can be cancelled.", 409);
  const open = await rows(pool, "SELECT * FROM pay_payments WHERE order_id = $1 AND status IN ('created','pending') AND provider <> 'free'", [order.id]);
  for (const a of open) {
    if (String(a.provider_session_ref).startsWith("pending_")) continue;
    try {
      const out = await settlePayment(Number(a.id), { actor: "customer", actorId: viewer.userId ?? "guest", via: "confirm" });
      if (out.paymentStatus === "succeeded") throw new PayError("order_already_paid", "This order has just been paid and cannot be cancelled. Use the refund process instead.", 409);
    } catch (e) {
      if (e instanceof PayError) throw e;
      if (e instanceof ProviderError) throw new PayError("provider_unavailable", "We could not check this payment with the provider. Please try again in a moment.", 503);
      throw e;
    }
    const prov = getProvider(a.provider);
    if (prov) { try { await prov.cancelPayment(a.provider_session_ref); } catch { /* it expires by itself */ } }
  }
  await tx((db) => closeUnpaid(db, order, "cancelled", { type: "customer", id: viewer.userId ?? "guest" }, "cancelled by customer"));
  return orderView(pool, (await first(pool, "SELECT * FROM pay_orders WHERE id = $1", [order.id])) as Row);
}


