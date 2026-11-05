import { item, type MathAttempt } from "../contract";
import { topicById, type Cognitive } from "../taxonomy";

/**
 * Adapter: a submitted Mathematics Speed studio session -> the standardized MathAttempt. The studio records every answer with its skill, difficulty
 * (1..10), correctness and the per-question time, so this source feeds the richest items: timed, so the engine's speed and timing diagnostics apply.
 * The 156 arithmetic skills are mapped into the universal taxonomy by keyword (an unmatched skill falls back to mental calculation, which is what the
 * studio mostly teaches); an administrator can refine the mapping later by re-tagging questions.
 */
export const MATHSPEED_SOURCE = "math-speed";

/** Ordered keyword rules: the first match wins. Kept deliberately small and auditable rather than enumerating all 156 skills. */
const RULES: Array<[RegExp, string]> = [
  [/^trig/, "trigonometry"],
  [/fraction|^mixed-fracdec|^convert$|decimal/, "fractions-decimals"],
  [/pct|percent|discount|profit-loss|interest|successive/, "percentages"],
  [/ratio|prop\b|share-ratio|partnership|mixture/, "ratio-proportion"],
  [/speed-distance|work-rate|^rate/, "rates-work-speed"],
  [/average|weighted/, "descriptive-stats"],
  [/data-|table-read|bar-chart|line-chart|pie-chart/, "data-interpretation"],
  [/probability/, "probability"],
  [/counting|perm-comb/, "counting"],
  [/quant-compare/, "quant-comparison"],
  [/estimate|approx/, "estimation"],
  [/prime-test/, "primes"],
  [/hcf|lcm|factor|divisible|multiple/, "divisibility"],
  [/remainder/, "remainders"],
  [/square|cube|sqrt|cbrt|power|exponent|radical|sci-notation|last-digit|unit-digit/, "exponents-roots"],
  [/quadratic|factorise|polynomial/, "quadratics"],
  [/solve-|substitute|like-terms|missing-number|identity-square|algebra|negatives|bodmas/, "algebra-basics"],
  [/word-multistep|reasoning-multistep|digit-problem|ages/, "multistep-problems"],
  [/perimeter|area|triangle|quad-area|circle|surface-area|volume|angle|pythagoras|measure-convert/, "geometry"], // resolved below
  [/^number|place-value|expanded|compare-numbers|count/, "number-properties"],
];
const GEO: Array<[RegExp, string]> = [[/triangle|pythagoras|angle/, "triangles"], [/circle|surface-area|volume/, "circles"], [/quad-area|area|perimeter/, "polygons"]];

export function mapSkill(skill: string): string {
  for (const [re, topic] of RULES) {
    if (re.test(skill)) {
      if (topic === "geometry") { for (const [g, t] of GEO) if (g.test(skill)) return t; return "polygons"; }
      return topic;
    }
  }
  return "mental-calc";
}

export interface MsAttempt { skill: string; d: number; correct: boolean; ms: number; allowedMs: number }

export function mathSpeedAttempt(userId: number, publicId: string, label: string, finishedAt: string, totalMs: number, answers: MsAttempt[]): MathAttempt {
  const items = answers.map((a, i) => {
    const topic = mapSkill(a.skill);
    const cognitive: Cognitive = topicById(topic)?.cognitive ?? "procedure";
    return item({ ref: `${publicId}:${i}`, topic, cognitive, difficulty: Math.ceil((a.d || 1) / 2), format: "numeric", correct: a.correct, skipped: false, timeMs: Math.max(0, Math.round(a.ms)), expectedSecs: a.allowedMs ? Math.round(a.allowedMs / 1000) : null });
  });
  return { v: 1, source: MATHSPEED_SOURCE, sourceRef: publicId, userId, label, startedAt: new Date(new Date(finishedAt).getTime() - Math.max(0, totalMs)).toISOString(), finishedAt: new Date(finishedAt).toISOString(), totalMs: Math.max(0, totalMs), items };
}
