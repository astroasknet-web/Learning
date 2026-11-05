import { scale } from "../rng";
import type { Generator, Skill } from "../types";
import { S, calc, calcE, dec, len, sup } from "./util";

/** Level H: Numerical Operations and Algebra. Order of operations, negatives, mixed fractions and decimals, missing numbers, substitution, linear equations, identities. */

/** Show an arithmetic expression the way a student reads it: spaced operators, × ÷ and superscript powers. */
export function show(expr: string): string {
  let out = "";
  for (let i = 0; i < expr.length; i++) {
    const c = expr[i];
    const prev = out.trimEnd().slice(-1);
    if (c === "*") out += " × ";
    else if (c === "/") out += " ÷ ";
    else if (c === "+") out += " + ";
    else if (c === "-" && i > 0 && prev !== "" && prev !== "(" && !/[*/+\-×÷^]/.test(prev)) out += " - ";
    else if (c === "^") { const m = /^\^(-?\d+)/.exec(expr.slice(i)); if (m) { out += sup(Number(m[1])); i += m[0].length - 1; } else out += c; }
    else out += c;
  }
  return out.replace(/\s+/g, " ").replace(/\( /g, "(").replace(/ \)/g, ")");
}

const bodmas: Generator = (r, d) => {
  const hi = scale(d, 9, 30);
  const a = r.int(2, hi), b = r.int(2, 9), c = r.int(2, 9), e = r.int(2, 9);
  const forms = d <= 3 ? [0, 1] : d <= 6 ? [0, 1, 2, 3] : [2, 3, 4, 5, 6, 7];
  const f = r.pick(forms);
  let expr: string, note: string;
  switch (f) {
    case 0: expr = `${a}+${b}*${c}`; note = `Multiplication before addition: ${b} × ${c} = ${b * c}.`; break;
    case 1: { const s = (a + b) * c; const sub = r.int(1, Math.min(s - 1, 20)); expr = `(${a}+${b})*${c}-${sub}`; note = `Brackets first: ${a} + ${b} = ${a + b}.`; break; }
    case 2: expr = `${a}+${b}^2-${c}`; note = `Powers first: ${b}² = ${b * b}.`; break;
    case 3: { const hiB = b + r.int(1, 8); expr = `${a}*(${hiB}-${b})+${e}^2`; note = `Brackets, then the power, then multiply, then add.`; break; }
    case 4: expr = `${b * c}/${c}+${a}*${e}`; note = `Divide and multiply before adding: ${b * c} ÷ ${c} = ${b}.`; break;
    case 5: { const k = r.int(2, 9); expr = `(${c * k - b}+${b})/${c}*${e}+${a}`; note = `Brackets: ${c * k - b} + ${b} = ${c * k}.`; break; }
    case 6: expr = `${a}-(${b}-${c}*${e})`; note = `Inside the brackets multiply first: ${c} × ${e} = ${c * e}.`; break;
    default: expr = `${a}^2-${b}*${c}+${e}`; note = `Power first, then the multiplication, then work left to right.`;
  }
  return calcE(`${show(expr)} = ?`, expr, [note, `Work left to right after that.`], { expr, f }, 3);
};

const negatives: Generator = (r, d) => {
  const hi = scale(d, 9, 40);
  const a = r.int(2, hi), b = r.int(2, hi);
  const f = r.pick(d <= 3 ? [0, 1, 2] : d <= 6 ? [0, 1, 2, 3, 4] : [3, 4, 5, 6, 7, 8]);
  let expr: string;
  switch (f) {
    case 0: expr = `(-${a})+${b}`; break;
    case 1: expr = `${a}-(-${b})`; break;
    case 2: expr = `${a}-${b}-${r.int(2, 9)}`; break;
    case 3: expr = `(-${a})*${b % 12 + 2}`; break;
    case 4: { const q = r.int(2, 12), m = r.int(2, 12); expr = `(-${q * m})/${m}`; break; }
    case 5: { const q = r.int(2, 12), m = r.int(2, 12); expr = `(-${q * m})/(-${m})`; break; }
    case 6: expr = `(-${a})*(-${b % 12 + 2})+${r.int(2, 20)}`; break;
    default: { const m = r.int(2, 9); expr = r.chance(0.5) ? `-${m}^2` : `(-${m})^2`; }
  }
  return calcE(`${show(expr)} = ?`, expr, [`Take care with the signs: two negatives multiply or divide to a positive; a negative and a positive give a negative.`], { expr, f }, 2);
};

const mixedFracDec: Generator = (r, d) => {
  const dens = [2, 4, 5, 8, 10];
  const b = r.pick(dens), a = r.int(1, b - 1);
  const dp = r.int(1, 2);
  const dv = r.int(2, 9 * 10 ** dp - 1);
  const decStr = dec(dv, dp);
  const k = r.int(2, 9);
  const f = d <= 4 ? r.pick([0, 1]) : r.pick([1, 2, 3]);
  const frStr = `${a}/${b}`;
  let expr: string;
  if (f === 0) expr = `${frStr}+${decStr}`;
  else if (f === 1) expr = `${decStr}+${frStr}*${k}`;
  else if (f === 2) expr = `(${frStr}+${decStr})*${k}`;
  else expr = `${decStr}*${k}-${frStr}`;
  const shown = show(expr).replace(/ ÷ /g, "/");
  return calcE(`${shown} = ?`, expr, [`Write the fraction as a decimal: ${frStr} = ${dec(Math.round((a * 1000) / b), 3)}.`, `Then work through the sum in order.`], { expr, f }, 3);
};

const missingNumber: Generator = (r, d) => {
  const x = r.int(2, scale(d, 12, 60));
  const k = r.int(2, scale(d, 6, 12)), c = r.int(1, scale(d, 9, 40));
  const f = r.pick(d <= 3 ? [0, 1] : [0, 1, 2, 3]);
  switch (f) {
    case 0: return calc(`${x + c} - ? = ${x}`, String(c), `${x + c}-${x}`, [`${x + c} - ${x} = ${c}`], { f, x, c }, len(x + c));
    case 1: return calc(`? × ${k} = ${x * k}`, String(x), `${x * k}/${k}`, [`${x * k} ÷ ${k} = ${x}`], { f, x, k }, len(x * k));
    case 2: return calc(`? × ${k} + ${c} = ${x * k + c}`, String(x), `(${x * k + c}-${c})/${k}`, [`Undo the + ${c}: ${x * k + c} - ${c} = ${x * k}.`, `Undo the × ${k}: ${x * k} ÷ ${k} = ${x}.`], { f, x, k, c }, len(x * k));
    default: return calc(`(? - ${c}) ÷ ${k} = ${x}`, String(x * k + c), `${x}*${k}+${c}`, [`Undo the ÷ ${k}: ${x} × ${k} = ${x * k}.`, `Undo the - ${c}: ${x * k} + ${c} = ${x * k + c}.`], { f, x, k, c }, len(x * k));
  }
};

/** A polynomial in x written the way a student reads it, and the same expression with the value substituted. */
function poly(coefs: number[], xs: string): { text: string; expr: string } {
  const deg = coefs.length - 1;
  const parts: string[] = [], ex: string[] = [];
  coefs.forEach((c, i) => {
    const p = deg - i;
    if (c === 0) return;
    const mag = Math.abs(c);
    const sign = c < 0 ? "-" : "+";
    const coefTxt = p > 0 && mag === 1 ? "" : String(mag);
    const varTxt = p === 0 ? "" : p === 1 ? "x" : `x${sup(p)}`;
    parts.push(parts.length === 0 ? `${c < 0 ? "-" : ""}${coefTxt}${varTxt}` : ` ${sign} ${coefTxt}${varTxt}`);
    ex.push(`${sign}${mag}${p === 0 ? "" : `*${xs}^${p}`}`);
  });
  return { text: parts.join(""), expr: ex.join("").replace(/^\+/, "") };
}

const substitute: Generator = (r, d) => {
  const deg = d <= 3 ? 1 : d <= 7 ? 2 : r.pick([2, 3]);
  const coefs = Array.from({ length: deg + 1 }, (_, i) => (i === 0 ? r.int(1, scale(d, 4, 6)) : r.int(-scale(d, 6, 9), scale(d, 6, 9)) || 1));
  const x = d >= 5 && r.chance(0.5) ? -r.int(1, 5) : r.int(1, scale(d, 5, 9));
  const p = poly(coefs, `(${x})`);
  const text = poly(coefs, "x").text;
  return calcE(`If x = ${x}, find ${text}.`, p.expr, [`Replace every x with ${x < 0 ? `(${x})` : x}.`, `Work out the powers first, then the multiplications, then add and subtract.`], { coefs: coefs.join(","), x }, 3);
};

const likeTerms: Generator = (r, d) => {
  const terms = scale(d, 2, 4);
  const xs: number[] = [], cs: number[] = [];
  const pieces: string[] = [];
  const piece = (v: number, suffix: string): string => {
    const mag = suffix && Math.abs(v) === 1 ? "" : String(Math.abs(v));
    return pieces.length === 0 ? `${v < 0 ? "-" : ""}${mag}${suffix}` : `${v < 0 ? "-" : "+"} ${mag}${suffix}`;
  };
  for (let i = 0; i < terms; i++) {
    const a = r.int(-scale(d, 6, 12), scale(d, 9, 15)) || 3, c = r.int(-scale(d, 6, 20), scale(d, 9, 30)) || 4;
    xs.push(a); cs.push(c);
    pieces.push(piece(a, "x"));
    pieces.push(piece(c, ""));
  }
  const text = pieces.join(" ");
  const askX = r.chance(0.5);
  const ans = askX ? xs.reduce((s, v) => s + v, 0) : cs.reduce((s, v) => s + v, 0);
  return { prompt: `Simplify ${text}. What is the ${askX ? "coefficient of x" : "constant term"}?`, answer: String(ans), working: [`Collect the x terms together and the plain numbers together.`, `x terms: ${xs.join(" + ")} = ${xs.reduce((s, v) => s + v, 0)}; numbers: ${cs.join(" + ")} = ${cs.reduce((s, v) => s + v, 0)}.`], params: { xs: xs.join(","), cs: cs.join(","), askX: askX ? 1 : 0 }, size: terms };
};

const solve1: Generator = (r, d) => {
  const x = r.int(2, scale(d, 12, 99));
  const k = r.int(2, scale(d, 9, 15)), c = r.int(2, scale(d, 20, 99));
  const f = r.pick([0, 1, 2, 3]);
  switch (f) {
    case 0: return calc(`x + ${c} = ${x + c}. Find x.`, String(x), `${x + c}-${c}`, [`Subtract ${c} from both sides.`], { f, x, c }, 2);
    case 1: return calc(`x - ${c} = ${x - c}. Find x.`, String(x), `${x - c}+${c}`, [`Add ${c} to both sides.`], { f, x, c }, 2);
    case 2: return calc(`${k}x = ${k * x}. Find x.`, String(x), `${k * x}/${k}`, [`Divide both sides by ${k}.`], { f, x, k }, 2);
    default: return calc(`x ÷ ${k} = ${x}. Find x.`, String(x * k), `${x}*${k}`, [`Multiply both sides by ${k}.`], { f, x, k }, 2);
  }
};

const solve2: Generator = (r, d) => {
  const x = (d >= 6 && r.chance(0.35) ? -1 : 1) * r.int(2, scale(d, 12, 30));
  const k = r.int(2, scale(d, 6, 12)), c = r.int(1, scale(d, 15, 60));
  const f = r.pick([0, 1, 2]);
  switch (f) {
    case 0: return calc(`${k}x + ${c} = ${k * x + c}. Find x.`, String(x), `(${k * x + c}-${c})/${k}`, [`Subtract ${c} from both sides: ${k}x = ${k * x}.`, `Divide by ${k}: x = ${x}.`], { f, x, k, c }, 2);
    case 1: return calc(`${k}x - ${c} = ${k * x - c}. Find x.`, String(x), `(${k * x - c}+${c})/${k}`, [`Add ${c} to both sides: ${k}x = ${k * x}.`, `Divide by ${k}: x = ${x}.`], { f, x, k, c }, 2);
    default: { const q = r.int(2, scale(d, 9, 25)); const xx = q * k - c; return calc(`(x + ${c}) ÷ ${k} = ${q}. Find x.`, String(xx), `${q}*${k}-${c}`, [`Multiply both sides by ${k}: x + ${c} = ${q * k}.`, `Subtract ${c}: x = ${xx}.`], { f, q, k, c }, 2); }
  }
};

const solveBoth: Generator = (r, d) => {
  const x = (d >= 7 && r.chance(0.3) ? -1 : 1) * r.int(1, scale(d, 9, 20));
  const m1 = r.int(3, scale(d, 6, 12)), m2 = r.int(1, m1 - 1);
  const c1 = r.int(-scale(d, 9, 30), scale(d, 9, 30));
  const c2 = m1 * x + c1 - m2 * x;
  const side = (m: number, c: number): string => `${m === 1 ? "" : m}x ${c < 0 ? "-" : "+"} ${Math.abs(c)}`;
  return calc(`${side(m1, c1)} = ${side(m2, c2)}. Find x.`, String(x), `(${c2}-(${c1}))/(${m1}-${m2})`, [`Collect the x terms on one side: ${m1 - m2}x = ${c2 - c1}.`, `Divide: x = ${x}.`], { x, m1, m2, c1, c2 }, 3);
};

const identitySquare: Generator = (r, d) => {
  const f = r.pick(d <= 3 ? [0, 1] : d <= 6 ? [0, 1, 2] : [1, 2, 3, 4]);
  const k = r.pick([10, 50, 100]);
  const t = r.int(2, k === 10 ? 4 : 9);
  switch (f) {
    case 0: return calc(`Use (${k} + ${t})² to find ${k + t}².`, String((k + t) ** 2), `${k + t}*${k + t}`, [`(a + b)² = a² + 2ab + b² with a = ${k}, b = ${t}.`, `${k * k} + ${2 * k * t} + ${t * t} = ${(k + t) ** 2}`], { f, k, t }, 4);
    case 1: return calc(`Use (${k} - ${t})² to find ${k - t}².`, String((k - t) ** 2), `${k - t}*${k - t}`, [`(a - b)² = a² - 2ab + b² with a = ${k}, b = ${t}.`, `${k * k} - ${2 * k * t} + ${t * t} = ${(k - t) ** 2}`], { f, k, t }, 4);
    case 2: return calc(`Find ${k - t} × ${k + t}.`, String(k * k - t * t), `${k - t}*${k + t}`, [`(a - b)(a + b) = a² - b² with a = ${k}, b = ${t}.`, `${k * k} - ${t * t} = ${k * k - t * t}`], { f, k, t }, 4);
    case 3: { const a = r.int(41, 99), b = r.int(11, a - 10); return calc(`Find ${a}² - ${b}².`, String(a * a - b * b), `${a}*${a}-${b}*${b}`, [`a² - b² = (a - b)(a + b).`, `${a - b} × ${a + b} = ${(a - b) * (a + b)}`], { f, a, b }, 4); }
    default: { const x = r.int(11, 49), y = r.int(2, 9); return calc(`Find ${x}² + 2 × ${x} × ${y} + ${y}².`, String((x + y) ** 2), `${x}*${x}+2*${x}*${y}+${y}*${y}`, [`This is (a + b)² with a = ${x}, b = ${y}.`, `(${x} + ${y})² = ${x + y}² = ${(x + y) ** 2}`], { f, x, y }, 4); }
  }
};

export const LEVEL_H: Skill[] = [
  S("bodmas", "Order of operations", 8, [7000, 22000], 8, bodmas),
  S("negatives", "Negative numbers", 8, [5000, 16000], 8, negatives),
  S("mixed-fracdec", "Fractions and decimals together", 8, [9000, 26000], 8, mixedFracDec),
  S("missing-number", "Missing numbers", 8, [6000, 16000], 8, missingNumber),
  S("substitute", "Substitution", 8, [8000, 26000], 8, substitute),
  S("like-terms", "Simplifying expressions", 8, [8000, 24000], 8, likeTerms),
  S("solve-1step", "One-step equations", 8, [4000, 12000], 8, solve1),
  S("solve-2step", "Two-step equations", 8, [7000, 20000], 8, solve2),
  S("solve-both", "Unknowns on both sides", 8, [10000, 28000], 8, solveBoth),
  S("identity-square", "Using identities", 8, [8000, 24000], 8, identitySquare),
];
