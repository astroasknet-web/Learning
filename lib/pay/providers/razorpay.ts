import { createHmac, timingSafeEqual } from "node:crypto";
import { cfg } from "../config";
import { ProviderError, type PaymentProvider, type ProviderDispute, type ProviderEvent, type ProviderPayment, type ProviderRefund, type SessionInput, type SessionResult } from "./types";

/**
 * Razorpay adapter. Based on the Razorpay REST API (Orders, Payments, Refunds) and its webhook rules:
 *  - checkout is Razorpay's hosted Standard Checkout, opened with an order id; card and UPI details never reach this server;
 *  - a webhook is trusted only when X-Razorpay-Signature equals HMAC-SHA256(webhook secret, exact raw body); x-razorpay-event-id is the de-duplication key;
 *  - the browser callback is never trusted: settlement re-reads the payment from Razorpay's API.
 * Razorpay has no idempotency header for orders or refunds, so refund calls are made at most once per local refund row and a timed-out
 * call is resolved by listing the payment's refunds (see refunds.ts).
 */
const API = "https://api.razorpay.com/v1";

type Json = Record<string, unknown>;
export type Transport = (method: string, path: string, body: Json | null) => Promise<{ status: number; json: Json }>;
let transport: Transport | null = null;
/** Tests replace the HTTP call. Pass null to restore. */
export function setRazorpayTransport(t: Transport | null): void {
  transport = t;
}

async function call(method: string, path: string, body: Json | null = null): Promise<Json> {
  const res = transport
    ? await transport(method, path, body)
    : await (async () => {
        try {
          const r = await fetch(API + path, {
            method,
            headers: { "Content-Type": "application/json", Authorization: "Basic " + Buffer.from(`${cfg.razorpayKeyId()}:${cfg.razorpaySecret()}`).toString("base64") },
            body: body === null ? undefined : JSON.stringify(body),
            signal: AbortSignal.timeout(20_000),
          });
          const text = await r.text();
          let json: Json = {};
          try { const v = JSON.parse(text); if (v && typeof v === "object") json = v as Json; } catch { /* not JSON */ }
          return { status: r.status, json };
        } catch {
          return { status: 0, json: {} };
        }
      })();
  if (res.status >= 200 && res.status < 300) return res.json;
  const err = (res.json.error ?? {}) as Json;
  const retryable = res.status === 0 || res.status === 429 || res.status >= 500;
  throw new ProviderError(`Razorpay ${method} ${path.split("?")[0]} failed (${res.status || "no response"}${err.code ? ", " + String(err.code) : ""})`, "razorpay", retryable, String(err.code ?? (res.status === 0 ? "unreachable" : "provider_error")), res.status);
}

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);
const str = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);

function payStatus(s: string): ProviderPayment["status"] {
  switch (s) {
    case "captured": case "refunded": return "succeeded";
    case "authorized": return "authorized";
    case "failed": return "failed";
    default: return "pending"; // created
  }
}

function toPayment(p: Json, order: Json | null): ProviderPayment {
  const notes = ((order?.notes ?? p.notes ?? {}) as Json);
  return {
    sessionRef: str(p.order_id) ?? "",
    paymentRef: str(p.id),
    status: payStatus(String(p.status)),
    amountMinor: num(p.amount),
    currency: String(p.currency ?? "").toUpperCase(),
    method: str(p.method),
    orderPublicId: str(notes.order_id) ?? str(order?.receipt),
    refundedMinor: num(p.amount_refunded),
    failureCode: str(p.error_code),
    failureMessage: str(p.error_description),
    createdAt: p.created_at ? new Date(num(p.created_at) * 1000) : undefined,
  };
}

function toRefund(r: Json): ProviderRefund {
  const s = String(r.status);
  return {
    ref: String(r.id),
    paymentRef: String(r.payment_id ?? ""),
    status: s === "processed" ? "succeeded" : s === "failed" ? "failed" : "pending",
    amountMinor: num(r.amount),
    currency: String(r.currency ?? "").toUpperCase(),
    receipt: str(r.receipt) ?? str(((r.notes ?? {}) as Json).refund_id),
  };
}

function toDispute(d: Json): ProviderDispute {
  const s = String(d.status);
  return {
    ref: String(d.id),
    paymentRef: String(d.payment_id ?? ""),
    status: s === "won" ? "won" : s === "lost" ? "lost" : s === "closed" ? "closed" : s === "under_review" ? "under_review" : "open",
    amountMinor: num(d.amount),
    currency: String(d.currency ?? "").toUpperCase(),
    reason: str(d.reason_code),
    respondBy: d.respond_by ? new Date(num(d.respond_by) * 1000) : null,
  };
}

function safeEqualHex(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export const razorpay: PaymentProvider = {
  id: "razorpay",
  label: "Razorpay",
  configured: () => cfg.razorpayKeyId() !== "" && cfg.razorpaySecret() !== "",
  webhookConfigured: () => cfg.razorpayWebhookSecret() !== "",
  currencies: () => cfg.razorpayCurrencies(),
  supports: ({ country, currency }) => cfg.razorpayCurrencies().includes(currency.toUpperCase()) && cfg.razorpayCountries().includes(country.toUpperCase()),

  async createPaymentSession(input: SessionInput): Promise<SessionResult> {
    const order = await call("POST", "/orders", {
      amount: input.amountMinor,
      currency: input.currency,
      receipt: input.orderPublicId,
      notes: { order_id: input.orderPublicId },
    });
    const id = str(order.id);
    if (!id || num(order.amount) !== input.amountMinor) throw new ProviderError("Razorpay returned an unexpected order", "razorpay", false, "bad_response");
    return {
      sessionRef: id,
      checkout: {
        kind: "razorpay", provider: "razorpay", keyId: cfg.razorpayKeyId(), orderId: id, amountMinor: input.amountMinor, currency: input.currency,
        name: cfg.seller().name, description: input.lines.map((l) => l.title).join(", ").slice(0, 250),
        prefill: { name: input.customer.name, email: input.customer.email }, notes: { order_id: input.orderPublicId },
      },
    };
  },

  async retrievePayment({ sessionRef, paymentRef }): Promise<ProviderPayment> {
    const order = await call("GET", `/orders/${encodeURIComponent(sessionRef)}`);
    let pay: Json | null = null;
    if (paymentRef) {
      pay = await call("GET", `/payments/${encodeURIComponent(paymentRef)}`);
      if (str(pay.order_id) !== sessionRef) throw new ProviderError("Payment does not belong to this order", "razorpay", false, "order_mismatch");
    } else {
      const list = (await call("GET", `/orders/${encodeURIComponent(sessionRef)}/payments`)) as { items?: Json[] };
      const items = list.items ?? [];
      const rank = (p: Json): number => ({ captured: 4, authorized: 3, created: 2, failed: 1 } as Record<string, number>)[String(p.status)] ?? 0;
      pay = [...items].sort((a, b) => rank(b) - rank(a) || num(b.created_at) - num(a.created_at))[0] ?? null;
    }
    if (!pay) {
      return { sessionRef, paymentRef: null, status: String(order.status) === "paid" ? "succeeded" : "pending", amountMinor: num(order.amount), currency: String(order.currency ?? "").toUpperCase(), method: null, orderPublicId: str(((order.notes ?? {}) as Json).order_id) ?? str(order.receipt), refundedMinor: 0 };
    }
    return toPayment(pay, order);
  },

  verifyWebhook(rawBody: string, headers: Headers): ProviderEvent {
    const secret = cfg.razorpayWebhookSecret();
    const given = headers.get("x-razorpay-signature") ?? "";
    if (!secret) throw new ProviderError("Razorpay webhook secret is not set", "razorpay", false, "not_configured");
    const want = createHmac("sha256", secret).update(rawBody).digest("hex");
    if (!given || !safeEqualHex(want, given)) throw new ProviderError("Invalid webhook signature", "razorpay", false, "bad_signature", 400);
    let body: Json;
    try { body = JSON.parse(rawBody) as Json; } catch { throw new ProviderError("Webhook body is not JSON", "razorpay", false, "bad_body", 400); }
    const type = String(body.event ?? "");
    const created = body.created_at ? new Date(num(body.created_at) * 1000) : null;
    if (created && created.getTime() > Date.now() + 10 * 60_000) throw new ProviderError("Webhook timestamp is in the future", "razorpay", false, "bad_timestamp", 400);
    // The de-duplication key is Razorpay's event id; if it is ever missing, a hash of the exact body is just as stable for retries.
    const id = headers.get("x-razorpay-event-id") || "body_" + createHmac("sha256", "event-id").update(rawBody).digest("hex").slice(0, 40);
    const payload = (body.payload ?? {}) as Record<string, { entity?: Json }>;
    const pay = payload.payment?.entity;
    const order = payload.order?.entity;
    const base: ProviderEvent = {
      provider: "razorpay", id, type, kind: "other", at: created,
      sessionRef: str(pay?.order_id) ?? str(order?.id), paymentRef: str(pay?.id), orderPublicId: str(((order?.notes ?? pay?.notes ?? {}) as Json).order_id),
    };
    switch (type) {
      case "payment.captured": case "order.paid": return { ...base, kind: "payment.succeeded" };
      case "payment.authorized": return { ...base, kind: "payment.authorized" };
      case "payment.failed": return { ...base, kind: "payment.attempt_failed", failureCode: str(pay?.error_code), failureMessage: str(pay?.error_description) };
      case "refund.created": case "refund.processed": case "refund.failed": case "refund.speed_changed": {
        const r = payload.refund?.entity;
        return r ? { ...base, kind: "refund.updated", paymentRef: str(r.payment_id) ?? base.paymentRef, refund: toRefund(r) } : base;
      }
      default:
        if (type.startsWith("payment.dispute.")) {
          const d = payload.dispute?.entity;
          return d ? { ...base, kind: "dispute.updated", paymentRef: str(d.payment_id) ?? base.paymentRef, dispute: toDispute(d) } : base;
        }
        return base;
    }
  },

  async capturePayment({ paymentRef, amountMinor, currency }) {
    await call("POST", `/payments/${encodeURIComponent(paymentRef)}/capture`, { amount: amountMinor, currency });
    return { supported: true, captured: true };
  },

  async cancelPayment() {
    return { cancelled: false }; // Razorpay orders cannot be cancelled; an unpaid order simply expires on our side.
  },

  async createRefund({ paymentRef, amountMinor, refundPublicId, reason }) {
    const r = await call("POST", `/payments/${encodeURIComponent(paymentRef)}/refund`, { amount: amountMinor, speed: "normal", receipt: refundPublicId, notes: { refund_id: refundPublicId, reason: reason.slice(0, 200) } });
    return toRefund({ ...r, payment_id: paymentRef });
  },

  async retrieveRefund(ref, paymentRef) {
    const r = await call("GET", `/refunds/${encodeURIComponent(ref)}`);
    return toRefund({ ...r, payment_id: r.payment_id ?? paymentRef });
  },

  async listRefunds(paymentRef) {
    const r = (await call("GET", `/payments/${encodeURIComponent(paymentRef)}/refunds`)) as { items?: Json[] };
    return (r.items ?? []).map((x) => toRefund({ ...x, payment_id: paymentRef }));
  },

  async reconcilePayment({ from, to }) {
    const out: ProviderPayment[] = [];
    for (let skip = 0; skip < 5000; skip += 100) {
      const page = (await call("GET", `/payments?from=${Math.floor(from.getTime() / 1000)}&to=${Math.floor(to.getTime() / 1000)}&count=100&skip=${skip}`)) as { items?: Json[] };
      const items = page.items ?? [];
      for (const p of items) out.push(toPayment(p, null));
      if (items.length < 100) break;
    }
    return out;
  },
};
