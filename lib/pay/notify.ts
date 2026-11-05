import { appUrl, send } from "@/lib/portal/mail";
import { cfg } from "./config";
import { formatMoney } from "./money";
import type { Row } from "./db";

/**
 * Payment emails, queued through the portal's mail outbox (so delivery happens after the response and is retried by the cron job).
 * They are sent only from the code path that performed the state change, so a repeated webhook cannot send a second copy.
 * None of them contains a card number, a provider secret or a link that works without signing in (the receipt link asks you to sign in).
 */
const money = (n: number, cur: string): string => formatMoney(n, cur, cur === "INR" ? "en-IN" : "en-US");

export async function paymentReceived(order: Row, docNumber: string): Promise<void> {
  const link = await appUrl(`/billing/${order.public_id}`);
  await send({ email: order.email, name: order.billing_name }, `Payment received: ${order.public_id}`, "Thank you, your payment was received",
    [`We received ${money(Number(order.total_minor), order.currency)} for order ${order.public_id}.`, `Your receipt number is ${docNumber}. Your purchase is now active in your account.`],
    ["View order and receipt", link], "payment_received", "If you did not make this payment, reply to this email right away.");
}

export async function paymentFailed(order: Row, reason: string): Promise<void> {
  const link = await appUrl(`/checkout/status/${order.public_id}`);
  await send({ email: order.email, name: order.billing_name }, `Payment not completed: ${order.public_id}`, "Your payment did not go through",
    [`We could not complete the payment for order ${order.public_id}. ${reason}`, "You have not been charged for this attempt. If money left your account, it is returned by your bank, usually within 5 to 7 working days.", "You can try again with the same or a different payment method."],
    ["Try again", link], "payment_failed");
}

export async function refundUpdate(order: Row, refund: Row, status: "succeeded" | "failed"): Promise<void> {
  const link = await appUrl(`/billing/${order.public_id}`);
  if (status === "succeeded") {
    await send({ email: order.email, name: order.billing_name }, `Refund processed: ${order.public_id}`, "Your refund was processed",
      [`We refunded ${money(Number(refund.amount_minor), refund.currency)} for order ${order.public_id}.`, "It can take 5 to 10 working days to appear on your statement, depending on your bank."],
      ["View order", link], "refund_succeeded");
  } else {
    await send({ email: order.email, name: order.billing_name }, `Refund could not be completed: ${order.public_id}`, "We could not complete your refund",
      [`The refund of ${money(Number(refund.amount_minor), refund.currency)} for order ${order.public_id} did not go through. Our team has been told and will contact you.`], undefined, "refund_failed");
  }
}

/** A message to the team (finance and support). Contains order ids and amounts only. */
export async function alertStaff(subject: string, lines: string[]): Promise<void> {
  const to = cfg.alertEmail();
  if (!to) return;
  await send({ email: to, name: "Payments team" }, `[Payments] ${subject}`, subject, lines, [`Open the console`, await appUrl("/console/payments")], "payment_alert");
}
