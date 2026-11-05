import recs from "@/lib/qrscore/data/recommendations.json";

/**
 * The courses a student may choose from their plan: the ones recommended after their resume scan. Pure, so it can be tested without a database.
 *
 *   1. The courses the scan recommended (section 1 of the stored result), in the order the scan gave them.
 *   2. If fewer than MIN_RECOMMENDED of those can be studied on GrowQR (lessons exist, `isNative`), the list is topped up so a student always has at least
 *      three to choose from: the courses recommended for the domain the scan detected, then the general ones, then a short fixed list of career-ready courses.
 *
 * Only a course taught on GrowQR can be studied, so only those are offered. The plan decides how many of them can be chosen (lib/market/plan-quota.ts).
 */
export const MIN_RECOMMENDED = 3;
export const MAX_RECOMMENDED = 6;
export const FALLBACK_SLUGS = ["corporate-readiness-interview", "business-communication", "critical-thinking-problem-solving", "digital-literacy-master", "financial-literacy-investing"];

interface ScanLike { sections?: Array<{ recommendations?: Array<{ url?: string }> }>; domain?: { key?: string } }
interface RecData { domains: Record<string, { courses?: string[] }>; catalog?: Array<{ slug?: string }> }

const slugOfUrl = (url: string): string => url.replace(/[?#].*$/, "").replace(/\/+$/, "").split("/").pop() ?? "";

export interface Recommended { slug: string; source: "scan" | "domain" | "general" }

export function recommendedCourses(scan: ScanLike | null, isNative: (slug: string) => boolean, data: RecData = recs as unknown as RecData): Recommended[] {
  const known = new Set((data.catalog ?? []).map((c) => c.slug).filter((s): s is string => !!s));
  const out: Recommended[] = [];
  const add = (slug: string, source: Recommended["source"]): void => {
    if (!slug || out.length >= MAX_RECOMMENDED || out.some((o) => o.slug === slug) || !isNative(slug)) return;
    out.push({ slug, source });
  };
  for (const s of scan?.sections ?? []) for (const r of s.recommendations ?? []) { const slug = slugOfUrl(String(r.url ?? "")); if (known.has(slug) || isNative(slug)) add(slug, "scan"); }
  if (out.length >= MIN_RECOMMENDED) return out;
  const domain = scan?.domain?.key ?? "general";
  for (const slug of data.domains[domain]?.courses ?? []) if (out.length < MIN_RECOMMENDED) add(slug, "domain");
  for (const slug of data.domains.general?.courses ?? []) if (out.length < MIN_RECOMMENDED) add(slug, "general");
  for (const slug of FALLBACK_SLUGS) if (out.length < MIN_RECOMMENDED) add(slug, "general");
  return out;
}
