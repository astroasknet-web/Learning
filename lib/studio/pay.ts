import { createHmac, timingSafeEqual } from "node:crypto";
import { one, run, tx, val } from "../portal/db";
import * as access from "./access";

/**
 * Razorpay checkout for the Resume Studio Pro plan (INR, one payment = one period; no auto-renewal). Port of Studio\Pay.
 *
 * Security rules this module keeps:
 *  - the amount is decided here from settings, never taken from the browser;
 *  - a checkout order belongs to one user and is only ever paid once (unique order_id and payment_id);
 *  - the browser callback is trusted only after the HMAC signature (order_id|payment_id) checks out in constant time,
 *    and the payment is then confirmed with Razorpay's API when it can be reached;
 *  - the webhook is trusted only with a valid X-Razorpay-Signature over the raw body;
 *  - card details never touch this server: Razorpay's hosted checkout handles them.
 *
 * Environment: RAZORPAY_KEY_ID (or NEXT_PUBLIC_RAZORPAY_KEY_ID), RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET.
 */
const API = "https://api.razorpay.com/v1";

type Json = Record<string, unknown>;
export type HttpHook = (method: string, path: string, body: Json | null) => Promise<[number, Json]>;
let http: HttpHook | null = null;
/** Test hook: replace the real HTTP call. Pass null to restore. */
export function setHttp(h: HttpHook | null): void {
  http = h;
}

/** Other modules (the CRM verification fee) register themselves for orders that are not Studio orders. */
export type UnknownOrderHandler = (orderId: string, paymentId: string, payment: Json) => Promise<{ status: number; message: string }>;
let unknownOrder: UnknownOrderHandler | null = null;
export function setUnknownOrderHandler(h: UnknownOrderHandler | null): void {
  unknownOrder = h;
}

const keyId = (): string => process.env.RAZORPAY_KEY_ID ?? process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? "";
const keySecret = (): string => process.env.RAZORPAY_KEY_SECRET ?? "";
const webhookSecret = (): string => process.env.RAZORPAY_WEBHOOK_SECRET ?? "";

export const enabled = (): boolean => keyId() !== "" && keySecret() !== "";
export const publicKey = (): string => keyId();

function hmac(secret: string, data: string): string {
  return createHmac("sha256", secret).update(data).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function signatureValid(orderId: string, paymentId: string, signature: string, secret: string): boolean {
  return secret !== "" && signature !== "" && safeEqual(hmac(secret, `${orderId}|${paymentId}`), signature);
}

/** Same Razorpay call for other modules (the CRM verification fee uses it). */
export const api = (method: string, path: string, body: Json | null = null): Promise<[number, Json]> => call(method, path, body);

async function call(method: string, path: string, body: Json | null = null): Promise<[number, Json]> {
  if (http) return http(method, path, body);
  try {
    const res = await fetch(API + path, {
      method,
      headers: { "Content-Type": "application/json", Authorization: "Basic " + Buffer.from(`${keyId()}:${keySecret()}`).toString("base64") },
      body: body === null ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
    const text = await res.text();
    let parsed: Json = {};
    try {
      const v = JSON.parse(text);
      if (v && typeof v === "object") parsed = v as Json;
    } catch {
      /* not JSON */
    }
    return [res.status, parsed];
  } catch {
    return [0, {}];
  }
}

interface PaymentRow { id: number; user_id: number; order_id: string; payment_id: string | null; amount_paise: number; currency: string; status: string }

export class PayError extends Error {}

/** Create a checkout order for the user. */
export async function createOrder(uid: number): Promise<{ order_id: string; amount: number; currency: string; key: string }> {
  if (!enabled()) throw new PayError("Online payment is not switched on yet.");
  const recent = Number(await val("SELECT COUNT(*) FROM studio_payments WHERE user_id = $1 AND created_at > LOCALTIMESTAMP(0) - INTERVAL '1 hour'", [uid]));
  if (recent >= 6) throw new PayError("Too many payment attempts. Please wait a little and try again.");
  const amount = access.pricePaise();
  const receipt = `rs${uid}-${Math.floor(Date.now() / 1000)}`;
  const [code, res] = await call("POST", "/orders", { amount, currency: "INR", receipt, notes: { user_id: String(uid), product: "resume-studio-pro" } });
  if (code < 200 || code >= 300 || !res.id) {
    console.error("razorpay order failed: HTTP", code, JSON.stringify(res));
    throw new PayError("Could not start the payment. Please try again in a moment.");
  }
  await run("INSERT INTO studio_payments (user_id, order_id, amount_paise, currency, status, receipt) VALUES ($1, $2, $3, $4, $5, $6)", [uid, String(res.id), amount, "INR", "created", receipt]);
  return { order_id: String(res.id), amount, currency: "INR", key: keyId() };
}

/** Mark an order paid and grant Pro, exactly once. Safe to call repeatedly (browser callback and webhook can both arrive). */
async function settle(orderId: string, paymentId: string): Promise<boolean> {
  try {
    return await tx(async (c) => {
      const up = await c.query("UPDATE studio_payments SET status = 'paid', payment_id = $1, paid_at = LOCALTIMESTAMP(0) WHERE order_id = $2 AND status <> 'paid'", [paymentId, orderId]);
      if (up.rowCount !== 1) return false;
      const row = (await c.query("SELECT user_id, amount_paise FROM studio_payments WHERE order_id = $1", [orderId])).rows[0];
      await access.grant(Number(row.user_id), "razorpay", paymentId, Number(row.amount_paise), null, c);
      return true;
    });
  } catch (e) {
    console.error("studio settle:", e instanceof Error ? e.message : e);
    return false;
  }
}

/** Check the payment with Razorpay's API (capturing an authorised one). false = Razorpay says it does not match; true = fine or unreachable. */
async function confirm(order: PaymentRow, paymentId: string): Promise<boolean> {
  const [code, p] = await call("GET", "/payments/" + encodeURIComponent(paymentId));
  if (code === 0 || code >= 500 || Object.keys(p).length === 0) return true; // Razorpay unreachable: the signed callback already proves the payment
  if (code !== 200 || (p.order_id ?? "") !== order.order_id || Math.trunc(Number(p.amount ?? 0)) !== Number(order.amount_paise) || (p.currency ?? "") !== "INR") return false;
  const status = String(p.status ?? "");
  if (status === "authorized") {
    const [cc, cap] = await call("POST", "/payments/" + encodeURIComponent(paymentId) + "/capture", { amount: Number(order.amount_paise), currency: "INR" });
    return cc === 200 && cap.status === "captured";
  }
  return status === "captured";
}

/** The browser reports a finished payment. */
export async function verifyCallback(uid: number, orderId: string, paymentId: string, signature: string): Promise<{ ok: boolean; message: string }> {
  const order = await one<PaymentRow>("SELECT * FROM studio_payments WHERE order_id = $1 AND user_id = $2", [orderId, uid]);
  if (!order) return { ok: false, message: "We could not find that payment." };
  if (order.status === "paid") return { ok: true, message: "Resume Studio Pro is already active." };
  if (!signatureValid(orderId, paymentId, signature, keySecret())) {
    return { ok: false, message: "The payment could not be verified. If money was taken it will be returned automatically; contact support with this payment reference: " + paymentId };
  }
  if (!(await confirm(order, paymentId))) return { ok: false, message: "The payment details did not match. Please contact support with reference " + paymentId + "." };
  await settle(orderId, paymentId);
  return { ok: true, message: "Payment received. Resume Studio Pro is now active." };
}

/** Razorpay webhook. */
export async function webhook(rawBody: string, signatureHeader: string): Promise<{ status: number; message: string }> {
  const secret = webhookSecret();
  if (secret === "" || signatureHeader === "" || !safeEqual(hmac(secret, rawBody), signatureHeader)) return { status: 400, message: "bad signature" };
  let ev: Json = {};
  try {
    const v = JSON.parse(rawBody);
    if (v && typeof v === "object") ev = v as Json;
  } catch {
    /* treated as an ignored event */
  }
  const event = String(ev.event ?? "");
  if (event !== "payment.captured" && event !== "order.paid") return { status: 200, message: "ignored" };
  const payload = (ev.payload ?? {}) as Json;
  const pay = (((payload.payment ?? {}) as Json).entity ?? {}) as Json;
  const orderEntity = (((payload.order ?? {}) as Json).entity ?? {}) as Json;
  const orderId = String(pay.order_id ?? orderEntity.id ?? "");
  const paymentId = String(pay.id ?? "");
  const order = orderId !== "" ? await one<PaymentRow>("SELECT * FROM studio_payments WHERE order_id = $1", [orderId]) : null;
  if (!order && orderId !== "" && paymentId !== "") {
    return unknownOrder ? unknownOrder(orderId, paymentId, pay) : { status: 200, message: "unknown order" };
  }
  if (!order || paymentId === "") return { status: 200, message: "unknown order" };
  if (Math.trunc(Number(pay.amount ?? 0)) !== Number(order.amount_paise) || (pay.currency ?? "INR") !== "INR" || (pay.status ?? "captured") !== "captured") return { status: 200, message: "mismatch" };
  await settle(orderId, paymentId);
  return { status: 200, message: "ok" };
}
