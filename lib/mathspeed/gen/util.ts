import { evaluate, formatRat } from "../expr";
import type { Built, Ctx, Generator, Skill } from "../types";
import type { Rng } from "../rng";

/** Small helpers shared by the question generators. */

/** A number as shown in a prompt: thousands separators from 10,000 up. (Responses may be typed with or without them.) */
export const n = (x: number): string => (Math.abs(x) >= 10000 ? x.toLocaleString("en-US") : String(x));

/** An integer v divided by 10^places, written exactly ("12.5", "-0.04"), with no float error. */
export function dec(v: number, places: number): string {
  if (places <= 0) return String(v);
  const s = v < 0 ? "-" : "";
  const str = String(Math.abs(v)).padStart(places + 1, "0");
  const int = str.slice(0, str.length - places);
  const frac = str.slice(str.length - places).replace(/0+$/, "");
  return s + int + (frac ? "." + frac : "");
}

export const len = (x: number): number => String(Math.abs(Math.trunc(x))).length;
export const gcd = (a: number, b: number): number => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
export const lcm = (a: number, b: number): number => (a / gcd(a, b)) * b;
export const sgn = (x: number): string => (x < 0 ? `(${x})` : String(x));

/** Define a skill. `ms` is the allowance at difficulty 1 and 10; `target` the difficulty expected by the end of the level. */
export const S = (id: string, title: string, level: number, ms: [number, number], target: number, gen: Generator): Skill => ({ id, title, level, ms, target, gen });

/** Build a question whose answer is the exact value of an arithmetic expression. */
export function calc(prompt: string, answer: string, expr: string, working: string[], params: Record<string, number | string>, size: number, extra: Partial<Built> = {}): Built {
  return { prompt, answer, expr, working, params, size, ...extra };
}

/** A multiple-choice question; the options are shuffled with the generator's rng so the same seed always gives the same order. */
export function choice(r: Rng, prompt: string, correct: string, wrong: string[], working: string[], params: Record<string, number | string>, size: number, extra: Partial<Built> = {}): Built {
  const opts = r.shuffle([correct, ...wrong]);
  return { prompt, answer: correct, kind: "choice", options: opts, working, params, size, ...extra };
}

/** A generator that picks one of several others (used for mixed-practice skills). The picked skill is recorded as params.via. */
export function mixOf(ids: Array<[string, Generator]>): Generator {
  return (r, d, ctx) => {
    const [id, g] = r.pick(ids);
    const b = g(r, d, ctx);
    return { ...b, params: { ...b.params, via: id } };
  };
}

export const money = (ctx: Ctx, x: number | string): string => `${ctx.currency}${typeof x === "number" ? n(x) : x}`;
export const who = (r: Rng, ctx: Ctx): string => ctx.names[r.int(0, ctx.names.length - 1)];
export const two = (r: Rng, ctx: Ctx): [string, string] => {
  // A fixed number of random draws whatever the name list is, so the same seed gives the same numbers in every country.
  const i = r.int(0, ctx.names.length - 1);
  const j = (i + 1 + r.int(0, ctx.names.length - 2)) % ctx.names.length;
  return [ctx.names[i], ctx.names[j]];
};
/** Things to count or buy, by age band (kept neutral: no brands, no exam wording). */
export const things = (ctx: Ctx): readonly string[] =>
  ctx.theme === "child" ? ["stickers", "marbles", "pencils", "apples", "cards"] : ctx.theme === "teen" ? ["notebooks", "tickets", "stickers", "pens", "cards"] : ["files", "parcels", "boxes", "tickets", "books"];

const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
/** A whole number written as a superscript (for powers). */
export const sup = (x: number): string => String(x).split("").map((c) => (c === "-" ? "⁻" : SUP[Number(c)] ?? c)).join("");

/** A question whose answer is the exact value of `expr` (evaluated with the rational calculator in ../expr). */
export function calcE(prompt: string, expr: string, working: string[], params: Record<string, number | string>, size: number, extra: Partial<Built> = {}): Built {
  return { prompt, answer: formatRat(evaluate(expr)), expr, working, params, size, derived: true, ...extra };
}
