import { scale } from "../rng";
import type { Generator, Skill } from "../types";
import { S, calc, calcE, gcd, len, sup } from "./util";
import { show } from "./h";

/** Level N: Advanced Mathematical Fluency. Algebra, exponents, radicals and standard form carry the level; trigonometry is two small skills and never leads. */

const co = (c: number): string => (c === 1 ? "" : String(c));

const algebraAdv: Generator = (r, d) => {
  const form = r.pick(d <= 3 ? [0] : [0, 1, 2]);
  const x = r.int(-scale(d, 6, 15), scale(d, 9, 25)) || 3, y0 = r.int(-scale(d, 6, 15), scale(d, 9, 25)) || 2;
  const y = y0 === x ? x + 2 : y0;
  if (form === 0) return calc(`Two numbers add up to ${x + y} and their difference is ${x - y}. What is the larger number?`, String(Math.max(x, y)), `${Math.max(x, y)}`, [`Add the two facts: 2 × (the first) = ${x + y} + ${Math.abs(x - y)}...`, `Larger number = (sum + difference) ÷ 2 = ${Math.max(x, y)}.`], { form, s: x + y, df: Math.abs(x - y), x, y }, 2);
  const a = r.int(2, 5), b = r.int(1, 4);
  const c1 = a * x + b * y, c2 = x - y;
  if (form === 1) return calc(`${co(a)}x + ${co(b)}y = ${c1} and x - y = ${c2}. Find x.`, String(x), `${x}`, [`From the second equation x = y + ${c2}.`, `Substitute: ${a}(y + ${c2}) + ${b}y = ${c1}.`, `Solve to get y = ${y} and x = ${x}.`], { form, a, b, c1, c2, x, y }, 3);
  const e = r.int(1, 4), f = r.int(2, 5);
  const c3 = e * x - f * y, c4 = a * x + b * y;
  return calc(`${co(a)}x + ${co(b)}y = ${c4} and ${co(e)}x - ${co(f)}y = ${c3}. Find y.`, String(y), `${y}`, [`Eliminate one letter by combining the equations.`, `Solving gives x = ${x}, y = ${y}.`], { form, a, b, c4, e, f, c3, x, y }, 3);
};

const quadraticRoots: Generator = (r, d) => {
  const p = r.int(-scale(d, 6, 15), scale(d, 9, 20)), q = r.int(-scale(d, 6, 15), scale(d, 9, 20));
  const b = -(p + q), c = p * q;
  const form = r.pick([0, 1, 2]);
  const bt = b === 0 ? "" : ` ${b < 0 ? "-" : "+"} ${Math.abs(b) === 1 ? "" : Math.abs(b)}x`;
  const ct = c === 0 ? "" : ` ${c < 0 ? "-" : "+"} ${Math.abs(c)}`;
  const eq = `x²${bt}${ct} = 0`;
  if (form === 0) return calc(`Solve ${eq}. What is the larger root?`, String(Math.max(p, q)), `${Math.max(p, q)}`, [`Find two numbers that multiply to ${c} and add to ${-b}: ${p} and ${q}.`, `So (x - ${p})(x - ${q}) = 0 and the roots are ${p} and ${q}.`], { form, b, c }, 3);
  if (form === 1) return calc(`For ${eq}, what is the sum of the roots?`, String(p + q), `${p + q}`, [`For x² + bx + c = 0 the sum of roots is -b.`, `Sum = ${-b}.`], { form, b, c }, 3);
  return calc(`For ${eq}, what is the product of the roots?`, String(c), `${c}`, [`For x² + bx + c = 0 the product of roots is c.`, `Product = ${c}.`], { form, b, c }, 3);
};

const factorise: Generator = (r, d) => {
  const p = r.int(1, scale(d, 6, 14)) * (r.chance(0.3) ? -1 : 1), q = r.int(1, scale(d, 6, 14)) * (r.chance(0.5) ? -1 : 1);
  const b = p + q, c = p * q;
  const lo = Math.min(p, q);
  const bt = b === 0 ? "" : ` ${b < 0 ? "-" : "+"} ${Math.abs(b) === 1 ? "" : Math.abs(b)}x`;
  return calc(`x²${bt} ${c < 0 ? "-" : "+"} ${Math.abs(c)} = (x + p)(x + q). What is the smaller of p and q?`, String(lo), `${lo}`, [`Find two numbers that multiply to ${c} and add to ${b}.`, `They are ${p} and ${q}, so the smaller is ${lo}.`], { b, c }, 3);
};

const exponentLaws: Generator = (r, d) => {
  const base = r.pick(d <= 4 ? [2, 3, 5, 10] : [2, 3, 4, 5, 6, 7, 10]);
  const a = r.int(2, scale(d, 6, 9)), b = r.int(2, scale(d, 5, 8)), c = r.int(1, a + b - 1);
  const form = r.pick(d <= 3 ? [0, 1] : [0, 1, 2, 3, 4]);
  let expr: string;
  switch (form) {
    case 0: expr = `${base}^${a}*${base}^${b}/${base}^${c}`; break;
    case 1: expr = `(${r.pick([2, 3])}^${Math.min(a, 4)})^${Math.min(b, 3)}`; break;
    case 2: expr = `${base}^${a}/${base}^${a + 2}`; break;
    case 3: expr = `${base}^0+${base}^-1*${base}`; break;
    default: expr = `(${base}^${Math.min(a, 3)}*${base}^-${r.int(1, 2)})^2`;
  }
  return calcE(`${show(expr)} = ?`, expr, [`Use the laws: aᵐ × aⁿ = aᵐ⁺ⁿ, aᵐ ÷ aⁿ = aᵐ⁻ⁿ, (aᵐ)ⁿ = aᵐⁿ, a⁰ = 1, a⁻ⁿ = 1/aⁿ.`], { expr }, 3);
};

const sqFree = (m: number): boolean => { for (let i = 2; i * i <= m; i++) if (m % (i * i) === 0) return false; return m > 1; };
const radicals: Generator = (r, d) => {
  const ms = [2, 3, 5, 6, 7, 10, 11].filter(sqFree);
  const m = r.pick(ms);
  const k = r.int(2, scale(d, 6, 15));
  if (d >= 5 && r.chance(0.5)) {
    const k2 = r.int(2, scale(d, 6, 12));
    return calc(`√${k * k * m} + √${k2 * k2 * m} = k√${m}. What is k?`, String(k + k2), `${k + k2}`, [`√${k * k * m} = ${k}√${m} and √${k2 * k2 * m} = ${k2}√${m}.`, `${k}√${m} + ${k2}√${m} = ${k + k2}√${m}.`], { form: 1, N1: k * k * m, N2: k2 * k2 * m, m }, 3);
  }
  return calc(`Write √${k * k * m} in the form k√${m}. What is k?`, String(k), `${k}`, [`Look for the largest square factor of ${k * k * m}: ${k * k}.`, `√${k * k * m} = √${k * k} × √${m} = ${k}√${m}.`], { form: 0, N1: k * k * m, m }, 3);
};

const sciNotation: Generator = (r, d) => {
  const form = r.pick(d <= 3 ? [0] : [0, 1, 2]);
  if (form === 0) {
    const a10 = r.int(11, 99), e = r.int(scale(d, 3, 6), scale(d, 7, 12)) * (r.chance(0.3) ? -1 : 1);
    const mant = a10 / 10;
    const text = e >= 0 ? (BigInt(a10) * 10n ** BigInt(Math.max(0, e - 1))).toString() : `0.${"0".repeat(-e - 1)}${a10}`;
    const shown = e >= 0 ? (text.length > 4 ? text.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : text) : text;
    return { prompt: `Write ${shown} in the form a × 10ⁿ with 1 ≤ a < 10. What is n?`, answer: String(e), working: [`Move the decimal point so one non-zero digit is before it: ${mant}.`, `The point moved ${Math.abs(e)} places, so n = ${e}.`], params: { form, text }, size: text.length };
  }
  if (form === 1) {
    const a10 = r.int(11, 99), b10 = r.int(11, 99), m = r.int(2, 8), k = r.int(2, 8);
    const prod = a10 * b10; // in units of 1/100
    const exp = m + k + (prod >= 1000 ? 1 : 0);
    return { prompt: `Multiply (${a10 / 10} × 10${sup(m)}) × (${b10 / 10} × 10${sup(k)}) and write the answer as a × 10ⁿ with 1 ≤ a < 10. What is n?`, answer: String(exp), working: [`Multiply the numbers: ${a10 / 10} × ${b10 / 10} = ${prod / 100}.`, `Add the powers: ${m} + ${k} = ${m + k}.`, prod >= 1000 ? `${prod / 100} is 10 or more, so write it as ${prod / 1000} × 10¹: n = ${exp}.` : `n = ${exp}.`], params: { form, a10, b10, m, k }, size: 3 };
  }
  const a10 = r.int(11, 99), e = r.int(2, scale(d, 4, 7));
  return calcE(`Write ${a10 / 10} × 10${sup(-e)} as an ordinary decimal.`, `${a10 / 10}*10^-${e}`, [`10⁻${e} means dividing by 10^${e}.`, `Move the decimal point ${e} places to the left.`], { form, a10, e }, e + 2);
};

const polynomialEval: Generator = (r, d) => {
  const deg = r.pick(d <= 4 ? [2, 3] : [3, 4]);
  const coefs = Array.from({ length: deg + 1 }, (_, i) => (i === 0 ? r.int(1, 3) : r.int(-6, 6)));
  const x = r.int(-3, 4) || 2;
  const terms: string[] = [];
  coefs.forEach((c, i) => {
    const pw = deg - i;
    if (c === 0) return;
    const mag = Math.abs(c) === 1 && pw > 0 ? "" : String(Math.abs(c));
    const v = pw === 0 ? "" : pw === 1 ? "x" : `x${["", "", "²", "³", "⁴"][pw]}`;
    terms.push((terms.length === 0 ? (c < 0 ? "-" : "") : c < 0 ? " - " : " + ") + mag + v);
  });
  const expr = coefs.map((c, i) => `${c < 0 ? "-" : "+"}${Math.abs(c)}*(${x})^${deg - i}`).join("").replace(/^\+/, "");
  const rem = r.chance(0.4) && d >= 4;
  return calcE(rem ? `p(x) = ${terms.join("")}. What is the remainder when p(x) is divided by (x ${x < 0 ? "+" : "-"} ${Math.abs(x)})?` : `p(x) = ${terms.join("")}. Find p(${x}).`, expr, [rem ? `By the remainder theorem the remainder is p(${x}).` : `Replace x with ${x < 0 ? `(${x})` : x}.`, `Work out each power, then each term, then add.`], { coefs: coefs.join(","), x }, 3);
};

const pctRatioAdv: Generator = (r, d) => {
  const form = r.pick(d <= 3 ? [0, 1] : [0, 1, 2]);
  if (form === 0) {
    const pct = r.pick([10, 20, 25, 50, 5, 15, 30]);
    const up = r.chance(0.5);
    const orig = r.int(2, scale(d, 20, 100)) * 20;
    const now = up ? orig + (orig * pct) / 100 : orig - (orig * pct) / 100;
    return calcE(`After a ${pct}% ${up ? "increase" : "decrease"} a value is ${now}. What was the original value?`, `${now}*100/(100${up ? "+" : "-"}${pct})`, [`Now = ${up ? 100 + pct : 100 - pct}% of the original.`, `Original = ${now} ÷ ${up ? 100 + pct : 100 - pct} × 100 = ${orig}.`], { form, now, pct, up: up ? 1 : 0 }, len(now));
  }
  if (form === 1) {
    const a = r.pick([10, 20, 25, 40, 50, 60, 75]), b = r.pick([10, 20, 25, 40, 50, 80]);
    const base = r.int(1, 10) * 100;
    return calcE(`What is ${a}% of ${b}% of ${base}?`, `${a}/100*${b}/100*${base}`, [`${b}% of ${base} = ${(b * base) / 100}.`, `${a}% of ${(b * base) / 100} = ${(a * b * base) / 10000}.`], { form, a, b, base }, len(base));
  }
  const p = r.pick([25, 100, 150, 300, 400, 900]);
  return calcE(`A is ${p}% more than B. B is what percentage less than A?`, `100*${p}/(100+${p})`, [`Let B = 100. Then A = ${100 + p}.`, `B is less than A by ${p} out of ${100 + p}: ${p} ÷ ${100 + p} × 100.`], { form, p }, 3, { unit: "%" });
};

const TRIG: Array<{ f: "sin" | "cos" | "tan"; deg: number; exact?: string }> = [
  { f: "sin", deg: 0, exact: "0" }, { f: "sin", deg: 30, exact: "1/2" }, { f: "sin", deg: 90, exact: "1" }, { f: "cos", deg: 0, exact: "1" }, { f: "cos", deg: 60, exact: "1/2" }, { f: "cos", deg: 90, exact: "0" },
  { f: "tan", deg: 0, exact: "0" }, { f: "tan", deg: 45, exact: "1" }, { f: "sin", deg: 45 }, { f: "cos", deg: 45 }, { f: "sin", deg: 60 }, { f: "cos", deg: 30 }, { f: "tan", deg: 30 }, { f: "tan", deg: 60 },
];
const rad = (deg: number): number => (deg * Math.PI) / 180;
const trigValues: Generator = (r, d) => {
  const exact = TRIG.filter((t) => t.exact);
  const form = d <= 4 ? 0 : r.pick([0, 1, 2]);
  if (form === 0) { const t = r.pick(exact); return { prompt: `What is ${t.f} ${t.deg}°?`, answer: t.exact!, working: [`Standard angle values: ${t.f} ${t.deg}° = ${t.exact}.`], params: { form, f: t.f, deg: t.deg }, size: 2 }; }
  if (form === 1) { const t = r.pick(TRIG.filter((x) => !x.exact)); const v = Math.round(Math[t.f](rad(t.deg)) * 1000) / 1000; return { prompt: `What is ${t.f} ${t.deg}°, correct to 3 decimal places?`, answer: String(v), tol: 0.002, working: [`${t.f} ${t.deg}° is a standard value: about ${v}.`, `An answer within 0.002 is accepted.`], params: { form, f: t.f, deg: t.deg }, size: 2 }; }
  const a = r.pick(exact), b = r.pick(exact);
  const va = a.exact!, vb = b.exact!;
  return calcE(`Find ${a.f} ${a.deg}° + ${b.f} ${b.deg}°.`, `${va}+${vb}`, [`${a.f} ${a.deg}° = ${va} and ${b.f} ${b.deg}° = ${vb}.`, `Add them.`], { form, f1: a.f, d1: a.deg, f2: b.f, d2: b.deg }, 2);
};

const trigIdentity: Generator = (r, d) => {
  const [a, b, c] = r.pick([[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25]].slice(0, scale(d, 2, 4)));
  const which = r.pick(["cos", "tan"] as const);
  const sinFirst = r.chance(0.5);
  const known = sinFirst ? `sin θ = ${a}/${c}` : `cos θ = ${a}/${c}`;
  // if sin = a/c then cos = b/c and tan = a/b; if cos = a/c then sin = b/c and tan = b/a
  let num: number, den: number, ask: string;
  if (sinFirst) { ask = which === "cos" ? "cos θ" : "tan θ"; [num, den] = which === "cos" ? [b, c] : [a, b]; }
  else { ask = which === "cos" ? "sin θ" : "tan θ"; [num, den] = which === "cos" ? [b, c] : [b, a]; }
  const g = gcd(num, den);
  return { prompt: `θ is an acute angle and ${known}. Use sin²θ + cos²θ = 1 to find ${ask}. (Give a fraction.)`, answer: `${num / g}/${den / g}`, lowest: true, working: [`${sinFirst ? "sin" : "cos"}²θ = ${a * a}/${c * c}, so the other squared is 1 - ${a * a}/${c * c} = ${b * b}/${c * c}.`, `Taking the positive root: ${b}/${c}.`, `${ask} = ${num}/${den}.`], params: { a, b, c, sinFirst: sinFirst ? 1 : 0, which }, size: len(c) };
};

export const LEVEL_N: Skill[] = [
  S("algebra-adv", "Simultaneous equations", 14, [14000, 36000], 8, algebraAdv),
  S("quadratic-roots", "Quadratic equations", 14, [12000, 32000], 8, quadraticRoots),
  S("factorise", "Factorising", 14, [10000, 28000], 8, factorise),
  S("exponent-laws", "Exponents", 14, [9000, 26000], 8, exponentLaws),
  S("radicals", "Radicals", 14, [9000, 26000], 8, radicals),
  S("sci-notation", "Standard form", 14, [9000, 26000], 8, sciNotation),
  S("polynomial-eval", "Polynomials", 14, [12000, 34000], 8, polynomialEval),
  S("pct-ratio-adv", "Advanced percentages and ratios", 14, [12000, 32000], 8, pctRatioAdv),
  S("trig-values", "Values of standard angles", 14, [6000, 16000], 6, trigValues),
  S("trig-identity", "Using identities", 14, [10000, 26000], 6, trigIdentity),
];
