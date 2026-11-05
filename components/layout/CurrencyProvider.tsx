"use client";

import { createContext, useContext, type ReactNode } from "react";
import { DEFAULT_REGION, type Currency, type Region } from "@/lib/currency";

/**
 * Makes the server-detected region available to any client component (Pricing
 * cards, the compare modal, CTAs) without prop-drilling. The value is resolved
 * once on the server in the root layout, so consumers render the right currency
 * and the right CTA on first paint with no flicker.
 */
const RegionContext = createContext<Region>(DEFAULT_REGION);

export function CurrencyProvider({
  value,
  children,
}: {
  value: Region;
  children: ReactNode;
}) {
  return <RegionContext.Provider value={value}>{children}</RegionContext.Provider>;
}

/** Read the active display currency ("INR" | "USD"). Defaults to USD. */
export function useCurrency(): Currency {
  return useContext(RegionContext).currency;
}

/**
 * Are subscriptions live for this visitor? Drives prices, the "Most Popular"
 * badge and real-vs-waitlist CTAs.
 *
 * Use this — never `useCurrency() === "USD"` — to decide availability: USD
 * markets can be live (the UAE, Norway), so currency does not imply it.
 */
export function useIsLive(): boolean {
  return useContext(RegionContext).isLive;
}

/**
 * Is the visitor in India? Only for India-specific content — the community page
 * and the DPDP/RBI policy links. For "can they buy?", use `useIsLive()`.
 */
export function useIsIndia(): boolean {
  return useContext(RegionContext).isIndia;
}

/** Raw two-letter country code, or null when undetected. Analytics/context only — never availability logic (use `useIsLive()`). */
export function useCountry(): string | null {
  return useContext(RegionContext).country;
}
