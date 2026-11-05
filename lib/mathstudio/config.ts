import { z } from "zod";

/**
 * Scoring and diagnosis configuration. Every number the engine uses lives here and can be changed by an administrator (stored in `mx_config`,
 * validated by `configSchema`, every change audited). The defaults are PROVISIONAL and have not been validated against real student outcomes; the
 * studio says so wherever it shows a score.
 */
export const ENGINE_VERSION = "mx-1.0";

export const configSchema = z.object({
  /** Weights of the overall performance score. Must add up to 100. */
  weights: z.object({ mastery: z.number().min(0).max(100), accuracy: z.number().min(0).max(100), efficiency: z.number().min(0).max(100), consistency: z.number().min(0).max(100) })
    .refine((w) => Math.abs(w.mastery + w.accuracy + w.efficiency + w.consistency - 100) < 1e-6, "weights must add up to 100"),
  /** Difficulty weights 1..5: a harder question counts for more of the accuracy and mastery figures. */
  difficultyWeights: z.object({ 1: z.number().min(0.1).max(5), 2: z.number().min(0.1).max(5), 3: z.number().min(0.1).max(5), 4: z.number().min(0.1).max(5), 5: z.number().min(0.1).max(5) }),
  /** Bayesian mastery prior: the prior's strength (pseudo-items) and the prior mean (expected accuracy before any evidence). */
  priorStrength: z.number().min(0.5).max(20),
  priorMean: z.number().min(0.1).max(0.9),
  /** A result loses half its weight in the mastery estimate after this many days (recency half-life). */
  recencyHalfLifeDays: z.number().min(1).max(365),
  /** Evidence thresholds, in number of relevant items: below `preliminary` is insufficient; then preliminary, developing, and at/above `strong` is strong. */
  evidence: z.object({ preliminary: z.number().int().min(1).max(50), developing: z.number().int().min(2).max(100), strong: z.number().int().min(3).max(200) })
    .refine((e) => e.preliminary < e.developing && e.developing < e.strong, "evidence thresholds must increase"),
  /** A topic also needs items from at least this many distinct attempts before its diagnosis is called "strong". */
  strongAttempts: z.number().int().min(1).max(10),
  /** Mastery bands (0..100): below `support` needs significant work; below `developing` developing; below `secure` progressing; at/above secure. */
  bands: z.object({ support: z.number().min(1).max(99), developing: z.number().min(1).max(99), secure: z.number().min(1).max(100) }).refine((b) => b.support < b.developing && b.developing < b.secure, "bands must increase"),
  /** A wrong answer given in under this share of the item's expected time is a candidate "hurried" error; at least `rushedMin` are needed to flag it. */
  rushedShare: z.number().min(0.05).max(1),
  rushedMin: z.number().int().min(2).max(50),
  /** A correct answer taking more than this multiple of the expected time counts toward "accurate but slow". */
  slowMultiple: z.number().min(1).max(5),
  slowMin: z.number().int().min(2).max(50),
  /** How many weaknesses the diagnosis surfaces, and how many topics the free tier shows in detail. */
  maxWeaknesses: z.number().int().min(1).max(12),
  freeTopics: z.number().int().min(1).max(20),
  /** Study minutes a day used to size the practice plan when the student gave none. */
  defaultStudyMinutes: z.number().int().min(5).max(180),
  /** Smallest group an aggregate figure may describe in administrator reports (privacy). */
  minCohort: z.number().int().min(1).max(200),
});

export type Config = z.infer<typeof configSchema>;

export const DEFAULT_CONFIG: Config = {
  weights: { mastery: 45, accuracy: 25, efficiency: 15, consistency: 15 },
  difficultyWeights: { 1: 0.8, 2: 1, 3: 1.3, 4: 1.7, 5: 2.2 },
  priorStrength: 4,
  priorMean: 0.55,
  recencyHalfLifeDays: 45,
  evidence: { preliminary: 3, developing: 8, strong: 20 },
  strongAttempts: 2,
  bands: { support: 40, developing: 60, secure: 80 },
  rushedShare: 0.3,
  rushedMin: 3,
  slowMultiple: 1.6,
  slowMin: 3,
  maxWeaknesses: 5,
  freeTopics: 3,
  defaultStudyMinutes: 30,
  minCohort: 5,
};

/** Merge stored overrides over the defaults, ignoring anything that does not validate (a bad stored value can never break scoring). */
export function resolveConfig(stored: Record<string, unknown>): Config {
  const merged: Record<string, unknown> = { ...DEFAULT_CONFIG };
  for (const [k, v] of Object.entries(stored)) {
    if (!(k in DEFAULT_CONFIG)) continue;
    if (configSchema.safeParse({ ...merged, [k]: v }).success) merged[k] = v;
  }
  return configSchema.parse(merged);
}
