import { scale, type Rng } from "../rng";
import { evaluate, toNumber } from "../expr";
import type { Generator, Skill } from "../types";
import { S, calc, calcE, choice, dec, len, n, sup } from "./util";
import { show } from "./h";

/** Level K: Advanced Number Sense. Series, remainders and cycles, digit puzzles, quick comparisons, estimation, multi-step simplification. */

interface Series { terms: number[]; rule: string }

/** A number series of the given kind, long enough to show `shown` terms and still have the next one. */
function makeSeries(r: Rng, d: number, count: number): Series {
  const kind = r.pick(d <= 3 ? ["arith", "arith", "geom"] : d <= 6 ? ["arith", "geom", "square", "diff", "alt"] : ["geom", "square", "cube", "diff", "alt", "fib", "squarePlus"]);
  const t: number[] = [];
  switch (kind) {
    case "arith": { const a = r.int(1, scale(d, 20, 80)), s = r.int(2, scale(d, 9, 25)) * (d >= 5 && r.chance(0.3) ? -1 : 1); for (let i = 0; i < count; i++) t.push(a + s * i + (s < 0 ? 200 : 0)); return { terms: t, rule: `adds ${s} each time` }; }
    case "geom": { const a = r.int(1, 6), m = r.pick(d <= 5 ? [2, 3] : [2, 3, 4, 5]); for (let i = 0; i < count; i++) t.push(a * m ** i); return { terms: t, rule: `multiplies by ${m} each time` }; }
    case "square": { const a = r.int(1, scale(d, 6, 15)); for (let i = 0; i < count; i++) t.push((a + i) ** 2); return { terms: t, rule: "consecutive square numbers" }; }
    case "cube": { const a = r.int(1, 5); for (let i = 0; i < count; i++) t.push((a + i) ** 3); return { terms: t, rule: "consecutive cube numbers" }; }
    case "squarePlus": { const a = r.int(1, 8), c = r.int(1, 9); for (let i = 0; i < count; i++) t.push((a + i) ** 2 + c); return { terms: t, rule: `squares plus ${c}` }; }
    case "diff": { const a = r.int(1, 20), f = r.int(1, 5), g = r.int(1, 4); let cur = a, step = f; for (let i = 0; i < count; i++) { t.push(cur); cur += step; step += g; } return { terms: t, rule: `the gaps grow by ${g}` }; }
    case "alt": { const a = r.int(20, 80), p = r.int(3, 12), q = r.int(1, p - 1); let cur = a; for (let i = 0; i < count; i++) { t.push(cur); cur += i % 2 === 0 ? p : -q; } return { terms: t, rule: `alternately adds ${p} and subtracts ${q}` }; }
    default: { const a = r.int(1, 5), b = r.int(2, 6); t.push(a, b); for (let i = 2; i < count; i++) t.push(t[i - 1] + t[i - 2]); return { terms: t, rule: "each term is the sum of the two before it" }; }
  }
}

const seriesNext: Generator = (r, d) => {
  const shown = scale(d, 5, 6);
  const s = makeSeries(r, d, shown + 1);
  const next = s.terms[shown];
  return { prompt: `What comes next? ${s.terms.slice(0, shown).map(n).join(", ")}, ?`, answer: String(next), working: [`Look at how the terms change: ${s.rule}.`, `So the next term is ${n(next)}.`], params: { terms: s.terms.slice(0, shown).join(","), full: s.terms.join(",") }, size: len(Math.max(...s.terms)) };
};

const seriesMissing: Generator = (r, d) => {
  const count = scale(d, 6, 7);
  const s = makeSeries(r, d, count);
  const idx = r.int(1, count - 2);
  const shown = s.terms.map((x, i) => (i === idx ? "?" : n(x)));
  return { prompt: `Find the missing term: ${shown.join(", ")}`, answer: String(s.terms[idx]), working: [`The pattern is: ${s.rule}.`, `The missing term is ${n(s.terms[idx])}.`], params: { terms: s.terms.join(","), idx }, size: len(Math.max(...s.terms)) };
};

const modPow = (a: number, b: number, m: number): number => { let res = 1 % m; const base = a % m; for (let i = 0; i < b; i++) res = (res * base) % m; return res; };

const remainderBig: Generator = (r, d) => {
  const m = r.int(3, scale(d, 7, 13)), a = r.int(2, scale(d, 9, 25)), b = r.int(scale(d, 10, 30), scale(d, 40, 99));
  const ans = modPow(a, b, m);
  return { prompt: `What is the remainder when ${a}${sup(b)} is divided by ${m}?`, answer: String(ans), working: [`Find how the remainders repeat: ${a}¹, ${a}², ${a}³ ... leave ${[1, 2, 3, 4, 5, 6].map((e) => modPow(a, e, m)).join(", ")} ...`, `Use the repeating pattern to reach power ${b}: the remainder is ${ans}.`], params: { a, b, m }, size: len(b) + 1 };
};

const unitDigitPower: Generator = (r, d) => {
  const a = r.int(2, scale(d, 19, 99)), b = r.int(scale(d, 5, 20), scale(d, 40, 199));
  const ans = modPow(a, b, 10);
  const cycle: number[] = [];
  for (let e = 1; e <= 4; e++) cycle.push(modPow(a, e, 10));
  return { prompt: `What is the last digit of ${a}${sup(b)}?`, answer: String(ans), working: [`Only the last digit of ${a} matters: ${a % 10}.`, `Its powers end in ${cycle.join(", ")}, then repeat every 4 (or fewer) steps.`, `Power ${b} ends in ${ans}.`], params: { a, b }, size: len(b) + 1 };
};

const digitProblem: Generator = (r, d) => {
  const form = d <= 4 ? 0 : r.pick([0, 1]);
  for (;;) {
    const t = r.int(2, 9), u = r.int(0, t - 1);
    const s = t + u, df = t - u;
    const num = t * 10 + u;
    if (form === 0) {
      // sum and difference of the digits fix the number uniquely when the tens digit is the bigger one
      return { prompt: `A two-digit number has digits that add up to ${s}. The tens digit is ${df} more than the ones digit. What is the number?`, answer: String(num), working: [`Tens + ones = ${s} and tens - ones = ${df}.`, `Add: 2 × tens = ${s + df}, so tens = ${(s + df) / 2}; ones = ${(s - df) / 2}.`], params: { form, s, df }, size: 2 };
    }
    if (df < 1) continue;
    return { prompt: `A two-digit number is ${9 * df} more than the number made by reversing its digits, and its digits add up to ${s}. What is the number?`, answer: String(num), working: [`The number minus its reverse is 9 × (tens - ones), so tens - ones = ${df}.`, `With tens + ones = ${s}: tens = ${(s + df) / 2}, ones = ${(s - df) / 2}.`], params: { form, s, df }, size: 2 };
  }
};

interface Qty { text: string; expr: string }
function quantity(r: Rng, d: number): Qty {
  const big = scale(d, 60, 900);
  switch (r.int(0, 3)) {
    case 0: { const p = r.pick([5, 10, 12, 15, 20, 25, 30, 40, 60, 75]); const b = r.int(2, big / 4) * 20; return { text: `${p}% of ${b}`, expr: `${p}*${b}/100` }; }
    case 1: { const q = r.pick([2, 3, 4, 5, 6, 8]); const p = r.int(1, q - 1); const b = q * r.int(5, big / 8); return { text: `${p}/${q} of ${b}`, expr: `${p}/${q}*${b}` }; }
    case 2: { const a = r.int(6, scale(d, 20, 60)), b = r.int(6, scale(d, 20, 60)); return { text: `${a} × ${b}`, expr: `${a}*${b}` }; }
    default: { const a = r.int(5, scale(d, 20, 45)), b = r.int(2, 9); return { text: `${a}² - ${b}²`, expr: `${a}*${a}-${b}*${b}` }; }
  }
}
const quantCompare: Generator = (r, d) => {
  const a = quantity(r, d), b = quantity(r, d);
  const va = toNumber(evaluate(a.expr)), vb = toNumber(evaluate(b.expr));
  const ans = va > vb ? "A is greater" : vb > va ? "B is greater" : "They are equal";
  return choice(r, `Quantity A: ${a.text}. Quantity B: ${b.text}. Which is true?`, ans, ["A is greater", "B is greater", "They are equal"].filter((x) => x !== ans), [`A = ${va}, B = ${vb}.`, `${ans}.`], { ea: a.expr, eb: b.expr }, 3);
};

const estimateProduct: Generator = (r, d) => {
  const form = r.int(0, 2);
  if (form === 0) {
    const a = r.int(scale(d, 11, 31), scale(d, 40, 99)) + r.int(1, 9) / 10, b = r.int(scale(d, 11, 21), scale(d, 40, 99)) + r.int(1, 9) / 10;
    const exact = Math.round(a * 10) * Math.round(b * 10);
    const ans = dec(exact, 2);
    return calc(`Estimate ${a} × ${b}`, ans, `${a}*${b}`, [`Round to ${Math.round(a)} × ${Math.round(b)} = ${Math.round(a) * Math.round(b)}.`, `Any answer within 6% of the true value is accepted.`], { a, b, op: "mul" }, 4, { tol: Math.round((exact / 100) * 0.06) + 1 });
  }
  if (form === 1) {
    const a = r.int(scale(d, 120, 1200), scale(d, 900, 9900)), b = r.int(scale(d, 120, 1200), scale(d, 900, 9900));
    return calc(`Estimate ${n(a)} + ${n(b)}`, String(a + b), `${a}+${b}`, [`Round each to the nearest hundred: ${n(Math.round(a / 100) * 100)} + ${n(Math.round(b / 100) * 100)}.`, `Any answer within 4% of the true value is accepted.`], { a, b, op: "add" }, len(a + b), { tol: Math.round((a + b) * 0.04) });
  }
  const x = r.int(scale(d, 21, 81), scale(d, 90, 195));
  const pct = r.pick([15, 18, 22, 28, 35, 45, 65, 85]);
  const exact = x * pct;
  return calc(`Estimate ${pct}% of ${x}`, dec(exact, 2), `${x}*${pct}/100`, [`Round ${pct}% to a friendly fraction and ${x} to a round number.`, `Any answer within 6% of the true value is accepted.`], { x, pct, op: "pct" }, 3, { tol: Math.round((exact / 100) * 0.06) + 1 });
};

const simplifyMulti: Generator = (r, d) => {
  const a = r.int(2, scale(d, 9, 20)), b = r.int(2, 9), c = r.int(2, 9), e = r.int(2, scale(d, 8, 12));
  const k = r.int(2, 9);
  const forms = [
    `(${a * k}+${b * k})/${k}*${c}`, `${a}^2-${b}*${c}+${e}`, `(${a}+${b})*(${c}+${e})`, `${a * k}/${k}+${b}^2-${c}`,
    `((${a + b})^2-${b}^2)/${a}`, `${a}*${b}+${c}*${e}-${k}^2`, `(${a * k}+${b * k})/${k}*${c}-${e}`,
  ];
  const expr = r.pick(forms.slice(scale(d, 0, 2), scale(d, 3, 7)));
  return calcE(`${show(expr)} = ?`, expr, [`Brackets, then powers, then multiplication and division, then addition and subtraction.`, `Simplify one step at a time.`], { expr }, 3);
};

const approxSqrt: Generator = (r, d) => {
  const x = r.int(scale(d, 3, 60), scale(d, 40, 2000));
  const v = Math.round(Math.sqrt(x) * 10) / 10;
  const lo = Math.floor(Math.sqrt(x));
  return { prompt: `Estimate √${n(x)} to 1 decimal place.`, answer: String(v), tol: 0.1, working: [`Find the perfect squares on either side: ${lo}² = ${lo * lo} and ${lo + 1}² = ${(lo + 1) ** 2}.`, `${n(x)} is between them, so the root is between ${lo} and ${lo + 1}: about ${v}.`, `An answer within 0.1 is accepted.`], params: { x }, size: len(x) };
};

export const LEVEL_K: Skill[] = [
  S("series-next", "Number series", 11, [10000, 28000], 8, seriesNext),
  S("series-missing", "Missing terms", 11, [12000, 30000], 8, seriesMissing),
  S("remainder-big", "Remainders of powers", 11, [12000, 32000], 8, remainderBig),
  S("unit-digit-power", "Cycles of last digits", 11, [10000, 28000], 8, unitDigitPower),
  S("digit-problem", "Digit problems", 11, [12000, 32000], 8, digitProblem),
  S("quant-compare", "Quick comparisons", 11, [14000, 36000], 8, quantCompare),
  S("estimate-product", "Estimation", 11, [8000, 22000], 8, estimateProduct),
  S("simplify-multi", "Multi-step simplification", 11, [10000, 32000], 8, simplifyMulti),
  S("approx-sqrt", "Estimating roots", 11, [9000, 24000], 8, approxSqrt),
];
