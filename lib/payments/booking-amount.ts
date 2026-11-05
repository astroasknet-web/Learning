import { getSessionAmountINR } from "@/features/experts/data/experts-data";

/* ────────────────────────────────────────────────────────────────
   Single source of truth for the booking charge amount (INR).

   The amount is ALWAYS computed server-side from the expert slug — the
   client is never trusted. Both the order-creation route and the
   payment-verification step in /api/experts/book use this function, so
   the amount the user is charged and the amount we verify can never drift.
──────────────────────────────────────────────────────────────── */

// TEST MODE: charge a flat ₹1 for safe end-to-end testing with live keys.
// TODO: set TEST_MODE = false before go-live to charge the real session price.
const TEST_MODE = true;
const TEST_AMOUNT_INR = 1;

/** Authoritative booking amount (INR) for an expert. */
export function resolveBookingAmountINR(slug: string): number {
  if (TEST_MODE) return TEST_AMOUNT_INR;
  return getSessionAmountINR(slug);
}
