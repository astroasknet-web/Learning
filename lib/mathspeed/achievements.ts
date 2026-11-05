import { LEVELS } from "./curriculum";
import { speedImproved, type SkillState } from "./mastery";
import { skill } from "./skills";
import type { Answered } from "./plan";

/** Achievements. Names are fixed; each is earned once per reference (a level, a skill, a streak length). */
export type AchievementCode = "level-completed" | "accuracy-master" | "speed-improver" | "consistency-champion";
export interface Earned { code: AchievementCode; ref: string; title: string; detail: string }

export const ACHIEVEMENT_INFO: Record<AchievementCode, { title: string; how: string }> = {
  "level-completed": { title: "Level Completed", how: "Pass a Level Assessment." },
  "accuracy-master": { title: "Accuracy Master", how: "Answer at least 20 questions in one session with 95% accuracy or better." },
  "speed-improver": { title: "Speed Improver", how: "Answer a skill at least 25% faster than when you started it, with 15 or more attempts." },
  "consistency-champion": { title: "Consistency Champion", how: "Practise on 7 days in a row." },
};

export const levelCompleted = (levelN: number): Earned => ({ code: "level-completed", ref: String(levelN), title: ACHIEVEMENT_INFO["level-completed"].title, detail: `Level ${LEVELS[levelN - 1].letter}: ${LEVELS[levelN - 1].title}` });

/** Accuracy Master: 20 or more answers at 95% or better. Earned once per level of the session's first skill. */
export function accuracyMaster(answers: Answered[]): Earned | null {
  if (answers.length < 20) return null;
  const right = answers.filter((a) => a.correct).length;
  if (right / answers.length < 0.95) return null;
  const lv = skill(answers[0].skill)?.level ?? 1;
  return { code: "accuracy-master", ref: String(lv), title: ACHIEVEMENT_INFO["accuracy-master"].title, detail: `${right} of ${answers.length} correct in Level ${LEVELS[lv - 1].letter}` };
}

/** Speed Improver: one per skill that got at least 25% faster. */
export function speedImprovers(states: Map<string, SkillState>): Earned[] {
  const out: Earned[] = [];
  for (const [id, s] of states) {
    if (!speedImproved(s)) continue;
    const sk = skill(id);
    out.push({ code: "speed-improver", ref: id, title: ACHIEVEMENT_INFO["speed-improver"].title, detail: `${sk?.title ?? id}: from about ${Math.round((s.baselineMs ?? 0) / 100) / 10} s to ${Math.round((s.ms ?? 0) / 100) / 10} s` });
  }
  return out;
}

/** The length of the run of consecutive practice days that ends today or yesterday. `days` are YYYY-MM-DD strings. */
export function streak(days: string[], today: string): number {
  const set = new Set(days);
  const day = (iso: string, back: number): string => new Date(new Date(iso + "T00:00:00Z").getTime() - back * 86_400_000).toISOString().slice(0, 10);
  let start = set.has(today) ? 0 : set.has(day(today, 1)) ? 1 : -1;
  if (start < 0) return 0;
  let n = 0;
  while (set.has(day(today, start + n))) n++;
  return n;
}

export function consistency(days: string[], today: string): Earned[] {
  const n = streak(days, today);
  const out: Earned[] = [];
  for (const len of [7, 30, 100]) if (n >= len) out.push({ code: "consistency-champion", ref: String(len), title: ACHIEVEMENT_INFO["consistency-champion"].title, detail: `${len} days in a row` });
  return out;
}

/** Points: 1 for each question attempted and 1 more for each correct answer. Milestones add their own points elsewhere. */
export const xpForAnswers = (answers: Answered[]): number => answers.length + answers.filter((a) => a.correct).length;
export const XP_MODULE = 50;
export const XP_LEVEL = 300;
