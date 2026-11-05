import { digits, scale } from "../rng";
import type { Generator, Skill } from "../types";
import { S, calc, dec, len, n } from "./util";

/** Level D: Advanced Basic Calculations. Multi-digit addition and subtraction, 2x2 and 3-digit multiplication, long division, powers of ten, near numbers, mixed operations. */

const addMulti: Generator = (r, d) => {
  const k = scale(d, 4, 6);
  const count = d >= 7 ? 3 : 2;
  const xs = Array.from({ length: count }, () => digits(r, k));
  const total = xs.reduce((s, x) => s + x, 0);
  return calc(`${xs.map(n).join(" + ")} = ?`, String(total), xs.join("+"), [`Line the digits up by place and add from the right, carrying as you go.`, `${xs.map(n).join(" + ")} = ${n(total)}`], { xs: xs.join(",") }, k);
};

const subMulti: Generator = (r, d) => {
  const k = scale(d, 5, 7);
  const a = digits(r, k);
  const b = r.int(10 ** (k - 2), a - 1);
  return calc(`${n(a)} - ${n(b)} = ?`, String(a - b), `${a}-${b}`, [`Subtract from the right, borrowing where the top digit is smaller.`, `Check by adding back: ${n(a - b)} + ${n(b)} = ${n(a)}.`], { a, b }, k);
};

const mul2x2: Generator = (r, d) => {
  const lo = d <= 3 ? 11 : 12, hi = scale(d, 25, 99);
  const a = r.int(Math.max(lo, scale(d, 11, 40)), hi), b = r.int(Math.max(lo, scale(d, 11, 30)), scale(d, 19, 99));
  const bt = Math.floor(b / 10) * 10, bo = b % 10;
  return calc(`${a} × ${b} = ?`, String(a * b), `${a}*${b}`, [`Split ${b} into ${bt} + ${bo}.`, `${a} × ${bt} = ${a * bt}; ${a} × ${bo} = ${a * bo}.`, `${a * bt} + ${a * bo} = ${a * b}`], { a, b }, 4);
};

const mul3x2: Generator = (r, d) => {
  const a = r.int(101, scale(d, 300, 999));
  const b = d <= 4 ? r.int(2, 9) : r.int(11, scale(d, 20, 99));
  return calc(`${a} × ${b} = ?`, String(a * b), `${a}*${b}`, [`Multiply by each part of ${b} and add.`, `${a} × ${b} = ${n(a * b)}`], { a, b }, len(a * b));
};

const divLong: Generator = (r, d) => {
  const b = r.int(3, 9);
  const q = digits(r, scale(d, 3, 4));
  const a = b * q;
  return calc(`${n(a)} ÷ ${b} = ?`, String(q), `${a}/${b}`, [`Divide one place at a time, carrying any remainder to the next digit.`, `${n(a)} ÷ ${b} = ${n(q)}`], { a, b }, len(a));
};

const div2digit: Generator = (r, d) => {
  const b = r.int(11, scale(d, 19, 49));
  const q = r.int(scale(d, 12, 45), scale(d, 40, 400));
  const a = b * q;
  return calc(`${n(a)} ÷ ${b} = ?`, String(q), `${a}/${b}`, [`Estimate: ${b} is close to ${Math.round(b / 10) * 10}, so the answer is near ${n(Math.round(a / (Math.round(b / 10) * 10)))}.`, `${b} × ${n(q)} = ${n(a)}, so ${n(a)} ÷ ${b} = ${n(q)}.`], { a, b }, len(a));
};

const mulPowers10: Generator = (r, d) => {
  const places = d <= 4 ? 0 : d <= 7 ? 1 : 2; // decimal places in the number
  const base = r.int(2, scale(d, 99, 999));
  const v = dec(base, places);
  const k = r.pick([10, 100, 1000]);
  if (r.chance(0.5)) {
    const ans = dec(base * k, places);
    return calc(`${v} × ${n(k)} = ?`, ans, `${v}*${k}`, [`Multiplying by ${n(k)} moves every digit ${String(k).length - 1} place${k > 10 ? "s" : ""} to the left.`, `${v} × ${n(k)} = ${ans}`], { v, k, op: "mul" }, len(base));
  }
  const shift = String(k).length - 1;
  const ans = dec(base, places + shift);
  return calc(`${v} ÷ ${n(k)} = ?`, ans, `${v}/${k}`, [`Dividing by ${n(k)} moves every digit ${shift} place${shift > 1 ? "s" : ""} to the right.`, `${v} ÷ ${n(k)} = ${ans}`], { v, k, op: "div" }, len(base));
};

const nearRoundMul: Generator = (r, d) => {
  const base = d <= 4 ? 50 : d <= 7 ? 100 : r.pick([100, 1000]);
  const off = r.pick([-3, -2, -1, 1, 2, 3]);
  const near = base + off;
  const m = r.int(scale(d, 3, 6), scale(d, 7, 9));
  const swap = r.chance(0.5);
  return calc(swap ? `${m} × ${n(near)} = ?` : `${n(near)} × ${m} = ?`, String(near * m), `${near}*${m}`, [`${n(near)} is ${Math.abs(off)} ${off < 0 ? "below" : "above"} ${n(base)}.`, `${n(base)} × ${m} = ${n(base * m)}; ${Math.abs(off)} × ${m} = ${Math.abs(off) * m}.`, `${n(base * m)} ${off < 0 ? "-" : "+"} ${Math.abs(off) * m} = ${n(near * m)}`], { near, m, base }, len(near * m));
};

const mixedOps: Generator = (r, d) => {
  const hi = scale(d, 9, 30);
  const a = r.int(2, hi), b = r.int(2, 9), c = r.int(2, 9);
  const form = d <= 3 ? 0 : d <= 6 ? r.int(0, 3) : r.int(2, 5);
  switch (form) {
    case 0: return calc(`${a} + ${b} × ${c} = ?`, String(a + b * c), `${a}+${b}*${c}`, [`Multiply first: ${b} × ${c} = ${b * c}.`, `${a} + ${b * c} = ${a + b * c}`], { form, a, b, c }, 2);
    case 1: return calc(`(${a} + ${b}) × ${c} = ?`, String((a + b) * c), `(${a}+${b})*${c}`, [`Brackets first: ${a} + ${b} = ${a + b}.`, `${a + b} × ${c} = ${(a + b) * c}`], { form, a, b, c }, 3);
    case 2: { const t = a * b; const s = r.int(1, Math.min(t - 1, 40)); return calc(`${a} × ${b} - ${s} = ?`, String(t - s), `${a}*${b}-${s}`, [`Multiply first: ${a} × ${b} = ${t}.`, `${t} - ${s} = ${t - s}`], { form, a, b, s }, 3); }
    case 4: { const e = r.int(2, 9); return calc(`${a} × ${b} + ${c} × ${e} = ?`, String(a * b + c * e), `${a}*${b}+${c}*${e}`, [`Do both products first: ${a} × ${b} = ${a * b} and ${c} × ${e} = ${c * e}.`, `${a * b} + ${c * e} = ${a * b + c * e}`], { form, a, b, c, e }, 3); }
    case 5: { const e = r.int(2, a); return calc(`(${a + b} - ${e}) × ${c} + ${a} = ?`, String((a + b - e) * c + a), `(${a + b}-${e})*${c}+${a}`, [`Brackets first: ${a + b} - ${e} = ${a + b - e}.`, `${a + b - e} × ${c} = ${(a + b - e) * c}, then + ${a}.`], { form, a, b, c, e }, 3); }
    default: { const q = r.int(2, 12); const dv = r.int(2, 9); return calc(`${a} + ${dv * q} ÷ ${dv} × ${c} = ?`, String(a + q * c), `${a}+${dv * q}/${dv}*${c}`, [`Divide and multiply from the left: ${dv * q} ÷ ${dv} = ${q}; ${q} × ${c} = ${q * c}.`, `${a} + ${q * c} = ${a + q * c}`], { form, a, dv, q, c }, 3); }
  }
};

export const LEVEL_D: Skill[] = [
  S("add-multi", "Multi-digit addition", 4, [7000, 20000], 8, addMulti),
  S("sub-multi", "Multi-digit subtraction", 4, [8000, 22000], 8, subMulti),
  S("mul-2x2", "Two-digit by two-digit", 4, [12000, 32000], 8, mul2x2),
  S("mul-3x2", "Three-digit multiplication", 4, [14000, 38000], 8, mul3x2),
  S("div-long", "Long division by one digit", 4, [9000, 24000], 8, divLong),
  S("div-2digit", "Division by two-digit numbers", 4, [14000, 40000], 8, div2digit),
  S("mul-powers-10", "Multiplying and dividing by 10, 100, 1000", 4, [4000, 10000], 8, mulPowers10),
  S("near-round-mul", "Near numbers", 4, [8000, 20000], 8, nearRoundMul),
  S("mixed-ops", "Mixed operations", 4, [7000, 20000], 8, mixedOps),
];
