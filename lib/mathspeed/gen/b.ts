import { digits, scale } from "../rng";
import type { Generator, Skill } from "../types";
import { S, calc, len, n } from "./util";

/** Level B: Arithmetic Fluency. Two- to four-digit addition and subtraction, chains, complements, shortcuts, estimation, checking. */

/** A pair of k-digit numbers whose ones digits do (carry) or do not (no carry) make a carry. */
function addPair(r: import("../rng").Rng, k: number, carry: boolean): [number, number] {
  const cols = (a: number, b: number): boolean => {
    const A = String(a).split("").reverse().map(Number), B = String(b).split("").reverse().map(Number);
    return A.some((x, i) => x + B[i] >= 10);
  };
  for (let i = 0; i < 400; i++) {
    const a = digits(r, k), b = digits(r, k);
    if (cols(a, b) === carry) return [a, b];
  }
  return [digits(r, k), digits(r, k)];
}

const add2: Generator = (r, d) => {
  if (d <= 8) {
    const [a, b] = addPair(r, 2, d >= 4);
    const w = d >= 4 ? [`Add the ones: ${a % 10} + ${b % 10} = ${(a % 10) + (b % 10)}, carry the ten.`, `Add the tens, plus the carried ten.`] : [`Add the tens, then the ones: ${a - (a % 10)} + ${b - (b % 10)} + ${(a % 10) + (b % 10)}.`];
    return calc(`${a} + ${b} = ?`, String(a + b), `${a}+${b}`, [...w, `${a} + ${b} = ${a + b}`], { a, b }, 2);
  }
  const a = digits(r, 2), b = digits(r, 2), c = digits(r, 2);
  return calc(`${a} + ${b} + ${c} = ?`, String(a + b + c), `${a}+${b}+${c}`, [`Add two numbers, then the third: ${a} + ${b} = ${a + b}; ${a + b} + ${c} = ${a + b + c}.`], { a, b, c }, 2);
};

const sub2: Generator = (r, d) => {
  if (d <= 8) {
    const borrow = d >= 4;
    const aT = r.int(3, 9), bT = r.int(1, aT - 1);
    let aO: number, bO: number;
    if (borrow) { aO = r.int(0, 7); bO = r.int(aO + 1, 9); } else { bO = r.int(0, 9); aO = r.int(bO, 9); }
    const a = aT * 10 + aO, b = bT * 10 + bO;
    return calc(`${a} - ${b} = ?`, String(a - b), `${a}-${b}`, [borrow ? `${aO} is smaller than ${bO}: borrow a ten, ${aO + 10} - ${bO} = ${aO + 10 - bO}.` : `Subtract the tens, then the ones.`, `${a} - ${b} = ${a - b}`], { a, b }, 2);
  }
  const a = r.int(100, 999), b = r.int(11, 99);
  return calc(`${a} - ${b} = ?`, String(a - b), `${a}-${b}`, [`Take the tens first: ${a} - ${b - (b % 10)} = ${a - (b - (b % 10))}, then take ${b % 10}.`, `${a} - ${b} = ${a - b}`], { a, b }, 3);
};

const addCarry: Generator = (r, d) => {
  const k = scale(d, 3, 5);
  const [a, b] = addPair(r, k, true);
  return calc(`${n(a)} + ${n(b)} = ?`, String(a + b), `${a}+${b}`, [`Work from the right, carrying whenever a column makes 10 or more.`, `${n(a)} + ${n(b)} = ${n(a + b)}`], { a, b }, k);
};

const subBorrow: Generator = (r, d) => {
  const k = scale(d, 3, 5);
  let a = digits(r, k);
  const zeros = d >= 6 && r.chance(0.7);
  if (zeros) a = r.int(2, 9) * 10 ** (k - 1) + r.int(0, 9) * (r.chance(0.5) ? 1 : 0);
  let b = r.int(10 ** (k - 2), a - 1);
  if (d >= 4 && a % 10 >= b % 10) b = b - (b % 10) + Math.min(9, (a % 10) + 1);
  if (b >= a) b = a - 1;
  return calc(`${n(a)} - ${n(b)} = ?`, String(a - b), `${a}-${b}`, [`Subtract column by column from the right, borrowing from the next place when the top digit is smaller.`, `${n(a)} - ${n(b)} = ${n(a - b)}`], { a, b }, k);
};

const calcChain: Generator = (r, d) => {
  const terms = scale(d, 3, 6);
  const hi = scale(d, 9, 60);
  let total = r.int(Math.max(5, hi / 2), hi);
  const first = total;
  let expr = String(total), shown = String(total);
  const steps: string[] = [];
  for (let i = 1; i < terms; i++) {
    const v = r.int(3, hi);
    if (total - v >= 0 && r.chance(0.5)) { total -= v; expr += `-${v}`; shown += ` - ${v}`; }
    else { total += v; expr += `+${v}`; shown += ` + ${v}`; }
    steps.push(String(total));
  }
  return calc(`${shown} = ?`, String(total), expr, [`Work left to right: ${[first, ...steps].join(" → ")}.`], { expr }, len(Math.max(total, first)) + 1);
};

const comp100: Generator = (r, d) => {
  const x = d <= 3 ? r.int(1, 9) * 10 : d <= 5 ? r.int(1, 19) * 5 : d <= 8 ? r.int(11, 99) : r.int(101, 499);
  const target = x > 100 ? Math.ceil((x + 1) / 100) * 100 : 100;
  if (r.chance(0.5)) return calc(`${target} - ${x} = ?`, String(target - x), `${target}-${x}`, [`Make each digit add to 9 (the last to 10): the answer is ${target - x}.`], { x, target }, len(x));
  return calc(`${x} + ? = ${target}`, String(target - x), `${target}-${x}`, [`${target} - ${x} = ${target - x}`], { x, target }, len(x));
};

const comp1000: Generator = (r, d) => {
  const x = d <= 4 ? r.int(1, 9) * 100 + r.int(0, 1) * 50 : r.int(101, 999);
  const target = d >= 8 && r.chance(0.5) ? 10000 : 1000;
  const v = target === 10000 ? r.int(1001, 9999) : x;
  if (r.chance(0.5)) return calc(`${n(target)} - ${n(v)} = ?`, String(target - v), `${target}-${v}`, [`Take each digit from 9 and the last from 10.`, `${n(target)} - ${n(v)} = ${n(target - v)}`], { x: v, target }, len(v));
  return calc(`${n(v)} + ? = ${n(target)}`, String(target - v), `${target}-${v}`, [`${n(target)} - ${n(v)} = ${n(target - v)}`], { x: v, target }, len(v));
};

const addByRounding: Generator = (r, d) => {
  const hundreds = d >= 6;
  const base = hundreds ? r.int(2, 9) * 100 : r.int(2, 9) * 10;
  const off = r.pick([-2, -1, 1, 2]);
  const near = base + off;
  const other = hundreds ? r.int(101, 499) : r.int(11, 79);
  const add = r.chance(0.6);
  const [x, y] = add ? [near, other] : [near + other, near];
  const text = add ? `${near} + ${other}` : `${near + other} - ${near}`;
  const exprV = add ? near + other : other;
  const w = add ? [`${near} is ${Math.abs(off)} ${off < 0 ? "below" : "above"} ${base}.`, `${base} + ${other} = ${base + other}, then ${off < 0 ? "subtract" : "add"} ${Math.abs(off)}.`] : [`${near} is close to ${base}.`, `${near + other} - ${base} = ${near + other - base}, then ${off < 0 ? "subtract" : "add"} back ${Math.abs(off)}.`];
  return calc(`${text} = ?`, String(exprV), add ? `${x}+${y}` : `${x}-${y}`, [...w, `The answer is ${exprV}.`], { x, y, add: add ? 1 : 0 }, hundreds ? 3 : 2);
};

const estimateSum: Generator = (r, d) => {
  const mult = d >= 7;
  if (mult) {
    const a = r.int(21, 98), b = r.int(21, 98);
    return calc(`Estimate ${a} × ${b}`, String(a * b), `${a}*${b}`, [`Round to ${Math.round(a / 10) * 10} × ${Math.round(b / 10) * 10} = ${Math.round(a / 10) * 10 * Math.round(b / 10) * 10}.`, `Any answer within 5% of the true value is accepted.`], { a, b, op: "mul" }, 4, { tol: Math.round(a * b * 0.06) });
  }
  const k = scale(d, 2, 4);
  const a = digits(r, k), b = digits(r, k), add = r.chance(0.6);
  const [x, y] = add ? [a, b] : [Math.max(a, b), Math.min(a, b)];
  const v = add ? x + y : x - y;
  const unit = 10 ** (k - 1);
  return calc(`Estimate ${n(x)} ${add ? "+" : "-"} ${n(y)}`, String(v), `${x}${add ? "+" : "-"}${y}`, [`Round each to the nearest ${n(unit)}: ${n(Math.round(x / unit) * unit)} ${add ? "+" : "-"} ${n(Math.round(y / unit) * unit)} = ${n(add ? Math.round(x / unit) * unit + Math.round(y / unit) * unit : Math.round(x / unit) * unit - Math.round(y / unit) * unit)}.`, `Any answer within 5% of the true value is accepted.`], { a: x, b: y, op: add ? "add" : "sub" }, k, { tol: Math.max(1, Math.round(Math.abs(v) * 0.06)) });
};

const digitalRoot: Generator = (r, d) => {
  const k = scale(d, 2, 7);
  const x = digits(r, k);
  const steps: string[] = [];
  let cur = x;
  while (cur >= 10) { const s = String(cur).split("").reduce((t, c) => t + Number(c), 0); steps.push(`${String(cur).split("").join(" + ")} = ${s}`); cur = s; }
  return { prompt: `Add the digits of ${n(x)} until one digit is left. What is it?`, answer: String(cur), working: steps.length ? steps : [`${x} is already one digit.`], params: { x }, size: k };
};

export const LEVEL_B: Skill[] = [
  S("add-2digit", "Two-digit addition", 2, [4000, 9000], 8, add2),
  S("sub-2digit", "Two-digit subtraction", 2, [4500, 10000], 8, sub2),
  S("add-carry", "Addition with carrying", 2, [6000, 16000], 8, addCarry),
  S("sub-borrow", "Subtraction with borrowing", 2, [6500, 17000], 8, subBorrow),
  S("calc-chain", "Calculation chains", 2, [6000, 20000], 8, calcChain),
  S("complement-100", "Complements to 100", 2, [3500, 9000], 8, comp100),
  S("complement-1000", "Complements to 1000", 2, [4500, 11000], 8, comp1000),
  S("add-by-rounding", "Rounding shortcuts", 2, [5000, 12000], 8, addByRounding),
  S("estimate-sum", "Estimating answers", 2, [6000, 14000], 8, estimateSum),
  S("digital-root", "Checking with digit sums", 2, [5000, 16000], 8, digitalRoot),
];
