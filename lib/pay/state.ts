/**
 * Explicit state machines for orders, payment attempts and refunds. Every status change in the payment code goes through
 * `assertTransition`, so an illegal change throws and nothing is written.
 */
export type OrderStatus = "pending" | "paid" | "fulfilled" | "failed" | "cancelled" | "expired" | "partially_refunded" | "refunded" | "disputed";
export type PaymentStatus = "created" | "pending" | "succeeded" | "failed" | "cancelled" | "expired" | "partially_refunded" | "refunded" | "disputed";
export type RefundStatus = "requested" | "pending" | "succeeded" | "failed";

/**
 * A payment that arrives after the order failed, was cancelled or expired is real money, so those states may move to `paid`
 * (the order is then fulfilled). That is the only way out of a terminal "unpaid" state.
 */
const ORDER: Record<OrderStatus, OrderStatus[]> = {
  pending: ["paid", "failed", "cancelled", "expired"],
  failed: ["paid", "pending"],
  cancelled: ["paid"],
  expired: ["paid"],
  paid: ["fulfilled", "partially_refunded", "refunded", "disputed"],
  fulfilled: ["partially_refunded", "refunded", "disputed"],
  partially_refunded: ["partially_refunded", "refunded", "disputed", "fulfilled"],
  refunded: [],
  disputed: ["paid", "fulfilled", "partially_refunded", "refunded"],
};

const PAYMENT: Record<PaymentStatus, PaymentStatus[]> = {
  created: ["pending", "succeeded", "failed", "cancelled", "expired"],
  pending: ["succeeded", "failed", "cancelled", "expired"],
  failed: ["pending", "succeeded"],
  cancelled: ["succeeded"],
  expired: ["succeeded"],
  succeeded: ["partially_refunded", "refunded", "disputed"],
  partially_refunded: ["partially_refunded", "refunded", "disputed", "succeeded"],
  refunded: [],
  disputed: ["succeeded", "partially_refunded", "refunded"],
};

const REFUND: Record<RefundStatus, RefundStatus[]> = {
  requested: ["pending", "succeeded", "failed"],
  pending: ["succeeded", "failed"],
  succeeded: [],
  failed: [],
};

export class IllegalTransition extends Error {
  constructor(public readonly entity: string, public readonly from: string, public readonly to: string) {
    super(`Illegal ${entity} transition: ${from} -> ${to}`);
  }
}

export const canOrder = (from: OrderStatus, to: OrderStatus): boolean => from === to || ORDER[from]?.includes(to) === true;
export const canPayment = (from: PaymentStatus, to: PaymentStatus): boolean => from === to || PAYMENT[from]?.includes(to) === true;
export const canRefund = (from: RefundStatus, to: RefundStatus): boolean => from === to || REFUND[from]?.includes(to) === true;

export function assertTransition(entity: "order" | "payment" | "refund", from: string, to: string): void {
  const ok = entity === "order" ? canOrder(from as OrderStatus, to as OrderStatus) : entity === "payment" ? canPayment(from as PaymentStatus, to as PaymentStatus) : canRefund(from as RefundStatus, to as RefundStatus);
  if (!ok) throw new IllegalTransition(entity, from, to);
}

/** The order status that follows from the facts. Used after every payment, refund or dispute change. */
export function deriveOrderStatus(o: { current: OrderStatus; paymentSucceeded: boolean; fulfilled: boolean; totalMinor: number; refundedMinor: number; disputeOpen: boolean }): OrderStatus {
  if (!o.paymentSucceeded && o.refundedMinor === 0) return o.current;
  if (o.disputeOpen) return "disputed";
  if (o.totalMinor > 0 && o.refundedMinor >= o.totalMinor) return "refunded";
  if (o.refundedMinor > 0) return "partially_refunded";
  return o.fulfilled ? "fulfilled" : "paid";
}

/** Same idea for the payment attempt. */
export function derivePaymentStatus(p: { current: PaymentStatus; succeeded: boolean; amountMinor: number; refundedMinor: number; disputeOpen: boolean }): PaymentStatus {
  if (!p.succeeded) return p.current;
  if (p.disputeOpen) return "disputed";
  if (p.refundedMinor >= p.amountMinor && p.amountMinor > 0) return "refunded";
  if (p.refundedMinor > 0) return "partially_refunded";
  return "succeeded";
}
