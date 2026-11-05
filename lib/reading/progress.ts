import type { Config } from "./config";
import type { SkillDiagnosis } from "./diagnosis";
import type { Kind } from "./taxonomy";

/**
 * Progress over time. Only complete assessments count, only comparable ones are compared (same kind of assessment, passage difficulty within one
 * step), a repeat of the same passage is called a repeat, and a flat score on a harder passage is not reported as a decline.
 */
export interface Summary {
  id: number;
  /** The id used in page addresses (the numeric id is internal). */
  publicId?: string;
  at: string;
  kind: Kind;
  levelKey: string | null;
  overall: number | null;
  wpm: number | null;
  comprehensionPct: number | null;
  qaPct: number | null;
  avgDifficulty: number | null;
  completion: "complete" | "partial";
  passageIds: number[];
  scoringVersion: string;
  correct: number;
  total: number;
}

/** Assessments are compared within a family: starting and fresh assessments together; each of the others on its own. */
export const family = (k: Kind): string => (k === "diagnostic" || k === "fresh" ? "assessment" : k);

export const comparableTo = (latest: Summary, other: Summary): boolean =>
  other.id !== latest.id && other.completion === "complete" && family(other.kind) === family(latest.kind) && other.scoringVersion === latest.scoringVersion &&
  (latest.avgDifficulty === null || other.avgDifficulty === null || Math.abs(latest.avgDifficulty - other.avgDifficulty) <= 1);

export type Verdict = "improved" | "steady" | "declined" | "harder-steady" | "harder-lower" | "repeat" | "first";

export interface Comparison {
  previous: Summary | null;
  verdict: Verdict;
  overallDelta: number | null;
  wpmDelta: number | null;
  comprehensionDelta: number | null;
  harder: boolean;
  repeat: boolean;
  message: string;
}

const MEANINGFUL = 3; // points; smaller moves are within what one assessment can wobble

export function compareToPrevious(latest: Summary, all: Summary[]): Comparison {
  const before = all.filter((s) => s.at < latest.at || (s.at === latest.at && s.id < latest.id)).filter((s) => comparableTo(latest, s)).sort((a, b) => a.at.localeCompare(b.at) || a.id - b.id);
  const previous = before[before.length - 1] ?? null;
  if (!previous) return { previous: null, verdict: "first", overallDelta: null, wpmDelta: null, comprehensionDelta: null, harder: false, repeat: false, message: "This is your first comparable assessment, so there is nothing to compare it with yet." };
  const d = (a: number | null, b: number | null): number | null => (a === null || b === null ? null : Math.round((a - b) * 10) / 10);
  const overallDelta = d(latest.overall, previous.overall);
  const repeat = latest.passageIds.length > 0 && latest.passageIds.every((p) => previous.passageIds.includes(p));
  const harder = latest.avgDifficulty !== null && previous.avgDifficulty !== null && latest.avgDifficulty - previous.avgDifficulty >= 0.5;
  const base = { previous, overallDelta, wpmDelta: d(latest.wpm, previous.wpm), comprehensionDelta: d(latest.comprehensionPct, previous.comprehensionPct), harder, repeat };
  if (overallDelta === null) return { ...base, verdict: "steady", message: "There was not enough in common to compare overall scores." };
  if (repeat) return { ...base, verdict: "repeat", message: `You read the same passage again and moved ${overallDelta >= 0 ? "+" : ""}${overallDelta} points. Some of that can be remembering the passage, so a fresh passage is the better test.` };
  if (harder && overallDelta >= -MEANINGFUL) return { ...base, verdict: "harder-steady", message: `This passage was harder than your last one, and you ${overallDelta > MEANINGFUL ? `scored ${overallDelta} points higher` : "held your score"}. That is a good sign.` };
  if (harder) return { ...base, verdict: "harder-lower", message: `Your score is ${Math.abs(overallDelta)} points lower, but this passage was harder than your last one, so it is not a like-for-like drop.` };
  if (overallDelta >= MEANINGFUL) return { ...base, verdict: "improved", message: `Up ${overallDelta} points from your previous comparable assessment.` };
  if (overallDelta <= -MEANINGFUL) return { ...base, verdict: "declined", message: `Down ${Math.abs(overallDelta)} points from your previous comparable assessment. One result can wobble; the next fresh passage will show whether it holds.` };
  return { ...base, verdict: "steady", message: "About the same as your previous comparable assessment." };
}

export interface Trend {
  window: Summary[];
  /** Least-squares slope in points per assessment. Null when there are fewer than three comparable points: a line through two points says nothing. */
  slope: number | null;
  firstToLast: number | null;
  wpmChange: number | null;
  comprehensionChange: number | null;
  message: string;
}

/** The last five comparable, complete assessments (the latest and up to four before it) and what changed across them. */
export function trendOf(all: Summary[]): Trend | null {
  const done = all.filter((s) => s.completion === "complete" && s.overall !== null).sort((a, b) => a.at.localeCompare(b.at) || a.id - b.id);
  const latest = done[done.length - 1];
  if (!latest) return null;
  const window = [...done.filter((s) => comparableTo(latest, s)), latest].sort((a, b) => a.at.localeCompare(b.at) || a.id - b.id).slice(-5);
  if (window.length < 2) return { window, slope: null, firstToLast: null, wpmChange: null, comprehensionChange: null, message: "A trend needs at least two comparable assessments." };
  const ys = window.map((w) => w.overall as number);
  const n = ys.length;
  let slope: number | null = null;
  if (n >= 3) {
    const mx = (n - 1) / 2;
    const my = ys.reduce((a, b) => a + b, 0) / n;
    slope = Math.round((ys.reduce((a, y, i) => a + (i - mx) * (y - my), 0) / ys.reduce((a, _, i) => a + (i - mx) ** 2, 0)) * 100) / 100;
  }
  const firstToLast = Math.round((ys[n - 1] - ys[0]) * 10) / 10;
  const ch = (key: "wpm" | "comprehensionPct"): number | null => { const a = window[0][key], b = window[n - 1][key]; return a === null || b === null ? null : Math.round((b - a) * 10) / 10; };
  return { window, slope, firstToLast, wpmChange: ch("wpm"), comprehensionChange: ch("comprehensionPct"), message: `Across your last ${n} comparable assessments your overall score moved ${firstToLast >= 0 ? "+" : ""}${firstToLast} points.` };
}

export interface SkillProgress { improved: SkillDiagnosis[]; stillWeak: SkillDiagnosis[]; recurringNow: number; recurringBefore: number | null }

/** Skills whose latest assessed accuracy beat the one before by at least five points, those still below the "progressing" line, and how many repeat errors there are. */
export function skillProgress(diags: SkillDiagnosis[], cfg: Config, recurringBefore: number | null = null): SkillProgress {
  return {
    improved: diags.filter((d) => d.change !== null && d.change >= 5),
    stillWeak: diags.filter((d) => d.band === "support" || d.band === "developing").filter((d) => !d.stretchOnly),
    recurringNow: diags.filter((d) => d.repeatedError).length,
    recurringBefore,
  };
}

// ---- levels ------------------------------------------------------------------------------------------------------------------

export interface LevelRule { key: string; position: number; passPct: number; minQuestions: number }
export interface LevelAttempt { kind: Kind; levelKey: string; completion: "complete" | "partial"; correct: number; total: number; credit: number }
export interface LevelState { key: string; unlocked: boolean; mastered: boolean; practiceDone: boolean; bestMasteryPct: number | null; combinedPct: number | null; message: string }

/**
 * A level is mastered when a complete Mastery check on it reaches the level's pass mark with at least its minimum number of questions, and the
 * level's practice and mastery answers together are within five points of that mark (so one lucky check is not enough). The next level opens only
 * then: demonstrated mastery, not time spent. Practice must have been completed at least once.
 */
export function levelStates(levels: LevelRule[], attempts: LevelAttempt[]): LevelState[] {
  const sorted = [...levels].sort((a, b) => a.position - b.position);
  let prevMastered = true;
  return sorted.map((lv) => {
    const mine = attempts.filter((a) => a.levelKey === lv.key && a.completion === "complete");
    const practice = mine.filter((a) => a.kind === "practice");
    const mastery = mine.filter((a) => a.kind === "mastery");
    const bestMasteryPct = mastery.length ? Math.max(...mastery.map((a) => Math.round((1000 * a.credit) / Math.max(1, a.total)) / 10)) : null;
    const totalQ = [...practice, ...mastery].reduce((a, x) => a + x.total, 0);
    const combinedPct = totalQ ? Math.round((1000 * [...practice, ...mastery].reduce((a, x) => a + x.credit, 0)) / totalQ) / 10 : null;
    const passing = mastery.find((a) => a.total >= lv.minQuestions && (100 * a.credit) / a.total >= lv.passPct);
    const mastered = !!passing && practice.length > 0 && combinedPct !== null && combinedPct >= lv.passPct - 5;
    const unlocked = prevMastered;
    let message: string;
    if (!unlocked) message = "Opens when the level before it is mastered.";
    else if (mastered) message = "Mastered.";
    else if (!practice.length) message = "Complete the practice, then take the mastery check.";
    else if (bestMasteryPct === null) message = `Take the mastery check: ${lv.passPct}% or more opens the next level.`;
    else message = `Best mastery check so far: ${bestMasteryPct}%. You need ${lv.passPct}% (and practice and checks together near that mark).`;
    prevMastered = mastered;
    return { key: lv.key, unlocked, mastered, practiceDone: practice.length > 0, bestMasteryPct, combinedPct, message };
  });
}

/** Readiness for the next level in words, from the current level's state. */
export function readiness(states: LevelState[]): { current: LevelState | null; next: LevelState | null; message: string } {
  const current = states.find((s) => s.unlocked && !s.mastered) ?? null;
  if (!current) return { current: null, next: null, message: states.length && states.every((s) => s.mastered) ? "Every level is mastered." : "Start with the first level." };
  const idx = states.indexOf(current);
  return { current, next: states[idx + 1] ?? null, message: current.message };
}
