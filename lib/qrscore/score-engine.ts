import type { Career } from "./career-stage";
import { phpRound } from "./php";
import type { RawScores } from "./scorers/types";

/**
 * Generic weighted scorer (port of Score\ScoreEngine). Given a rubric section, raw 0-5 scores per parameter id and the
 * candidate's career context, it applies the N/A redistribution rules and computes
 *
 *   SectionScore = (SumEarnedWeighted / SumApplicableMaxWeighted) * pointsPerSection
 *
 * N/A parameters are excluded from BOTH numerator and denominator, redistributing their weight across the others.
 */
export interface NaRuleObject {
  force_na_when?: { min_years_experience?: number };
  unless?: string;
  fallback?: string;
}

export interface ParamDef {
  id: number;
  parameter_name: string;
  multiplier: number;
  na_eligible: boolean;
  na_rule?: string | NaRuleObject | null;
}

export interface SectionDef {
  id: number;
  name: string;
  implemented: boolean;
  categories: Array<{ name: string; parameters: ParamDef[] }>;
}

export interface ParamResult {
  id: number;
  name: string;
  category: string;
  multiplier: number;
  na_eligible: boolean;
  na_applied: boolean;
  na_reason: string | null;
  raw_score: number | null;
  weighted_earned: number | null;
  weighted_max: number | null;
  reason: string;
}

export interface SectionResult {
  id: number;
  name: string;
  points_per_section: number;
  earned_weighted: number;
  max_applicable_weighted: number;
  raw_percent: number;
  section_score: number;
  parameters: ParamResult[];
  implemented?: boolean;
  applicable?: boolean;
  na_note?: string;
  note?: string;
  recommendations?: unknown[];
}

export function scoreSection(section: SectionDef, rawScores: RawScores, career: Career, pointsPerSection = 20): SectionResult {
  const params: ParamResult[] = [];
  let earned = 0;
  let maxApplicable = 0;

  for (const category of section.categories) {
    for (const def of category.parameters) {
      const mult = Math.trunc(def.multiplier);
      const raw = rawScores[def.id]?.score ?? 0;
      const reason = rawScores[def.id]?.reason ?? "";
      const [naApplied, naReason] = decideNa(def, raw, career);
      const weightedMax = 5 * mult;
      const weightedEarned = raw * mult;
      if (!naApplied) {
        earned += weightedEarned;
        maxApplicable += weightedMax;
      }
      params.push({
        id: def.id,
        name: def.parameter_name,
        category: category.name,
        multiplier: mult,
        na_eligible: Boolean(def.na_eligible),
        na_applied: naApplied,
        na_reason: naApplied ? naReason : null,
        raw_score: naApplied ? null : raw,
        weighted_earned: naApplied ? null : weightedEarned,
        weighted_max: naApplied ? null : weightedMax,
        reason,
      });
    }
  }

  const rawPercent = maxApplicable > 0 ? earned / maxApplicable : 0;
  const sectionScore = rawPercent * pointsPerSection;
  return {
    id: section.id,
    name: section.name,
    points_per_section: pointsPerSection,
    earned_weighted: phpRound(earned, 2),
    max_applicable_weighted: phpRound(maxApplicable, 2),
    raw_percent: phpRound(rawPercent * 100, 1),
    section_score: phpRound(sectionScore, 2),
    parameters: params,
  };
}

function decideNa(def: ParamDef, raw: number, career: Career): [boolean, string] {
  const rule = def.na_rule ?? null;
  if (rule === null) return [false, ""]; // always scored
  if (rule === "absent") {
    return raw === 0 ? [true, "No content detected for this parameter; excluded (N/A) so it does not penalise the score."] : [false, ""];
  }
  if (typeof rule === "object") {
    const minYears = Math.trunc(rule.force_na_when?.min_years_experience ?? Number.MAX_SAFE_INTEGER);
    const exception = rule.unless === "academia_transition" && career.academiaTransition;
    if ((career.yearsExperience ?? 0) >= minYears && !exception) {
      return [true, `Candidate has ${career.yearsExperience}+ years of experience; parameter is N/A for experienced professionals (career-stage redistribution).`];
    }
    if (rule.fallback === "absent" && raw === 0) return [true, "No content detected for this parameter; excluded (N/A)."];
  }
  return [false, ""];
}
