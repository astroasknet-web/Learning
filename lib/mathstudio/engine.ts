import { ENGINE_VERSION, type Config } from "./config";
import { areaOf, clampDifficulty, DIFFICULTY_LABEL, topicById, type Cognitive, type Difficulty, type Evidence } from "./taxonomy";

/**
 * The central performance engine. Pure, deterministic functions over a student's normalised items: no I/O, no clock read (the caller passes `now`),
 * no AI. Every number traces to a formula documented in lib/mathstudio/README.md, and each rule is unit-tested. The same items always give the same
 * scores, so the engine can be re-run to reprocess history when the algorithm version changes.
 */

/** A normalised answered item as stored, with the attempt it belongs to and when that attempt happened (for recency weighting). */
export interface Item {
  attemptId: number;
  at: string;
  topic: string;
  cognitive: Cognitive;
  difficulty: Difficulty;
  format: string;
  credit: number;
  maxMarks: number;
  correct: boolean;
  skipped: boolean;
  timeMs: number | null;
  expectedSecs: number | null;
}

const r1 = (n: number): number => Math.round(n * 10) / 10;
const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));
export const median = (xs: number[]): number | null => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
/** Fraction of the maximum marks earned on an item (partial credit aware). */
const frac = (i: Item): number => (i.maxMarks > 0 ? clamp(i.credit / i.maxMarks, 0, 1) : i.correct ? 1 : 0);
const ageDays = (at: string, now: number): number => Math.max(0, (now - Date.parse(at.replace(" ", "T") + (/[zZ]|[+-]\d\d:?\d\d$/.test(at) ? "" : "Z"))) / 86_400_000);
const recency = (at: string, now: number, halfLife: number): number => Math.pow(0.5, ageDays(at, now) / halfLife);

// ---- accuracy ----------------------------------------------------------------------------------------------------------------

export interface Accuracy { attempted: number; correct: number; incorrect: number; skipped: number; total: number; pct: number | null; weightedPct: number | null; marks: number; maxMarks: number; marksPct: number | null }

export function accuracyOf(items: Item[], cfg: Config): Accuracy {
  const attempted = items.filter((i) => !i.skipped);
  let weighted = 0, weight = 0, marks = 0, maxMarks = 0, credit = 0;
  for (const i of attempted) {
    const w = cfg.difficultyWeights[i.difficulty];
    weighted += frac(i) * w; weight += w; credit += frac(i); marks += i.credit; maxMarks += i.maxMarks;
  }
  const correct = attempted.filter((i) => i.correct).length;
  return {
    attempted: attempted.length, correct, incorrect: attempted.length - correct, skipped: items.length - attempted.length, total: items.length,
    pct: attempted.length ? r1((100 * credit) / attempted.length) : null,
    weightedPct: weight > 0 ? r1((100 * weighted) / weight) : null,
    marks: r1(marks), maxMarks: r1(maxMarks), marksPct: maxMarks > 0 ? r1((100 * marks) / maxMarks) : null,
  };
}

// ---- speed (robust; only where per-question time exists) ------------------------------------------------------------------------

export interface Speed { timedItems: number; medianSecs: number | null; medianVsExpected: number | null; secsPerCorrect: number | null; note: string; measurable: boolean }

/** Robust speed: uses the median (not the mean) so one long question does not distort the profile, and only items that carry a per-question time. */
export function speedOf(items: Item[]): Speed {
  const timed = items.filter((i) => i.timeMs !== null && !i.skipped);
  if (!timed.length) return { timedItems: 0, medianSecs: null, medianVsExpected: null, secsPerCorrect: null, note: "This source does not record the time spent on each question, so speed is not measured here.", measurable: false };
  const secs = timed.map((i) => (i.timeMs as number) / 1000);
  const med = median(secs);
  const withExpected = timed.filter((i) => i.expectedSecs);
  const ratios = withExpected.map((i) => (i.timeMs as number) / 1000 / (i.expectedSecs as number));
  const correct = timed.filter((i) => i.correct);
  return {
    timedItems: timed.length,
    medianSecs: med === null ? null : r1(med),
    medianVsExpected: ratios.length ? r1(median(ratios) as number) : null,
    secsPerCorrect: correct.length ? r1(correct.reduce((a, i) => a + (i.timeMs as number) / 1000, 0) / correct.length) : null,
    note: "Speed uses the median time, so a single slow question does not skew it.", measurable: true,
  };
}

// ---- Bayesian topic mastery ----------------------------------------------------------------------------------------------------

export interface Mastery {
  topic: string;
  topicName: string;
  area: string;
  items: number;
  attempts: number;
  /** Difficulty- and recency-weighted fractional credit, 0..1 (the posterior mean of a Beta estimate). */
  p: number;
  /** 0..100. */
  score: number;
  /** A 68% credible interval on the score, so a thin estimate shows as a wide band rather than a false point. */
  low: number;
  high: number;
  evidence: Evidence;
  band: "support" | "developing" | "progressing" | "secure";
  /** Average difficulty of the items seen, so "mastered easy only" is visible. */
  avgDifficulty: number;
  recent: Array<{ attemptId: number; at: string; pct: number; n: number }>;
  trend: number | null;
}

export function evidenceLevel(items: number, attempts: number, cfg: Config): Evidence {
  if (items < cfg.evidence.preliminary) return "insufficient";
  if (items < cfg.evidence.developing) return "preliminary";
  if (items < cfg.evidence.strong || attempts < cfg.strongAttempts) return "developing";
  return "strong";
}
const bandOf = (score: number, cfg: Config): Mastery["band"] => (score < cfg.bands.support ? "support" : score < cfg.bands.developing ? "developing" : score < cfg.bands.secure ? "progressing" : "secure");

/** Beta-posterior mastery for one topic: prior + each item's weighted evidence; difficulty and recency set each item's weight. */
export function masteryOfTopic(topic: string, items: Item[], cfg: Config, now: number): Mastery {
  const a0 = cfg.priorStrength * cfg.priorMean, b0 = cfg.priorStrength * (1 - cfg.priorMean);
  let a = a0, b = b0;
  let dSum = 0, dW = 0;
  for (const i of items) {
    const w = cfg.difficultyWeights[i.difficulty] * recency(i.at, now, cfg.recencyHalfLifeDays);
    const f = frac(i);
    a += w * f; b += w * (1 - f);
    dSum += i.difficulty * cfg.difficultyWeights[i.difficulty]; dW += cfg.difficultyWeights[i.difficulty];
  }
  const p = a / (a + b);
  // 68% Beta credible interval via the normal approximation on the posterior, clamped to [0,1].
  const varr = (a * b) / ((a + b) * (a + b) * (a + b + 1));
  const sd = Math.sqrt(varr);
  const byAttempt = new Map<number, { at: string; n: number; c: number }>();
  for (const i of items) { const e = byAttempt.get(i.attemptId) ?? { at: i.at, n: 0, c: 0 }; e.n++; e.c += frac(i); byAttempt.set(i.attemptId, e); }
  const recent = [...byAttempt.entries()].map(([attemptId, e]) => ({ attemptId, at: e.at, pct: r1((100 * e.c) / e.n), n: e.n })).sort((x, y) => x.at.localeCompare(y.at) || x.attemptId - y.attemptId).slice(-5);
  const trend = recent.length >= 2 ? r1(recent[recent.length - 1].pct - recent[recent.length - 2].pct) : null;
  const score = r1(100 * p);
  return {
    topic, topicName: topicById(topic)?.name ?? topic, area: areaOf(topic), items: items.length, attempts: byAttempt.size,
    p: Math.round(p * 1000) / 1000, score, low: r1(100 * clamp(p - sd, 0, 1)), high: r1(100 * clamp(p + sd, 0, 1)),
    evidence: evidenceLevel(items.length, byAttempt.size, cfg), band: bandOf(score, cfg),
    avgDifficulty: dW ? r1(dSum / dW) : 3, recent, trend,
  };
}

export function masteryByTopic(items: Item[], cfg: Config, now: number): Mastery[] {
  const by = new Map<string, Item[]>();
  for (const i of items) by.set(i.topic, [...(by.get(i.topic) ?? []), i]);
  return [...by.entries()].map(([topic, xs]) => masteryOfTopic(topic, xs, cfg, now)).sort((a, b) => a.score - b.score);
}

// ---- consistency -------------------------------------------------------------------------------------------------------------

export interface Consistency { index: number | null; topics: number; volatile: Array<{ topic: string; topicName: string; spread: number }> }

/** How reliably the student performs across comparable attempts of the same topic. 100 = identical each time; lower = results swing. */
export function consistencyOf(items: Item[], cfg: Config): Consistency {
  const by = new Map<string, Map<number, { n: number; c: number }>>();
  for (const i of items) { const m = by.get(i.topic) ?? new Map(); const e = m.get(i.attemptId) ?? { n: 0, c: 0 }; e.n++; e.c += frac(i); m.set(i.attemptId, e); by.set(i.topic, m); }
  const spreads: Array<{ topic: string; spread: number; weight: number }> = [];
  for (const [topic, m] of by) {
    const pcts = [...m.values()].filter((e) => e.n >= 2).map((e) => e.c / e.n);
    if (pcts.length < 2) continue;
    const mean = pcts.reduce((a, b) => a + b, 0) / pcts.length;
    const sd = Math.sqrt(pcts.reduce((a, p) => a + (p - mean) ** 2, 0) / pcts.length);
    spreads.push({ topic, spread: sd, weight: pcts.length });
  }
  if (!spreads.length) return { index: null, topics: 0, volatile: [] };
  const wsum = spreads.reduce((a, s) => a + s.weight, 0);
  const meanSpread = spreads.reduce((a, s) => a + s.spread * s.weight, 0) / wsum;
  const index = r1(100 * clamp(1 - meanSpread / 0.5, 0, 1));
  const volatile = spreads.filter((s) => s.spread > 0.2).sort((a, b) => b.spread - a.spread).slice(0, 3).map((s) => ({ topic: s.topic, topicName: topicById(s.topic)?.name ?? s.topic, spread: r1(100 * s.spread) }));
  return { index, topics: spreads.length, volatile };
}

// ---- efficiency (speed x accuracy, where time exists) --------------------------------------------------------------------------

export interface Efficiency { score: number | null; timedItems: number; note: string }
export function efficiencyOf(items: Item[], cfg: Config): Efficiency {
  const timed = items.filter((i) => i.timeMs !== null && i.expectedSecs && !i.skipped);
  if (timed.length < 4) return { score: null, timedItems: timed.length, note: "Not enough questions with a recorded time to measure efficiency." };
  const factors = timed.map((i) => clamp((i.expectedSecs as number) * 1000 / (i.timeMs as number), 0.2, 1));
  const speedFactor = median(factors) as number;
  const acc = accuracyOf(timed, cfg).weightedPct ?? 0;
  return { score: r1(speedFactor * acc), timedItems: timed.length, note: "Speed counts only together with accuracy, so being fast and wrong never scores well." };
}

// ---- overall performance score -------------------------------------------------------------------------------------------------

export type Band = Mastery["band"];
export const BAND_LABEL: Record<Band, string> = { support: "Needs focused work", developing: "Developing", progressing: "Progressing", secure: "Secure on assessed material" };

export interface Component { key: "mastery" | "accuracy" | "efficiency" | "consistency"; label: string; score: number | null; weight: number; effectiveWeight: number; contribution: number; note: string }
export interface Overall {
  engineVersion: string;
  provisional: true;
  score: number | null;
  band: Band | null;
  components: Component[];
  accuracy: Accuracy;
  speed: Speed;
  consistency: Consistency;
  efficiency: Efficiency;
  mastery: Mastery[];
  evidence: Evidence;
  topicsAssessed: number;
}

export function overallScore(items: Item[], cfg: Config, now: number): Overall {
  const accuracy = accuracyOf(items, cfg);
  const speed = speedOf(items);
  const consistency = consistencyOf(items, cfg);
  const efficiency = efficiencyOf(items, cfg);
  const mastery = masteryByTopic(items, cfg, now);
  const assessed = mastery.filter((m) => m.evidence !== "insufficient");
  // mastery component: evidence-weighted mean mastery over topics with at least preliminary evidence
  const mW = assessed.reduce((a, m) => a + m.items, 0);
  const masteryScore = mW > 0 ? r1(assessed.reduce((a, m) => a + m.score * m.items, 0) / mW) : null;
  const raw: Array<[Component["key"], number | null, string]> = [
    ["mastery", masteryScore, "Evidence-weighted average of your topic mastery estimates."],
    ["accuracy", accuracy.weightedPct, "Difficulty-weighted share of marks earned on questions you attempted."],
    ["efficiency", efficiency.score, efficiency.note],
    ["consistency", consistency.index, consistency.index === null ? "Needs two comparable attempts of a topic." : "How steady your results are across comparable attempts."],
  ];
  const present = raw.filter(([, s]) => s !== null);
  const denom = present.reduce((a, [k]) => a + cfg.weights[k], 0);
  const components: Component[] = raw.map(([key, score, note]) => {
    const eff = score !== null && denom > 0 ? r1((100 * cfg.weights[key]) / denom) : 0;
    return { key, label: { mastery: "Topic mastery", accuracy: "Accuracy", efficiency: "Efficiency", consistency: "Consistency" }[key], score, weight: cfg.weights[key], effectiveWeight: eff, contribution: score !== null && denom > 0 ? r1((score * cfg.weights[key]) / denom) : 0, note: score === null ? note : note };
  });
  const score = denom > 0 ? r1(present.reduce((a, [k, s]) => a + (s as number) * cfg.weights[k], 0) / denom) : null;
  const totalItems = items.length, totalAttempts = new Set(items.map((i) => i.attemptId)).size;
  return {
    engineVersion: ENGINE_VERSION, provisional: true, score, band: score === null ? null : bandOf(score, cfg), components,
    accuracy, speed, consistency, efficiency, mastery, evidence: evidenceLevel(totalItems, totalAttempts, cfg), topicsAssessed: assessed.length,
  };
}

export const difficultyLabel = (d: number): string => DIFFICULTY_LABEL[clampDifficulty(d)];
