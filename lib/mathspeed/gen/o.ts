import { digits, scale } from "../rng";
import type { Generator, Skill } from "../types";
import { S, calc, choice, dec, len, n } from "./util";

/** Level O: Mastery and High-Speed Calculation. Large-number work is generated here; the mixed and cumulative skills are assembled from the other levels in buildMixedSkills. */

const largeMental: Generator = (r, d) => {
  const form = r.pick(d <= 3 ? [0, 1] : d <= 6 ? [0, 1, 3] : [0, 1, 2, 3, 4]);
  switch (form) {
    case 0: {
      const k = scale(d, 5, 7);
      const a = digits(r, k), b = digits(r, k);
      const add = r.chance(0.5);
      const [x, y] = add ? [a, b] : a >= b ? [a, b] : [b, a];
      return calc(`${n(x)} ${add ? "+" : "-"} ${n(y)} = ?`, String(add ? x + y : x - y), `${x}${add ? "+" : "-"}${y}`, [`Work in chunks of thousands: split each number as ${n(Math.floor(x / 1000) * 1000)} and ${x % 1000}.`], { form, x, y, add: add ? 1 : 0 }, k);
    }
    case 1: { const a = digits(r, scale(d, 4, 5)), b = r.int(11, scale(d, 30, 99)); return calc(`${n(a)} × ${b} = ?`, String(a * b), `${a}*${b}`, [`Multiply by the tens and the ones separately, then add.`], { form, a, b }, len(a * b)); }
    case 2: { const a = digits(r, 4), b = r.int(101, scale(d, 300, 999)); return calc(`${n(a)} × ${b} = ?`, String(a * b), `${a}*${b}`, [`Break ${b} into hundreds, tens and ones and add the three products.`], { form, a, b }, len(a * b)); }
    case 3: { const a = r.int(scale(d, 101, 105), scale(d, 199, 999)); return calc(`${a}² = ?`, String(a * a), `${a}*${a}`, [`Use (a ± b)² around a round number near ${a}.`], { form, a }, len(a * a)); }
    default: { const b = r.int(101, scale(d, 200, 499)), q = r.int(101, 999); return calc(`${n(b * q)} ÷ ${b} = ?`, String(q), `${b * q}/${b}`, [`Estimate first, then check by multiplying back.`], { form, a: b * q, b }, len(b * q)); }
  }
};

const mulAdv: Generator = (r, d) => {
  const form = r.pick(d <= 3 ? [0, 1] : [0, 1, 2, 3]);
  switch (form) {
    case 0: { const a = r.int(101, scale(d, 199, 999)), b = r.int(101, scale(d, 199, 999)); return calc(`${a} × ${b} = ?`, String(a * b), `${a}*${b}`, [`Split one number into hundreds, tens and ones and add the partial products.`], { form, a, b }, len(a * b)); }
    case 1: { const a = digits(r, 4), b = r.int(12, 99); return calc(`${n(a)} × ${b} = ?`, String(a * b), `${a}*${b}`, [`${n(a)} × ${Math.floor(b / 10) * 10} + ${n(a)} × ${b % 10}.`], { form, a, b }, len(a * b)); }
    case 2: { const da = r.int(1, scale(d, 9, 40)), db = r.int(1, scale(d, 9, 40)); const a = 1000 - da, b = 1000 + db; return calc(`${n(a)} × ${n(b)} = ?`, String(a * b), `${a}*${b}`, [`Both are near 1000: ${n(a)} = 1000 - ${da}, ${n(b)} = 1000 + ${db}.`, `Cross: ${n(a)} + ${db} = ${n(a + db)}; gaps: -${da} × ${db} = -${da * db}.`, `${n((a + db) * 1000)} - ${da * db} = ${n(a * b)}`], { form, a, b }, len(a * b)); }
    default: { const x = digits(r, 5), m = r.pick([11, 99, 101, 25, 125]); return calc(`${n(x)} × ${m} = ?`, String(x * m), `${x}*${m}`, [`Use the shortcut for ${m} rather than long multiplication.`], { form, x, m }, len(x * m)); }
  }
};

const divAdv: Generator = (r, d) => {
  const form = r.pick(d <= 3 ? [0] : [0, 1, 2]);
  if (form === 0) { const b = r.int(12, scale(d, 49, 99)), q = r.int(scale(d, 100, 400), scale(d, 600, 999)); return calc(`${n(b * q)} ÷ ${b} = ?`, String(q), `${b * q}/${b}`, [`Estimate with round numbers, then refine.`, `Check: ${b} × ${n(q)} = ${n(b * q)}.`], { form, a: b * q, b }, len(b * q)); }
  if (form === 1) { const b = r.pick([8, 16, 32, 40, 80]), a = r.int(100, scale(d, 999, 9999)); return calc(`${n(a)} ÷ ${b} = ?`, dec(a * (100000 / b), 5), `${a}/${b}`, [`${b} is a power-of-two multiple: halve repeatedly.`], { form, a, b }, len(a)); }
  const b = r.int(101, scale(d, 250, 499)), q = r.int(11, scale(d, 90, 999));
  return calc(`${n(b * q)} ÷ ${b} = ?`, String(q), `${b * q}/${b}`, [`${b} × ${q} = ${n(b * q)}.`], { form, a: b * q, b }, len(b * q));
};

const errorSpot: Generator = (r, d) => {
  const a = r.int(scale(d, 12, 120), scale(d, 99, 999)), b = r.int(scale(d, 11, 31), scale(d, 59, 99));
  const right = a * b;
  const wrongs = new Set<number>();
  const cand = [right + 10, right - 10, right + 100, right - 100, right + b, right - a, Number(String(right).split("").reverse().join("")), right + 9, right - 1];
  for (const c of r.shuffle(cand)) if (c !== right && c > 0 && wrongs.size < 3) wrongs.add(c);
  return choice(r, `Which is the correct value of ${n(a)} × ${b}?`, n(right), [...wrongs].map(n), [`Check the last digit: ${a % 10} × ${b % 10} ends in ${(a * b) % 10}.`, `Check the digit sum (mod 9) of the product.`, `${n(a)} × ${b} = ${n(right)}.`], { a, b }, len(right), { expr: `${a}*${b}` });
};

export const LEVEL_O: Skill[] = [
  S("large-mental", "Large-number mental calculation", 15, [12000, 40000], 8, largeMental),
  S("mul-adv", "Advanced multiplication", 15, [14000, 44000], 8, mulAdv),
  S("div-adv", "Advanced division", 15, [14000, 44000], 8, divAdv),
  S("error-spot", "Accuracy and error spotting", 15, [10000, 30000], 8, errorSpot),
];

/**
 * Skills that practise a mix of others: each question is a question of one of the listed skills, written by that skill's generator.
 * The time allowed is the underlying skill's, scaled by `timeScale` (under 1 asks for more speed). `fixedD` pins the difficulty (used for benchmarks).
 */
interface MixDef { id: string; title: string; level: number; from: string[]; shift?: number; timeScale?: number; fixedD?: number; target?: number }
export const MIX_DEFS: MixDef[] = [
  { id: "efficient-mixed", title: "Choosing efficient methods", level: 11, from: ["mul-11", "mul-25-50", "mul-99-101", "square-ends-5", "distributive", "compensation", "div-reciprocal", "crosswise", "mul-2x2", "mul-3x2"] },
  { id: "combined-shortcuts", title: "Combined shortcuts", level: 14, from: ["mul-near-base", "square-ends-5", "mul-99-101", "bodmas", "identity-square", "pct-of", "fraction-muldiv", "exponent-laws", "square-near-base"] },
  { id: "rapid-mixed", title: "Rapid mixed arithmetic", level: 15, from: ["add-carry", "sub-borrow", "mul-2x2", "div-2digit", "calc-chain", "mixed-ops", "tables-teens", "squares", "pct-of", "decimal-addsub"], timeScale: 0.8 },
  { id: "reasoning-multistep", title: "Multi-step reasoning", level: 15, from: ["profit-loss", "discount", "successive-pct", "work-rate", "speed-distance-time", "word-multistep", "ages", "weighted-average", "mixture", "compound-interest", "share-ratio"], shift: 1 },
  { id: "pressure-mixed", title: "Calculation under time pressure", level: 15, from: ["add-2digit", "sub-2digit", "tables-mid", "tables-teens", "mul-2x1", "div-facts", "squares", "complement-100", "pct-of", "missing-factor"], timeScale: 0.6 },
  { id: "high-difficulty", title: "Adaptive high-difficulty problems", level: 15, from: ["mul-3x2", "div-2digit", "fraction-addsub", "decimal-muldiv", "pct-change", "solve-both", "hcf", "lcm", "series-next", "volume", "pythagoras", "large-mental"], shift: 2 },
  { id: "cumulative-mix", title: "Cumulative mastery practice", level: 15, from: ["add-carry", "mul-2x2", "div-long", "squares", "lcm", "fraction-addsub", "pct-change", "mul-11", "bodmas", "solve-2step", "share-ratio", "profit-loss", "series-missing", "circle", "data-average", "factorise", "large-mental"] },
  { id: "benchmark", title: "Personal speed and accuracy benchmark", level: 15, from: ["add-carry", "sub-borrow", "mul-2x1", "tables-teens", "div-exact", "pct-of", "fraction-addsub", "squares", "mul-11", "bodmas"], fixedD: 6 },
];

/** Build the mixed skills from the registry of single skills. */
export function buildMixedSkills(base: Skill[]): Skill[] {
  const byId = new Map(base.map((s) => [s.id, s]));
  return MIX_DEFS.map((def) => {
    const parts = def.from.map((id) => {
      const s = byId.get(id);
      if (!s) throw new Error(`mixed skill ${def.id} lists unknown skill ${id}`);
      return s;
    });
    const gen: Generator = (r, d, ctx) => {
      const [id, g] = r.pick(parts.map((s) => [s.id, s.gen] as const));
      const dd = def.fixedD ?? Math.min(10, Math.max(1, d + (def.shift ?? 0)));
      const b = g(r, dd, ctx);
      return { ...b, params: { ...b.params, via: id, viaD: dd } };
    };
    const slowest = Math.max(...parts.map((s) => s.ms[1]));
    const fastest = Math.min(...parts.map((s) => s.ms[0]));
    return { ...S(def.id, def.title, def.level, [fastest, slowest], def.target ?? 8, gen), timeScale: def.timeScale, mixes: def.from, fixedD: def.fixedD };
  });
}
