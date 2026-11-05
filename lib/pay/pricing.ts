import { MAX_MINOR, divRound } from "./money";

/**
 * The price of an order, worked out on the server in integer minor units. Nothing the browser sends is used except the SKUs, the
 * quantities and a coupon code.
 *
 *  - A line's gross amount is unit price x quantity, less its share of the discount.
 *  - If the price is tax-inclusive the tax is the part of the gross amount that is tax (gross - gross / (1 + rate)); the customer pays the gross amount.
 *  - If the price is tax-exclusive the tax is added on top of the gross amount.
 *  - All rounding is half up on whole minor units, per line, so the order total always equals the sum of its lines.
 */
export interface PriceLine { unitMinor: number; qty: number; taxInclusive: boolean }
export interface PricedLine { subtotalMinor: number; discountMinor: number; taxMinor: number; totalMinor: number }
export interface Totals { lines: PricedLine[]; subtotalMinor: number; discountMinor: number; taxMinor: number; totalMinor: number; taxInclusive: boolean }

export function applyCoupon(subtotalMinor: number, c: { kind: "percent" | "fixed"; percentBp?: number | null; fixedMinor?: number | null }): number {
  const raw = c.kind === "percent" ? divRound(subtotalMinor * Math.min(10_000, Math.max(0, c.percentBp ?? 0)), 10_000) : Math.max(0, c.fixedMinor ?? 0);
  return Math.min(subtotalMinor, raw);
}

/** Split `amount` over lines in proportion to `weights`, using the largest-remainder method so the parts add up exactly. */
export function allocate(amount: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (amount <= 0 || sum <= 0) return weights.map(() => 0);
  const base = weights.map((w) => Math.floor((amount * w) / sum));
  let left = amount - base.reduce((a, b) => a + b, 0);
  const order = weights.map((w, i) => ({ i, r: (amount * w) % sum })).sort((a, b) => b.r - a.r || a.i - b.i);
  for (const o of order) {
    if (left <= 0) break;
    base[o.i] += 1;
    left -= 1;
  }
  return base;
}

export function computeTotals(lines: PriceLine[], opts: { discountMinor?: number; taxRateBp?: number } = {}): Totals {
  const rate = Math.max(0, opts.taxRateBp ?? 0);
  const subtotals = lines.map((l) => {
    if (!Number.isSafeInteger(l.unitMinor) || l.unitMinor < 0 || !Number.isInteger(l.qty) || l.qty < 1) throw new Error("Invalid price line");
    return l.unitMinor * l.qty;
  });
  const subtotal = subtotals.reduce((a, b) => a + b, 0);
  if (subtotal > MAX_MINOR) throw new Error("Order too large");
  const discount = Math.min(subtotal, Math.max(0, opts.discountMinor ?? 0));
  const shares = allocate(discount, subtotals);
  const priced = lines.map((l, i): PricedLine => {
    const gross = subtotals[i] - shares[i];
    const tax = rate === 0 ? 0 : l.taxInclusive ? gross - divRound(gross * 10_000, 10_000 + rate) : divRound(gross * rate, 10_000);
    return { subtotalMinor: subtotals[i], discountMinor: shares[i], taxMinor: tax, totalMinor: l.taxInclusive ? gross : gross + tax };
  });
  const sum = (f: (p: PricedLine) => number): number => priced.reduce((a, p) => a + f(p), 0);
  return {
    lines: priced,
    subtotalMinor: subtotal,
    discountMinor: discount,
    taxMinor: sum((p) => p.taxMinor),
    totalMinor: sum((p) => p.totalMinor),
    taxInclusive: lines.every((l) => l.taxInclusive),
  };
}
