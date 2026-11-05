import Stripe from "stripe";
import { cfg } from "../config";
import { ProviderError, type PaymentProvider, type ProviderDispute, type ProviderEvent, type ProviderPayment, type ProviderRefund, type SessionInput, type SessionResult } from "./types";

/**
 * Stripe adapter, using the official `stripe` SDK and Stripe-hosted Checkout (mode "payment").
 *  - card details are entered on checkout.stripe.com; this server only ever sees ids and amounts;
 *  - webhooks are verified with `stripe.webhooks.constructEvent` over the exact raw body, which also rejects timestamps older than the
 *    SDK's tolerance (five minutes), the replay protection Stripe documents;
 *  - fulfilment follows Stripe's guidance: a `checkout.session.completed` event is only a trigger. Settlement fetches the session and acts
 *    on `payment_status`, and delayed methods arrive later as `checkout.session.async_payment_succeeded` / `_failed`;
 *  - `Idempotency-Key` is sent on every create call.
 * Stripe availability depends on the country of the business account and the payment methods enabled in its Dashboard; STRIPE_CURRENCIES limits what we offer.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Obj = Record<string, any>;

let client: Stripe | null = null;
let override: Stripe | null = null;
/** Tests supply a client wired to a fake HTTP layer. Pass null to restore. */
export function setStripeClient(c: Stripe | null): void {
  override = c;
}
/** Local demo only (scripts/demo-fake-stripe.mjs): STRIPE_API_BASE points the SDK at a stand-in on this machine. Ignored in production. */
function localStandIn(): { host?: string; port?: string; protocol?: "http" | "https" } {
  const base = process.env.STRIPE_API_BASE;
  if (!base || process.env.NODE_ENV === "production") return {};
  const u = new URL(base);
  return { host: u.hostname, port: u.port || (u.protocol === "https:" ? "443" : "80"), protocol: u.protocol === "https:" ? "https" : "http" };
}
function api(): Stripe {
  if (override) return override;
  if (!cfg.stripeSecret()) throw new ProviderError("Stripe is not configured", "stripe", false, "not_configured");
  return (client ??= new Stripe(cfg.stripeSecret(), { maxNetworkRetries: 2, timeout: 20_000, appInfo: { name: "GrowQR payments" }, ...localStandIn() }));
}

/** Turn an SDK error into a ProviderError that says whether trying again could help. */
function wrap(e: unknown): never {
  if (e instanceof ProviderError) throw e;
  const err = e as { type?: string; statusCode?: number; code?: string; message?: string };
  const status = err.statusCode ?? 0;
  const retryable = err.type === "StripeConnectionError" || err.type === "StripeRateLimitError" || status === 429 || status >= 500 || status === 0;
  throw new ProviderError(`Stripe request failed (${err.type ?? "error"}${err.code ? ", " + err.code : ""})`, "stripe", retryable, err.code ?? err.type ?? "provider_error", status);
}

const id = (v: unknown): string | null => (typeof v === "string" ? v : v && typeof v === "object" && typeof (v as Obj).id === "string" ? (v as Obj).id : null);
const ts = (n: unknown): Date | null => (typeof n === "number" ? new Date(n * 1000) : null);

function toPayment(s: Obj): ProviderPayment {
  const pi = (typeof s.payment_intent === "object" && s.payment_intent) || null;
  const charge = pi && typeof pi.latest_charge === "object" ? (pi.latest_charge as Obj) : null;
  let status: ProviderPayment["status"] = "pending";
  if (s.payment_status === "paid" || s.payment_status === "no_payment_required") status = "succeeded";
  else if (s.status === "expired") status = "expired";
  const err = pi?.last_payment_error as Obj | undefined;
  return {
    sessionRef: String(s.id),
    paymentRef: id(s.payment_intent),
    status,
    amountMinor: Number(s.amount_total ?? 0),
    currency: String(s.currency ?? "").toUpperCase(),
    method: (charge?.payment_method_details?.type as string | undefined) ?? (Array.isArray(pi?.payment_method_types) ? (pi?.payment_method_types as string[])[0] : null) ?? null,
    orderPublicId: (s.client_reference_id as string | null) ?? (s.metadata?.order_id as string | undefined) ?? null,
    refundedMinor: Number(charge?.amount_refunded ?? 0),
    failureCode: (err?.code as string | undefined) ?? null,
    failureMessage: (err?.message as string | undefined) ?? null,
    createdAt: ts(s.created) ?? undefined,
  };
}

function toRefund(r: Obj): ProviderRefund {
  const s = String(r.status);
  return {
    ref: String(r.id),
    paymentRef: id(r.payment_intent) ?? "",
    status: s === "succeeded" ? "succeeded" : s === "failed" || s === "canceled" ? "failed" : "pending",
    amountMinor: Number(r.amount ?? 0),
    currency: String(r.currency ?? "").toUpperCase(),
    receipt: (r.metadata?.refund_id as string | undefined) ?? null,
    reason: (r.reason as string | undefined) ?? null,
  };
}

function toDispute(d: Obj): ProviderDispute {
  const s = String(d.status);
  const status: ProviderDispute["status"] = s === "won" ? "won" : s === "lost" ? "lost" : s.endsWith("under_review") ? "under_review" : s === "needs_response" || s === "warning_needs_response" ? "open" : s === "warning_closed" ? "closed" : "open";
  return { ref: String(d.id), paymentRef: id(d.payment_intent) ?? "", status, amountMinor: Number(d.amount ?? 0), currency: String(d.currency ?? "").toUpperCase(), reason: (d.reason as string | undefined) ?? null, respondBy: ts(d.evidence_details?.due_by) };
}

export const stripe: PaymentProvider = {
  id: "stripe",
  label: "Stripe",
  configured: () => cfg.stripeSecret() !== "",
  webhookConfigured: () => cfg.stripeWebhookSecret() !== "",
  currencies: () => cfg.stripeCurrencies(),
  supports: ({ country, currency }) => cfg.stripeCurrencies().includes(currency.toUpperCase()) && !cfg.blockedCountries().includes(country.toUpperCase()),

  async createPaymentSession(input: SessionInput): Promise<SessionResult> {
    try {
      const currency = input.currency.toLowerCase();
      const lines = input.lines.filter((l) => l.totalMinor > 0).map((l) => ({
        quantity: 1,
        price_data: {
          currency,
          unit_amount: l.totalMinor,
          product_data: { name: (l.qty > 1 ? `${l.title} x ${l.qty}` : l.title).slice(0, 120), ...(l.taxMinor > 0 ? { description: `Includes ${input.taxName || "tax"} ${(l.taxMinor / 100).toFixed(2)}`.slice(0, 200) } : {}) },
        },
      }));
      const session = await api().checkout.sessions.create(
        {
          mode: "payment",
          client_reference_id: input.orderPublicId,
          customer_email: input.customer.email,
          line_items: lines,
          success_url: input.returnUrl,
          cancel_url: input.cancelUrl,
          expires_at: Math.floor(input.expiresAt.getTime() / 1000),
          metadata: { order_id: input.orderPublicId },
          payment_intent_data: { metadata: { order_id: input.orderPublicId }, description: `GrowQR order ${input.orderPublicId}` },
        },
        { idempotencyKey: input.idempotencyKey },
      );
      if (!session.url) throw new ProviderError("Stripe did not return a checkout URL", "stripe", false, "bad_response");
      if (typeof session.amount_total === "number" && session.amount_total !== input.amountMinor) throw new ProviderError("Stripe total does not match the order", "stripe", false, "amount_mismatch");
      return { sessionRef: session.id, checkout: { kind: "redirect", provider: "stripe", url: session.url } };
    } catch (e) {
      return wrap(e);
    }
  },

  async retrievePayment({ sessionRef }): Promise<ProviderPayment> {
    try {
      const s = await api().checkout.sessions.retrieve(sessionRef, { expand: ["payment_intent", "payment_intent.latest_charge"] });
      return toPayment(s as unknown as Obj);
    } catch (e) {
      return wrap(e);
    }
  },

  verifyWebhook(rawBody: string, headers: Headers): ProviderEvent {
    const secret = cfg.stripeWebhookSecret();
    if (!secret) throw new ProviderError("Stripe webhook secret is not set", "stripe", false, "not_configured");
    let ev: Stripe.Event;
    try {
      ev = api().webhooks.constructEvent(rawBody, headers.get("stripe-signature") ?? "", secret);
    } catch {
      throw new ProviderError("Invalid webhook signature or timestamp", "stripe", false, "bad_signature", 400);
    }
    const o = ev.data.object as unknown as Obj;
    const base: ProviderEvent = { provider: "stripe", id: ev.id, type: ev.type, kind: "other", at: ts(ev.created) };
    switch (ev.type) {
      case "checkout.session.completed":
        return { ...base, kind: o.payment_status === "paid" || o.payment_status === "no_payment_required" ? "payment.succeeded" : "payment.pending", sessionRef: String(o.id), paymentRef: id(o.payment_intent), orderPublicId: o.client_reference_id ?? o.metadata?.order_id ?? null };
      case "checkout.session.async_payment_succeeded":
        return { ...base, kind: "payment.succeeded", sessionRef: String(o.id), paymentRef: id(o.payment_intent), orderPublicId: o.client_reference_id ?? o.metadata?.order_id ?? null };
      case "checkout.session.async_payment_failed":
        return { ...base, kind: "payment.failed", sessionRef: String(o.id), paymentRef: id(o.payment_intent), orderPublicId: o.client_reference_id ?? o.metadata?.order_id ?? null };
      case "checkout.session.expired":
        return { ...base, kind: "session.expired", sessionRef: String(o.id), orderPublicId: o.client_reference_id ?? o.metadata?.order_id ?? null };
      case "payment_intent.payment_failed":
        return { ...base, kind: "payment.attempt_failed", paymentRef: String(o.id), orderPublicId: o.metadata?.order_id ?? null, failureCode: o.last_payment_error?.code ?? null, failureMessage: o.last_payment_error?.message ?? null };
      case "charge.refunded":
        return { ...base, kind: "refund.updated", paymentRef: id(o.payment_intent), orderPublicId: o.metadata?.order_id ?? null };
      case "charge.refund.updated":
      case "refund.created":
      case "refund.updated":
      case "refund.failed":
        return { ...base, kind: "refund.updated", paymentRef: id(o.payment_intent), refund: toRefund(o) };
      case "charge.dispute.created":
      case "charge.dispute.updated":
      case "charge.dispute.closed":
        return { ...base, kind: "dispute.updated", paymentRef: id(o.payment_intent), dispute: toDispute(o) };
      default:
        return base;
    }
  },

  async capturePayment() {
    return { supported: false, captured: false }; // Checkout captures automatically
  },

  async cancelPayment(sessionRef) {
    try {
      await api().checkout.sessions.expire(sessionRef);
      return { cancelled: true };
    } catch (e) {
      const err = e as { code?: string; statusCode?: number };
      if (err.statusCode === 400 || err.statusCode === 404) return { cancelled: false }; // already complete or expired
      return wrap(e);
    }
  },

  async createRefund({ paymentRef, amountMinor, refundPublicId, reason, idempotencyKey }) {
    try {
      const r = await api().refunds.create({ payment_intent: paymentRef, amount: amountMinor, reason: "requested_by_customer", metadata: { refund_id: refundPublicId, note: reason.slice(0, 200) } }, { idempotencyKey });
      return toRefund(r as unknown as Obj);
    } catch (e) {
      return wrap(e);
    }
  },

  async retrieveRefund(ref) {
    try {
      return toRefund((await api().refunds.retrieve(ref)) as unknown as Obj);
    } catch (e) {
      return wrap(e);
    }
  },

  async listRefunds(paymentRef) {
    try {
      const l = await api().refunds.list({ payment_intent: paymentRef, limit: 100 });
      return l.data.map((r) => toRefund(r as unknown as Obj));
    } catch (e) {
      return wrap(e);
    }
  },

  async reconcilePayment({ from, to }) {
    try {
      const out: ProviderPayment[] = [];
      const list = api().checkout.sessions.list({ created: { gte: Math.floor(from.getTime() / 1000), lte: Math.floor(to.getTime() / 1000) }, limit: 100, expand: ["data.payment_intent", "data.payment_intent.latest_charge"] });
      for await (const s of list) {
        out.push(toPayment(s as unknown as Obj));
        if (out.length >= 5000) break;
      }
      return out;
    } catch (e) {
      return wrap(e);
    }
  },
};
