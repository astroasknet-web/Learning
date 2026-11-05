import { currentUser } from "@/lib/portal/guard";
import { hasPurchasedCourse } from "@/lib/pay/plans";
import { courseFee } from "@/lib/pay/course-access";

/**
 * Access to a product that is sold on its own and has no free preview and no plan pick (Maths Olympiad classes, exam preparation). Open only for a buyer of
 * that product; if the shop cannot be reached the page stays locked, never open by default.
 */
export interface ProductAccess { open: boolean; signedIn: boolean; slug: string; rupees: number; onSale: boolean }

export async function productAccess(slug: string, fallbackRupees: number): Promise<ProductAccess> {
  const me = await currentUser().catch(() => null);
  const open = me ? await hasPurchasedCourse(me.id, slug).catch(() => false) : false;
  const fee = await courseFee(slug).catch(() => null);
  return { open, signedIn: !!me, slug, rupees: fee ? Math.round(fee.amountMinor / 100) : fallbackRupees, onSale: !!fee };
}
