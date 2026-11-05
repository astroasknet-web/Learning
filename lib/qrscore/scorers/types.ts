/** One parameter's raw 0-5 score plus a short human-readable reason (the audit trail shown to staff). */
export interface RawScore {
  score: number;
  reason: string;
}

/** Raw scores keyed by rubric parameter id. */
export type RawScores = Record<number, RawScore>;

/** Clamp to 0-5 and attach the label for that score. */
export function rate(score: number, labels: Record<number, string>): RawScore {
  const s = Math.max(0, Math.min(5, Math.trunc(score)));
  return { score: s, reason: labels[s] ?? "" };
}
