import { describe, expect, it } from "vitest";
import { cleanHtml, nativeCourse, nativeSlugs } from "../../market/lessons";
import { decodeSpec, validateSpec } from "./engine";
import type { WidgetSpec } from "./types";

const slugs = nativeSlugs().filter((s) => nativeCourse(s)?.landing);
const RE = /<div class="cw-widget-slot" data-cw-widget="([a-z]+)" data-spec="([A-Za-z0-9+/=]+)"/g;

describe("interactive widgets in university courses", () => {
  it("has at least one university course to check", () => expect(slugs.length).toBeGreaterThan(0));

  for (const slug of slugs) {
    const nc = nativeCourse(slug)!;
    it(`${slug}: every lesson has a valid quick check and complete button, and every spec validates`, () => {
      const ids = new Set<string>();
      for (const m of nc.modules) for (const t of m.topics) {
        const html = cleanHtml(t.html); // must survive the real sanitiser
        const specs = [...html.matchAll(RE)].map((x) => ({ type: x[1], spec: decodeSpec(x[2]) as WidgetSpec }));
        expect(specs.some((s) => s.type === "complete"), `${t.slug}: complete button`).toBe(true);
        expect(specs.some((s) => s.type === "quiz"), `${t.slug}: quick check`).toBe(true);
        for (const s of specs) {
          expect(s.spec.type, t.slug).toBe(s.type);
          expect(validateSpec(s.spec), `${t.slug} / ${s.spec.id}`).toEqual([]);
          if (s.type !== "complete") { expect(ids.has(s.spec.id), `duplicate widget id ${s.spec.id}`).toBe(false); ids.add(s.spec.id); }
        }
      }
    });
  }
});
