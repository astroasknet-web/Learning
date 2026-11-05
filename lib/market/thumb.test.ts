import { describe, expect, it } from "vitest";
import catalogue from "./data/courses.json";
import glyphs from "./data/course-glyphs.json";
import { darken, hash, thumbSpec } from "./thumb";

const specs = catalogue.courses.map((c) => ({ slug: c.slug, cat: c.cat, ...thumbSpec(c.slug, c.icon, catalogue.categories[c.cat as keyof typeof catalogue.categories].c1 ?? "#4338ca", catalogue.categories[c.cat as keyof typeof catalogue.categories].c2 ?? "#818cf8") }));

describe("course cover art", () => {
  it("has a drawn glyph for every icon used by a course", () => {
    for (const c of catalogue.courses) expect((glyphs as Record<string, string>)[c.icon], `${c.slug} uses icon ${c.icon}`).toBeTruthy();
  });
  it("is deterministic", () => {
    expect(thumbSpec("a", "code", "#2563eb", "#60a5fa")).toEqual(thumbSpec("a", "code", "#2563eb", "#60a5fa"));
    expect(hash("python-foundations")).toBe(hash("python-foundations"));
  });
  it("gives (nearly) every course a different cover, including inside one category", () => {
    const sigs = new Set(specs.map((s) => s.signature + "|" + s.shapes.map((x) => `${x.x},${x.y}`).join(";")));
    expect(sigs.size).toBe(specs.length); // exact artwork differs for all 120
    const visual = new Set(specs.map((s) => s.signature + "|" + s.cat));
    expect(visual.size / specs.length).toBeGreaterThan(0.95); // glyph + pattern + angle + side + colours: almost no two look alike
    const blockchain = specs.filter((s) => s.cat === "blockchain");
    expect(new Set(blockchain.map((s) => s.signature)).size).toBeGreaterThanOrEqual(blockchain.length - 1); // the 18 that used to be identical
  });
  it("darkens colours safely so white text stays readable", () => {
    expect(darken("#ffffff", 0.5)).toBe("#808080");
    expect(darken("#E98A1E", 0.38)).toMatch(/^#[0-9a-f]{6}$/);
    expect(darken("not-a-colour", 0.4)).toBe("#334155");
    const lum = (hex: string) => { const n = parseInt(hex.slice(1), 16); const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f((n >> 16) & 255) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255); };
    for (const s of specs) expect(1.05 / (lum(s.from) + 0.05), s.slug).toBeGreaterThan(3.5); // white on the gradient start colour
  });
});
