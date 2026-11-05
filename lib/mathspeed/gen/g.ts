import { scale } from "../rng";
import type { Generator, Skill } from "../types";
import { S, calc, dec, len, mixOf, n } from "./util";

/** Level G: Mental Calculation Techniques. Each skill is a named shortcut; the working shows the shortcut, the answer is the exact product or quotient. */

const mul11: Generator = (r, d) => {
  const k = scale(d, 2, 5);
  const x = r.int(10 ** (k - 1) + 1, 10 ** k - 1);
  const s = String(x);
  return calc(`${n(x)} × 11 = ?`, String(x * 11), `${x}*11`, [`Write ${n(x)} × 10 = ${n(x * 10)}, then add ${n(x)} once more.`, `${n(x * 10)} + ${n(x)} = ${n(x * 11)}.`, k === 2 ? `Shortcut: put the digit sum ${Number(s[0]) + Number(s[1])} between ${s[0]} and ${s[1]} (carry if it is 10 or more).` : `Shortcut: add each digit to its neighbour from the right.`], { x }, k + 1);
};

const mul2550: Generator = (r, d) => {
  const m = d <= 6 ? r.pick([25, 50]) : r.pick([25, 50, 75, 125]);
  const x = r.int(scale(d, 4, 40), scale(d, 60, 480));
  const w = m === 25 ? [`× 25 = × 100 ÷ 4: ${n(x * 100)} ÷ 4.`] : m === 50 ? [`× 50 = × 100 ÷ 2: ${n(x * 100)} ÷ 2.`] : m === 75 ? [`× 75 = × 100 − × 25: ${n(x * 100)} ÷ 4 × 3.`] : [`× 125 = × 1000 ÷ 8: ${n(x * 1000)} ÷ 8.`];
  return calc(`${n(x)} × ${m} = ?`, String(x * m), `${x}*${m}`, [...w, `${n(x)} × ${m} = ${n(x * m)}`], { x, m }, len(x * m));
};

const mul99101: Generator = (r, d) => {
  const m = d <= 4 ? r.pick([99, 101]) : r.pick([99, 101, 999, 1001, 9, 11]);
  const x = r.int(scale(d, 3, 40), scale(d, 60, 999));
  const base = m === 99 ? 100 : m === 101 ? 100 : m === 999 ? 1000 : m === 1001 ? 1000 : m === 9 ? 10 : 10;
  const sign = m < base ? "-" : "+";
  return calc(`${n(x)} × ${m} = ?`, String(x * m), `${x}*${m}`, [`${m} = ${base} ${sign} ${Math.abs(m - base)}.`, `${n(x)} × ${base} = ${n(x * base)}; ${n(x)} × ${Math.abs(m - base)} = ${n(x * Math.abs(m - base))}.`, `${n(x * base)} ${sign} ${n(x * Math.abs(m - base))} = ${n(x * m)}`], { x, m }, len(x * m));
};

const mulNearBase: Generator = (r, d) => {
  const base = d <= 7 ? 100 : r.pick([100, 1000]);
  const span = base === 100 ? scale(d, 6, 20) : scale(d, 6, 30);
  const da = r.int(1, span) * (r.chance(0.5) ? 1 : -1), db = r.int(1, span) * (r.chance(0.5) ? 1 : -1);
  const a = base + da, b = base + db;
  const cross = a + db;
  return calc(`${n(a)} × ${n(b)} = ?`, String(a * b), `${a}*${b}`, [`Both are near ${n(base)}: ${da > 0 ? "+" : ""}${da} and ${db > 0 ? "+" : ""}${db}.`, `Cross: ${n(a)} ${db < 0 ? "-" : "+"} ${Math.abs(db)} = ${n(cross)}; that gives the left part.`, `Multiply the gaps: ${da} × ${db} = ${da * db}.`, `${n(a)} × ${n(b)} = ${n(cross * base)} ${da * db < 0 ? "-" : "+"} ${Math.abs(da * db)} = ${n(a * b)}`], { a, b, base }, len(a * b));
};

const squareEnds5: Generator = (r, d) => {
  const t = r.int(scale(d, 1, 9), scale(d, 9, d >= 8 ? 99 : 19));
  const x = t * 10 + 5;
  return calc(`${n(x)}² = ?`, String(x * x), `${x}*${x}`, [`The number ends in 5: take the tens part ${t}.`, `${t} × ${t + 1} = ${t * (t + 1)}, then write 25 after it.`, `${n(x)}² = ${n(x * x)}`], { x }, len(x * x));
};

const distributive: Generator = (r, d) => {
  const f = r.int(scale(d, 3, 12), scale(d, 20, 99));
  const total = r.pick([10, 100, 50, 20]);
  const b = r.int(Math.floor(total / 5) + 1, total - Math.floor(total / 5) - 1);
  const c = total - b;
  const minus = d >= 6 && r.chance(0.4);
  if (minus) {
    const hi = total + r.int(10, 60);
    return calc(`${f} × ${hi} - ${f} × ${hi - total} = ?`, String(f * total), `${f}*${hi}-${f}*${hi - total}`, [`Both products share the factor ${f}: ${f} × (${hi} - ${hi - total}).`, `${f} × ${total} = ${n(f * total)}.`], { f, total, hi, minus: 1 }, len(f * total));
  }
  return calc(`${f} × ${b} + ${f} × ${c} = ?`, String(f * total), `${f}*${b}+${f}*${c}`, [`Both products share the factor ${f}: ${f} × (${b} + ${c}).`, `${b} + ${c} = ${total}, so ${f} × ${total} = ${n(f * total)}.`], { f, total, b, c, minus: 0 }, len(f * total));
};

const compensation: Generator = (r, d) => {
  const base = d <= 4 ? 100 : 1000;
  const off = r.int(1, scale(d, 4, 9));
  const lowSide = r.chance(0.5);
  const near = lowSide ? base - off : base + off;
  const other = r.int(scale(d, 120, 1200), scale(d, 480, 9400));
  const add = r.chance(0.5);
  const text = add ? `${n(other)} + ${n(near)}` : `${n(other)} - ${n(near)}`;
  const res = add ? other + near : other - near;
  const w = add ? [`${n(near)} is ${off} ${lowSide ? "less" : "more"} than ${n(base)}.`, `${n(other)} + ${n(base)} = ${n(other + base)}, then ${lowSide ? "add back" : "take off"} ${off}.`] : [`${n(near)} is ${off} ${lowSide ? "less" : "more"} than ${n(base)}.`, `${n(other)} - ${n(base)} = ${n(other - base)}, then ${lowSide ? "take off" : "add back"} ${off}.`];
  return calc(`${text} = ?`, String(res), add ? `${other}+${near}` : `${other}-${near}`, [...w, `${text} = ${n(res)}`], { other, near, add: add ? 1 : 0 }, len(res));
};

const crosswise: Generator = (r, d) => {
  const lo = d <= 3 ? 11 : 12;
  const a = r.int(Math.max(lo, scale(d, 11, 30)), scale(d, 29, 99)), b = r.int(Math.max(lo, scale(d, 11, 25)), scale(d, 29, 99));
  const [a1, a0, b1, b0] = [Math.floor(a / 10), a % 10, Math.floor(b / 10), b % 10];
  const left = a1 * b1, mid = a1 * b0 + a0 * b1, right = a0 * b0;
  return calc(`${a} × ${b} = ?`, String(a * b), `${a}*${b}`, [`Vertically and crosswise. Ones: ${a0} × ${b0} = ${right}.`, `Cross: ${a1} × ${b0} + ${a0} × ${b1} = ${a1 * b0} + ${a0 * b1} = ${mid}.`, `Tens: ${a1} × ${b1} = ${left}.`, `Combine with carries: ${left} × 100 + ${mid} × 10 + ${right} = ${a * b}.`], { a, b }, 4);
};

const divReciprocal: Generator = (r, d) => {
  const m = d <= 3 ? r.pick([5, 4, 2]) : d <= 7 ? r.pick([5, 25, 4, 50]) : r.pick([5, 25, 125, 50, 4, 8]);
  const x = r.int(scale(d, 8, 60), scale(d, 120, 2400));
  const fm: Record<number, [number, number]> = { 2: [5, 10], 4: [25, 100], 5: [2, 10], 8: [125, 1000], 25: [4, 100], 50: [2, 100], 125: [8, 1000] };
  const [mulBy, scaleBy] = fm[m];
  const ans = dec(x * mulBy, String(scaleBy).length - 1);
  return calc(`${n(x)} ÷ ${m} = ?`, ans, `${x}/${m}`, [`Dividing by ${m} is the same as multiplying by ${mulBy} and dividing by ${n(scaleBy)}.`, `${n(x)} × ${mulBy} = ${n(x * mulBy)}; ÷ ${n(scaleBy)} = ${ans}.`], { x, m }, len(x));
};

const strategyMixed: Generator = mixOf([["mul-11", mul11], ["mul-25-50", mul2550], ["mul-99-101", mul99101], ["square-ends-5", squareEnds5], ["distributive", distributive], ["compensation", compensation], ["div-reciprocal", divReciprocal], ["mul-near-base", mulNearBase]]);

export const LEVEL_G: Skill[] = [
  S("mul-11", "Multiplying by 11", 7, [5000, 14000], 8, mul11),
  S("mul-25-50", "Multiplying by 25 and 50", 7, [5000, 14000], 8, mul2550),
  S("mul-99-101", "Multiplying by 99 and 101", 7, [6000, 16000], 8, mul99101),
  S("mul-near-base", "Numbers near 100 and 1000", 7, [8000, 22000], 8, mulNearBase),
  S("square-ends-5", "Squaring numbers ending in 5", 7, [4000, 10000], 8, squareEnds5),
  S("distributive", "Distributive shortcuts", 7, [7000, 20000], 8, distributive),
  S("compensation", "Compensation", 7, [6000, 16000], 8, compensation),
  S("crosswise", "Crosswise multiplication", 7, [10000, 26000], 8, crosswise),
  S("div-reciprocal", "Fast division", 7, [6000, 16000], 8, divReciprocal),
  S("strategy-mixed", "Choosing the best strategy", 7, [6000, 18000], 8, strategyMixed),
];
