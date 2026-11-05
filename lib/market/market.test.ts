import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as js from "./job-search";

/** Parity: the TypeScript job search must equal the original PHP JobSearch on the same listings and queries (php scripts/market-golden.php). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const g = JSON.parse(readFileSync(path.join(__dirname, "__golden__", "market.json"), "utf8")) as any;
const jobs = g.jobs as js.SearchJob[];
const fixUrl = (u: string) => u.replace(/^internships\.php/, "/internships");

describe("job search parity with PHP", () => {
  it("has real listings to search", () => expect(jobs.length).toBeGreaterThan(10));
  it("normalizes and splits queries identically", () => {
    for (const c of g.normalize) {
      expect(js.normalize(c.in), c.in).toBe(c.out);
      expect(js.terms(c.in), c.in).toEqual(c.terms);
    }
  });
  it("returns the same jobs, order, scores and modes for every query", () => {
    for (const c of g.search) {
      const r = js.run(jobs, c.q);
      const got = { jobs: r.jobs.map((j) => ({ id: j.id, _score: j._score ?? null, _fields: j._fields ?? null })), terms: r.terms, mode: r.mode, corrected: r.corrected, original: r.original };
      expect(got, JSON.stringify(c.q)).toEqual(c.out);
    }
  });
  it("suggests the same things", () => {
    for (const c of g.suggest) {
      const want = c.out.map((s: js.Suggestion) => ({ ...s, url: fixUrl(s.url) }));
      expect(js.suggest(jobs, c.q, c.limit), JSON.stringify(c.q)).toEqual(want);
    }
  });
  it("highlights identically and escapes", () => {
    for (const c of g.highlight) expect(js.highlight(c.text, c.terms), c.text).toBe(c.out);
  });
});
