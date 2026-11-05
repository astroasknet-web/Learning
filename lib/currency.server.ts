// Server-only: relies on next/headers, which cannot be imported into a client
// component (Next will error at build time if this is pulled client-side).
import { headers } from "next/headers";
import {
  currencyForCountry,
  regionForCountry,
  DEFAULT_REGION,
  type Currency,
  type Region,
} from "./currency";

/**
 * Read the visitor's country from Vercel's geolocation header.
 *
 * On Vercel production the platform injects `x-vercel-ip-country` (a two-letter
 * ISO country code) on every request. `x-country` is honoured as a manual
 * override, which is what makes local testing possible:
 *
 *   curl -H "x-country: AE" localhost:3000
 */
async function detectCountry(): Promise<string | null> {
  const h = await headers();
  return h.get("x-vercel-ip-country") ?? h.get("x-country") ?? null;
}

/**
 * Resolve the visitor's region (currency + whether we sell here) on the server,
 * before the HTML is sent — so consumers render correctly on first paint with
 * no flicker or hydration mismatch.
 *
 * Locally the geo header is absent, so detection falls back to
 * `DEFAULT_REGION` (USD, not live). Set FORCE_COUNTRY=IN (or AE, US, …) in
 * .env.local and restart the dev server to pin a country.
 */
export async function detectRegion(): Promise<Region> {
  const forcedCountry = process.env.FORCE_COUNTRY?.toUpperCase();
  if (forcedCountry) return regionForCountry(forcedCountry);

  try {
    const region = regionForCountry(await detectCountry());

    // Legacy escape hatch: FORCE_CURRENCY pins only the displayed currency and
    // leaves availability to the real country. Prefer FORCE_COUNTRY, which sets
    // both coherently.
    const forcedCurrency = process.env.FORCE_CURRENCY?.toUpperCase();
    if (forcedCurrency === "INR" || forcedCurrency === "USD") {
      return { ...region, currency: forcedCurrency };
    }
    return region;
  } catch {
    return DEFAULT_REGION;
  }
}

/**
 * Currency only. Prefer `detectRegion()` — availability is a separate axis and
 * must never be inferred from the currency (the UAE is USD *and* live).
 */
export async function detectCurrency(): Promise<Currency> {
  const forced = process.env.FORCE_CURRENCY?.toUpperCase();
  if (forced === "INR" || forced === "USD") return forced;

  try {
    return currencyForCountry(await detectCountry());
  } catch {
    return DEFAULT_REGION.currency;
  }
}
