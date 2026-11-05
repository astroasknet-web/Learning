import { all, one, run } from "../portal/db";
import * as courses from "../market/courses";
import * as learning from "../market/learning";
import * as lessons from "../market/lessons";
import { badgeEarned, learnCourse, levelFor, requiredFor, skillProgress, xpFor } from "./activities";
import type { ActivityState, RunResult } from "./types";

/**
 * What a student has demonstrated. Progress here is never invented: a row exists only after a student submitted work (or a quiz) and
 * the server re-ran the checks. A module counts as complete only when its quiz AND its required activities are passed.
 */
export interface Result { id: string; attempts: number; best: number; passed: boolean; xp: number; updated: string }

const map = (r: Record<string, unknown>): Result => ({ id: String(r.activity_id), attempts: Number(r.attempts), best: Number(r.best_score), passed: Boolean(r.passed), xp: Number(r.xp), updated: String(r.updated_at) });

export async function resultsFor(userId: number, slug: string): Promise<Map<string, Result>> {
  const rows = await all("SELECT activity_id, attempts, best_score, passed, xp, updated_at FROM activity_results WHERE user_id = $1 AND course_slug = $2", [userId, slug]);
  return new Map(rows.map((r) => [String(r.activity_id), map(r)]));
}

export const passedIds = (m: Map<string, Result>): Set<string> => new Set([...m.values()].filter((r) => r.passed).map((r) => r.id));

export async function savedState(userId: number, slug: string, id: string): Promise<ActivityState | null> {
  const r = await one("SELECT state_json FROM activity_results WHERE user_id = $1 AND course_slug = $2 AND activity_id = $3", [userId, slug, id]);
  if (!r || !r.state_json) return null;
  try { return JSON.parse(String(r.state_json)) as ActivityState; } catch { return null; }
}

export const MAX_STATE_BYTES = 120_000;

/**
 * Record one submission. `check` = the student pressed "Check my work" (counts as an attempt and can pass the activity);
 * otherwise it is just "Save" (keeps the work, changes no score). XP is the activity's fixed XP, earned once, on the first pass.
 */
export async function save(userId: number, slug: string, id: string, state: ActivityState | null, xp: number, result: RunResult | null): Promise<void> {
  const json = state ? JSON.stringify(state) : null;
  if (json && Buffer.byteLength(json) > MAX_STATE_BYTES) throw new Error("Your work is too large to save.");
  const pass = result?.allPassed ?? false;
  await run(
    `INSERT INTO activity_results (user_id, course_slug, activity_id, attempts, best_score, passed, passed_at, xp, state_json, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,CASE WHEN $6 THEN NOW() END,CASE WHEN $6 THEN $7 ELSE 0 END,$8,NOW())
     ON CONFLICT (user_id, course_slug, activity_id) DO UPDATE SET
       attempts = activity_results.attempts + $4,
       best_score = GREATEST(activity_results.best_score, $5),
       passed_at = CASE WHEN activity_results.passed THEN activity_results.passed_at WHEN $6 THEN NOW() ELSE NULL END,
       xp = CASE WHEN activity_results.passed THEN activity_results.xp WHEN $6 THEN $7 ELSE 0 END,
       passed = activity_results.passed OR $6,
       state_json = COALESCE($8, activity_results.state_json),
       updated_at = NOW()`,
    [userId, slug, id, result ? 1 : 0, result?.score ?? 0, pass, xp, json],
  );
}

/** A module quiz result ("quiz:<module-slug>"), kept in the same table so progress has one source. */
export async function recordQuiz(userId: number, slug: string, module: string, percent: number, passed: boolean): Promise<void> {
  await save(userId, slug, `quiz:${module}`, null, 0, { results: [], passed: passed ? 1 : 0, total: 1, score: percent, allPassed: passed });
}

/**
 * Turn demonstrated skills into course progress: tick a module's checkpoint once its quiz and every required activity are passed,
 * then mark the course GrowQR-verified when all checkpoints are done. Earlier ticks are kept (they came from the quiz-only rule).
 * Returns what changed so the page can say so.
 */
export async function reconcile(userId: number, slug: string): Promise<{ ticked: number[]; completed: boolean; pending: string[] }> {
  const nc = lessons.nativeCourse(slug);
  const course = await courses.bySlug(slug);
  if (!nc || !course) return { ticked: [], completed: false, pending: [] };
  const passed = passedIds(await resultsFor(userId, slug));
  await learning.enrol(userId, course.id);
  const e = await learning.find(userId, course.id);
  if (!e || e.verified) return { ticked: [], completed: Boolean(e?.verified), pending: [] };
  const keys = [...nc.modules.map((m) => m.slug), "capstone"];
  const done = new Set(e.done);
  const ticked: number[] = [];
  const pending: string[] = [];
  keys.forEach((key, i) => {
    if (done.has(i)) return;
    const quizOk = passed.has(`quiz:${key}`);
    const missing = requiredFor(slug, key).filter((a) => !passed.has(a.id));
    if (quizOk && missing.length === 0) { done.add(i); ticked.push(i); }
    else if (quizOk) pending.push(key);
  });
  if (!ticked.length) return { ticked, completed: e.status === "completed", pending };
  const r = await learning.setDone(userId, course, [...done]);
  if (r?.status === "completed") await learning.verifyNative(userId, course.id);
  return { ticked, completed: r?.status === "completed", pending };
}

export interface Summary { xp: number; level: { title: string; next: { title: string; need: number } | null }; badges: Array<{ id: string; title: string; description: string; earned: boolean }>; skills: ReturnType<typeof skillProgress>; passed: Set<string>; results: Map<string, Result> }
export async function summary(userId: number, slug: string): Promise<Summary | null> {
  const lc = learnCourse(slug);
  if (!lc) return null;
  const results = await resultsFor(userId, slug);
  const passed = passedIds(results);
  const xp = xpFor(lc, passed);
  return { xp, level: levelFor(lc, xp), badges: lc.badges.map((b) => ({ id: b.id, title: b.title, description: b.description, earned: badgeEarned(b, passed) })), skills: skillProgress(lc, passed), passed, results };
}
