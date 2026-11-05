import type { Outcome } from "./types";

/**
 * Per-skill learning state: adaptive difficulty, accuracy and speed tracking, a mastery score and a spaced-review schedule.
 * Pure functions over plain data; the database layer only stores and loads a SkillState.
 */
export interface SkillState {
  /** The difficulty (1..10) the next question of this skill is aimed at. */
  d: number;
  attempts: number;
  correct: number;
  /** Smoothed accuracy, 0..1. */
  acc: number;
  /** Smoothed speed score, 0..1: 1 means answered inside the time allowed. */
  speed: number;
  /** Smoothed time of correct answers (ms), or null before the first correct answer. */
  ms: number | null;
  /** Average time of the first five correct answers (ms): the starting point for "Speed Improver". */
  baselineMs: number | null;
  baselineN: number;
  /** The last few outcomes at about the current difficulty: [correct, inTime]. Drives the difficulty. */
  recent: Array<[0 | 1, 0 | 1]>;
  /** 0..100. */
  mastery: number;
  /** Spaced review: the position in INTERVAL_DAYS, and when the skill is next due (null = not scheduled yet). */
  step: number;
  nextReviewAt: string | null;
  lastSeenAt: string | null;
  masteredAt: string | null;
}

export const newSkillState = (): SkillState => ({ d: 1, attempts: 0, correct: 0, acc: 0, speed: 0, ms: null, baselineMs: null, baselineN: 0, recent: [], mastery: 0, step: 0, nextReviewAt: null, lastSeenAt: null, masteredAt: null });

/** Days until the next review after each successful review. */
export const INTERVAL_DAYS = [1, 3, 7, 14, 30, 60, 120];
export const MASTERED_AT = 80;
export const MASTERED_MIN_ATTEMPTS = 10;
const DAY = 86_400_000;

export interface Applied { state: SkillState; becameMastered: boolean }

/** Mastery: accuracy, speed, and how far the student has climbed towards the difficulty the level expects (easy questions alone can never reach mastery). */
export function masteryScore(s: Pick<SkillState, "acc" | "speed" | "d" | "attempts">, target: number): number {
  if (s.attempts === 0) return 0;
  const depth = Math.min(1, s.d / target);
  return Math.round(1000 * (0.4 * s.acc + 0.15 * s.speed + 0.45 * depth)) / 10;
}

/**
 * Record one answered question. `q.d` is the difficulty of the question; it only moves the student's difficulty when it was close to it,
 * so easy warm-up questions never push the student up and a few hard ones never push them down.
 */
export function applyOutcome(state: SkillState, o: Outcome & { allowedMs: number; d: number }, target: number, now: Date): Applied {
  const s: SkillState = { ...state, recent: [...state.recent] };
  s.attempts += 1;
  if (o.correct) s.correct += 1;
  const alpha = s.attempts <= 8 ? 1 / s.attempts : 0.15;
  s.acc += alpha * ((o.correct ? 1 : 0) - s.acc);
  const inTime = o.correct && o.ms <= o.allowedMs;
  const speedScore = o.correct ? Math.min(1, o.allowedMs / Math.max(o.ms, 500)) : 0;
  s.speed += alpha * (speedScore - s.speed);
  if (o.correct) {
    s.ms = s.ms === null ? o.ms : s.ms * 0.8 + o.ms * 0.2;
    if (s.baselineN < 5) { s.baselineMs = s.baselineMs === null ? o.ms : (s.baselineMs * s.baselineN + o.ms) / (s.baselineN + 1); s.baselineN += 1; }
  }
  if (Math.abs(o.d - s.d) <= 1) {
    s.recent.push([o.correct ? 1 : 0, inTime ? 1 : 0]);
    if (s.recent.length > 6) s.recent.shift();
    const right = s.recent.filter((x) => x[0] === 1).length, fast = s.recent.filter((x) => x[1] === 1).length;
    if (s.recent.length >= 5 && right >= 5 && fast >= 4 && s.d < 10) { s.d += 1; s.recent = []; }
    else if (s.recent.length >= 4 && right * 2 <= s.recent.length && s.d > 1) { s.d -= 1; s.recent = []; }
  }
  s.mastery = masteryScore(s, target);
  s.lastSeenAt = now.toISOString();
  const was = state.masteredAt !== null;
  let becameMastered = false;
  if (!was && s.attempts >= MASTERED_MIN_ATTEMPTS && s.mastery >= MASTERED_AT) {
    s.masteredAt = now.toISOString();
    s.step = 0;
    s.nextReviewAt = new Date(now.getTime() + INTERVAL_DAYS[0] * DAY).toISOString();
    becameMastered = true;
  }
  return { state: s, becameMastered };
}

export const isMastered = (s: SkillState): boolean => s.masteredAt !== null && s.mastery >= MASTERED_AT - 10;

/** Mastery as shown today: a mastered skill that is overdue for review fades a little each day (at most 25%), until it is reviewed. */
export function effectiveMastery(s: SkillState, now: Date): number {
  if (!s.masteredAt || !s.nextReviewAt) return s.mastery;
  const overdueDays = (now.getTime() - new Date(s.nextReviewAt).getTime()) / DAY;
  if (overdueDays <= 0) return s.mastery;
  return Math.round(s.mastery * (1 - Math.min(0.25, overdueDays * 0.01)) * 10) / 10;
}

/** Skills whose review is due, most overdue first. */
export function dueSkills(states: Map<string, SkillState>, now: Date, limit = 20): string[] {
  return [...states]
    .filter(([, s]) => s.nextReviewAt !== null && new Date(s.nextReviewAt).getTime() <= now.getTime())
    .sort((a, b) => new Date(a[1].nextReviewAt!).getTime() - new Date(b[1].nextReviewAt!).getTime())
    .slice(0, limit)
    .map(([id]) => id);
}

/**
 * Update a skill's review schedule after a review session in which it was asked `asked` times and answered `right` times.
 * 80% or better moves it to the next interval; under 60% sends it back to the start and takes some mastery away; in between repeats the interval, halved.
 */
export function afterReview(s: SkillState, asked: number, right: number, now: Date): SkillState {
  if (asked < 2) return s;
  const out = { ...s };
  const acc = right / asked;
  if (acc >= 0.8) {
    out.step = Math.min(INTERVAL_DAYS.length - 1, s.step + 1);
    out.nextReviewAt = new Date(now.getTime() + INTERVAL_DAYS[out.step] * DAY).toISOString();
  } else if (acc < 0.6) {
    out.step = 0;
    out.nextReviewAt = new Date(now.getTime() + INTERVAL_DAYS[0] * DAY).toISOString();
    out.mastery = Math.max(0, Math.round((s.mastery - 8) * 10) / 10);
  } else {
    out.nextReviewAt = new Date(now.getTime() + (INTERVAL_DAYS[s.step] * DAY) / 2).toISOString();
  }
  return out;
}

/** Put a skill into the review schedule immediately (used when a placement or a check finds a gap in earlier work). */
export function scheduleNow(s: SkillState, now: Date): SkillState {
  return { ...s, step: 0, nextReviewAt: now.toISOString() };
}

/** True when the correct-answer time has improved by at least `ratio` compared with the starting speed (Speed Improver). */
export function speedImproved(s: SkillState, ratio = 0.25): boolean {
  return s.attempts >= 15 && s.baselineN >= 5 && s.baselineMs !== null && s.ms !== null && s.ms <= s.baselineMs * (1 - ratio);
}
