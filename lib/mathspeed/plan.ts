import { LEVELS, level, skillsOfLevel, type Module } from "./curriculum";
import { mixSeed, rng, type Rng } from "./rng";
import { ctxFor } from "./personalise";
import { allowedMs, buildQuestion, skill } from "./skills";
import { mark } from "./mark";
import type { Ctx, Question } from "./types";
import type { SkillState } from "./mastery";

/**
 * Session planning. A plan is small, plain data: the kind of session, a seed, the student's country and age band (for wording only) and a list of
 * [skill, difficulty] pairs. Questions are always rebuilt from the plan, so the server marks what the student actually saw and never trusts the browser.
 */
export type SessionKind = "practice" | "drill" | "level" | "progress" | "mastery" | "foundation" | "revision" | "review" | "diagnostic" | "benchmark";

export interface Plan {
  v: 1;
  kind: SessionKind;
  /** Module key, level number, or other reference the kind needs. */
  ref: string;
  seed: number;
  country: string;
  age: string;
  items: Array<[string, number]>;
  /** Seconds allowed for a timed drill (0 = untimed). */
  seconds: number;
}

export const PRACTICE_SIZE = 10;
export const DRILL_SECONDS = 60;
export const DRILL_ITEMS = 40;
export const LEVEL_ASSESSMENT_SIZE = 30;
export const PROGRESS_ASSESSMENT_SIZE = 15;
export const MASTERY_ASSESSMENT_SIZE = 40;
export const REVISION_SIZE = 12;
export const REVIEW_SIZE = 10;
export const DIAGNOSTIC_PROBE_SIZE = 5;
export const BENCHMARK_SIZE = 20;
export const MODULE_PASS = 0.8;
/** Levels after which a Mastery Assessment is offered: E, J and O. */
export const MASTERY_LEVELS = [5, 10, 15];

const clampD = (d: number): number => Math.min(10, Math.max(1, Math.round(d)));
const dOf = (states: Map<string, SkillState>, id: string): number => states.get(id)?.d ?? 1;
const target = (id: string): number => skill(id)?.target ?? 8;

function base(kind: SessionKind, ref: string, seed: number, country: string, age: string, items: Array<[string, number]>, seconds = 0): Plan {
  return { v: 1, kind, ref, seed: seed >>> 0, country, age, items, seconds };
}

/** Difficulty for item i of n, climbing from `from` to `to`: a graded set gets harder as it goes. */
const ramp = (from: number, to: number, i: number, n: number): number => clampD(from + ((to - from) * i) / Math.max(1, n - 1));

/**
 * A graded Practise set for a module: its skills in turn, climbing from where the student is now (never below 1, never above target - 3) to one step under
 * the level's target. Getting 8 of 10 therefore means working near the standard the level expects, not only at the easy end.
 */
export function planPractice(m: Module, states: Map<string, SkillState>, seed: number, country: string, age: string, n = PRACTICE_SIZE): Plan {
  const items: Array<[string, number]> = [];
  for (let i = 0; i < n; i++) {
    const id = m.skills[i % m.skills.length];
    const t = target(id);
    const start = Math.min(Math.max(1, dOf(states, id)), Math.max(1, t - 3));
    items.push([id, ramp(start, t - 1, i, n)]);
  }
  return base("practice", m.key, seed, country, age, items);
}

/** A timed drill: a long stream of questions at the student's current difficulty (and one step either side), ended by the clock. */
export function planDrill(m: Module, states: Map<string, SkillState>, seed: number, country: string, age: string, n = DRILL_ITEMS, seconds = DRILL_SECONDS): Plan {
  const r = rng(mixSeed(seed, 11));
  const items: Array<[string, number]> = [];
  for (let i = 0; i < n; i++) {
    const id = m.skills[i % m.skills.length];
    const t = target(id);
    items.push([id, clampD(Math.min(t, dOf(states, id)) + r.int(-1, 1))]);
  }
  return base("drill", m.key, seed, country, age, items, seconds);
}

/** The questions of one skill, spread over the three difficulties that define the level standard: target - 2, target - 1 and target. */
const standardD = (id: string, i: number): number => clampD(target(id) - 2 + (i % 3));

/**
 * The cumulative Level Assessment: at least two questions from every skill the level teaches, the remaining questions going to the skills the student
 * knows least, all at the level's standard difficulty. Weak skills found earlier are asked more often.
 */
export function planLevelAssessment(levelN: number, states: Map<string, SkillState>, seed: number, country: string, age: string, size = LEVEL_ASSESSMENT_SIZE, emphasise: string[] = []): Plan {
  const r = rng(mixSeed(seed, 21));
  const ids = skillsOfLevel(levelN);
  const per = Math.max(2, Math.floor(size / ids.length));
  const bag: string[] = [];
  for (const id of ids) for (let i = 0; i < per; i++) bag.push(id);
  const weakFirst = [...ids].sort((a, b) => (states.get(a)?.mastery ?? 0) - (states.get(b)?.mastery ?? 0));
  const pool = weakFirst;
  for (const id of emphasise) { bag.push(id, id); } // a retake asks twice more about each weak skill
  let k = 0;
  while (bag.length < size) bag.push(pool[k++ % pool.length]);
  const chosen = r.shuffle(bag);
  const seen = new Map<string, number>();
  const items = chosen.map((id): [string, number] => { const i = seen.get(id) ?? 0; seen.set(id, i + 1); return [id, standardD(id, i)]; });
  return base("level", String(levelN), seed, country, age, items);
}

/** A shorter check partway through a level: the skills of the modules already completed. */
export function planProgressAssessment(levelN: number, doneModules: string[], states: Map<string, SkillState>, seed: number, country: string, age: string): Plan {
  const lv = level(levelN)!;
  const ids = [...new Set(lv.modules.filter((m) => doneModules.includes(m.key)).flatMap((m) => m.skills))];
  const use = ids.length ? ids : skillsOfLevel(levelN).slice(0, 3);
  const r = rng(mixSeed(seed, 31));
  const items: Array<[string, number]> = [];
  for (let i = 0; i < PROGRESS_ASSESSMENT_SIZE; i++) {
    const id = use[i % use.length];
    items.push([id, clampD(Math.min(target(id) - 1, dOf(states, id) + r.int(0, 1)))]);
  }
  return base("progress", String(levelN), seed, country, age, r.shuffle(items));
}

/** The Mastery Assessment after a milestone level: questions from every level up to and including it, drawn evenly. */
export function planMasteryAssessment(upToLevel: number, seed: number, country: string, age: string): Plan {
  const r = rng(mixSeed(seed, 41));
  const items: Array<[string, number]> = [];
  for (let i = 0; i < MASTERY_ASSESSMENT_SIZE; i++) {
    const lv = 1 + (i % upToLevel);
    const ids = skillsOfLevel(lv);
    const id = ids[r.int(0, ids.length - 1)];
    items.push([id, standardD(id, i)]);
  }
  return base("mastery", String(upToLevel), seed, country, age, r.shuffle(items));
}

/** A foundation check over levels the student placed past: two questions from each, so an early gap is found rather than hidden. */
export function planFoundationCheck(placedLevels: number[], seed: number, country: string, age: string): Plan {
  const r = rng(mixSeed(seed, 51));
  const items: Array<[string, number]> = [];
  const levels = placedLevels.length ? placedLevels : [1];
  let i = 0;
  while (items.length < Math.min(20, Math.max(10, levels.length * 3))) {
    const lv = levels[i++ % levels.length];
    const ids = skillsOfLevel(lv);
    const id = ids[r.int(0, ids.length - 1)];
    items.push([id, clampD(target(id) - 2)]);
  }
  return base("foundation", "placed", seed, country, age, r.shuffle(items));
}

/** Targeted revision: only the weak skills, a little below where they failed so the student can rebuild the method. */
export function planRevision(weak: string[], states: Map<string, SkillState>, seed: number, country: string, age: string, ref: string): Plan {
  const use = weak.length ? weak : ["add-single"];
  const items: Array<[string, number]> = [];
  for (let i = 0; i < REVISION_SIZE; i++) {
    const id = use[i % use.length];
    const t = target(id);
    items.push([id, ramp(Math.max(1, Math.min(dOf(states, id), t - 1) - 1), Math.max(2, t - 2), i, REVISION_SIZE)]);
  }
  return base("revision", ref, seed, country, age, items);
}

/** Spaced review: the due skills, a few questions each, at the difficulty the student reached. */
export function planReview(due: string[], states: Map<string, SkillState>, seed: number, country: string, age: string): Plan {
  const items: Array<[string, number]> = [];
  for (let i = 0; i < REVIEW_SIZE; i++) {
    const id = due[i % due.length];
    items.push([id, clampD(Math.min(target(id), Math.max(2, dOf(states, id))))]);
  }
  return base("review", "daily", seed, country, age, items);
}

/** One stage of the diagnostic: five questions on five different skills of one level, at fluent-but-not-hard difficulty. */
export function planDiagnosticStage(levelN: number, seed: number, country: string, age: string): Plan {
  const r = rng(mixSeed(seed, 61, levelN));
  const ids = r.shuffle(skillsOfLevel(levelN)).slice(0, DIAGNOSTIC_PROBE_SIZE);
  return base("diagnostic", String(levelN), seed, country, age, ids.map((id): [string, number] => [id, clampD(target(id) - 2)]));
}

/** The personal benchmark: the same ten skills at the same difficulty, twice, for a comparable speed and accuracy figure. */
export function planBenchmark(seed: number, country: string, age: string): Plan {
  const items: Array<[string, number]> = Array.from({ length: BENCHMARK_SIZE }, () => ["benchmark", 6]);
  return base("benchmark", "O", seed, country, age, items);
}

// ---- rebuilding and marking -----------------------------------------------------------------------------------------------

export const itemSeed = (plan: Plan, i: number): number => mixSeed(plan.seed, i + 1);
export const planCtx = (plan: Plan): Ctx => ctxFor(plan.country, plan.age);

export function questionsOf(plan: Plan): Question[] {
  const ctx = planCtx(plan);
  return plan.items.map(([id, d], i) => buildQuestion(id, d, itemSeed(plan, i), ctx));
}

export interface Answered {
  skill: string; d: number; correct: boolean; ms: number; allowedMs: number; response: string; parsed: boolean;
}
export interface Response { r: string; ms: number }

/**
 * Mark a submitted session. The server rebuilds each question from the plan and marks the response itself. Only as many responses as the plan has
 * are read; a missing response is a blank, counted wrong. Times are clamped to a sensible range (a timer cannot run backwards or for hours).
 */
export function markPlan(plan: Plan, responses: Response[]): Answered[] {
  const qs = questionsOf(plan);
  const out: Answered[] = [];
  const limit = plan.seconds > 0 ? Math.min(qs.length, responses.length) : qs.length;
  let spent = 0;
  for (let i = 0; i < limit; i++) {
    const q = qs[i];
    const given = responses[i];
    const text = typeof given?.r === "string" ? given.r.slice(0, 60) : "";
    const ms = Math.min(600_000, Math.max(0, Math.round(Number(given?.ms) || 0)));
    spent += ms;
    if (plan.seconds > 0 && spent > (plan.seconds + 3) * 1000) break; // answers that took longer than the clock allowed are not counted
    const m = text === "" ? { correct: false, parsed: false } : mark(q, text);
    out.push({ skill: q.skill, d: q.d, correct: m.correct, ms, allowedMs: q.allowedMs, response: text, parsed: m.parsed });
  }
  return out;
}

export { allowedMs, LEVELS };
export type { Rng };
