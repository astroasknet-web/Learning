import { describe, expect, it } from "vitest";
import data from "./essays.json";
import { classifyQuestion, DEFAULT_FREE_ESSAYS, ESSAY_META, essaySlug, THEMES } from "./meta";
import { isQType, isSkill } from "../taxonomy";

interface E { n: number; title: string; body: string; words: number; questions: Array<{ n: number; question: string; options: string[] | null; answer: string | null; explanation: string }> }
const essays = data as unknown as E[];

describe("the 30 essay tests as normalised", () => {
  it("has thirty essays numbered 1 to 30 with ten questions each and four distinct options", () => {
    expect(essays.map((e) => e.n)).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
    for (const e of essays) {
      expect(e.questions, `test ${e.n}`).toHaveLength(10);
      expect(e.title.length, `test ${e.n} title`).toBeGreaterThan(8);
      expect(e.body.length, `test ${e.n} body`).toBeGreaterThan(2500);
      expect(e.body, `test ${e.n} must not contain pasted questions`).not.toMatch(/\nQ1\.|Answer:\s*[A-D]/);
      for (const q of e.questions) {
        expect(q.options, `${e.n}.${q.n}`).toHaveLength(4);
        expect(new Set(q.options!.map((o) => o.trim().toLowerCase())).size, `${e.n}.${q.n} distinct`).toBe(4);
        expect("ABCD").toContain(q.answer);
        expect(q.explanation.length, `${e.n}.${q.n} explanation`).toBeGreaterThan(30);
        expect(q.question.length).toBeGreaterThan(15);
      }
    }
  });

  it("spreads the correct answers over all four positions instead of favouring one", () => {
    const d: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
    for (const e of essays) for (const q of e.questions) d[q.answer!]++;
    const total = 300;
    for (const k of Object.keys(d)) { expect(d[k] / total).toBeGreaterThan(0.18); expect(d[k] / total).toBeLessThan(0.34); }
    for (const e of essays) { const c = e.questions.filter((q) => q.answer === "B").length; expect(c, `test ${e.n} should not be almost all B`).toBeLessThan(7); }
  });

  it("has metadata for every test, valid themes and exams, three free samples, and unique slugs", () => {
    expect(ESSAY_META.map((m) => m.n)).toEqual(essays.map((e) => e.n));
    for (const m of ESSAY_META) { expect(THEMES.some((t) => t.id === m.theme)).toBe(true); expect(m.exams.length).toBeGreaterThanOrEqual(2); }
    expect(DEFAULT_FREE_ESSAYS).toHaveLength(3);
    const slugs = essays.map((e) => essaySlug(e.n, e.title));
    expect(new Set(slugs).size).toBe(30);
    for (const s of slugs) expect(s).toMatch(/^essay-\d\d-[a-z0-9-]+$/);
  });

  it("names no exam as a learning label inside the question wording a student sees in the Studio", () => {
    for (const e of essays) for (const q of e.questions) expect(q.question).not.toMatch(/\b(IELTS|TOEFL)\b/);
  });
});

describe("question classification", () => {
  const c = (q: string) => classifyQuestion(q, ["one option", "another option here", "a third option", "fourth"]);
  it("recognises the main kinds of question from their wording", () => {
    expect(c("Which of the following best captures the central theme of the essay?")).toMatchObject({ skill: "main_idea" });
    expect(c("What can be inferred about subsidies from the essay?")).toMatchObject({ skill: "inference", qtype: "infer" });
    expect(c("The author's tone towards the scheme is best described as")).toMatchObject({ skill: "purpose_tone" });
    expect(c("The word 'precipice' as used in the essay means")).toMatchObject({ skill: "vocab_context" });
    expect(c("Which of the following is the main reason for groundwater depletion?")).toMatchObject({ skill: "relationships" });
    expect(c("Which of the following would weaken the author's argument?")).toMatchObject({ skill: "arguments" });
    expect(c("With reference to the budget, consider the following statements: 1. A 2. B Which of the statements given above is/are correct?")).toMatchObject({ qtype: "multi_evidence", difficulty: 3 });
    expect(c("Which of the following is NOT a consequence mentioned?")).toMatchObject({ qtype: "negation" });
    expect(c("Which year was the scheme launched?")).toMatchObject({ skill: "details", qtype: "locate" });
  });
  it("always returns a known skill, type, difficulty and a sensible guide time", () => {
    for (const e of essays) for (const q of e.questions) {
      const r = classifyQuestion(q.question, q.options!);
      expect(isSkill(r.skill)).toBe(true); expect(isQType(r.qtype)).toBe(true);
      expect([1, 2, 3]).toContain(r.difficulty);
      expect(r.expectedSecs).toBeGreaterThanOrEqual(35); expect(r.expectedSecs).toBeLessThanOrEqual(120);
    }
  });
  it("tags a useful mix of skills across the bank rather than one skill for everything", () => {
    const seen = new Set<string>();
    for (const e of essays) for (const q of e.questions) seen.add(classifyQuestion(q.question, q.options!).skill);
    expect(seen.size).toBeGreaterThanOrEqual(5);
  });
});
