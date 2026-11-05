import { createHmac } from "node:crypto";
import Stripe from "stripe";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { redact } from "./audit";
import { formatMoney, minorUnits, parseAmount, plainAmount } from "./money";
import { allocate, applyCoupon, computeTotals } from "./pricing";
import { activeProviders, providersFor, selectProvider } from "./providers";
import { razorpay } from "./providers/razorpay";
import { setStripeClient, stripe } from "./providers/stripe";
import { ProviderError } from "./providers/types";
import { assertTransition, canOrder, canPayment, canRefund, deriveOrderStatus, derivePaymentStatus, IllegalTransition } from "./state";
import { verifyTruth } from "./settle";
import { hashToken, newAccessToken, newOrderId, tokenMatches } from "./ids";

/** Pure logic and provider adapters, with no database and no network. */

describe("money", () => {
  it("knows each currency's minor unit", () => {
    expect(minorUnits("INR")).toBe(2);
    expect(minorUnits("JPY")).toBe(0);
    expect(minorUnits("KWD")).toBe(3);
  });
  it("parses decimal text exactly, with no floating point drift", () => {
    expect(parseAmount("499", "INR")).toBe(49900);
    expect(parseAmount("1,499.50", "INR")).toBe(149950);
    expect(parseAmount("0.10", "USD") + parseAmount("0.20", "USD")).toBe(30); // 0.1 + 0.2 is the classic float trap
    expect(parseAmount("5000", "JPY")).toBe(5000);
    expect(parseAmount("1.234", "KWD")).toBe(1234);
  });
  it("rejects ambiguous or out-of-range amounts", () => {
    expect(() => parseAmount("1.999", "USD")).toThrow();
    expect(() => parseAmount("-5", "USD")).toThrow();
    expect(() => parseAmount("abc", "USD")).toThrow();
    expect(() => parseAmount("99999999999999", "USD")).toThrow();
    expect(() => parseAmount("10.5", "JPY")).toThrow();
  });
  it("formats for the locale and writes plain decimals for machines", () => {
    expect(formatMoney(319900, "INR", "en-IN")).toBe("₹3,199.00");
    expect(formatMoney(4900, "USD", "en-US")).toBe("$49.00");
    expect(plainAmount(319900, "INR")).toBe("3199.00");
    expect(plainAmount(5, "USD")).toBe("0.05");
    expect(plainAmount(500, "JPY")).toBe("500");
  });
});

describe("pricing", () => {
  it("adds tax on top of a tax-exclusive price", () => {
    const t = computeTotals([{ unitMinor: 10000, qty: 1, taxInclusive: false }], { taxRateBp: 1800 });
    expect(t.taxMinor).toBe(1800);
    expect(t.totalMinor).toBe(11800);
  });
  it("finds the tax inside a tax-inclusive price and charges the listed amount", () => {
    const t = computeTotals([{ unitMinor: 11800, qty: 1, taxInclusive: true }], { taxRateBp: 1800 });
    expect(t.taxMinor).toBe(1800);
    expect(t.totalMinor).toBe(11800);
  });
  it("charges no tax when there is no rule", () => {
    const t = computeTotals([{ unitMinor: 39900, qty: 1, taxInclusive: true }]);
    expect(t.taxMinor).toBe(0);
    expect(t.totalMinor).toBe(39900);
  });
  it("splits a discount so lines always add up to the total", () => {
    const t = computeTotals([{ unitMinor: 333, qty: 1, taxInclusive: true }, { unitMinor: 333, qty: 1, taxInclusive: true }, { unitMinor: 334, qty: 1, taxInclusive: true }], { discountMinor: 100, taxRateBp: 1800 });
    expect(t.discountMinor).toBe(100);
    expect(t.lines.reduce((a, l) => a + l.discountMinor, 0)).toBe(100);
    expect(t.lines.reduce((a, l) => a + l.totalMinor, 0)).toBe(t.totalMinor);
    expect(t.totalMinor).toBe(900);
  });
  it("never discounts below zero", () => {
    const t = computeTotals([{ unitMinor: 500, qty: 1, taxInclusive: true }], { discountMinor: 9999 });
    expect(t.totalMinor).toBe(0);
    expect(t.discountMinor).toBe(500);
  });
  it("applies percent and fixed coupons", () => {
    expect(applyCoupon(39900, { kind: "percent", percentBp: 2500 })).toBe(9975);
    expect(applyCoupon(1000, { kind: "fixed", fixedMinor: 5000 })).toBe(1000);
  });
  it("allocates with the largest remainder", () => {
    expect(allocate(10, [1, 1, 1])).toEqual([4, 3, 3]);
    expect(allocate(0, [1, 2])).toEqual([0, 0]);
  });
  it("rejects bad lines", () => {
    expect(() => computeTotals([{ unitMinor: -1, qty: 1, taxInclusive: true }])).toThrow();
    expect(() => computeTotals([{ unitMinor: 100, qty: 0, taxInclusive: true }])).toThrow();
  });
});

describe("state machines", () => {
  it("allows the normal order path and refuses shortcuts", () => {
    expect(canOrder("pending", "paid")).toBe(true);
    expect(canOrder("paid", "fulfilled")).toBe(true);
    expect(canOrder("fulfilled", "partially_refunded")).toBe(true);
    expect(canOrder("pending", "fulfilled")).toBe(false);
    expect(canOrder("refunded", "paid")).toBe(false);
    expect(() => assertTransition("order", "refunded", "paid")).toThrow(IllegalTransition);
  });
  it("lets a late payment rescue an expired order, but nothing else leave it", () => {
    expect(canOrder("expired", "paid")).toBe(true);
    expect(canOrder("expired", "pending")).toBe(false);
  });
  it("never moves a succeeded payment back to failed", () => {
    expect(canPayment("succeeded", "failed")).toBe(false);
    expect(canPayment("succeeded", "pending")).toBe(false);
    expect(canPayment("pending", "succeeded")).toBe(true);
  });
  it("refunds only move forward, and final states stay final", () => {
    expect(canRefund("requested", "pending")).toBe(true);
    expect(canRefund("succeeded", "failed")).toBe(false);
    expect(canRefund("failed", "succeeded")).toBe(false);
  });
  it("derives statuses from the facts", () => {
    const base = { current: "paid" as const, paymentSucceeded: true, fulfilled: true, totalMinor: 1000, refundedMinor: 0, disputeOpen: false };
    expect(deriveOrderStatus(base)).toBe("fulfilled");
    expect(deriveOrderStatus({ ...base, refundedMinor: 400 })).toBe("partially_refunded");
    expect(deriveOrderStatus({ ...base, refundedMinor: 1000 })).toBe("refunded");
    expect(deriveOrderStatus({ ...base, disputeOpen: true })).toBe("disputed");
    expect(deriveOrderStatus({ ...base, paymentSucceeded: false, current: "pending" })).toBe("pending");
    expect(derivePaymentStatus({ current: "succeeded", succeeded: true, amountMinor: 1000, refundedMinor: 1000, disputeOpen: false })).toBe("refunded");
  });
});

describe("ids and tokens", () => {
  it("makes unguessable ids and checks guest tokens in constant time", () => {
    const a = newOrderId();
    expect(a).toMatch(/^ord_[a-z2-9]{20}$/);
    expect(newOrderId()).not.toBe(a);
    const t = newAccessToken();
    expect(tokenMatches(t, hashToken(t))).toBe(true);
    expect(tokenMatches(t + "x", hashToken(t))).toBe(false);
  });
});

describe("audit redaction", () => {
  it("removes credentials and card-like fields", () => {
    const r = redact({ ok: 1, apiKey: "sk_live_abc", nested: { card_number: "4242", authorization: "Bearer x", fine: "yes" }, signature: "abc" }) as Record<string, unknown>;
    expect(r.apiKey).toBe("[removed]");
    expect((r.nested as Record<string, unknown>).card_number).toBe("[removed]");
    expect((r.nested as Record<string, unknown>).authorization).toBe("[removed]");
    expect((r.nested as Record<string, unknown>).fine).toBe("yes");
    expect(r.signature).toBe("[removed]");
  });
});

describe("settlement checks", () => {
  const pay = { amount_minor: 39900, currency: "INR" };
  const order = { public_id: "ord_abc" };
  const t = { sessionRef: "s", paymentRef: "p", status: "succeeded" as const, amountMinor: 39900, currency: "INR", method: "upi", orderPublicId: "ord_abc", refundedMinor: 0 };
  it("accepts a matching payment", () => expect(verifyTruth(t, pay, order)).toBeNull());
  it("rejects a different order, amount or currency", () => {
    expect(verifyTruth({ ...t, orderPublicId: "ord_other" }, pay, order)).toMatch(/different order/);
    expect(verifyTruth({ ...t, amountMinor: 100 }, pay, order)).toMatch(/amount differs/);
    expect(verifyTruth({ ...t, currency: "USD" }, pay, order)).toMatch(/currency differs/);
    expect(verifyTruth({ ...t, orderPublicId: null }, pay, order)).toMatch(/not linked/);
  });
});

describe("Razorpay webhooks", () => {
  const secret = "whsec_test_razorpay";
  const body = JSON.stringify({ event: "payment.captured", created_at: Math.floor(Date.now() / 1000), payload: { payment: { entity: { id: "pay_1", order_id: "order_1", status: "captured", amount: 100, currency: "INR" } } } });
  const sign = (b: string, s = secret): string => createHmac("sha256", s).update(b).digest("hex");
  beforeEach(() => { process.env.PAY_RAZORPAY_WEBHOOK_SECRET = secret; });
  afterEach(() => { delete process.env.PAY_RAZORPAY_WEBHOOK_SECRET; });

  it("accepts a correctly signed body and reads the event id from the header", () => {
    const ev = razorpay.verifyWebhook(body, new Headers({ "x-razorpay-signature": sign(body), "x-razorpay-event-id": "evt_1" }));
    expect(ev).toMatchObject({ provider: "razorpay", id: "evt_1", kind: "payment.succeeded", paymentRef: "pay_1", sessionRef: "order_1" });
  });
  it("rejects a wrong signature, a missing signature and a changed body", () => {
    expect(() => razorpay.verifyWebhook(body, new Headers({ "x-razorpay-signature": sign(body, "other") }))).toThrow(ProviderError);
    expect(() => razorpay.verifyWebhook(body, new Headers())).toThrow(ProviderError);
    expect(() => razorpay.verifyWebhook(body + " ", new Headers({ "x-razorpay-signature": sign(body) }))).toThrow(ProviderError);
  });
  it("refuses everything when no secret is configured (fail closed)", () => {
    delete process.env.PAY_RAZORPAY_WEBHOOK_SECRET;
    expect(() => razorpay.verifyWebhook(body, new Headers({ "x-razorpay-signature": sign(body) }))).toThrow(ProviderError);
  });
  it("rejects an event stamped far in the future", () => {
    const future = JSON.stringify({ event: "payment.captured", created_at: Math.floor(Date.now() / 1000) + 3600, payload: {} });
    expect(() => razorpay.verifyWebhook(future, new Headers({ "x-razorpay-signature": sign(future) }))).toThrow(/future/);
  });
  it("maps refund and dispute events", () => {
    const refund = JSON.stringify({ event: "refund.processed", payload: { refund: { entity: { id: "rfnd_1", payment_id: "pay_1", amount: 500, currency: "INR", status: "processed", notes: { refund_id: "ref_abc" } } } } });
    const ev = razorpay.verifyWebhook(refund, new Headers({ "x-razorpay-signature": sign(refund), "x-razorpay-event-id": "evt_2" }));
    expect(ev.kind).toBe("refund.updated");
    expect(ev.refund).toMatchObject({ ref: "rfnd_1", status: "succeeded", amountMinor: 500, receipt: "ref_abc" });
    const dispute = JSON.stringify({ event: "payment.dispute.created", payload: { dispute: { entity: { id: "disp_1", payment_id: "pay_1", amount: 500, currency: "INR", status: "open", reason_code: "fraud" } } } });
    const dv = razorpay.verifyWebhook(dispute, new Headers({ "x-razorpay-signature": sign(dispute), "x-razorpay-event-id": "evt_3" }));
    expect(dv.kind).toBe("dispute.updated");
    expect(dv.dispute?.status).toBe("open");
  });
});

describe("Stripe webhooks", () => {
  const secret = "whsec_test_stripe";
  const client = new Stripe("sk_test_unit");
  beforeEach(() => { process.env.STRIPE_WEBHOOK_SECRET = secret; setStripeClient(client); });
  afterEach(() => { delete process.env.STRIPE_WEBHOOK_SECRET; setStripeClient(null); });
  const payload = (type: string, object: Record<string, unknown>, id = "evt_s1"): string => JSON.stringify({ id, object: "event", type, created: Math.floor(Date.now() / 1000), data: { object } });
  const header = (p: string, ts?: number): string => client.webhooks.generateTestHeaderString({ payload: p, secret, timestamp: ts });

  it("accepts a signed event and maps a paid checkout session", () => {
    const p = payload("checkout.session.completed", { id: "cs_1", payment_status: "paid", payment_intent: "pi_1", client_reference_id: "ord_x" });
    const ev = stripe.verifyWebhook(p, new Headers({ "stripe-signature": header(p) }));
    expect(ev).toMatchObject({ id: "evt_s1", kind: "payment.succeeded", sessionRef: "cs_1", paymentRef: "pi_1", orderPublicId: "ord_x" });
  });
  it("treats an unpaid completed session (delayed method) as pending, and the async events as success or failure", () => {
    const pend = payload("checkout.session.completed", { id: "cs_2", payment_status: "unpaid", payment_intent: "pi_2" });
    expect(stripe.verifyWebhook(pend, new Headers({ "stripe-signature": header(pend) })).kind).toBe("payment.pending");
    const ok = payload("checkout.session.async_payment_succeeded", { id: "cs_2", payment_intent: "pi_2" }, "evt_s2");
    expect(stripe.verifyWebhook(ok, new Headers({ "stripe-signature": header(ok) })).kind).toBe("payment.succeeded");
    const bad = payload("checkout.session.async_payment_failed", { id: "cs_2", payment_intent: "pi_2" }, "evt_s3");
    expect(stripe.verifyWebhook(bad, new Headers({ "stripe-signature": header(bad) })).kind).toBe("payment.failed");
  });
  it("rejects a wrong secret, a tampered body and an old timestamp (replay)", () => {
    const p = payload("checkout.session.completed", { id: "cs_1", payment_status: "paid" });
    const wrong = new Stripe("sk_test_unit").webhooks.generateTestHeaderString({ payload: p, secret: "whsec_other" });
    expect(() => stripe.verifyWebhook(p, new Headers({ "stripe-signature": wrong }))).toThrow(ProviderError);
    expect(() => stripe.verifyWebhook(p + " ", new Headers({ "stripe-signature": header(p) }))).toThrow(ProviderError);
    expect(() => stripe.verifyWebhook(p, new Headers({ "stripe-signature": header(p, Math.floor(Date.now() / 1000) - 3600) }))).toThrow(ProviderError);
    expect(() => stripe.verifyWebhook(p, new Headers())).toThrow(ProviderError);
  });
  it("fails closed without a secret", () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const p = payload("checkout.session.completed", { id: "cs_1" });
    expect(() => stripe.verifyWebhook(p, new Headers({ "stripe-signature": header(p) }))).toThrow(ProviderError);
  });
  it("maps a dispute", () => {
    const p = payload("charge.dispute.created", { id: "dp_1", payment_intent: "pi_1", amount: 5000, currency: "usd", status: "needs_response", reason: "fraudulent", evidence_details: { due_by: 1_900_000_000 } }, "evt_s9");
    const ev = stripe.verifyWebhook(p, new Headers({ "stripe-signature": header(p) }));
    expect(ev.kind).toBe("dispute.updated");
    expect(ev.dispute).toMatchObject({ ref: "dp_1", status: "open", amountMinor: 5000, currency: "USD" });
  });
});

describe("provider routing", () => {
  beforeEach(() => {
    process.env.RAZORPAY_KEY_ID = "rzp_test_x"; process.env.RAZORPAY_KEY_SECRET = "s"; process.env.STRIPE_SECRET_KEY = "sk_test_x";
  });
  afterEach(() => { for (const k of ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "STRIPE_SECRET_KEY", "PAY_ENABLED_PROVIDERS", "STRIPE_CURRENCIES", "PAY_BLOCKED_COUNTRIES"]) delete process.env[k]; });

  it("sends India and INR to Razorpay, and everyone else to Stripe", () => {
    expect(selectProvider({ country: "IN", currency: "INR" })?.id).toBe("razorpay");
    expect(selectProvider({ country: "US", currency: "USD" })?.id).toBe("stripe");
    expect(selectProvider({ country: "GB", currency: "GBP" })?.id).toBe("stripe");
  });
  it("never offers a provider that does not support the currency", () => {
    expect(selectProvider({ country: "IN", currency: "USD" })?.id).toBe("stripe"); // Razorpay is INR only by default; Stripe supports USD
    expect(selectProvider({ country: "US", currency: "INR" })).toBeNull(); // Razorpay needs an Indian customer; Stripe is not set up for INR
    expect(selectProvider({ country: "US", currency: "XYZ" })).toBeNull();
  });
  it("respects a requested provider only if it supports the payment", () => {
    expect(selectProvider({ country: "IN", currency: "INR", requested: "stripe" })).toBeNull();
    expect(selectProvider({ country: "IN", currency: "INR", requested: "razorpay" })?.id).toBe("razorpay");
  });
  it("blocks sanctioned countries for Stripe and honours the enabled list", () => {
    expect(providersFor({ country: "IR", currency: "USD" })).toHaveLength(0);
    process.env.PAY_ENABLED_PROVIDERS = "stripe";
    expect(activeProviders().map((p) => p.id)).toEqual(["stripe"]);
    expect(selectProvider({ country: "IN", currency: "INR" })).toBeNull();
  });
  it("offers nothing when no provider is configured", () => {
    delete process.env.RAZORPAY_KEY_ID; delete process.env.RAZORPAY_KEY_SECRET; delete process.env.STRIPE_SECRET_KEY;
    expect(activeProviders()).toHaveLength(0);
    expect(selectProvider({ country: "IN", currency: "INR" })).toBeNull();
  });
});
