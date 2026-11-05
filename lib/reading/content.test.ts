import { describe, expect, it } from "vitest";
import { EXAM_WORDS, keyDistribution, validatePassage, validateQuestion, wordsIn, type QuestionDraft } from "./content-model";
import { SEED_LEVELS, SEED_PASSAGES } from "./content/levels";
import { SKILLS, QTYPES, DIMENSION_LABEL } from "./taxonomy";
import { isSkill } from "./taxonomy";

describe("seed content bank", () => {
  it("every passage and question passes the validator", () => {
    const issues = SEED_PASSAGES.flatMap(validatePassage).filter((i) => i.level === "error");
    expect(issues).toEqual([]);
  });

  it("has the two starting passages and one passage per level, with unique slugs and references", () => {
    expect(SEED_PASSAGES.filter((p) => p.isDiagnostic)).toHaveLength(2);
    for (const l of SEED_LEVELS) expect(SEED_PASSAGES.some((p) => p.levelKey === l.key), `level ${l.key}`).toBe(true);
    const slugs = SEED_PASSAGES.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    const refs = SEED_PASSAGES.flatMap((p) => p.questions.map((q) => q.ref));
    expect(new Set(refs).size).toBe(refs.length);
  });

  it("gives each level practice, mastery and recall questions, and the starting assessment enough of each skill group", () => {
    for (const p of SEED_PASSAGES) {
      if (p.isDiagnostic) { expect(p.questions.filter((q) => q.mode === "diagnostic").length).toBeGreaterThanOrEqual(8); expect(p.questions.some((q) => q.mode === "recall")).toBe(true); continue; }
      expect(p.questions.filter((q) => q.mode === "practice").length, p.slug).toBeGreaterThanOrEqual(4);
      expect(p.questions.filter((q) => q.mode === "mastery").length, p.slug).toBeGreaterThanOrEqual(4);
      expect(p.questions.filter((q) => q.mode === "recall").length, p.slug).toBeGreaterThanOrEqual(2);
    }
    const diag = SEED_PASSAGES.filter((p) => p.isDiagnostic).flatMap((p) => p.questions.filter((q) => q.mode === "diagnostic"));
    for (const g of ["comprehension", "inference", "vocabulary"] as const) expect(diag.filter((q) => SKILLS[q.skill].group === g).length, g).toBeGreaterThanOrEqual(2);
  });

  it("does not let the key sit in one place", () => {
    const all = SEED_PASSAGES.flatMap((p) => p.questions);
    const d = keyDistribution(all);
    const total = d.reduce((a, b) => a + b, 0);
    for (const c of d) expect(c / total).toBeLessThan(0.45);
    expect(d[2] + d[3]).toBeGreaterThan(0.3 * total);
  });

  it("uses every question format the engine supports", () => {
    const formats = new Set(SEED_PASSAGES.flatMap((p) => p.questions.map((q) => q.format)));
    expect([...formats].sort()).toEqual(["match", "mcq", "short", "tf"]);
  });

  it("passage word counts are within a readable range and difficulty never decreases across levels A to J by more than one step", () => {
    for (const p of SEED_PASSAGES) { const n = wordsIn(p.body); expect(n, p.slug).toBeGreaterThan(150); expect(n, p.slug).toBeLessThan(500); }
    const lv = SEED_LEVELS.map((l) => SEED_PASSAGES.find((p) => p.levelKey === l.key)!.difficulty);
    for (let i = 1; i < lv.length; i++) expect(lv[i] - lv[i - 1]).toBeGreaterThanOrEqual(-1);
  });

  it("no student-facing text names an examination", () => {
    const text = [
      ...SEED_LEVELS.flatMap((l) => [l.name, l.objective, ...l.lesson.objectives, ...l.lesson.lesson, ...l.lesson.tips, l.lesson.completion]),
      ...Object.values(SKILLS).flatMap((s) => [s.label, s.why, s.practice]),
      ...Object.values(QTYPES),
      ...Object.values(DIMENSION_LABEL),
      ...SEED_PASSAGES.flatMap((p) => [p.title, p.body, p.topic, ...p.questions.flatMap((q) => [q.stem, q.explanation, ...(Array.isArray(q.options) ? q.options : [...q.options.left, ...q.options.right])])]),
    ];
    for (const t of text) expect(EXAM_WORDS.test(t), t.slice(0, 60)).toBe(false);
  });

  it("level names follow the neutral names in the specification", () => {
    expect(SEED_LEVELS.map((l) => l.name)).toEqual(["Reading Foundations", "Understanding Main Ideas", "Finding Important Information", "Vocabulary in Context", "Drawing Inferences", "Understanding Arguments", "Advanced Comprehension", "Reading Under Time Constraints", "Complex Passage Analysis", "Advanced Reading Mastery"]);
  });

  it("every skill used exists, and skills used cover each group", () => {
    const used = new Set(SEED_PASSAGES.flatMap((p) => p.questions.map((q) => q.skill)));
    for (const s of used) expect(isSkill(s)).toBe(true);
    expect(new Set([...used].map((s) => SKILLS[s].group))).toEqual(new Set(["comprehension", "inference", "vocabulary", "retention"]));
  });
});

describe("question validator catches ambiguity and bad keys", () => {
  const base: QuestionDraft = { ref: "T-1", mode: "practice", format: "mcq", stem: "What is the main idea of the passage?", options: ["One option", "Another option", "A third option", "A fourth option"], answer: 1, explanation: "Option B is supported because the passage says so, while the others add claims.", skill: "main_idea", qtype: "interpret", difficulty: 2, expectedSecs: 40 };
  const errors = (q: Partial<QuestionDraft>) => validateQuestion({ ...base, ...q }, "passage text").filter((i) => i.level === "error").map((i) => i.message);

  it("accepts a sound question", () => expect(errors({})).toEqual([]));
  it("rejects a key outside the options", () => expect(errors({ answer: 7 }).join()).toMatch(/key is not one of the options/));
  it("rejects duplicate options", () => expect(errors({ options: ["Same", "same", "Other", "Another"] }).join()).toMatch(/identical/));
  it("rejects a missing explanation", () => expect(errors({ explanation: "Because." }).join()).toMatch(/explanation/));
  it("rejects an unknown skill and exam names", () => {
    expect(errors({ skill: "magic" as never }).join()).toMatch(/unknown skill/);
    expect(errors({ stem: "Which strategy helps most on the IELTS reading section?" }).join()).toMatch(/examination/);
  });
  it("rejects a malformed match key and a short answer with no accepted answers", () => {
    expect(errors({ format: "match", options: { left: ["a", "b", "c"], right: ["x", "y", "z"] }, answer: [0, 0, 1] }).join()).toMatch(/pair every left item/);
    expect(errors({ format: "short", options: [], answer: [] }).join()).toMatch(/accepted answer/);
  });
  it("rejects a true/false question that lacks the cannot-be-told option", () => expect(errors({ format: "tf", options: ["True", "False"], answer: 0 }).join()).toMatch(/three options/));
});
