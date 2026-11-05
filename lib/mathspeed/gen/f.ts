import { scale, type Rng } from "../rng";
import type { Generator, Skill } from "../types";
import { S, calc, choice, dec, gcd, len } from "./util";

/** Level F: Fractions, Decimals and Percentages. */

const frac = (p: number, q: number): string => (q === 1 ? String(p) : `${p}/${q}`);
const reduce = (p: number, q: number): [number, number] => { const g = gcd(p, q) || 1; return [p / g, q / g]; };
/** A proper fraction in lowest terms with denominator in [2, maxQ]. */
function properFraction(r: Rng, maxQ: number): [number, number] {
  for (;;) {
    const q = r.int(2, maxQ), p = r.int(1, q - 1);
    if (gcd(p, q) === 1) return [p, q];
  }
}

const simplifyFraction: Generator = (r, d) => {
  const [p, q] = properFraction(r, scale(d, 6, 20));
  const k = r.int(2, scale(d, 5, 12));
  const g = k;
  return calc(`Simplify ${p * k}/${q * k} to its lowest terms.`, frac(p, q), `${p}/${q}`, [`Divide the top and the bottom by their highest common factor, ${g}.`, `${p * k} ÷ ${g} = ${p}; ${q * k} ÷ ${g} = ${q}.`, `So ${p * k}/${q * k} = ${p}/${q}.`], { num: p * k, den: q * k }, len(q * k), { lowest: true });
};

const compareFractions: Generator = (r, d) => {
  const maxQ = scale(d, 6, 20);
  let [a, b] = properFraction(r, maxQ);
  let [c, e] = properFraction(r, maxQ);
  if (d >= 6) { // close together: nudge the second fraction next to the first
    const q2 = b + 1;
    c = Math.max(1, Math.round((a / b) * q2)); e = q2;
    if (c >= e) c = e - 1;
  }
  if (a * e === c * b) { a = Math.min(a + 1, b - 1); if (a * e === c * b) c = Math.max(1, c - 1); }
  if (a * e === c * b) { [a, b] = [1, 2]; [c, e] = [1, 3]; }
  const larger = r.chance(0.5);
  const first = a * e > c * b; // is a/b the larger?
  const want = larger === first ? `${a}/${b}` : `${c}/${e}`;
  const other = want === `${a}/${b}` ? `${c}/${e}` : `${a}/${b}`;
  return choice(r, `Which is ${larger ? "larger" : "smaller"}: ${a}/${b} or ${c}/${e}?`, want, [other], [`Cross-multiply: ${a} × ${e} = ${a * e} and ${c} × ${b} = ${c * b}.`, `${a * e > c * b ? `${a}/${b}` : `${c}/${e}`} is the larger fraction.`], { a, b, c, e, larger: larger ? 1 : 0 }, len(Math.max(b, e)));
};

const fractionAddSub: Generator = (r, d) => {
  let b: number, e: number;
  if (d <= 3) { b = r.int(3, 10); e = b; }
  else if (d <= 7) { b = r.int(2, 8); e = b * r.int(2, 4); }
  else { b = r.int(3, 12); e = r.int(3, 12); }
  const a = r.int(1, b - 1), c = r.int(1, e - 1);
  let add = r.chance(0.5);
  let [x, y] = [[a, b], [c, e]];
  if (!add && a * e < c * b) [x, y] = [y, x];
  if (!add && a * e === c * b) add = true;
  const num = add ? x[0] * y[1] + y[0] * x[1] : x[0] * y[1] - y[0] * x[1];
  const den = x[1] * y[1];
  const [p, q] = reduce(num, den);
  const l = (x[1] * y[1]) / gcd(x[1], y[1]);
  return calc(`${x[0]}/${x[1]} ${add ? "+" : "-"} ${y[0]}/${y[1]} = ?`, frac(p, q), `${x[0]}/${x[1]}${add ? "+" : "-"}${y[0]}/${y[1]}`, [`Use a common denominator: ${l}.`, `${x[0] * (l / x[1])}/${l} ${add ? "+" : "-"} ${y[0] * (l / y[1])}/${l} = ${add ? x[0] * (l / x[1]) + y[0] * (l / y[1]) : x[0] * (l / x[1]) - y[0] * (l / y[1])}/${l}`, `Simplify: ${frac(p, q)}.`], { x: x.join("/"), y: y.join("/"), add: add ? 1 : 0 }, len(l), { lowest: true });
};

const fractionMulDiv: Generator = (r, d) => {
  const hi = scale(d, 6, 14);
  const [a, b] = properFraction(r, hi);
  const [c, e] = properFraction(r, hi);
  const mul = r.chance(0.55);
  const num = mul ? a * c : a * e, den = mul ? b * e : b * c;
  const [p, q] = reduce(num, den);
  return calc(`${a}/${b} ${mul ? "×" : "÷"} ${c}/${e} = ?`, frac(p, q), `${a}/${b}${mul ? "*" : "/"}(${c}/${e})`, [mul ? `Multiply the tops and the bottoms: ${a}×${c} over ${b}×${e}.` : `Dividing by ${c}/${e} is multiplying by ${e}/${c}.`, `${num}/${den} simplifies to ${frac(p, q)}.`], { a, b, c, e, mul: mul ? 1 : 0 }, len(den), { lowest: true });
};

const decimalAddSub: Generator = (r, d) => {
  const p1 = scale(d, 1, 3), p2 = scale(d, 1, 3);
  const P = Math.max(p1, p2);
  const A = r.int(10 ** (p1), scale(d, 99, 9999)), B = r.int(10 ** (p2), scale(d, 99, 9999));
  const a = A * 10 ** (P - p1), b = B * 10 ** (P - p2);
  const add = r.chance(0.55) || a === b;
  const [hi, lo] = a >= b ? [a, b] : [b, a];
  const v = add ? a + b : hi - lo;
  const sa = add ? dec(a, P) : dec(hi, P), sb = add ? dec(b, P) : dec(lo, P);
  return calc(`${sa} ${add ? "+" : "-"} ${sb} = ?`, dec(v, P), `${sa}${add ? "+" : "-"}${sb}`, [`Line up the decimal points and ${add ? "add" : "subtract"} column by column.`, `${sa} ${add ? "+" : "-"} ${sb} = ${dec(v, P)}`], { a: sa, b: sb, add: add ? 1 : 0 }, len(v));
};

const decimalMulDiv: Generator = (r, d) => {
  if (r.chance(0.55)) {
    const pa = r.int(1, scale(d, 1, 2)), pb = r.int(1, scale(d, 1, 2));
    const A = r.int(2, scale(d, 9, 99)), B = r.int(2, scale(d, 9, 60));
    const sa = dec(A, pa), sb = dec(B, pb);
    return calc(`${sa} × ${sb} = ?`, dec(A * B, pa + pb), `${sa}*${sb}`, [`Ignore the points: ${A} × ${B} = ${A * B}.`, `Count the decimal places: ${pa} + ${pb} = ${pa + pb}, so the answer is ${dec(A * B, pa + pb)}.`], { a: sa, b: sb, op: "mul" }, len(A * B));
  }
  const pd = r.int(1, scale(d, 1, 2)), pq = r.int(0, scale(d, 1, 2));
  const Dv = r.int(2, scale(d, 9, 49)), Q = r.int(2, scale(d, 9, 80));
  const sd = dec(Dv, pd), sq = dec(Q, pq);
  const a = dec(Dv * Q, pd + pq);
  return calc(`${a} ÷ ${sd} = ?`, sq, `${a}/${sd}`, [`Multiply both numbers by ${10 ** pd} so the divisor is whole: ${dec(Dv * Q * 10 ** pd, pd + pq)} ÷ ${Dv}.`, `${a} ÷ ${sd} = ${sq}`], { a, b: sd, op: "div" }, len(Dv * Q));
};

const convert: Generator = (r, d) => {
  const dens = d <= 3 ? [2, 4, 5, 10] : d <= 6 ? [2, 4, 5, 8, 10, 20, 25] : [4, 5, 8, 16, 20, 25, 40, 50];
  const q = r.pick(dens);
  const p = r.int(1, q - 1);
  const form = r.int(0, 3);
  const [pp, qq] = reduce(p, q);
  const decStr = dec((p * 10000) / q, 4);
  const pct = String((p * 100) / q);
  switch (form) {
    case 0: return calc(`Write ${p}/${q} as a decimal.`, decStr, `${p}/${q}`, [`Divide the top by the bottom: ${p} ÷ ${q} = ${decStr}.`], { form, p, q }, len(q));
    case 1: return calc(`Write ${decStr} as a percentage.`, pct, `${decStr}*100`, [`Multiply by 100: ${decStr} × 100 = ${pct}%.`], { form, p, q }, len(q), { unit: "%" });
    case 2: return calc(`Write ${pct}% as a fraction in lowest terms.`, frac(pp, qq), `${pct}/100`, [`${pct}% means ${pct} out of 100.`, `Simplify ${pct}/100 to ${frac(pp, qq)}.`], { form, p, q }, len(q), { lowest: true });
    default: return calc(`Write ${pp}/${qq} as a percentage.`, pct, `${pp}/${qq}*100`, [`${pp} ÷ ${qq} = ${decStr}.`, `${decStr} × 100 = ${pct}%.`], { form, p, q }, len(q), { unit: "%" });
  }
};

const PCTS_EASY = [10, 20, 25, 50, 5];
const PCTS_MID = [10, 15, 20, 25, 30, 40, 60, 75, 12, 8, 35, 45];
const PCTS_HARD = [12.5, 7.5, 37.5, 62.5, 17.5, 22.5, 65, 85, 95, 112.5, 120, 150];

/** A base amount for which pct% is a whole number. */
function baseFor(r: Rng, pct: number, hi: number): number {
  const unit = 1000 / gcd(Math.round(pct * 10), 1000); // the smallest base for which pct% is a whole number
  return unit * r.int(1, Math.max(1, Math.floor(hi / unit)));
}

const pctOf: Generator = (r, d) => {
  const pct = r.pick(d <= 3 ? PCTS_EASY : d <= 7 ? PCTS_MID : [...PCTS_MID, ...PCTS_HARD]);
  const base = baseFor(r, pct, scale(d, 400, 4000));
  const ans = (pct * base) / 100;
  return calc(`${pct}% of ${base} = ?`, String(ans), `${pct}*${base}/100`, [`${pct}% means ${pct}/100.`, `${pct}/100 × ${base} = ${ans}.`], { pct, base }, len(base));
};

const pctChange: Generator = (r, d) => {
  const pct = r.pick(d <= 5 ? [10, 20, 25, 50, 5, 15] : [12, 8, 15, 35, 45, 12.5, 30, 18]);
  const base = baseFor(r, pct, scale(d, 400, 2000));
  const up = r.chance(0.5);
  const form = r.int(0, 1);
  const change = (pct * base) / 100;
  if (form === 0) {
    const v = up ? base + change : base - change;
    return calc(`${up ? "Increase" : "Decrease"} ${base} by ${pct}%.`, String(v), `${base}*(100${up ? "+" : "-"}${pct})/100`, [`${pct}% of ${base} = ${change}.`, `${base} ${up ? "+" : "-"} ${change} = ${v}.`], { base, pct, up: up ? 1 : 0, form }, len(base));
  }
  const nv = up ? base + change : base - change;
  return calc(`A value goes from ${base} to ${nv}. What is the percentage ${up ? "increase" : "decrease"}?`, String(pct), `(${up ? nv : base}-${up ? base : nv})/${base}*100`, [`Change = ${Math.abs(nv - base)}.`, `${Math.abs(nv - base)} ÷ ${base} × 100 = ${pct}%.`], { base, nv, form }, len(base), { unit: "%" });
};

const pctWhat: Generator = (r, d) => {
  const pct = r.pick(d <= 4 ? [10, 20, 25, 50, 5, 40, 75] : d <= 7 ? [12, 15, 35, 45, 60, 80, 8] : [12.5, 37.5, 62.5, 87.5, 7.5, 16, 22.5]);
  const total = baseFor(r, pct, scale(d, 300, 2400));
  const part = (pct * total) / 100;
  return calc(`What percentage is ${part} of ${total}?`, String(pct), `${part}/${total}*100`, [`Write it as a fraction of the whole: ${part}/${total}.`, `${part} ÷ ${total} × 100 = ${pct}%.`], { part, total }, len(total), { unit: "%" });
};

const roundDecimal: Generator = (r, d) => {
  const whole = r.int(0, scale(d, 20, 999));
  const places = scale(d, 3, 6);
  const frac6 = String(r.int(0, 10 ** places - 1)).padStart(places, "0");
  const dp = r.int(0, Math.min(places - 1, scale(d, 1, 4)));
  const v = `${whole}.${frac6}`;
  const scaled = BigInt(`${whole}${frac6}`);
  const cut = 10n ** BigInt(places - dp);
  let q = scaled / cut;
  if (scaled % cut >= cut / 2n) q += 1n;
  const qs = q.toString().padStart(dp + 1, "0");
  const ans = dp === 0 ? qs : `${qs.slice(0, qs.length - dp)}.${qs.slice(qs.length - dp)}`;
  const where = dp === 0 ? "the nearest whole number" : dp === 1 ? "1 decimal place" : `${dp} decimal places`;
  return { prompt: `Round ${v} to ${where}.`, answer: ans, working: [`Look at the digit after the place you keep: if it is 5 or more, round up.`, `${v} → ${ans}`], params: { v, dp }, size: places };
};

const recurringDigit: Generator = (r, d) => {
  const qs = d <= 3 ? [3, 6, 9] : d <= 6 ? [3, 6, 7, 9, 11, 12] : [7, 11, 13, 14, 15, 17, 18, 19, 21, 22];
  const q = r.pick(qs);
  let p = r.int(1, q - 1);
  while (gcd(p, q) !== 1) p = (p % (q - 1)) + 1;
  const pos = r.int(2, scale(d, 6, 14));
  let rem = p % q, digit = 0;
  const ds: number[] = [];
  for (let i = 0; i < pos; i++) { rem *= 10; digit = Math.floor(rem / q); rem %= q; ds.push(digit); }
  return { prompt: `What is the ${pos}${pos % 10 === 1 && pos !== 11 ? "st" : pos % 10 === 2 && pos !== 12 ? "nd" : pos % 10 === 3 && pos !== 13 ? "rd" : "th"} digit after the decimal point in ${p}/${q}?`, answer: String(digit), working: [`${p}/${q} = 0.${ds.join("")}...`, `The digits repeat in a pattern; the ${pos}th digit is ${digit}.`], params: { p, q, pos }, size: len(q) + 1 };
};

export const LEVEL_F: Skill[] = [
  S("simplify-fraction", "Simplifying fractions", 6, [5000, 14000], 8, simplifyFraction),
  S("compare-fractions", "Comparing fractions", 6, [6000, 16000], 8, compareFractions),
  S("fraction-addsub", "Adding and subtracting fractions", 6, [8000, 24000], 8, fractionAddSub),
  S("fraction-muldiv", "Multiplying and dividing fractions", 6, [8000, 22000], 8, fractionMulDiv),
  S("decimal-addsub", "Decimal addition and subtraction", 6, [6000, 18000], 8, decimalAddSub),
  S("decimal-muldiv", "Decimal multiplication and division", 6, [8000, 24000], 8, decimalMulDiv),
  S("convert", "Fractions, decimals and percentages", 6, [6000, 16000], 8, convert),
  S("pct-of", "Percentage of an amount", 6, [6000, 18000], 8, pctOf),
  S("pct-change", "Increase and decrease", 6, [8000, 22000], 8, pctChange),
  S("pct-what", "Finding the percentage", 6, [7000, 20000], 8, pctWhat),
  S("round-decimal", "Approximating decimals", 6, [5000, 14000], 8, roundDecimal),
  S("recurring-digit", "Recurring decimals", 6, [8000, 26000], 8, recurringDigit),
];
