import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as A from "./catalogue";

/** Parity: the TypeScript fit engine must equal the original PHP Abroad class (php scripts/abroad-golden.php). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const g = JSON.parse(readFileSync(path.join(__dirname, "__golden__", "abroad.json"), "utf8")) as any;
const countries = g.countries as Record<string, A.Country>;
const unis = g.unis as A.University[];

describe("study-abroad engine parity with PHP", () => {
  it("converts scores identically", () => {
    for (const [a, want] of g.conv.index) expect(A.academicIndex(a[0], a[1]), JSON.stringify(a)).toBe(want);
    for (const [a, want] of g.conv.english) expect(A.englishEq(a[0], a[1]), JSON.stringify(a)).toBe(want);
    for (const [n, want] of g.conv.inr) expect(A.inr(n), String(n)).toBe(want);
  });
  it("estimates cost identically", () => {
    for (const [slug, want] of g.cost) {
      const u = unis.find((x) => x.slug === slug)!;
      expect(A.cost(u, countries[u.country_key]), slug).toEqual(want);
    }
  });
  it("labels and scores every university for every profile identically", () => {
    expect(g.fits.length).toBeGreaterThan(9000);
    for (const [pi, slug, want] of g.fits) {
      const u = unis.find((x) => x.slug === slug)!;
      expect(A.fit(g.profiles[pi], u, countries[u.country_key]), `${pi}/${slug}`).toEqual(want);
    }
  });
  it("ranks only universities offering the student's level, best first", () => {
    const p = g.profiles.find((x: { level: string }) => x.level === "UG");
    const r = A.rank(p, unis, countries);
    expect(r.length).toBeGreaterThan(5);
    expect(r.every((u) => u.level_list.includes("UG"))).toBe(true);
    expect(r.map((u) => u.fit.score)).toEqual([...r.map((u) => u.fit.score)].sort((a, b) => b - a));
    expect(A.rank(p, [{ ...unis[0], country_key: "nowhere" }], countries)).toEqual([]);
  });
});
