import { describe, expect, it } from "vitest";
import { searchBundled } from "./college-list";

describe("bundled college search", () => {
  it("needs two characters", () => {
    expect(searchBundled("a")).toEqual([]);
    expect(searchBundled("  ")).toEqual([]);
  });
  it("puts names that start with the text first", () => {
    const r = searchBundled("vellore");
    expect(r[0]).toMatch(/^Vellore/);
    expect(r).toContain("Vellore Institute of Technology");
  });
  it("matches words in any order position and ignores case and punctuation", () => {
    expect(searchBundled("bits pilani")).toContain("Birla Institute of Technology and Science - BITS Pilani");
    expect(searchBundled("IIT BOMBAY")).toContain("Indian Institute of Technology - IIT Bombay");
    expect(searchBundled("st. xavier")).toContain("St. Xaviers College");
  });
  it("finds the text inside a name and caps the result", () => {
    expect(searchBundled("engineering", 5)).toHaveLength(5);
    expect(searchBundled("zzzzqq")).toEqual([]);
  });
  it("shows & rather than &amp;", () => {
    expect(searchBundled("mysore medical")[0]).toBe("Mysore Medical College & Research Institute");
  });
});
