import { z } from "zod";
import { auditIn } from "./audit";
import { pricesFor, productsBySku, taxRule, type Price, type Product } from "./catalogue";
import { cfg } from "./config";
import { dbTime, exec, first, fromDb, insertId, pool, rows, tx, type Db, type Row } from "./db";
import { hashToken, newAccessToken, newOrderId, tokenMatches } from "./ids";
import { isCurrencyCode, MAX_MINOR } from "./money";
import { applyCoupon, computeTotals } from "./pricing";
import { payableCurrencies } from "./providers";
import { assertTransition, type OrderStatus } from "./state";

/** Orders: validation, server-side pricing, persistence, and who may read one. */
export class PayError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 400, public readonly details?: Record<string, unknown>) {
    super(message);
  }
}

const emailRe = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;

export const createOrderSchema = z.object({
  items: z.array(z.object({ sku: z.string().regex(/^[a-z0-9][a-z0-9_.-]{0,79}$/i), qty: z.number().int().min(1).max(20) })).min(1).max(10),
  country: z.string().regex(/^[A-Za-z]{2}$/).transform((s) => s.toUpperCase()),
  currency: z.string().regex(/^[A-Za-z]{3}$/).transform((s) => s.toUpperCase()).optional(),
  coupon: z.string().trim().min(2).max(40).optional(),
  provider: z.enum(["razorpay", "stripe"]).optional(),
  billing: z.object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().toLowerCase().max(254).refine((s) => emailRe.test(s), "Invalid email"),
    phone: z.string().trim().max(30).optional(),
    taxId: z.string().trim().max(40).optional(),
    address: z.object({ line1: z.string().trim().max(120).optional(), line2: z.string().trim().max(120).optional(), city: z.string().trim().max(80).optional(), state: z.string().trim().max(80).optional(), postalCode: z.string().trim().max(20).optional() }).optional(),
  }),
});
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

/** The person asking. A guest is identified only by the opaque access token returned when the order was created. */
export interface Viewer { userId: number | null; role?: string | null; email?: string | null; token?: string | null; isStaff?: boolean }

export interface OrderItemView { sku: string; title: string; qty: number; unitMinor: number; discountMinor: number; taxMinor: number; totalMinor: number }
export interface OrderView {
  id: string; status: OrderStatus; currency: string; subtotalMinor: number; discountMinor: number; taxMinor: number; totalMinor: number; taxInclusive: boolean; taxName: string; taxRateBp: number;
  refundedMinor: number; country: string; couponCode: string | null; createdAt: string; expiresAt: string; paidAt: string | null; fulfilledAt: string | null;
  items: OrderItemView[]; email: string; billingName: string;
}

const iso = (s: string | null): string | null => fromDb(s)?.toISOString() ?? null;

export async function orderView(db: Db, o: Row): Promise<OrderView> {
  const items = await rows(db, "SELECT sku, title, qty, unit_minor, discount_minor, tax_minor, total_minor FROM pay_order_items WHERE order_id = $1 ORDER BY id", [o.id]);
  return {
    id: o.public_id, status: o.status, currency: o.currency, subtotalMinor: Number(o.subtotal_minor), discountMinor: Number(o.discount_minor), taxMinor: Number(o.tax_minor), totalMinor: Number(o.total_minor),
    taxInclusive: !!o.tax_inclusive, taxName: o.tax_name, taxRateBp: Number(o.tax_rate_bp), refundedMinor: Number(o.refunded_minor), country: o.country, couponCode: o.coupon_code,
    createdAt: iso(o.created_at) as string, expiresAt: iso(o.expires_at) as string, paidAt: iso(o.paid_at), fulfilledAt: iso(o.fulfilled_at),
    items: items.map((i) => ({ sku: i.sku, title: i.title, qty: Number(i.qty), unitMinor: Number(i.unit_minor), discountMinor: Number(i.discount_minor), taxMinor: Number(i.tax_minor), totalMinor: Number(i.total_minor) })),
    email: o.email, billingName: o.billing_name,
  };
}

/** Load an order the viewer may see. Anything else is "not found", so order ids cannot be probed. */
export async function loadOrder(db: Db, publicId: string, viewer: Viewer): Promise<Row> {
  const o = await first(db, "SELECT * FROM pay_orders WHERE public_id = $1", [publicId]);
  const ok = !!o && (viewer.isStaff === true || (viewer.userId !== null && o.user_id !== null && Number(o.user_id) === viewer.userId) || (!!viewer.token && tokenMatches(viewer.token, o.access_token_hash)));
  if (!o || !ok) throw new PayError("order_not_found", "Order not found.", 404);
  return o;
}

/** The currencies this basket can be paid in from this country: every item has a price, the currency is enabled and a provider supports it. */
export function candidateCurrencies(country: string, products: Product[], prices: Map<number, Map<string, Price>>): string[] {
  const sets = products.map((p) => [...(prices.get(p.id)?.keys() ?? [])]);
  const common = sets.length ? sets[0].filter((c) => sets.every((s) => s.includes(c))) : [];
  return payableCurrencies(country, common);
}

export function pickCurrency(country: string, candidates: string[], requested?: string): string {
  if (requested) {
    if (!isCurrencyCode(requested) || !candidates.includes(requested)) throw new PayError("currency_not_available", `This basket cannot be paid in ${requested}.`, 400, { available: candidates });
    return requested;
  }
  const home = country === "IN" ? "INR" : null;
  if (home && candidates.includes(home)) return home;
  if (candidates.includes(cfg.defaultCurrency()) && country !== "IN") return cfg.defaultCurrency();
  if (candidates.includes("USD")) return "USD";
  if (!candidates.length) throw new PayError("not_available_in_region", "These items cannot be bought from your country or in a supported currency yet.", 400);
  return candidates[0];
}

interface CouponRow extends Row { id: number }

/**
 * Check a coupon against a basket. With `lock` (inside the order transaction) the coupon row is locked, so the redemption limits hold under
 * concurrency; without it (the checkout page's price preview) nothing is locked or changed.
 */
export async function checkCoupon(db: Db, code: string, ctx: { skus: string[]; currency: string; subtotalMinor: number; userId: number | null; email: string }, lock = false): Promise<{ id: number; discountMinor: number }> {
  const c = (await first<CouponRow>(db, `SELECT * FROM pay_coupons WHERE code = $1${lock ? " FOR UPDATE" : ""}`, [code.toUpperCase()])) as CouponRow | null;
  const bad = (m: string) => new PayError("coupon_invalid", m, 400);
  if (!c || !c.active) throw bad("This coupon code is not valid.");
  const now = Date.now();
  if (c.starts_at && (fromDb(c.starts_at)?.getTime() ?? 0) > now) throw bad("This coupon is not active yet.");
  if (c.ends_at && (fromDb(c.ends_at)?.getTime() ?? Infinity) < now) throw bad("This coupon has expired.");
  if (c.kind === "fixed" && String(c.currency) !== ctx.currency) throw bad(`This coupon only applies to ${c.currency} orders.`);
  if (c.skus && !ctx.skus.every((s) => String(c.skus).split(",").map((x) => x.trim()).includes(s))) throw bad("This coupon does not apply to everything in your basket.");
  if (c.max_redemptions !== null && Number(c.redeemed) >= Number(c.max_redemptions)) throw bad("This coupon has been fully used.");
  // A price preview does not count the buyer's own unpaid checkouts: a declined payment must not lock them out of retrying. Creating the real order
  // first cancels those unpaid checkouts (see releaseHeldCoupon), so the limit is still exact where it matters.
  const ownPending = lock || ctx.userId === null ? "" : " AND NOT (order_id IN (SELECT id FROM pay_orders WHERE status = 'pending' AND user_id = $2))";
  const used = Number((await first<{ n: number }>(db, `SELECT COUNT(*) AS n FROM pay_coupon_redemptions WHERE coupon_id = $1 AND (($2 IS NOT NULL AND user_id = $2) OR email = $3)${ownPending}`, [c.id, ctx.userId, ctx.email]))?.n ?? 0);
  if (used >= Number(c.per_user_limit)) throw bad("You have already used this coupon.");
  const discountMinor = applyCoupon(ctx.subtotalMinor, { kind: c.kind, percentBp: c.percent_bp === null ? null : Number(c.percent_bp), fixedMinor: c.fixed_minor === null ? null : Number(c.fixed_minor) });
  if (discountMinor <= 0) throw bad("This coupon gives no discount on this basket.");
  return { id: Number(c.id), discountMinor };
}

export async function releaseCoupon(db: Db, orderId: number): Promise<void> {
  const r = await first<{ coupon_id: number }>(db, "SELECT coupon_id FROM pay_coupon_redemptions WHERE order_id = $1", [orderId]);
  if (!r) return;
  await exec(db, "DELETE FROM pay_coupon_redemptions WHERE order_id = $1", [orderId]);
  await exec(db, "UPDATE pay_coupons SET redeemed = GREATEST(redeemed - 1, 0) WHERE id = $1", [r.coupon_id]);
}

export interface CreatedOrder { order: OrderView; accessToken: string; row: Row }

/**
 * Create a pending order. The browser supplies SKUs, quantities, a country, a coupon code and the buyer's details; every amount is worked out
 * here from the catalogue. The price is snapshotted onto the order so later catalogue edits never change it.
 */
export async function createOrder(input: CreateOrderInput, viewer: { userId: number | null }): Promise<CreatedOrder> {
  const country = input.country;
  if (cfg.blockedCountries().includes(country)) throw new PayError("country_not_supported", "We cannot take payments from this country.", 403);

  const skus = input.items.map((i) => i.sku);
  if (new Set(skus).size !== skus.length) throw new PayError("duplicate_items", "List each item once and use the quantity field.");
  const products = await productsBySku(pool, skus);
  const missing = skus.filter((s) => !products.has(s));
  if (missing.length) throw new PayError("unknown_item", "One of these items is not available.", 404, { skus: missing });
  const list = skus.map((s) => products.get(s) as Product);
  for (const it of input.items) if (it.qty > (products.get(it.sku) as Product).maxQty) throw new PayError("quantity_too_high", "That quantity is more than allowed for this item.", 400, { sku: it.sku });
  if (viewer.userId === null && !list.every((p) => p.allowGuest)) throw new PayError("login_required", "Please sign in to buy this item.", 401);

  const prices = await pricesFor(pool, list.map((p) => p.id));
  const currency = pickCurrency(country, candidateCurrencies(country, list, prices), input.currency);
  const lines = input.items.map((it) => {
    const p = products.get(it.sku) as Product;
    const price = prices.get(p.id)?.get(currency) as Price;
    return { p, qty: it.qty, price };
  });
  const rule = await taxRule(pool, country);

  const expiresAt = new Date(Date.now() + cfg.orderTtlMinutes() * 60_000);
  const token = newAccessToken();
  const publicId = newOrderId();

  const row = await tx(async (db) => {
    const subtotal = lines.reduce((a, l) => a + l.price.amountMinor * l.qty, 0);
    if (subtotal > MAX_MINOR) throw new PayError("order_too_large", "This order is too large.");
    let discount = 0;
    let couponId: number | null = null;
    if (input.coupon) {
      const c = await checkCoupon(db, input.coupon, { skus, currency, subtotalMinor: subtotal, userId: viewer.userId, email: input.billing.email }, true);
      discount = c.discountMinor;
      couponId = c.id;
    }
    const totals = computeTotals(lines.map((l) => ({ unitMinor: l.price.amountMinor, qty: l.qty, taxInclusive: l.price.taxInclusive })), { discountMinor: discount, taxRateBp: rule?.rateBp ?? 0 });
    const billing = { phone: input.billing.phone ?? null, taxId: input.billing.taxId ?? null, address: input.billing.address ?? null };
    const orderId = await insertId(db,
      "INSERT INTO pay_orders (public_id, user_id, email, status, currency, subtotal_minor, discount_minor, tax_minor, total_minor, tax_inclusive, tax_name, tax_rate_bp, country, billing_name, billing_json, coupon_code, access_token_hash, expires_at) VALUES ($1,$2,$3,'pending',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)",
      [publicId, viewer.userId, input.billing.email, currency, totals.subtotalMinor, totals.discountMinor, totals.taxMinor, totals.totalMinor, totals.taxInclusive ? 1 : 0, rule?.name ?? "", rule?.rateBp ?? 0, country, input.billing.name, JSON.stringify(billing), input.coupon ? input.coupon.toUpperCase() : null, hashToken(token), dbTime(expiresAt)]);
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      const t = totals.lines[i];
      await insertId(db,
        "INSERT INTO pay_order_items (order_id, product_id, sku, kind, title, fulfil_ref, access_days, qty, unit_minor, discount_minor, tax_minor, total_minor) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)",
        [orderId, l.p.id, l.p.sku, l.p.kind, l.p.title, l.p.fulfilRef, l.p.accessDays, l.qty, l.price.amountMinor, t.discountMinor, t.taxMinor, t.totalMinor]);
    }
    if (couponId !== null) {
      await exec(db, "INSERT INTO pay_coupon_redemptions (coupon_id, order_id, user_id, email, amount_minor) VALUES ($1,$2,$3,$4,$5)", [couponId, orderId, viewer.userId, input.billing.email, totals.discountMinor]);
      await exec(db, "UPDATE pay_coupons SET redeemed = redeemed + 1 WHERE id = $1", [couponId]);
    }
    await auditIn(db, { actorType: viewer.userId ? "customer" : "customer", actorId: viewer.userId ?? "guest", action: "order.created", entity: "order", entityId: publicId, detail: { currency, totalMinor: totals.totalMinor, items: input.items, country } });
    return (await first(db, "SELECT * FROM pay_orders WHERE id = $1", [orderId])) as Row;
  });
  return { order: await orderView(pool, row), accessToken: token, row };
}

/** Move an unpaid order to failed, cancelled or expired and free its coupon. Does nothing once the order has been paid. */
export async function closeUnpaid(db: Db, order: Row, to: "failed" | "cancelled" | "expired", actor: { type: "customer" | "system" | "staff" | "provider"; id?: string | number | null }, why: string): Promise<boolean> {
  const cur = (await first(db, "SELECT id, status FROM pay_orders WHERE id = $1 FOR UPDATE", [order.id])) as Row;
  if (cur.status !== "pending") return false;
  assertTransition("order", cur.status, to);
  await exec(db, "UPDATE pay_orders SET status = $1 WHERE id = $2", [to, order.id]);
  await exec(db, "UPDATE pay_payments SET status = $1 WHERE order_id = $2 AND status IN ('created','pending')", [to === "failed" ? "failed" : to === "cancelled" ? "cancelled" : "expired", order.id]);
  await releaseCoupon(db, Number(order.id));
  await auditIn(db, { actorType: actor.type, actorId: actor.id ?? null, action: `order.${to}`, entity: "order", entityId: order.public_id, detail: { why } });
  return true;
}

/** List a customer's orders, newest first. */
export async function listOrders(userId: number, page = 1, perPage = 20): Promise<{ orders: OrderView[]; total: number }> {
  const total = Number((await first<{ n: number }>(pool, "SELECT COUNT(*) AS n FROM pay_orders WHERE user_id = $1", [userId]))?.n ?? 0);
  const list = await rows(pool, `SELECT * FROM pay_orders WHERE user_id = $1 ORDER BY id DESC LIMIT ${Math.min(100, Math.max(1, perPage))} OFFSET ${(Math.max(1, page) - 1) * Math.min(100, Math.max(1, perPage))}`, [userId]);
  return { orders: await Promise.all(list.map((o) => orderView(pool, o))), total };
}
