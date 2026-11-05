import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { isScored, scoreText, setNowYear } from "./index";

/**
 * Parity test: the TypeScript engine must return the SAME result as the original PHP engine on every fixture.
 * Golden results come from `php scripts/qrscore-golden.php`. Numbers must match to 1e-9; an empty PHP array and an empty
 * JS object are the same thing in JSON, so they are treated as equal.
 */
const dir = path.join(__dirname, "__fixtures__");
const golden = JSON.parse(readFileSync(path.join(__dirname, "__golden__", "results.json"), "utf8")) as { year: number; cases: Record<string, unknown> };

function diff(a: unknown, b: unknown, at: string, out: string[]): void {
  if (out.length >= 12) return;
  const empty = (v: unknown) => (Array.isArray(v) && v.length === 0) || (v !== null && typeof v === "object" && !Array.isArray(v) && Object.keys(v as object).length === 0);
  if (empty(a) && empty(b)) return;
  if (typeof a === "number" && typeof b === "number") {
    if (Math.abs(a - b) > 1e-9) out.push(`${at}: ts=${a} php=${b}`);
    return;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) out.push(`${at}: length ts=${a.length} php=${b.length}`);
    for (let i = 0; i < Math.min(a.length, b.length); i++) diff(a[i], b[i], `${at}[${i}]`, out);
    return;
  }
  if (a !== null && b !== null && typeof a === "object" && typeof b === "object" && !Array.isArray(a) && !Array.isArray(b)) {
    const ka = Object.keys(a as object);
    const kb = Object.keys(b as object);
    for (const k of new Set([...ka, ...kb])) {
      if (!(k in (a as object))) out.push(`${at}.${k}: missing in ts`);
      else if (!(k in (b as object))) out.push(`${at}.${k}: missing in php`);
      else diff((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${at}.${k}`, out);
    }
    return;
  }
  if (a !== b) out.push(`${at}: ts=${JSON.stringify(a)} php=${JSON.stringify(b)}`);
}

describe("TypeScript engine matches the PHP engine", () => {
  beforeAll(() => setNowYear(golden.year));

  const names = [...readdirSync(dir).filter((f) => f.endsWith(".txt")), ...readdirSync(path.join(dir, "variants")).map((f) => "variants/" + f)].sort();
  it("has fixtures and golden results for all of them", () => {
    expect(names.length).toBeGreaterThan(100);
    for (const n of names) expect(golden.cases[n], n).toBeDefined();
  });

  for (const name of names) {
    it(name, () => {
      const text = readFileSync(path.join(dir, name), "utf8");
      const ts = scoreText(text) as unknown as Record<string, unknown> & { extraction: Record<string, unknown> };
      if (isScored(ts as never)) delete ts.extraction.text; // the golden files leave the input text out
      const out: string[] = [];
      diff(JSON.parse(JSON.stringify(ts)), golden.cases[name], "", out);
      expect(out, out.join("\n")).toEqual([]);
    });
  }
});
