/**
 * Money helpers. An amount is always a safe integer in the currency's minor unit (paise, cents, yen ...) next to its ISO 4217 code.
 * Nothing in the payment code uses floating point for money; the only division is integer division with an explicit rounding rule.
 */
export type Currency = string;

/** Currencies whose minor unit is not 1/100. Everything not listed has two decimals. */
const ZERO_DECIMAL = new Set(["BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA", "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF"]);
const THREE_DECIMAL = new Set(["BHD", "IQD", "JOD", "KWD", "LYD", "OMR", "TND"]);

/** The largest amount we accept in minor units, so integer maths stays exact (well under 2^53). */
export const MAX_MINOR = 100_000_000_000;

export const isCurrencyCode = (c: string): boolean => /^[A-Z]{3}$/.test(c);

export function minorUnits(currency: Currency): number {
  const c = currency.toUpperCase();
  return ZERO_DECIMAL.has(c) ? 0 : THREE_DECIMAL.has(c) ? 3 : 2;
}

/** 10^minorUnits, for converting a human amount ("499.00") to minor units and back. */
export const factor = (currency: Currency): number => 10 ** minorUnits(currency);

/** Parse a decimal string such as "499", "499.5" or "1,499.00" into minor units. Throws on anything ambiguous or out of range. */
export function parseAmount(text: string, currency: Currency): number {
  const t = text.trim().replace(/,/g, "");
  const m = /^(\d{1,12})(?:\.(\d{1,3}))?$/.exec(t);
  if (!m) throw new Error("Invalid amount");
  const places = minorUnits(currency);
  const frac = (m[2] ?? "").padEnd(places, "0");
  if (frac.length > places && /[1-9]/.test(frac.slice(places))) throw new Error("Too many decimal places for " + currency);
  const minor = Number(m[1]) * 10 ** places + (places ? Number(frac.slice(0, places)) : 0);
  if (!Number.isSafeInteger(minor) || minor > MAX_MINOR) throw new Error("Amount out of range");
  return minor;
}

export function assertMinor(n: number, what = "amount"): number {
  if (!Number.isSafeInteger(n) || n < 0 || n > MAX_MINOR) throw new Error(`Invalid ${what}`);
  return n;
}

/** Integer division, rounding half up. */
export const divRound = (num: number, den: number): number => Math.floor((num * 2 + den) / (den * 2));

/** "₹3,199.00", "$49.00", "¥5,000". Uses Intl with the currency code, so symbols and grouping follow the locale. */
export function formatMoney(amountMinor: number, currency: Currency, locale = "en-IN"): string {
  const places = minorUnits(currency);
  const value = amountMinor / 10 ** places; // display only: never used to compute anything
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency: currency.toUpperCase(), minimumFractionDigits: places, maximumFractionDigits: places }).format(value);
  } catch {
    return `${currency.toUpperCase()} ${value.toFixed(places)}`;
  }
}

/** Plain decimal text for a machine or CSV: "3199.00". */
export function plainAmount(amountMinor: number, currency: Currency): string {
  const places = minorUnits(currency);
  if (places === 0) return String(amountMinor);
  const s = String(Math.abs(amountMinor)).padStart(places + 1, "0");
  return `${amountMinor < 0 ? "-" : ""}${s.slice(0, -places)}.${s.slice(-places)}`;
}
