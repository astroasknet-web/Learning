import { z } from "zod";
import { pricesFor, productsBySku, type Product } from "./catalogue";
import { cfg } from "./config";
import { first, pool } from "./db";
import { accessFor } from "./course-access";
import { isCurrencyCode } from "./money";
import { PayError } from "./orders";
import { payableCurrencies } from "./providers";
import { quoteOrder, type Quote } from "./quote";

/**
 * The cart page's view of a basket. The cart itself lives in the visitor's browser (a list of product codes, nothing else); this turns it into
 * what can really be bought right now: it drops nothing silently, it labels each line, and it prices the buyable ones with the same code that
 * prices an order. The cart never carries a price, so it cannot change what is charged.
 */
export const MAX_CART_ITEMS = 10;

export const cartSchema = z.object({
  skus: z.array(z.string().regex(/^[a-z0-9][a-z0-9_.-]{0,79}$/i)).max(30),
  country: z.string().regex(/^[A-Za-z]{2}$/).transform((s) => s.toUpperCase()),
  currency: z.string().regex(/^[A-Za-z]{3}$/).transform((s) => s.toUpperCase()).optional(),
  coupon: z.string().trim().min(2).max(40).optional(),
});
export type CartInput = z.infer<typeof cartSchema>;

export type LineStatus = "ok" | "owned" | "unavailable";
export interface CartLine { sku: string; title: string; kind: string; unitMinor: number | null; status: LineStatus; reason: string | null }
export interface CartView { currency: string; currencies: string[]; lines: CartLine[]; quote: Quote | null; blocked: boolean }

async function owns(userId: number, p: Product): Promise<boolean> {
  if (p.kind !== "course") return false;
  const a = await accessFor(userId, p.fulfilRef);
  return a === "purchase" || a === "plan";
}

export async function viewCart(input: CartInput, viewer: { userId: number | null }): Promise<CartView> {
  if (cfg.blockedCountries().includes(input.country)) throw new PayError("country_not_supported", "We cannot take payments from this country.", 403);
  const skus = [...new Set(input.skus)].slice(0, MAX_CART_ITEMS);
  const products = await productsBySku(pool, skus);
  const prices = await pricesFor(pool, [...products.values()].map((p) => p.id));

  // One currency for the whole basket: the one asked for, else the buyer's home currency, else the one most items can be paid in.
  const per = new Map<string, string[]>();
  for (const [sku, p] of products) per.set(sku, payableCurrencies(input.country, [...(prices.get(p.id)?.keys() ?? [])]));
  const union = [...new Set([...per.values()].flat())];
  const tally = (c: string): number => [...per.values()].filter((l) => l.includes(c)).length;
  const home = input.country === "IN" ? "INR" : cfg.defaultCurrency() === "INR" ? "USD" : cfg.defaultCurrency();
  let currency = input.currency && isCurrencyCode(input.currency) && union.includes(input.currency) ? input.currency : "";
  if (!currency) currency = union.includes(home) ? home : union.sort((a, b) => tally(b) - tally(a))[0] ?? home;

  const lines: CartLine[] = [];
  for (const sku of skus) {
    const p = products.get(sku);
    if (!p) { lines.push({ sku, title: sku, kind: "other", unitMinor: null, status: "unavailable", reason: "This item is no longer on sale." }); continue; }
    if (viewer.userId !== null && (await owns(viewer.userId, p))) { lines.push({ sku, title: p.title, kind: p.kind, unitMinor: null, status: "owned", reason: "You already have this." }); continue; }
    const price = prices.get(p.id)?.get(currency);
    if (!price || !(per.get(sku) ?? []).includes(currency)) {
      const priced = (prices.get(p.id)?.size ?? 0) > 0;
      const reason = priced && union.length === 0 ? "Online payment is not open for your country yet." : `Not sold in ${currency} yet.`;
      lines.push({ sku, title: p.title, kind: p.kind, unitMinor: null, status: "unavailable", reason });
      continue;
    }
    lines.push({ sku, title: p.title, kind: p.kind, unitMinor: price.amountMinor, status: "ok", reason: null });
  }
  const buyable = lines.filter((l) => l.status === "ok").map((l) => ({ sku: l.sku, qty: 1 }));
  const quote = buyable.length ? await quoteOrder({ items: buyable, country: input.country, currency, coupon: input.coupon }, viewer) : null;
  return { currency, currencies: union.length ? union.sort() : [currency], lines, quote, blocked: buyable.length === 0 };
}
