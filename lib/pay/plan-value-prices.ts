import catalogue from "@/lib/market/data/courses.json";
import { nativeSlugs } from "@/lib/market/lessons";
import { buildStacks, type PaidPlanKey, type PlanStack, type ValuePrices } from "@/lib/market/plan-value";
import { COURSE_FEE_RUPEES, RESUME_STUDIO_PRO_RUPEES, SERVICE_PRODUCTS, STUDIO_COURSES } from "./course-fees";
import type { ServiceKey } from "@/lib/market/plan-services";

/**
 * The standalone prices behind the value stack, read from the same lists that seed the product catalogue (lib/pay/course-fees.ts), so the
 * numbers on the home page are the numbers a student pays at checkout. A price changed afterwards in the console is not reflected until
 * these lists are updated.
 *
 * A student can pick only a course whose lessons are on GrowQR (see pick in app/courses/actions.ts), so the pick is valued over exactly those.
 */
const studioRupees = (slug: string): number => {
  const s = STUDIO_COURSES.find((x) => x.slug === slug);
  if (!s) throw new Error(`Studio ${slug} is not in STUDIO_COURSES`);
  return s.rupees;
};

export function pickableFees(): number[] {
  const cats = (catalogue as unknown as { categories: Record<string, { name: string }> }).categories;
  const bySlug = new Map((catalogue as unknown as { courses: Array<{ slug: string; cat: string }> }).courses.map((c) => [c.slug, c]));
  const out: number[] = [];
  for (const slug of nativeSlugs()) {
    const c = bySlug.get(slug);
    const fee = c ? COURSE_FEE_RUPEES[cats[c.cat]?.name ?? ""] : undefined;
    if (fee) out.push(fee);
  }
  return out;
}

export function valuePrices(): ValuePrices {
  const fees = pickableFees();
  return {
    pickMin: Math.min(...fees),
    pickMax: Math.max(...fees),
    vedicMathematics: studioRupees("vedic-mathematics"),
    resumeStudioPro: RESUME_STUDIO_PRO_RUPEES,
    mathsSpeedStudio: studioRupees("mathematics-speed-enhancement"),
    englishWritingStudio: studioRupees("english-writing-studio"),
    ieltsPracticeTests: studioRupees("ielts-practice-tests"),
    services: Object.fromEntries(SERVICE_PRODUCTS.map((v) => [v.key, v.rupees])) as Record<ServiceKey, number>,
  };
}

export const planStacks = (): Record<PaidPlanKey, PlanStack> => buildStacks(valuePrices());
