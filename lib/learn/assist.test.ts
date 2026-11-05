import { describe, expect, it } from "vitest";
import { aiAvailable, buildMessages, describeWork, MAX_QUESTION, MAX_WORK_CHARS } from "./assist";
import { findActivity, initialState } from "./activities";
import { emptySheet } from "./sheet/engine";

const act = findActivity("digital-literacy-master", "s2-total-average")!;

describe("learning assistant", () => {
  it("is off unless explicitly enabled with a plausible key", () => {
    expect(aiAvailable({})).toBe(false);
    expect(aiAvailable({ OPENAI_API_KEY: "sk-" + "x".repeat(30) })).toBe(false);
    expect(aiAvailable({ LEARN_AI_ENABLED: "true" })).toBe(false);
    expect(aiAvailable({ LEARN_AI_ENABLED: "true", OPENAI_API_KEY: "short" })).toBe(false);
    expect(aiAvailable({ LEARN_AI_ENABLED: "true", OPENAI_API_KEY: "sk-" + "x".repeat(30) })).toBe(true);
  });
  it("tells the model it has NOT seen the student's work when none was shared", () => {
    const m = buildMessages({ activity: act, question: "What is a range?", level: "beginner", work: null });
    expect(m[0].content).toMatch(/NOT shared their work/);
    expect(m[0].content).toMatch(/Never say or imply that you checked/);
    expect(m[1].content).not.toContain('"""');
    expect(m[1].content).toContain("Calculate total and average");
  });
  it("includes the shared work, labelled as text only, and says the assistant does not mark it", () => {
    const m = buildMessages({ activity: act, question: "Is my formula right?", level: "intermediate", work: "E2: =SUM(B2:C2) -> 137" });
    expect(m[0].content).toMatch(/chose to share a text copy/);
    expect(m[0].content).toMatch(/do not mark it/);
    expect(m[0].content).toMatch(/intermediate learner/);
    expect(m[1].content).toContain("E2: =SUM(B2:C2) -> 137");
  });
  it("asks for hints first, keeps to the course and protects personal details", () => {
    const sys = buildMessages({ activity: null, question: "hi there", level: "beginner", work: null })[0].content;
    expect(sys).toMatch(/Give hints first/);
    expect(sys).toMatch(/only help with the course/i);
    expect(sys).toMatch(/passwords, or ID numbers|ID numbers/);
  });
  it("cuts long questions and long work", () => {
    const m = buildMessages({ activity: act, question: "q".repeat(5000), level: "beginner", work: null });
    expect(m[1].content.length).toBeLessThan(MAX_QUESTION + 600);
    const big = { kind: "word" as const, html: "<p>" + "word ".repeat(5000) + "</p>" };
    expect(describeWork(big).length).toBeLessThanOrEqual(MAX_WORK_CHARS);
  });
  it("describes sheets with formulas and their results, slides and answers as plain text", () => {
    const st = initialState(act) as { kind: "sheet"; sheet: ReturnType<typeof emptySheet> };
    st.sheet.cells.E2 = "=SUM(B2:D2)";
    const d = describeWork(st);
    expect(d).toContain("E2: =SUM(B2:D2) -> 217");
    expect(d).toContain("A1: Student");
    const slides = describeWork({ kind: "slides", deck: { theme: "clean", slides: [{ id: "a", layout: "title", title: "Hi", body: "- one\n- two", body2: "", shapes: [] }] } });
    expect(slides).toBe("Slide 1 (title): Hi | one; two");
    expect(describeWork({ kind: "classify", answers: { i1: "input" } })).toBe("i1: input");
  });
  it("the route answers 503 (and does nothing else) when AI is not enabled", async () => {
    const { POST } = await import("@/app/api/learn/assist/route");
    const res = await POST(new Request("http://x/api/learn/assist", { method: "POST", body: "{}" }));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/lesson works without it/);
  });
});
