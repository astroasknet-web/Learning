/** Shared types of the Mathematics Speed Enhancement Studio engine. Pure data: no database, no DOM. */
import type { Rng } from "./rng";

/** Who the examples are written for. Only wording changes (currency, names, themes); the numbers and the journey are the same everywhere. */
export interface Ctx {
  currency: string;          // symbol put before money amounts, e.g. "₹"
  names: readonly string[];  // first names used in word problems
  theme: "child" | "teen" | "adult";
}

export type AnswerKind = "number" | "choice" | "text";

/** Something to draw next to the prompt (charts and tables for the data module). */
export type Visual =
  | { type: "table"; head: string[]; rows: Array<Array<string | number>> }
  | { type: "bar"; title: string; labels: string[]; values: number[] }
  | { type: "line"; title: string; labels: string[]; values: number[] }
  | { type: "pie"; title: string; labels: string[]; values: number[] };

/** What a generator returns for one (rng, difficulty). */
export interface Built {
  prompt: string;
  /** Canonical answer: a number as text ("42", "-3.5", "3/4") or, for kind "choice", the correct option's exact text. */
  answer: string;
  kind?: AnswerKind;
  options?: string[];
  /** Accepted distance from the answer, for estimates and rounded decimals. Absent means the answer must be exact. */
  tol?: number;
  /** The response must be a fraction in lowest terms (or a whole number). */
  lowest?: boolean;
  unit?: string;
  /** Worked solution, one line per step; shown after a wrong answer and in lessons. */
  working: string[];
  /** When set, an arithmetic expression (+ - * / ^ and brackets) whose exact value is the answer. Tests check it with an independent evaluator. */
  expr?: string;
  /** Plain numbers behind the question, for the skill's independent check in the tests. */
  params: Record<string, number | string>;
  /** Rough size of the calculation (digits involved); the tests check it grows with difficulty. */
  size: number;
  visual?: Visual;
  /** True when the answer was computed from `expr` itself, so the tests need an oracle (or the expression must be the one shown in the prompt). */
  derived?: boolean;
  /** Extra time (ms) this particular question needs on top of the skill's allowance. */
  extraMs?: number;
}

export type Generator = (r: Rng, d: number, ctx: Ctx) => Built;

/** A question as the student sees it. Identified by (skill, d, seed, ctx), so it can always be rebuilt and marked on the server. */
export interface Question extends Built {
  skill: string;
  d: number;
  seed: number;
  allowedMs: number;
  kind: AnswerKind;
}

export interface Skill {
  id: string;
  title: string;
  level: number;            // 1..15 (A..O)
  /** Time allowance in ms at difficulty 1 and difficulty 10 (linear between). */
  ms: [number, number];
  /** The difficulty this skill is expected to reach by the end of its level (used by mastery). */
  target: number;
  gen: Generator;
  /** For a mixed skill: the single skills it draws from. */
  mixes?: string[];
  /** For a mixed skill: multiplies the time allowed by the underlying skill (under 1 asks for more speed). */
  timeScale?: number;
  /** For a benchmark skill: the difficulty is fixed, whatever the student's level. */
  fixedD?: number;
}

export interface Outcome { correct: boolean; ms: number }
