import { recommendations } from "./data";
import type { Career, Domain } from "./career-stage";
import type { RawScores } from "./scorers/types";

/**
 * Turns scores into GrowQR course recommendations (port of Score\Recommender). Two layers, both from the editable
 * recommendations.json: weakness-driven career-readiness courses, then upskilling courses for the detected domain.
 * Deduplicated by course slug and capped at max_total.
 */
export interface Recommendation {
  type: "career" | "skill";
  title: string;
  category: string | null;
  url: string;
  reason: string;
}

interface When {
  section_below?: number;
  section_min?: number;
  overall_below?: number;
  param_below?: { id: number; score: number; min?: number };
  career_stage?: string | string[];
}

export function recommend(section: { section_score: number }, rawScores: RawScores, career: Career, overall: number, domain: Domain): Recommendation[] {
  const data = recommendations() as unknown as {
    base_url?: string;
    course_path?: string;
    max_total?: number;
    catalog?: Array<{ slug?: string; title: string; category?: string }>;
    resume_rules?: Array<{ when?: When; slug?: string; reason?: string }>;
    domains: Record<string, { label?: string; courses?: string[] }>;
    domain_recommendation?: { max?: number; reason_template?: string };
  };
  const base = (data.base_url ?? "").replace(/\/+$/, "");
  const path = data.course_path ?? "/courses/";
  const maxTotal = Math.trunc(data.max_total ?? 6);
  const catalog = new Map<string, { slug?: string; title: string; category?: string }>();
  for (const row of data.catalog ?? []) if (row.slug !== undefined) catalog.set(row.slug, row);

  const out: Recommendation[] = [];
  const seen = new Set<string>();
  const add = (slug: string, reason: string, type: "career" | "skill"): void => {
    const row = catalog.get(slug);
    if (slug === "" || seen.has(slug) || !row) return;
    seen.add(slug);
    out.push({ type, title: row.title, category: row.category ?? null, url: base + path + slug, reason });
  };

  for (const rule of data.resume_rules ?? []) {
    if (!matches(rule.when ?? {}, section, rawScores, career, overall)) continue;
    add(String(rule.slug ?? ""), String(rule.reason ?? ""), "career");
  }

  const domainCfg = data.domains[domain.key];
  if (domainCfg) {
    const max = Math.trunc(data.domain_recommendation?.max ?? 3);
    const tpl = data.domain_recommendation?.reason_template ?? "Recommended for your %DOMAIN% background.";
    const reason = tpl.split("%DOMAIN%").join(domainCfg.label ?? domain.key);
    let count = 0;
    for (const slug of domainCfg.courses ?? []) {
      if (count >= max) break;
      const before = out.length;
      add(String(slug), reason, "skill");
      if (out.length > before) count++;
    }
  }
  return out.slice(0, maxTotal);
}

function matches(when: When, section: { section_score: number }, rawScores: RawScores, career: Career, overall: number): boolean {
  if (when.section_below !== undefined && !(section.section_score < when.section_below)) return false;
  if (when.section_min !== undefined && !(section.section_score >= when.section_min)) return false;
  if (when.overall_below !== undefined && !(overall < when.overall_below)) return false;
  if (when.param_below !== undefined) {
    const pid = Math.trunc(when.param_below.id);
    const threshold = Math.trunc(when.param_below.score);
    const min = Math.trunc(when.param_below.min ?? 0);
    const actual = rawScores[pid]?.score ?? 0;
    if (!(actual < threshold && actual >= min)) return false;
  }
  if (when.career_stage !== undefined) {
    const stages = Array.isArray(when.career_stage) ? when.career_stage : [when.career_stage];
    if (!stages.includes(career.stage ?? "")) return false;
  }
  return true;
}
