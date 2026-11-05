/**
 * Currency detection + config, shared by server and client.
 *
 * This module is intentionally free of any server-only imports (no
 * `next/headers`) so it can be pulled into client components. The server-side
 * detection lives in `currency.server.ts`.
 */

export type Currency = "INR" | "USD";

/** Fallback when geolocation is unavailable (per spec: default to USD). */
export const DEFAULT_CURRENCY: Currency = "USD";

export const CURRENCY_SYMBOL: Record<Currency, string> = {
  INR: "₹",
  USD: "$",
};

/**
 * Map a two-letter country code (e.g. Vercel's `x-vercel-ip-country`) to the
 * currency we display. India → INR, everyone else → USD.
 */
export function currencyForCountry(country?: string | null): Currency {
  return country?.toUpperCase() === "IN" ? "INR" : "USD";
}

/**
 * Markets where subscriptions are live: plans are purchasable, so prices, the
 * "Most Popular" badge and the real signup CTA all show. Everywhere else
 * (including the US) sees "Coming soon" and a waitlist CTA instead.
 *
 * Deliberately separate from `Currency`: currency and availability are not the
 * same axis. The UAE and Norway are billed in USD *and* live, which the INR/USD
 * split alone cannot express — so never infer availability from currency.
 *
 * ISO 3166-1 alpha-2. Note GE is the country Georgia, not the US state.
 */
export const LIVE_COUNTRIES: ReadonlySet<string> = new Set([
  "IN", // India
  "AE", // United Arab Emirates
  "TR", // Turkey
  "GE", // Georgia
  "LK", // Sri Lanka
  "NP", // Nepal
  "TH", // Thailand
  "BR", // Brazil
  "AR", // Argentina
  "MT", // Malta
  "NO", // Norway
  "SE", // Sweden
  "CH", // Switzerland
]);

/** Is this country a live market? Unknown/undetected countries are not. */
export function isLiveCountry(country?: string | null): boolean {
  const code = country?.toUpperCase();
  return code ? LIVE_COUNTRIES.has(code) : false;
}

/** What a visitor's location resolves to: how we price, and whether we sell. */
export interface Region {
  currency: Currency;
  /** Subscriptions purchasable here — show prices + real CTA, not the waitlist. */
  isLive: boolean;
  /**
   * Visitor is in India. Only for genuinely India-specific content (the
   * community page, the DPDP/RBI policy links) — never for availability, which
   * is `isLive`.
   *
   * Tracked separately rather than read off `currency === "INR"`: that works
   * only while India is the sole INR market, and silently breaks the moment a
   * second one exists or FORCE_CURRENCY is set.
   */
  isIndia: boolean;
  /** Raw two-letter country code (e.g. Vercel's x-vercel-ip-country), kept
   *  verbatim for analytics/reporting — never used for availability logic,
   *  which stays on `isLive`/`isIndia` above. Null when undetected. */
  country: string | null;
}

/** Fallback when geolocation is unavailable: USD, not live, not India. */
export const DEFAULT_REGION: Region = {
  currency: DEFAULT_CURRENCY,
  isLive: false,
  isIndia: false,
  country: null,
};

export function regionForCountry(country?: string | null): Region {
  const code = country?.toUpperCase();
  return {
    currency: currencyForCountry(code),
    isLive: isLiveCountry(code),
    isIndia: code === "IN",
    country: code ?? null,
  };
}
