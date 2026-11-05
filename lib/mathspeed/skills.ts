import { hashString, mixSeed, rng } from "./rng";
import type { Ctx, Question, Skill } from "./types";
import { LEVEL_A } from "./gen/a";
import { LEVEL_B } from "./gen/b";
import { LEVEL_C } from "./gen/c";
import { LEVEL_D } from "./gen/d";
import { LEVEL_E } from "./gen/e";
import { LEVEL_F } from "./gen/f";
import { LEVEL_G } from "./gen/g";
import { LEVEL_H } from "./gen/h";
import { LEVEL_I } from "./gen/i";
import { LEVEL_J } from "./gen/j";
import { LEVEL_K } from "./gen/k";
import { LEVEL_L } from "./gen/l";
import { LEVEL_M } from "./gen/m";
import { LEVEL_N } from "./gen/n";
import { LEVEL_O, buildMixedSkills } from "./gen/o";

/** Every skill the engine can ask about, with the generator that writes its questions. */
const SINGLE: Skill[] = [...LEVEL_A, ...LEVEL_B, ...LEVEL_C, ...LEVEL_D, ...LEVEL_E, ...LEVEL_F, ...LEVEL_G, ...LEVEL_H, ...LEVEL_I, ...LEVEL_J, ...LEVEL_K, ...LEVEL_L, ...LEVEL_M, ...LEVEL_N, ...LEVEL_O];
export const SKILLS: Skill[] = [...SINGLE, ...buildMixedSkills(SINGLE)];

const byId = new Map(SKILLS.map((s) => [s.id, s]));
export const skill = (id: string): Skill | null => byId.get(id) ?? null;

/** Time allowed for one question: the skill's easy-to-hard allowance by difficulty, plus the question's own extra. */
export function allowedMs(s: Skill, d: number, extra = 0): number {
  const t = (Math.min(10, Math.max(1, d)) - 1) / 9;
  return Math.round((s.ms[0] + (s.ms[1] - s.ms[0]) * t + extra) / 100) * 100;
}

/**
 * Build one question. The same (skill, d, seed, ctx) always gives the same question, so the server can rebuild exactly what the student saw
 * and mark the response itself; the browser never has to be trusted about right or wrong.
 */
export function buildQuestion(id: string, d: number, seed: number, ctx: Ctx): Question {
  const s = byId.get(id);
  if (!s) throw new Error(`unknown skill ${id}`);
  const dd = s.fixedD ?? Math.min(10, Math.max(1, Math.round(d)));
  const r = rng(mixSeed(seed, hashString(id), dd));
  const b = s.gen(r, dd, ctx);
  // A mixed question is timed like the single skill it came from.
  const via = typeof b.params.via === "string" ? byId.get(b.params.via) : undefined;
  const timing = via ?? s;
  const timedD = via && typeof b.params.viaD === "number" ? b.params.viaD : dd;
  const ms = Math.round((allowedMs(timing, timedD, b.extraMs ?? 0) * (s.timeScale ?? 1)) / 100) * 100;
  return { ...b, kind: b.kind ?? "number", skill: id, d: dd, seed: seed >>> 0, allowedMs: ms };
}
