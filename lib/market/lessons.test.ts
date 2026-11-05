import { describe, expect, it } from "vitest";
import catalogue from "./data/courses.json";
import { cleanHtml, gradeQuiz, isNative, nativeCourse, nativeSlugs, stepFor } from "./lessons";

describe("native lessons", () => {
  it("every native course is in the catalogue with a matching module count", () => {
    for (const slug of nativeSlugs()) {
      const row = catalogue.courses.find((c) => c.slug === slug);
      expect(row, slug).toBeTruthy();
      expect(row!.modules).toBe(nativeCourse(slug)!.modules.length);
    }
  });
  it("every module has lessons and a well-formed quiz", () => {
    for (const slug of nativeSlugs()) {
      const nc = nativeCourse(slug)!;
      for (const m of [...nc.modules]) {
        expect(m.topics.length, `${slug}/${m.slug}`).toBeGreaterThan(0);
        for (const q of m.quiz?.questions ?? []) {
          expect(q.correct).toBeGreaterThanOrEqual(0);
          expect(q.correct).toBeLessThan(q.options.length);
        }
      }
      expect(nc.capstone.quiz?.questions.length ?? 0).toBeGreaterThan(0);
    }
  });
  it("maps steps to checkpoints, capstone last", () => {
    const nc = nativeCourse("digital-literacy-master")!;
    expect(stepFor(nc, nc.modules[0].slug)?.index).toBe(0);
    expect(stepFor(nc, "capstone")).toMatchObject({ index: nc.modules.length, capstone: true });
    expect(stepFor(nc, "nope")).toBeNull();
    expect(isNative("python-foundations")).toBe(false);
  });
  it("grades on the stored key and ignores bad picks", () => {
    const quiz = { pass: 60, questions: [1, 2, 3, 4, 5].map((n) => ({ text: "q" + n, options: ["a", "b", "c"], correct: 1, explanation: "" })) };
    expect(gradeQuiz(quiz, [1, 1, 1, 0, null])).toMatchObject({ score: 3, percent: 60, passed: true });
    expect(gradeQuiz(quiz, [1, 1, 9, -1, 1.5 as number])).toMatchObject({ score: 2, passed: false });
  });
  it("strips scripts, handlers and javascript: links", () => {
    const out = cleanHtml('<p onclick="x()">hi</p><script>alert(1)</script><a href="javascript:alert(1)">l</a><iframe src="x"></iframe>');
    expect(out).not.toMatch(/script|onclick|javascript:|iframe/i);
    expect(out).toContain("hi");
  });
});
