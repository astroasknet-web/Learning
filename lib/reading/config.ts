import { z } from "zod";
import type { Dimension } from "./taxonomy";

/**
 * Scoring configuration. Every number the algorithm uses lives here and can be changed by an administrator (stored as JSON in rd_config,
 * validated by `configSchema`, every change audited). The defaults below are INITIAL, PROVISIONAL values chosen for transparency; they have
 * not been validated against real student data and the studio never says otherwise.
 */
export const SCORING_VERSION = "rs-1.0";

export const DEFAULT_WEIGHTS: Record<Dimension, number> = { comprehension: 30, qa: 25, inference: 15, efficiency: 15, vocabulary: 10, retention: 5 };

export const configSchema = z.object({
  /** Dimension weights, as percentages. Must add up to 100. */
  weights: z.object({ comprehension: z.number().min(0).max(100), qa: z.number().min(0).max(100), inference: z.number().min(0).max(100), efficiency: z.number().min(0).max(100), vocabulary: z.number().min(0).max(100), retention: z.number().min(0).max(100) })
    .refine((w) => Math.abs(Object.values(w).reduce((a, b) => a + b, 0) - 100) < 0.001, "The weights must add up to 100."),
  /** Accuracy bands: below `support` = significant support may be needed; below `developing` = developing; below `progressing` = progressing; at or above `strong` = strong on assessed material. */
  bands: z.object({ support: z.number().min(1).max(99), developing: z.number().min(1).max(99), progressing: z.number().min(1).max(100) }).refine((b) => b.support < b.developing && b.developing < b.progressing, "Band thresholds must increase."),
  /** Weight of an easy, medium and difficult question in accuracy figures. */
  difficultyWeights: z.object({ 1: z.number().min(0.1).max(5), 2: z.number().min(0.1).max(5), 3: z.number().min(0.1).max(5) }),
  /** Words per minute a comfortable reader of a passage of difficulty 1..5 is expected to manage; efficiency never goes above 1.0 of this. */
  targetWpm: z.object({ 1: z.number().min(50).max(600), 2: z.number().min(50).max(600), 3: z.number().min(50).max(600), 4: z.number().min(50).max(600), 5: z.number().min(50).max(600) }),
  /** Reading times implying more than this speed are treated as skimming, and under `minWpm` or over `maxReadMinutes` as an interrupted session: no efficiency score. */
  maxPlausibleWpm: z.number().min(300).max(2000),
  minWpm: z.number().min(5).max(100),
  maxReadMinutes: z.number().min(2).max(120),
  /** Evidence needed before a skill is diagnosed (questions answered), and before the diagnosis is called high confidence (questions and passages). */
  minSample: z.number().int().min(2).max(30),
  highSample: z.number().int().min(3).max(60),
  highPassages: z.number().int().min(1).max(10),
  /** A dimension counts in the overall score only when at least this many questions informed it. */
  minItemsDimension: z.number().int().min(1).max(10),
  minItemsQa: z.number().int().min(2).max(20),
  /** Comprehension safeguard: when comprehension accuracy is below `safeguardBelow`, the overall score cannot exceed `safeguardCap`. */
  safeguardBelow: z.number().min(0).max(100),
  safeguardCap: z.number().min(0).max(100),
  /** An assessment with fewer than this share of questions answered is partial: shown, but not used for progress or level mastery. */
  completeShare: z.number().min(0.3).max(1),
  /** A wrong answer given in under this share of the expected time counts as a hurried answer; at least `rushedErrors` of them are needed to say anything. */
  rushedShare: z.number().min(0.05).max(1),
  rushedErrors: z.number().int().min(2).max(20),
  /** Hours a student must wait after an assessment before a delayed-recall session on its passage is offered (a snapshot of recall needs a gap). */
  recallDelayHours: z.number().min(0).max(240),
  /** Essay reading tests (by test number) that any signed-in student may take without the package. */
  freeEssays: z.array(z.number().int().min(1).max(500)).max(60),
  /** Free tier: starting assessments a student may take without the premium package. */
  freeDiagnostics: z.number().int().min(0).max(10),
  /** Study minutes per day used to size the 7-day plan when the student gave none. */
  defaultStudyMinutes: z.number().int().min(5).max(120),
  /** Smallest group an aggregate figure may describe in administrator reports (privacy). */
  minCohort: z.number().int().min(1).max(100),
});

export type Config = z.infer<typeof configSchema>;

export const DEFAULT_CONFIG: Config = {
  weights: DEFAULT_WEIGHTS,
  bands: { support: 50, developing: 70, progressing: 85 },
  difficultyWeights: { 1: 1, 2: 1.25, 3: 1.5 },
  targetWpm: { 1: 220, 2: 200, 3: 180, 4: 160, 5: 140 },
  maxPlausibleWpm: 900,
  minWpm: 25,
  maxReadMinutes: 25,
  minSample: 4,
  highSample: 8,
  highPassages: 2,
  minItemsDimension: 2,
  minItemsQa: 4,
  safeguardBelow: 50,
  safeguardCap: 55,
  completeShare: 0.8,
  rushedShare: 0.35,
  rushedErrors: 3,
  recallDelayHours: 20,
  freeEssays: [6, 11, 20],
  freeDiagnostics: 2,
  defaultStudyMinutes: 20,
  minCohort: 5,
};

/** Merge stored overrides over the defaults, ignoring anything that does not validate (a bad stored value can never break scoring). */
export function resolveConfig(stored: Record<string, unknown>): Config {
  const merged: Record<string, unknown> = { ...DEFAULT_CONFIG };
  for (const [k, v] of Object.entries(stored)) {
    if (!(k in DEFAULT_CONFIG)) continue;
    const trial = { ...merged, [k]: v };
    if (configSchema.safeParse(trial).success) merged[k] = v;
  }
  return configSchema.parse(merged);
}
