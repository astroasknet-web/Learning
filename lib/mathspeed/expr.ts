/**
 * An exact calculator for the tests and the marker: + - * / ^ (whole-number powers) and brackets over rational numbers (BigInt).
 * It shares no code with the question generators, so a generator's answer can be checked against it independently.
 */
export interface Rat { n: bigint; d: bigint }

const gcd = (a: bigint, b: bigint): bigint => { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) [a, b] = [b, a % b]; return a; };
export const rat = (n: bigint, d: bigint = 1n): Rat => {
  if (d === 0n) throw new Error("division by zero");
  if (d < 0n) { n = -n; d = -d; }
  const g = gcd(n, d) || 1n;
  return { n: n / g, d: d / g };
};
export const add = (a: Rat, b: Rat): Rat => rat(a.n * b.d + b.n * a.d, a.d * b.d);
export const sub = (a: Rat, b: Rat): Rat => rat(a.n * b.d - b.n * a.d, a.d * b.d);
export const mul = (a: Rat, b: Rat): Rat => rat(a.n * b.n, a.d * b.d);
export const div = (a: Rat, b: Rat): Rat => rat(a.n * b.d, a.d * b.n);
export const eq = (a: Rat, b: Rat): boolean => a.n === b.n && a.d === b.d;
export const toNumber = (a: Rat): number => Number(a.n) / Number(a.d);

/** "12", "-3.25", ".5" -> rational. Returns null for anything else. */
export function parseDecimal(s: string): Rat | null {
  const m = /^([+-]?)(\d*)(?:\.(\d*))?$/.exec(s);
  if (!m || (m[2] === "" && (m[3] ?? "") === "")) return null;
  const frac = m[3] ?? "";
  const n = BigInt((m[2] || "0") + frac);
  return rat(m[1] === "-" ? -n : n, 10n ** BigInt(frac.length));
}

/** Evaluate an arithmetic expression exactly. Throws on bad syntax. */
export function evaluate(src: string): Rat {
  let i = 0;
  const peek = (): string => { while (src[i] === " ") i++; return src[i] ?? ""; };
  const eat = (c: string): boolean => { if (peek() === c) { i++; return true; } return false; };
  function number(): Rat {
    peek();
    const start = i;
    while (/[0-9.]/.test(src[i] ?? "")) i++;
    const r = parseDecimal(src.slice(start, i));
    if (!r) throw new Error(`bad number at ${start} in ${src}`);
    return r;
  }
  function primary(): Rat {
    if (eat("(")) { const v = sum(); if (!eat(")")) throw new Error("missing )"); return v; }
    return number();
  }
  function exponent(): Rat {
    if (eat("-")) return mul(rat(-1n), exponent());
    return primary();
  }
  function power(): Rat {
    if (eat("-")) return mul(rat(-1n), power());
    if (eat("+")) return power();
    const base = primary();
    if (peek() === "^") {
      i++;
      const e = exponent();
      if (e.d !== 1n || e.n > 64n || e.n < -64n) throw new Error("exponent must be a small whole number");
      let r = rat(1n);
      for (let k = 0n; k < (e.n < 0n ? -e.n : e.n); k++) r = mul(r, base);
      return e.n < 0n ? div(rat(1n), r) : r;
    }
    return base;
  }
  function product(): Rat {
    let v = power();
    for (;;) {
      if (eat("*")) v = mul(v, power());
      else if (eat("/")) v = div(v, power());
      else return v;
    }
  }
  function sum(): Rat {
    let v = product();
    for (;;) {
      if (eat("+")) v = add(v, product());
      else if (eat("-")) v = sub(v, product());
      else return v;
    }
  }
  const out = sum();
  if (peek() !== "") throw new Error(`unexpected "${peek()}" in ${src}`);
  return out;
}

/**
 * A rational as a canonical answer string: "42", "-3.25" when the decimal ends, otherwise "7/3".
 * Used by generators whose answer is the value of an expression; the tests check those answers again with other calculators.
 */
export function formatRat(a: Rat): string {
  if (a.d === 1n) return a.n.toString();
  let d = a.d, twos = 0, fives = 0;
  while (d % 2n === 0n) { d /= 2n; twos++; }
  while (d % 5n === 0n) { d /= 5n; fives++; }
  if (d !== 1n) return `${a.n}/${a.d}`;
  const places = Math.max(twos, fives);
  const scaled = (a.n * 10n ** BigInt(places)) / a.d;
  const neg = scaled < 0n;
  const s = (neg ? -scaled : scaled).toString().padStart(places + 1, "0");
  const frac = s.slice(s.length - places).replace(/0+$/, "");
  return `${neg ? "-" : ""}${s.slice(0, s.length - places)}${frac ? "." + frac : ""}`;
}
