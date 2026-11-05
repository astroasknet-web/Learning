import { first, pool, type Db } from "./db";
import { hasEntitlement } from "./entitlements";
import { openPickSlugs, studioFromPlan } from "./plans";

/**
 * Who may study a course. Every course with a fee is paid: the lessons open only for a student who bought the course, or who has used one of
 * their plan's course picks on it while that plan is active (see lib/pay/plans.ts). The course page (what is in it, who it is for) stays public.
 * A course that was taken off sale stays locked; "off sale" stops new purchases, it never gives the course away.
 * A course with no fee at all stays free.
 */
export interface CourseFee { sku: string; amountMinor: number; currency: "INR" }

export const courseSku = (slug: string): string => `course-${slug}`;

/** The price someone can pay right now: the product is on sale and has an active INR price. */
export async function courseFee(slug: string, db: Db = pool): Promise<CourseFee | null> {
  const r = await first<{ amount_minor: number }>(db, "SELECT pr.amount_minor FROM pay_products p JOIN pay_prices pr ON pr.product_id = p.id AND pr.currency = 'INR' AND pr.active = 1 WHERE p.sku = $1 AND p.active = 1", [courseSku(slug)]);
  return r ? { sku: courseSku(slug), amountMinor: Number(r.amount_minor), currency: "INR" } : null;
}

/** Whether the lessons are behind payment (true even when the product is off sale, as long as it has a price). */
export async function courseGated(slug: string, db: Db = pool): Promise<boolean> {
  return (await first(db, "SELECT 1 AS x FROM pay_products p JOIN pay_prices pr ON pr.product_id = p.id AND pr.currency = 'INR' AND pr.amount_minor > 0 WHERE p.sku = $1 LIMIT 1", [courseSku(slug)])) !== null;
}

export type Access = "free" | "purchase" | "plan" | null;

/** How this person can study the course: free, by purchase, by a plan pick, or not at all. */
export async function accessFor(userId: number | null, slug: string, db: Db = pool): Promise<Access> {
  if (!(await courseGated(slug, db))) return "free";
  if (userId === null) return null;
  if (await hasEntitlement(userId, "course", slug, db)) return "purchase";
  if ((await openPickSlugs(userId, db)).includes(slug)) return "plan";
  if (await studioFromPlan(userId, slug, db)) return "plan"; // a studio the plan includes (Maths speed studio: Silver and Gold)
  return null;
}

export async function canStudy(userId: number | null, _courseId: number, slug: string, db: Db = pool): Promise<boolean> {
  return (await accessFor(userId, slug, db)) !== null;
}

export const buyHref = (slug: string): string => `/checkout?sku=${courseSku(slug)}`;
