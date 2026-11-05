import { LEVELS, MAX_LEVEL, level } from "./curriculum";
import type { Answered } from "./plan";

/** Unlock rules, assessment verdicts and the placement diagnostic. Pure functions; the database layer feeds them what a student has done. */

export interface Progress {
  /** The level the student began at (1 unless a diagnostic recommended more). Levels below it are "placed": open for study, not formally completed. */
  startLevel: number;
  /** Levels whose Level Assessment has been passed. */
  completed: ReadonlySet<number>;
  /** Module keys finished (Learn and Understand viewed, graded Practise passed). */
  doneModules: ReadonlySet<string>;
  /** Levels whose last Level Assessment was failed and whose targeted revision has not been done yet. */
  revisionPending: ReadonlySet<number>;
}

export type LevelStatus = "completed" | "in_progress" | "locked";

export const isPlaced = (n: number, p: Progress): boolean => n < p.startLevel && !p.completed.has(n);
const isDone = (n: number, p: Progress): boolean => p.completed.has(n) || isPlaced(n, p);

/** The level the student is working on: the first one not completed or placed. After level O it is MAX_LEVEL + 1. */
export function frontier(p: Progress): number {
  for (let n = 1; n <= MAX_LEVEL; n++) if (!isDone(n, p)) return n;
  return MAX_LEVEL + 1;
}

/** Completed / In progress / Locked, as shown on the learning journey. */
export function levelStatus(n: number, p: Progress): LevelStatus {
  const f = frontier(p);
  return n < f ? "completed" : n === f ? "in_progress" : "locked";
}

/** Modules of the working level open in order: a module opens when the one before it is finished. Finished and placed levels are open throughout. */
export function moduleOpen(levelN: number, moduleN: number, p: Progress): boolean {
  const f = frontier(p);
  if (levelN < f) return true;
  if (levelN > f) return false;
  if (moduleN <= 1) return true;
  const prev = level(levelN)?.modules[moduleN - 2];
  return prev ? p.doneModules.has(prev.key) : false;
}

export interface AssessmentGate { ok: boolean; reason?: string }

/** The Level Assessment opens when every module of the level is finished; after a fail it also needs the targeted revision. */
export function levelAssessmentGate(levelN: number, p: Progress): AssessmentGate {
  const lv = level(levelN);
  if (!lv) return { ok: false, reason: "That level does not exist." };
  if (levelStatus(levelN, p) === "locked") return { ok: false, reason: "Complete the earlier levels first." };
  if (p.completed.has(levelN)) return { ok: true };
  const left = lv.modules.filter((m) => !p.doneModules.has(m.key)).length;
  if (left > 0) return { ok: false, reason: `Finish the remaining ${left} module${left === 1 ? "" : "s"} first.` };
  if (p.revisionPending.has(levelN)) return { ok: false, reason: "Do the targeted revision for your weak skills first." };
  return { ok: true };
}

/** A Progress Assessment is open once a quarter of the level's modules (at least two) are finished. */
export function progressAssessmentGate(levelN: number, p: Progress): AssessmentGate {
  const lv = level(levelN);
  if (!lv) return { ok: false, reason: "That level does not exist." };
  if (levelStatus(levelN, p) === "locked") return { ok: false, reason: "Complete the earlier levels first." };
  const done = lv.modules.filter((m) => p.doneModules.has(m.key)).length;
  const need = Math.max(2, Math.ceil(lv.modules.length / 4));
  return done >= need ? { ok: true } : { ok: false, reason: `Finish ${need - done} more module${need - done === 1 ? "" : "s"} to open it.` };
}

/** The Mastery Assessment opens after levels E, J and O are completed. */
export function masteryAssessmentGate(upTo: number, p: Progress): AssessmentGate {
  if (![5, 10, 15].includes(upTo)) return { ok: false, reason: "No Mastery Assessment at this point." };
  return p.completed.has(upTo) ? { ok: true } : { ok: false, reason: `Complete Level ${LEVELS[upTo - 1].letter} first.` };
}

// ---- verdicts -----------------------------------------------------------------------------------------------------------------

export interface SkillResult { skill: string; asked: number; right: number; accuracy: number }
export interface Verdict {
  total: number; correct: number;
  /** Percent, one decimal. */
  accuracy: number;
  /** Median time of the correct answers (ms), or null. */
  medianMs: number | null;
  /** Percent of correct answers that were inside the time allowed. */
  inTime: number;
  passed: boolean;
  perSkill: SkillResult[];
  /** Skills to revise: asked at least twice and under 70%; if none is that low but the verdict failed, the three weakest. */
  weak: string[];
}

const median = (xs: number[]): number | null => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

export function verdict(answers: Answered[], passPct: number): Verdict {
  const total = answers.length;
  const correct = answers.filter((a) => a.correct).length;
  const accuracy = total ? Math.round((correct / total) * 1000) / 10 : 0;
  const rights = answers.filter((a) => a.correct);
  const per = new Map<string, { asked: number; right: number }>();
  for (const a of answers) {
    const e = per.get(a.skill) ?? { asked: 0, right: 0 };
    e.asked += 1;
    if (a.correct) e.right += 1;
    per.set(a.skill, e);
  }
  const perSkill: SkillResult[] = [...per].map(([skill, e]) => ({ skill, asked: e.asked, right: e.right, accuracy: Math.round((e.right / e.asked) * 1000) / 10 })).sort((a, b) => a.accuracy - b.accuracy);
  const passed = total > 0 && accuracy >= passPct;
  let weak = perSkill.filter((s) => s.asked >= 2 && s.accuracy < 70).map((s) => s.skill);
  if (!passed && weak.length === 0) weak = perSkill.filter((s) => s.accuracy < 100).slice(0, 3).map((s) => s.skill);
  return { total, correct, accuracy, medianMs: median(rights.map((a) => a.ms)), inTime: rights.length ? Math.round((rights.filter((a) => a.ms <= a.allowedMs).length / rights.length) * 100) : 0, passed, perSkill, weak };
}

/** A graded Practise set finishes its module with 80% or better. */
export const modulePassed = (v: Pick<Verdict, "accuracy" | "total">): boolean => v.total >= 8 && v.accuracy >= 80;

// ---- the placement diagnostic ---------------------------------------------------------------------------------------------------

export interface Probe { level: number; right: number; asked: number; passed: boolean }
export interface DiagState {
  /** The highest level known to be passed (0 = none yet) and the highest level that could still be passed. */
  lo: number; hi: number;
  probes: Probe[];
  done: boolean;
  /** The level to start at once done. */
  recommended: number | null;
}

export const PROBE_PASS = 0.8;

/** The search runs over the levels that can be played today: levels whose lessons are not written are never offered as a start. */
export const startDiagnostic = (playable: number): DiagState => ({ lo: 0, hi: Math.max(1, Math.min(MAX_LEVEL, playable)), probes: [], done: false, recommended: null });

/** The next level to probe: the middle of what is still possible. null when the search has finished. */
export function nextProbe(s: DiagState): number | null {
  if (s.done || s.lo >= s.hi) return null;
  return Math.ceil((s.lo + s.hi) / 2);
}

/**
 * Record a probe. Passing it (4 of 5) means the student is at least that far on; failing it caps the search below that level.
 * The recommended start is the highest level passed (or Level A), not the one after it: the student still works through that level's modules,
 * and every level skipped stays open for study and is checked by a Foundation Check.
 */
export function recordProbe(s: DiagState, levelN: number, right: number, asked: number): DiagState {
  const passed = asked > 0 && right / asked >= PROBE_PASS;
  const probes = [...s.probes, { level: levelN, right, asked, passed }];
  let { lo, hi } = s;
  if (passed) lo = Math.max(lo, levelN);
  else hi = Math.min(hi, levelN - 1);
  if (hi < lo) hi = lo;
  const done = lo >= hi;
  return { lo, hi, probes, done, recommended: done ? Math.max(1, lo) : null };
}

/** How the diagnostic result is worded to the student. Never says anything is skipped permanently. */
export function placementSummary(recommended: number): string {
  const lv = LEVELS[recommended - 1];
  return recommended === 1
    ? "You will begin at Level A, where the journey starts."
    : `You will begin at Level ${lv.letter}: ${lv.title}. Levels A to ${LEVELS[recommended - 2].letter} stay open for you to study at any time, and a short Foundation Check will confirm they are secure.`;
}
