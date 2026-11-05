import { scale } from "../rng";
import type { Generator, Skill } from "../types";
import { S, calc, choice, gcd, lcm, len, n, sup } from "./util";

/** Level E: Number Mastery. Squares, cubes, roots, primes, factors, multiples, HCF and LCM, powers, last digits, fast squaring. */

const squares: Generator = (r, d) => {
  const x = r.int(scale(d, 2, 11), scale(d, 12, 40));
  return calc(`${x}² = ?`, String(x * x), `${x}*${x}`, [`${x} × ${x} = ${n(x * x)}`], { x }, len(x * x));
};

const cubes: Generator = (r, d) => {
  const x = r.int(scale(d, 2, 5), scale(d, 6, 16));
  return calc(`${x}³ = ?`, String(x ** 3), `${x}^3`, [`${x}² = ${x * x}, then ${x * x} × ${x} = ${n(x ** 3)}.`], { x }, len(x ** 3));
};

const sqrtPerfect: Generator = (r, d) => {
  const x = r.int(scale(d, 2, 13), scale(d, 12, 99));
  return calc(`√${n(x * x)} = ?`, String(x), `${x}`, [`Which number multiplied by itself gives ${n(x * x)}? ${x} × ${x} = ${n(x * x)}.`], { x, sq: x * x }, len(x * x));
};

const cbrtPerfect: Generator = (r, d) => {
  const x = r.int(scale(d, 2, 6), scale(d, 7, 25));
  return calc(`∛${n(x ** 3)} = ?`, String(x), `${x}`, [`Which number cubed gives ${n(x ** 3)}? ${x} × ${x} × ${x} = ${n(x ** 3)}.`], { x, cube: x ** 3 }, len(x ** 3));
};

const isPrime = (x: number): boolean => { if (x < 2) return false; for (let i = 2; i * i <= x; i++) if (x % i === 0) return false; return true; };

const primeTest: Generator = (r, d) => {
  const hi = scale(d, 30, 400);
  let p = r.int(5, hi);
  while (!isPrime(p)) p++;
  const comps: number[] = [];
  while (comps.length < 3) {
    // composites that look prime: odd and not divisible by 3 or 5 at higher difficulty
    let c = r.int(9, hi + 20);
    if (d >= 4) while (c % 2 === 0 || c % 3 === 0 || c % 5 === 0 || isPrime(c)) c++;
    else while (isPrime(c)) c++;
    if (c !== p && !comps.includes(c)) comps.push(c);
  }
  return choice(r, `Which of these numbers is prime?`, String(p), comps.map(String), [`A prime has exactly two factors: 1 and itself.`, `Try dividing by 2, 3, 5, 7, 11 and so on up to the square root.`, `${p} has no other factor, so it is prime.`], { p, others: comps.join(",") }, len(p));
};

const factorCount: Generator = (r, d) => {
  const x = r.int(scale(d, 6, 40), scale(d, 36, 240));
  let c = 0;
  const fs: number[] = [];
  for (let i = 1; i <= x; i++) if (x % i === 0) { c++; fs.push(i); }
  return { prompt: `How many factors does ${x} have?`, answer: String(c), working: [`List the pairs that multiply to ${x}.`, `Factors: ${fs.join(", ")}.`, `That is ${c} factors.`], params: { x }, size: len(x) };
};

const nextMultiple: Generator = (r, d) => {
  const m = r.int(scale(d, 3, 11), scale(d, 9, 29));
  const above = r.int(scale(d, 20, 120), scale(d, 100, 999));
  const ans = (Math.floor(above / m) + 1) * m;
  return { prompt: `What is the smallest multiple of ${m} that is greater than ${above}?`, answer: String(ans), working: [`${above} ÷ ${m} is about ${Math.floor(above / m)}.`, `${m} × ${Math.floor(above / m) + 1} = ${ans}.`], params: { m, above }, size: len(above) };
};

const hcf: Generator = (r, d) => {
  const g = r.int(scale(d, 2, 6), scale(d, 9, 30));
  let a = r.int(2, scale(d, 6, 20)), b = r.int(2, scale(d, 6, 20));
  while (gcd(a, b) !== 1) b++;
  a *= g; b *= g;
  return { prompt: `What is the HCF (highest common factor) of ${a} and ${b}?`, answer: String(g), working: [`List the factors or divide both by common factors.`, `The largest number that divides both ${a} and ${b} is ${g}.`], params: { a, b }, size: len(Math.max(a, b)) };
};

const lcmSkill: Generator = (r, d) => {
  const three = d >= 8;
  const xs = [r.int(scale(d, 2, 6), scale(d, 9, 20)), r.int(scale(d, 2, 6), scale(d, 9, 24))];
  if (three) xs.push(r.int(3, 12));
  const uniq = [...new Set(xs)];
  if (uniq.length < 2) uniq.push(uniq[0] + 1);
  const l = uniq.reduce((p, c) => lcm(p, c), 1);
  return { prompt: `What is the LCM (lowest common multiple) of ${uniq.join(", ")}?`, answer: String(l), working: [`Write multiples of the largest number until all the others divide it.`, `The smallest number that all of ${uniq.join(", ")} divide into is ${n(l)}.`], params: { xs: uniq.join(",") }, size: len(l) };
};

const powers: Generator = (r, d) => {
  const opts: Array<[number, number]> = d <= 3 ? [[2, 5], [3, 3], [10, 3], [2, 4]] : d <= 6 ? [[2, 6], [2, 7], [2, 8], [3, 4], [3, 5], [5, 3], [4, 3], [4, 4], [10, 4], [10, 5], [6, 3], [7, 3]] : [[2, 10], [3, 6], [5, 5], [7, 4], [4, 6], [9, 4], [12, 3]];
  const [a, b] = r.pick(opts);
  const prompt = `${a}${sup(b)} = ?`;
  return calc(prompt, String(a ** b), `${a}^${b}`, [`${a}^${b} means ${a} multiplied by itself ${b} times.`, `${Array(b).fill(a).join(" × ")} = ${n(a ** b)}`], { a, b }, len(a ** b));
};

const lastDigit: Generator = (r, d) => {
  const k = scale(d, 2, 4);
  const count = d >= 7 ? 3 : 2;
  const xs = Array.from({ length: count }, () => r.int(10 ** (k - 1) + 1, 10 ** k - 1));
  const digit = xs.reduce((p, x) => (p * (x % 10)) % 10, 1);
  return { prompt: `What is the last digit of ${xs.map(n).join(" × ")}?`, answer: String(digit), working: [`Only the last digits matter: ${xs.map((x) => x % 10).join(" × ")}.`, `${xs.map((x) => x % 10).join(" × ")} = ${xs.reduce((p, x) => p * (x % 10), 1)}, which ends in ${digit}.`], params: { xs: xs.join(",") }, size: k };
};

const remainderPattern: Generator = (r, d) => {
  const m = d <= 4 ? 9 : r.pick([9, 11, 7]);
  const x = r.int(scale(d, 100, 10000), scale(d, 999, 999999));
  const rem = x % m;
  const w = m === 9 ? [`A number leaves the same remainder as its digit sum when divided by 9.`, `Digit sum of ${n(x)} is ${String(x).split("").reduce((p, c) => p + Number(c), 0)}.`] : [`Divide step by step, or use the number's pattern for ${m}.`];
  return { prompt: `What is the remainder when ${n(x)} is divided by ${m}?`, answer: String(rem), working: [...w, `Remainder = ${rem}.`], params: { x, m }, size: len(x) };
};

const squareNearBase: Generator = (r, d) => {
  const base = d <= 5 ? 50 : r.pick([50, 100]);
  const off = r.int(1, scale(d, 6, base === 50 ? 20 : 12));
  const x = base + (r.chance(0.5) ? off : -off);
  const dlt = x - base;
  return calc(`${x}² = ?`, String(x * x), `${x}*${x}`, [`${x} is ${Math.abs(dlt)} ${dlt < 0 ? "below" : "above"} ${base}: use (${base} ${dlt < 0 ? "-" : "+"} ${Math.abs(dlt)})².`, `${base}² = ${n(base * base)}; 2 × ${base} × ${Math.abs(dlt)} = ${n(2 * base * Math.abs(dlt))}; ${Math.abs(dlt)}² = ${dlt * dlt}.`, `${n(base * base)} ${dlt < 0 ? "-" : "+"} ${n(2 * base * Math.abs(dlt))} + ${dlt * dlt} = ${n(x * x)}`], { x, base }, len(x * x));
};

export const LEVEL_E: Skill[] = [
  S("squares", "Squares", 5, [3000, 9000], 8, squares),
  S("cubes", "Cubes", 5, [4000, 11000], 8, cubes),
  S("sqrt-perfect", "Square roots", 5, [4000, 10000], 8, sqrtPerfect),
  S("cbrt-perfect", "Cube roots", 5, [5000, 12000], 8, cbrtPerfect),
  S("prime-test", "Spotting primes", 5, [6000, 18000], 8, primeTest),
  S("factor-count", "Factors", 5, [7000, 22000], 8, factorCount),
  S("next-multiple", "Multiples", 5, [6000, 16000], 8, nextMultiple),
  S("hcf", "HCF", 5, [7000, 20000], 8, hcf),
  S("lcm", "LCM", 5, [8000, 24000], 8, lcmSkill),
  S("powers", "Powers", 5, [5000, 16000], 8, powers),
  S("last-digit", "Last digits", 5, [5000, 14000], 8, lastDigit),
  S("remainder-pattern", "Remainder patterns", 5, [6000, 18000], 8, remainderPattern),
  S("square-near-base", "Fast squaring", 5, [6000, 16000], 8, squareNearBase),
];
