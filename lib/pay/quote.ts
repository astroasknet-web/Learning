import { z } from "zod";
import { productsBySku, pricesFor, taxRule, type Price, type Product } from "./catalogue";
import { cfg } from "./config";
import { pool } from "./db";
import { candidateCurrencies, checkCoupon, PayError, pickCurrency } from "./orders";
import { computeTotals } from "./pricing";
import { providersFor } from "./providers";

/**
 * A price preview for the checkout page: the same maths as an order, with nothing written to the database. The page shows this before
 * the customer pays; the order that follows is priced again from scratch on the server, so the preview can never decide what is charged.
 */
export const quoteSchema = z.object({
  items: z.array(z.object({ sku: z.string().regex(/^[a-z0-9][a-z0-9_.-]{0,79}$/i), qty: z.number().int().min(1).max(20) })).min(1).max(10),
  country: z.string().regex(/^[A-Za-z]{2}$/).transform((s) => s.toUpperCase()),
  currency: z.string().regex(/^[A-Za-z]{3}$/).transform((s) => s.toUpperCase()).optional(),
  coupon: z.string().trim().min(2).max(40).optional(),
  email: z.string().trim().toLowerCase().max(254).optional(),
});
export type QuoteInput = z.infer<typeof quoteSchema>;

export interface QuoteLine { sku: string; title: string; qty: number; unitMinor: number; discountMinor: number; taxMinor: number; totalMinor: number }
export interface Quote {
  currency: string; currencies: string[]; providers: string[];
  lines: QuoteLine[]; subtotalMinor: number; discountMinor: number; taxMinor: number; totalMinor: number; taxInclusive: boolean; taxName: string; taxRateBp: number;
  coupon: string | null; couponError: string | null; requiresLogin: boolean;
}

export async function quoteOrder(input: QuoteInput, viewer: { userId: number | null }): Promise<Quote> {
  if (cfg.blockedCountries().includes(input.country)) throw new PayError("country_not_supported", "We cannot take payments from this country.", 403);
  const skus = input.items.map((i) => i.sku);
  if (new Set(skus).size !== skus.length) throw new PayError("duplicate_items", "List each item once and use the quantity field.");
  const products = await productsBySku(pool, skus);
  const missing = skus.filter((s) => !products.has(s));
  if (missing.length) throw new PayError("unknown_item", "One of these items is not available.", 404, { skus: missing });
  const list = skus.map((s) => products.get(s) as Product);
  for (const it of input.items) if (it.qty > (products.get(it.sku) as Product).maxQty) throw new PayError("quantity_too_high", "That quantity is more than allowed for this item.", 400, { sku: it.sku });

  const prices = await pricesFor(pool, list.map((p) => p.id));
  const candidates = candidateCurrencies(input.country, list, prices);
  const currency = pickCurrency(input.country, candidates, input.currency);
  const lines = input.items.map((it) => {
    const p = products.get(it.sku) as Product;
    return { p, qty: it.qty, price: prices.get(p.id)?.get(currency) as Price };
  });
  const rule = await taxRule(pool, input.country);
  const subtotal = lines.reduce((a, l) => a + l.price.amountMinor * l.qty, 0);

  let discount = 0;
  let coupon: string | null = null;
  let couponError: string | null = null;
  if (input.coupon) {
    try {
      const c = await checkCoupon(pool, input.coupon, { skus, currency, subtotalMinor: subtotal, userId: viewer.userId, email: input.email ?? "" });
      discount = c.discountMinor;
      coupon = input.coupon.toUpperCase();
    } catch (e) {
      if (e instanceof PayError) couponError = e.message; else throw e;
    }
  }
  const t = computeTotals(lines.map((l) => ({ unitMinor: l.price.amountMinor, qty: l.qty, taxInclusive: l.price.taxInclusive })), { discountMinor: discount, taxRateBp: rule?.rateBp ?? 0 });
  return {
    currency, currencies: candidates, providers: providersFor({ country: input.country, currency }).map((p) => p.id),
    lines: lines.map((l, i) => ({ sku: l.p.sku, title: l.p.title, qty: l.qty, unitMinor: l.price.amountMinor, discountMinor: t.lines[i].discountMinor, taxMinor: t.lines[i].taxMinor, totalMinor: t.lines[i].totalMinor })),
    subtotalMinor: t.subtotalMinor, discountMinor: t.discountMinor, taxMinor: t.taxMinor, totalMinor: t.totalMinor, taxInclusive: t.taxInclusive, taxName: rule?.name ?? "", taxRateBp: rule?.rateBp ?? 0,
    coupon, couponError, requiresLogin: viewer.userId === null && !list.every((p) => p.allowGuest),
  };
}
