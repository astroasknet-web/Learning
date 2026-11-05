import { digits, scale } from "../rng";
import type { Generator, Skill } from "../types";
import { S, calc, choice, len, mixOf, n } from "./util";

/** Level C: Multiplication and Division Foundations. Tables to 20, missing factors, two-digit by one-digit, division, remainders, divisibility. */

const table = (lo: number, hi: number, maxB: [number, number]): Generator => (r, d) => {
  const a = r.int(lo, hi);
  const b = r.int(scale(d, 2, 5), scale(d, maxB[0], maxB[1]));
  const swap = r.chance(0.5);
  const [x, y] = swap ? [b, a] : [a, b];
  return calc(`${x} × ${y} = ?`, String(a * b), `${x}*${y}`, [`${a} × ${b} = ${a * b}`], { a: x, b: y }, len(a * b));
};
const tablesEasy = table(2, 5, [6, 12]);
const tablesMid = table(6, 10, [6, 12]);
const tablesTeens = table(11, 20, [5, 12]);

const missingFactor: Generator = (r, d) => {
  const hi = scale(d, 6, 20);
  const a = r.int(scale(d, 2, 4), hi), b = r.int(scale(d, 2, 5), Math.min(12, hi));
  const first = r.chance(0.5);
  return calc(first ? `? × ${a} = ${a * b}` : `${a} × ? = ${a * b}`, String(b), `${a * b}/${a}`, [`Ask: how many ${a}s make ${a * b}?`, `${a * b} ÷ ${a} = ${b}`], { a, product: a * b }, len(a * b));
};

const mul2x1: Generator = (r, d) => {
  const lo = d <= 3 ? 11 : 12, hi = scale(d, 29, 99);
  const a = r.int(lo, hi), b = r.int(scale(d, 2, 6), scale(d, 5, 9));
  const t = Math.floor(a / 10) * 10, o = a % 10;
  return calc(`${a} × ${b} = ?`, String(a * b), `${a}*${b}`, [`Split ${a} into ${t} + ${o}.`, `${t} × ${b} = ${t * b}; ${o} × ${b} = ${o * b}; ${t * b} + ${o * b} = ${a * b}.`], { a, b }, 3);
};

const divFacts: Generator = (r, d) => {
  const hi = scale(d, 6, 20);
  const b = r.int(2, hi), q = r.int(2, Math.min(12, hi));
  return calc(`${b * q} ÷ ${b} = ?`, String(q), `${b * q}/${b}`, [`Think of the table: ${b} × ${q} = ${b * q}, so ${b * q} ÷ ${b} = ${q}.`], { a: b * q, b }, len(b * q));
};

const divExact: Generator = (r, d) => {
  const b = r.int(2, scale(d, 5, 9));
  const q = d <= 4 ? r.int(11, 30) : digits(r, d <= 7 ? 2 : 3);
  const a = b * q;
  return calc(`${n(a)} ÷ ${b} = ?`, String(q), `${a}/${b}`, [`Divide part by part: split ${n(a)} into pieces that ${b} goes into.`, `${n(a)} ÷ ${b} = ${n(q)}, because ${b} × ${n(q)} = ${n(a)}.`], { a, b }, len(a));
};

const divRemainder: Generator = (r, d) => {
  const b = r.int(2, scale(d, 6, 12));
  const a = r.int(b + 1, scale(d, 40, 999));
  const rem = a % b;
  return { prompt: `What is the remainder when ${n(a)} is divided by ${b}?`, answer: String(rem), working: [`${b} × ${Math.floor(a / b)} = ${b * Math.floor(a / b)}, the closest multiple not above ${n(a)}.`, `${n(a)} - ${b * Math.floor(a / b)} = ${rem}.`], params: { a, b }, size: len(a) };
};

const RULES: Array<{ m: number; rule: string }> = [
  { m: 2, rule: "A number is divisible by 2 when its last digit is even." },
  { m: 5, rule: "A number is divisible by 5 when it ends in 0 or 5." },
  { m: 10, rule: "A number is divisible by 10 when it ends in 0." },
  { m: 3, rule: "A number is divisible by 3 when its digit sum is a multiple of 3." },
  { m: 9, rule: "A number is divisible by 9 when its digit sum is a multiple of 9." },
  { m: 4, rule: "A number is divisible by 4 when its last two digits are." },
  { m: 6, rule: "A number is divisible by 6 when it is even and divisible by 3." },
  { m: 8, rule: "A number is divisible by 8 when its last three digits are." },
  { m: 11, rule: "A number is divisible by 11 when the alternating digit sum is 0 or a multiple of 11." },
];
const divisibleBy: Generator = (r, d) => {
  const pool = RULES.slice(0, Math.min(RULES.length, scale(d, 3, 9)));
  const { m, rule } = r.pick(pool);
  const k = scale(d, 2, 5);
  let x = digits(r, k);
  const yes = r.chance(0.5);
  if (yes) x = Math.max(m, Math.round(x / m) * m);
  else if (x % m === 0) x += 1;
  const right = x % m === 0 ? "Yes" : "No";
  return choice(r, `Is ${n(x)} divisible by ${m}?`, right, [right === "Yes" ? "No" : "Yes"], [rule, `${n(x)} ${right === "Yes" ? "passes" : "fails"} this test, so the answer is ${right}.`], { x, m }, k);
};

const recallMixed: Generator = mixOf([["tables-easy", tablesEasy], ["tables-mid", tablesMid], ["tables-teens", tablesTeens], ["missing-factor", missingFactor], ["div-facts", divFacts], ["mul-2x1", mul2x1]]);

export const LEVEL_C: Skill[] = [
  S("tables-easy", "Tables 2 to 5", 3, [2500, 5000], 8, tablesEasy),
  S("tables-mid", "Tables 6 to 10", 3, [2800, 6000], 8, tablesMid),
  S("tables-teens", "Tables 11 to 20", 3, [3500, 8000], 8, tablesTeens),
  S("missing-factor", "Missing factors", 3, [3500, 8000], 8, missingFactor),
  S("mul-2x1", "Two-digit by one-digit", 3, [5000, 12000], 8, mul2x1),
  S("div-facts", "Division facts", 3, [3000, 7000], 8, divFacts),
  S("div-exact", "Exact division", 3, [5000, 14000], 8, divExact),
  S("div-remainder", "Remainders", 3, [5000, 14000], 8, divRemainder),
  S("divisible-by", "Divisibility rules", 3, [5000, 14000], 8, divisibleBy),
  S("recall-mixed", "Rapid recall", 3, [3000, 9000], 8, recallMixed),
];
