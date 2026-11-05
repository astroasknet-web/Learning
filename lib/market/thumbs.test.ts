import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import catalogue from "./data/courses.json";
import { hasThumb, thumbFull, thumbSmall } from "./thumbs";

const dir = path.join(process.cwd(), "public", "course-thumbs");
const courses = (catalogue as unknown as { courses: Array<{ slug: string; title: string }> }).courses;

describe("course thumbnails", () => {
  it("every course in the catalogue has its own 1920x1080 and 640x360 WebP", async () => {
    for (const c of courses) {
      expect(hasThumb(c.slug), c.slug).toBe(true);
      const full = await sharp(path.join(process.cwd(), "public", thumbFull(c.slug))).metadata();
      const small = await sharp(path.join(process.cwd(), "public", thumbSmall(c.slug))).metadata();
      expect([full.format, full.width, full.height], c.slug).toEqual(["webp", 1920, 1080]);
      expect([small.format, small.width, small.height], c.slug).toEqual(["webp", 640, 360]);
    }
  }, 120_000);
  it("the manifest lists every course with its exact title, file, concept and status, and no two share a concept or a file", () => {
    const m = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8")) as { complete: number; missing: string[]; thumbnails: Array<{ id: string; title: string; file: string; concept: string; width: number; height: number; status: string; palette: string }> };
    expect(m.complete).toBe(courses.length);
    expect(m.missing).toEqual([]);
    expect(m.thumbnails.map((t) => t.id)).toEqual(courses.map((c) => c.slug));
    for (const t of m.thumbnails) {
      const c = courses.find((x) => x.slug === t.id)!;
      expect(t.title).toBe(c.title);
      expect([t.width, t.height, t.status]).toEqual([1920, 1080, "generated"]);
      expect(t.file).toBe(`${t.id}.webp`);
    }
    expect(new Set(m.thumbnails.map((t) => t.concept)).size).toBe(courses.length);
    expect(new Set(m.thumbnails.map((t) => t.file)).size).toBe(courses.length);
  });
  it("filenames are lowercase, hyphenated and unique", () => {
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".webp"));
    expect(new Set(files).size).toBe(files.length);
    for (const f of files) expect(f).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*\.webp$/);
  });
});
