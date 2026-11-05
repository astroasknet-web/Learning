import { databaseConfigured } from "@/lib/portal/db";
import { accessFor, buyHref, courseFee } from "@/lib/pay/course-access";
import { planInfo } from "@/lib/pay/plans";
import { ALL_IELTS_TESTS, FREE_IELTS_TESTS, SILVER_IELTS_TESTS } from "@/lib/market/plan-services";

/** The shop product that sells the whole IELTS Reading and Listening set (slug in STUDIO_COURSES). */
export const IELTS_SET_SLUG = "ielts-practice-tests";

/**
 * How many tests of each IELTS kind (Reading, Listening) a person may open: the first few are free for everyone, Silver opens 10, and Gold, or buying
 * the set, opens all 30. If the shop has no product for the set (an empty catalogue) nothing is locked.
 */
export async function ieltsLimit(userId: number | null): Promise<number> {
  if (!databaseConfigured()) return ALL_IELTS_TESTS;
  try {
    const a = await accessFor(userId, IELTS_SET_SLUG);
    if (a !== null) return ALL_IELTS_TESTS; // free (no product), bought, or opened by Gold
    if (userId !== null && (await planInfo(userId))?.key === "silver") return SILVER_IELTS_TESTS;
    return FREE_IELTS_TESTS;
  } catch {
    return FREE_IELTS_TESTS;
  }
}

export async function ieltsOffer(userId: number | null): Promise<{ priceRupees: number | null; buy: string }> {
  const fee = await courseFee(IELTS_SET_SLUG).catch(() => null);
  const href = buyHref(IELTS_SET_SLUG);
  return { priceRupees: fee ? Math.round(fee.amountMinor / 100) : null, buy: userId !== null ? href : `/login?next=${encodeURIComponent(href)}` };
}
