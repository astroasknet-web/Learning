import { add, eq, parseDecimal, rat, sub, toNumber, type Rat } from "./expr";
import type { Question } from "./types";

/**
 * Marking. A numeric response may be written as 1,234 or 0.5 or 3/4 or 1 1/2 or 50%; money signs and the question's unit are ignored.
 * An exact question is correct only when the value is exactly right; a question with a tolerance accepts anything within it.
 */
export function parseResponse(raw: string, unit?: string): Rat | null {
  let s = raw.trim().toLowerCase().replace(/[−–]/g, "-");
  if (!s || s.length > 40) return null;
  s = s.replace(/^[₹$£€]\s*/, "");
  if (unit) {
    const u = unit.toLowerCase();
    if (s.endsWith(u)) s = s.slice(0, s.length - u.length).trim();
  }
  s = s.replace(/%$/, "").trim();
  const mixed = /^([+-]?)(\d+)\s+(\d+)\s*\/\s*(\d+)$/.exec(s);
  if (mixed) {
    const d = BigInt(mixed[4]);
    if (d === 0n) return null;
    const v = add(rat(BigInt(mixed[2])), rat(BigInt(mixed[3]), d));
    return mixed[1] === "-" ? sub(rat(0n), v) : v;
  }
  s = s.replace(/\s+/g, "");
  if (/^[+-]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, "");
  const frac = /^([+-]?\d+)\/(\d+)$/.exec(s);
  if (frac) {
    const d = BigInt(frac[2]);
    return d === 0n ? null : rat(BigInt(frac[1]), d);
  }
  return parseDecimal(s);
}

export interface Marked { correct: boolean; parsed: boolean }

export function mark(q: Pick<Question, "kind" | "answer" | "tol" | "lowest" | "unit">, response: string): Marked {
  if (q.kind === "choice") return { correct: response.trim().toLowerCase() === q.answer.trim().toLowerCase(), parsed: true };
  if (q.kind === "text") return { correct: response.replace(/\s+/g, "").toLowerCase() === q.answer.replace(/\s+/g, "").toLowerCase(), parsed: true };
  const got = parseResponse(response, q.unit);
  if (!got) return { correct: false, parsed: false };
  const want = parseResponse(q.answer);
  if (!want) throw new Error(`question answer is not a number: ${q.answer}`);
  if (q.tol !== undefined) return { correct: Math.abs(toNumber(got) - toNumber(want)) <= q.tol + 1e-9, parsed: true };
  if (!eq(got, want)) return { correct: false, parsed: true };
  if (q.lowest) {
    // The student must also have written it in lowest terms: "6/8" is the right value but not simplified.
    const f = /^\s*([+-]?\d+)\s*\/\s*(\d+)\s*$/.exec(response);
    if (f) {
      const gcd = (a: bigint, b: bigint): bigint => { a = a < 0n ? -a : a; while (b) [a, b] = [b, a % b]; return a; };
      if (gcd(BigInt(f[1]), BigInt(f[2])) !== 1n) return { correct: false, parsed: true };
    } else if (!/^\s*[+-]?\d+\s*$/.test(response)) return { correct: false, parsed: true };
  }
  return { correct: true, parsed: true };
}

