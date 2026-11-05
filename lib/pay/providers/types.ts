import type { ProviderId } from "../config";

/**
 * The one interface every payment provider implements. Business code (orders, settlement, refunds) only ever talks to this, so adding a
 * provider (PayPal, for example) means writing one adapter and registering it; nothing else changes.
 */
export class ProviderError extends Error {
  constructor(message: string, public readonly provider: ProviderId, public readonly retryable: boolean, public readonly code = "provider_error", public readonly status = 0) {
    super(message);
  }
}

/** A provider-reported payment state. "authorized" means the money is held but not yet captured. */
export type ProviderPaymentStatus = "pending" | "authorized" | "succeeded" | "failed" | "cancelled" | "expired";

export interface ProviderPayment {
  sessionRef: string;
  paymentRef: string | null;
  status: ProviderPaymentStatus;
  amountMinor: number;
  currency: string;
  method: string | null;
  /** Our order id as stored in the provider's metadata when the session was created. */
  orderPublicId: string | null;
  refundedMinor: number;
  failureCode?: string | null;
  failureMessage?: string | null;
  createdAt?: Date;
}

export interface ProviderRefund {
  ref: string;
  paymentRef: string;
  status: "pending" | "succeeded" | "failed";
  amountMinor: number;
  currency: string;
  /** Our refund public id, when we sent one. */
  receipt?: string | null;
  reason?: string | null;
}

export interface ProviderDispute {
  ref: string;
  paymentRef: string;
  status: "open" | "under_review" | "won" | "lost" | "closed";
  amountMinor: number;
  currency: string;
  reason?: string | null;
  respondBy?: Date | null;
}

/** What a verified webhook means, in provider-neutral terms. The event is only a hint: settlement re-reads the payment from the provider. */
export type EventKind = "payment.succeeded" | "payment.authorized" | "payment.pending" | "payment.failed" | "payment.attempt_failed" | "session.expired" | "refund.updated" | "dispute.updated" | "other";

export interface ProviderEvent {
  provider: ProviderId;
  id: string;
  type: string;
  kind: EventKind;
  at: Date | null;
  sessionRef?: string | null;
  paymentRef?: string | null;
  orderPublicId?: string | null;
  refund?: ProviderRefund;
  dispute?: ProviderDispute;
  failureCode?: string | null;
  failureMessage?: string | null;
}

export type CheckoutDescriptor =
  | { kind: "redirect"; provider: ProviderId; url: string }
  | { kind: "razorpay"; provider: "razorpay"; keyId: string; orderId: string; amountMinor: number; currency: string; name: string; description: string; prefill: { name: string; email: string }; notes: Record<string, string> };

export interface SessionInput {
  orderPublicId: string;
  amountMinor: number;
  currency: string;
  customer: { name: string; email: string; country: string };
  lines: Array<{ title: string; qty: number; totalMinor: number; taxMinor: number }>;
  taxName: string;
  taxInclusive: boolean;
  returnUrl: string;
  cancelUrl: string;
  expiresAt: Date;
  idempotencyKey: string;
}

export interface SessionResult { sessionRef: string; checkout: CheckoutDescriptor }

export interface PaymentProvider {
  readonly id: ProviderId;
  readonly label: string;
  /** Keys present, so calls can be made. */
  configured(): boolean;
  /** Webhook secret present. */
  webhookConfigured(): boolean;
  supports(c: { country: string; currency: string }): boolean;
  currencies(): string[];
  createPaymentSession(input: SessionInput): Promise<SessionResult>;
  retrievePayment(ref: { sessionRef: string; paymentRef?: string | null }): Promise<ProviderPayment>;
  /** Throws ProviderError (non-retryable) when the signature, timestamp or body is not valid. */
  verifyWebhook(rawBody: string, headers: Headers): ProviderEvent;
  /** For providers that authorize first. Providers that capture automatically return { captured: false, supported: false }. */
  capturePayment(input: { paymentRef: string; amountMinor: number; currency: string }): Promise<{ supported: boolean; captured: boolean }>;
  /** Stop an unpaid session so it cannot be paid later. Providers that cannot do this return { cancelled: false }. */
  cancelPayment(sessionRef: string): Promise<{ cancelled: boolean }>;
  createRefund(input: { paymentRef: string; amountMinor: number; currency: string; refundPublicId: string; reason: string; idempotencyKey: string }): Promise<ProviderRefund>;
  retrieveRefund(ref: string, paymentRef: string): Promise<ProviderRefund>;
  /** Refunds the provider holds for a payment (used to recover from a timed-out refund call). */
  listRefunds(paymentRef: string): Promise<ProviderRefund[]>;
  /** Provider payments created in a window, for reconciliation. */
  reconcilePayment(window: { from: Date; to: Date }): Promise<ProviderPayment[]>;
}
