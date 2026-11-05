import { one, run, tx, val } from "../portal/db";
import * as pay from "../studio/pay";
import { find as findVerification } from "./verify";

/**
 * Online payment of the verification fee by the student (Razorpay), on the same rules as the Studio plan (port of Crm\VerifyPay): amount decided
 * on the server, signature checked in constant time, payment confirmed with Razorpay, settled once. The student reaches this from their private
 * file link, so the order is bound to the lead's access token.
 */
export class VerifyPayError extends Error {}
export const enabled = (): boolean => pay.enabled();

interface PaymentRow { id: number; lead_id: number; kind: string; amount_inr: number; status: string; order_id: string | null; payment_id: string | null; verification_id: number | null }

export async function createOrder(verificationId: number): Promise<{ order_id: string; amount: number; currency: string; key: string }> {
  if (!pay.enabled()) throw new VerifyPayError("Online payment is not switched on. Please pay at the office or ask your counsellor to record your payment.");
  const v = await findVerification(verificationId);
  const p = await one<PaymentRow>("SELECT * FROM crm_payments WHERE verification_id = $1 AND kind = 'verification' AND status = 'due' ORDER BY id DESC LIMIT 1", [verificationId]);
  if (!v || v.status !== "awaiting_payment" || !p) throw new VerifyPayError("This verification does not need a payment.");
  const recent = Number(await val("SELECT COUNT(*) FROM crm_payments WHERE lead_id = $1 AND order_id IS NOT NULL AND created_at > LOCALTIMESTAMP(0) - INTERVAL '1 hour'", [v.lead_id]));
  if (recent >= 6) throw new VerifyPayError("Too many payment attempts. Please wait a little and try again.");
  const amount = Number(p.amount_inr) * 100;
  const [code, res] = await pay.api("POST", "/orders", { amount, currency: "INR", receipt: `vf${verificationId}-${Math.floor(Date.now() / 1000)}`, notes: { verification_id: String(verificationId), product: "crm-verification" } });
  if (code < 200 || code >= 300 || !res.id) {
    console.error("crm razorpay order failed: HTTP", code, JSON.stringify(res));
    throw new VerifyPayError("Could not start the payment. Please try again in a moment.");
  }
  // the due row carries the latest order id; a new attempt replaces an unpaid one
  await run("UPDATE crm_payments SET order_id = $1 WHERE id = $2 AND status = 'due'", [String(res.id), p.id]);
  return { order_id: String(res.id), amount, currency: "INR", key: pay.publicKey() };
}

/** Mark the payment received and release the verification, exactly once. */
async function settle(orderId: string, paymentId: string): Promise<boolean> {
  try {
    return await tx(async (c) => {
      const up = await c.query("UPDATE crm_payments SET status = 'received', payment_id = $1, method = 'razorpay', received_on = CURRENT_DATE WHERE order_id = $2 AND status = 'due'", [paymentId, orderId]);
      if (up.rowCount !== 1) return false;
      const row = (await c.query("SELECT lead_id, verification_id, amount_inr FROM crm_payments WHERE order_id = $1", [orderId])).rows[0];
      const log = (body: string) => c.query("INSERT INTO crm_activities (lead_id, actor_id, kind, body) VALUES ($1, NULL, 'system', $2)", [row.lead_id, body.slice(0, 1000)]);
      if (row.verification_id) {
        const mv = await c.query("UPDATE crm_verifications SET status = 'in_progress', paid_at = NOW() WHERE id = $1 AND status = 'awaiting_payment'", [row.verification_id]);
        if (mv.rowCount === 1) {
          const prov = (await c.query("SELECT provider FROM crm_verifications WHERE id = $1", [row.verification_id])).rows[0]?.provider;
          await log(`Verification #${row.verification_id} paid by the student (online). Sent to ${prov || "the partner"}.`);
        }
      }
      await log(`Verification fee INR ${Number(row.amount_inr).toLocaleString("en-US")} paid online by the student (${paymentId}).`);
      return true;
    });
  } catch (e) {
    console.error("crm settle:", e instanceof Error ? e.message : e);
    return false;
  }
}

async function confirm(order: PaymentRow, paymentId: string): Promise<boolean> {
  const [code, p] = await pay.api("GET", "/payments/" + encodeURIComponent(paymentId));
  if (code === 0 || code >= 500 || Object.keys(p).length === 0) return true;
  const amt = Number(order.amount_inr) * 100;
  if (code !== 200 || (p.order_id ?? "") !== order.order_id || Math.trunc(Number(p.amount ?? 0)) !== amt || (p.currency ?? "") !== "INR") return false;
  const status = String(p.status ?? "");
  if (status === "authorized") {
    const [cc, cap] = await pay.api("POST", "/payments/" + encodeURIComponent(paymentId) + "/capture", { amount: amt, currency: "INR" });
    return cc === 200 && cap.status === "captured";
  }
  return status === "captured";
}

export async function verifyCallback(leadId: number, orderId: string, paymentId: string, signature: string): Promise<{ ok: boolean; message: string }> {
  const order = await one<PaymentRow>("SELECT * FROM crm_payments WHERE order_id = $1 AND lead_id = $2", [orderId, leadId]);
  if (!order) return { ok: false, message: "We could not find that payment." };
  if (order.status === "received") return { ok: true, message: "Payment already received." };
  if (!pay.signatureValid(orderId, paymentId, signature, process.env.RAZORPAY_KEY_SECRET ?? "")) {
    return { ok: false, message: "The payment could not be verified. If money was taken it will be returned automatically; contact us with reference " + paymentId + "." };
  }
  if (!(await confirm(order, paymentId))) return { ok: false, message: "The payment details did not match. Please contact us with reference " + paymentId + "." };
  await settle(orderId, paymentId);
  return { ok: true, message: "Payment received. Your documents are now with the verification partner." };
}

/** Called from the shared Razorpay webhook for orders that are not Resume Studio orders. */
export async function webhook(orderId: string, paymentId: string, p: Record<string, unknown>): Promise<{ status: number; message: string }> {
  const order = await one<PaymentRow>("SELECT * FROM crm_payments WHERE order_id = $1", [orderId]);
  if (!order) return { status: 200, message: "unknown order" };
  if (Math.trunc(Number(p.amount ?? 0)) !== Number(order.amount_inr) * 100 || (p.currency ?? "INR") !== "INR" || (p.status ?? "captured") !== "captured") return { status: 200, message: "mismatch" };
  await settle(orderId, paymentId);
  return { status: 200, message: "ok" };
}
