import { SCORING_VERSION, type Config } from "./config";
import { DIMENSION_LABEL, GROUP_DIMENSION, SKILLS, type Dimension, type Difficulty, type Format, type QType, type SkillId } from "./taxonomy";

/**
 * Deterministic scoring. Nothing here calls an AI, reads the clock or touches the database: the same answers and timings always give the same
 * scores, and every number can be traced to the formulas in lib/reading/README.md. Pure functions only, so each rule is unit-tested.
 */

// ---- marking ---------------------------------------------------------------------------------------------------------------

export type Response = number | number[] | string | null;

export interface Keyed { format: Format; options: unknown; answer: unknown }

export interface Mark { answered: boolean; credit: number; correct: boolean }

/** Compare free text the way a person would: case, spacing, punctuation and a leading article do not matter. */
export const normaliseShort = (s: string): string => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim().replace(/^(the|a|an) /, "");

/** Mark one response. A match question earns the share of its pairs that are right (so a near miss is visible), and counts as correct only when all are. */
export function markResponse(q: Keyed, response: Response): Mark {
  if (response === null || response === undefined || response === "" || (Array.isArray(response) && response.length === 0)) return { answered: false, credit: 0, correct: false };
  if (q.format === "short") {
    const accepted = Array.isArray(q.answer) ? (q.answer as unknown[]).map((x) => normaliseShort(String(x))) : [];
    const ok = typeof response === "string" && accepted.includes(normaliseShort(response));
    return { answered: true, credit: ok ? 1 : 0, correct: ok };
  }
  if (q.format === "match") {
    const key = Array.isArray(q.answer) ? (q.answer as number[]) : [];
    if (!Array.isArray(response) || !key.length) return { answered: true, credit: 0, correct: false };
    const right = key.filter((k, i) => response[i] === k).length;
    return { answered: true, credit: right / key.length, correct: right === key.length };
  }
  const ok = typeof response === "number" && response === q.answer;
  return { answered: true, credit: ok ? 1 : 0, correct: ok };
}

// ---- items and statistics ----------------------------------------------------------------------------------------------------

export interface Item {
  questionId: number;
  passageId: number;
  skill: SkillId;
  qtype: QType;
  difficulty: Difficulty;
  credit: number;
  correct: boolean;
  skipped: boolean;
  /** Server-checked response time in ms, or null when unknown. */
  ms: number | null;
  expectedSecs: number;
}

export interface Timing {
  /** Words in the passages read, and the time spent reading them (server clock). Null reading time = not measured. */
  wordCount: number;
  readingMs: number | null;
  answeringMs: number;
  totalMs: number;
  /** Word-weighted mean passage difficulty, 1 to 5. */
  passageDifficulty: number;
}

const r1 = (n: number): number => Math.round(n * 10) / 10;
const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

export interface Tally { n: number; credit: number; weighted: number; weight: number; ms: number[] }
const emptyTally = (): Tally => ({ n: 0, credit: 0, weighted: 0, weight: 0, ms: [] });

export function tally(items: Item[], cfg: Config): Tally {
  const t = emptyTally();
  for (const i of items) {
    const w = cfg.difficultyWeights[i.difficulty];
    t.n++;
    t.credit += i.credit;
    t.weighted += i.credit * w;
    t.weight += w;
    if (i.ms !== null) t.ms.push(i.ms);
  }
  return t;
}
/** Difficulty-weighted accuracy of a tally as a percentage, or null when nothing was asked. */
export const weightedPct = (t: Tally): number | null => (t.weight > 0 ? r1((100 * t.weighted) / t.weight) : null);
/** Plain (unweighted) accuracy, for counts a student reads as "7 of 10". */
export const plainPct = (t: Tally): number | null => (t.n > 0 ? r1((100 * t.credit) / t.n) : null);

export const median = (xs: number[]): number | null => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// ---- bands ---------------------------------------------------------------------------------------------------------------

export type Band = "support" | "developing" | "progressing" | "strong";
export const BAND_LABEL: Record<Band, string> = { support: "Significant support may be needed", developing: "Developing", progressing: "Progressing", strong: "Strong on assessed material" };

export function bandOf(pct: number, cfg: Config): Band {
  if (pct < cfg.bands.support) return "support";
  if (pct < cfg.bands.developing) return "developing";
  if (pct < cfg.bands.progressing) return "progressing";
  return "strong";
}

// ---- efficiency ------------------------------------------------------------------------------------------------------------

export interface Efficiency {
  /** Words per minute from the recorded reading-session time: an ESTIMATE, not a measure of eye movement or how the student actually read. */
  wpm: number | null;
  target: number;
  speedFactor: number | null;
  score: number | null;
  /** Why no efficiency score was produced, in words a student can read. */
  note: string;
  reliable: boolean;
}

/**
 * Efficiency = speed factor x accuracy. The speed factor is wpm / target, capped at 1 (no bonus for reading faster than the target) and floored
 * at 0.25; accuracy is the comprehension accuracy (or overall accuracy when no comprehension skills were asked). Because the product can never
 * exceed accuracy, speed cannot make up for poor understanding. A reading time that implies skimming, or an interrupted session, is not scored.
 */
export function efficiencyOf(t: Timing, accuracyPct: number | null, cfg: Config): Efficiency {
  const target = cfg.targetWpm[clamp(Math.round(t.passageDifficulty), 1, 5) as 1 | 2 | 3 | 4 | 5];
  if (t.readingMs === null || t.readingMs <= 0 || t.wordCount <= 0) return { wpm: null, target, speedFactor: null, score: null, note: "Reading time was not recorded for this assessment, so speed is not scored.", reliable: false };
  const minutes = t.readingMs / 60000;
  const wpm = r1(t.wordCount / minutes);
  if (wpm > cfg.maxPlausibleWpm) return { wpm, target, speedFactor: null, score: null, note: "The time recorded is shorter than reading the passage would normally take, so the speed estimate is not used. It looks as though the passage was skimmed or skipped.", reliable: false };
  if (wpm < cfg.minWpm || minutes > cfg.maxReadMinutes) return { wpm, target, speedFactor: null, score: null, note: "The reading session looks as though it was interrupted, so the speed estimate is not used.", reliable: false };
  if (accuracyPct === null) return { wpm, target, speedFactor: null, score: null, note: "There were no questions to pair with the reading time.", reliable: true };
  const speedFactor = clamp(wpm / target, 0.25, 1);
  return { wpm, target, speedFactor: Math.round(speedFactor * 1000) / 1000, score: r1(speedFactor * accuracyPct), note: "Speed is an estimate from the recorded reading time. It counts only together with accuracy.", reliable: true };
}

// ---- the overall score -------------------------------------------------------------------------------------------------------

export interface DimensionResult {
  dimension: Dimension;
  label: string;
  /** 0..100, or null when this dimension was not assessed (and so is left out of the overall score). */
  score: number | null;
  weight: number;
  /** Share of the overall score this dimension carries after the weights of unassessed dimensions are removed. */
  effectiveWeight: number;
  /** Points this dimension contributed to the overall score. */
  contribution: number;
  questions: number;
  note: string;
}

export interface SkillScore { skill: SkillId; label: string; n: number; correct: number; pct: number | null; weightedPct: number | null; medianMs: number | null }

export interface ScoreResult {
  scoringVersion: string;
  provisional: true;
  overall: number | null;
  classification: Band | null;
  capped: boolean;
  dimensions: DimensionResult[];
  skills: SkillScore[];
  efficiency: Efficiency;
  comprehensionPct: number | null;
  qaPct: number | null;
  answered: number;
  total: number;
  correct: number;
  skipped: number;
  completion: "complete" | "partial";
}

export function scoreAssessment(items: Item[], timing: Timing, cfg: Config): ScoreResult {
  const total = items.length;
  const answered = items.filter((i) => !i.skipped).length;
  const correct = items.filter((i) => i.correct).length;
  const completion: "complete" | "partial" = total > 0 && answered / total >= cfg.completeShare ? "complete" : "partial";

  const bySkill = new Map<SkillId, Item[]>();
  for (const i of items) bySkill.set(i.skill, [...(bySkill.get(i.skill) ?? []), i]);
  const skills: SkillScore[] = [...bySkill.entries()].map(([skill, xs]) => {
    const t = tally(xs, cfg);
    return { skill, label: SKILLS[skill].label, n: t.n, correct: xs.filter((x) => x.correct).length, pct: plainPct(t), weightedPct: weightedPct(t), medianMs: median(t.ms) };
  });

  const groupScore = (g: "comprehension" | "inference" | "vocabulary" | "retention"): { score: number | null; n: number } => {
    const xs = items.filter((i) => GROUP_DIMENSION[SKILLS[i.skill].group] === g);
    const t = tally(xs, cfg);
    return { score: t.n >= cfg.minItemsDimension ? weightedPct(t) : null, n: t.n };
  };
  const comp = groupScore("comprehension");
  const inf = groupScore("inference");
  const voc = groupScore("vocabulary");
  const ret = groupScore("retention");
  const allT = tally(items, cfg);
  const qa = allT.n >= cfg.minItemsQa ? weightedPct(allT) : null;
  const efficiency = efficiencyOf(timing, comp.score ?? qa, cfg);

  const raw: Array<[Dimension, number | null, number, string]> = [
    ["comprehension", comp.score, comp.n, "Difficulty-weighted accuracy on main idea, details, fact and opinion, relationships, purpose and tone, and data questions."],
    ["qa", qa, allT.n, "Difficulty-weighted accuracy across every question in the assessment."],
    ["inference", inf.score, inf.n, "Difficulty-weighted accuracy on inference, conclusion, assumption, argument and contradiction questions."],
    ["efficiency", efficiency.score, efficiency.score === null ? 0 : allT.n, efficiency.note],
    ["vocabulary", voc.score, voc.n, "Difficulty-weighted accuracy on word-meaning and figurative-language questions."],
    ["retention", ret.score, ret.n, "Accuracy on recall questions asked without the passage in view."],
  ];
  const assessed = raw.filter(([, s]) => s !== null);
  const denom = assessed.reduce((a, [d]) => a + cfg.weights[d], 0);
  const dimensions: DimensionResult[] = raw.map(([dimension, score, questions, note]) => {
    const effectiveWeight = score !== null && denom > 0 ? r1((100 * cfg.weights[dimension]) / denom) : 0;
    const contribution = score !== null && denom > 0 ? (score * cfg.weights[dimension]) / denom : 0;
    return { dimension, label: DIMENSION_LABEL[dimension], score, weight: cfg.weights[dimension], effectiveWeight, contribution: r1(contribution), questions, note: score === null && dimension !== "efficiency" ? "Not assessed here, so it is left out and the other weights are rescaled." : note };
  });
  let overall: number | null = denom > 0 ? r1(assessed.reduce((a, [d, s]) => a + (s as number) * cfg.weights[d], 0) / denom) : null;
  let capped = false;
  if (overall !== null && comp.score !== null && comp.score < cfg.safeguardBelow && overall > cfg.safeguardCap) { overall = cfg.safeguardCap; capped = true; }

  return { scoringVersion: SCORING_VERSION, provisional: true, overall, classification: overall === null ? null : bandOf(overall, cfg), capped, dimensions, skills, efficiency, comprehensionPct: comp.score, qaPct: qa, answered, total, correct, skipped: total - answered, completion };
}

/** Response time to record: the browser's figure, but never more than the server saw elapse plus a small allowance, and never negative. */
export function checkedMs(clientMs: number, serverElapsedMs: number | null): number {
  const c = Number.isFinite(clientMs) ? Math.max(0, Math.round(clientMs)) : 0;
  if (serverElapsedMs === null) return Math.min(c, 30 * 60_000);
  return Math.min(c, Math.max(0, serverElapsedMs) + 1500, 30 * 60_000);
}

export const overallLabel = (r: ScoreResult): string => (r.overall === null ? "Not enough answers to score" : `${r.overall} / 100 (provisional)`);
