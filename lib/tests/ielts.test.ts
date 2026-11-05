import { describe, expect, it } from "vitest";
import { allQuestions, decodeAnswers, encodeAnswers, grade, isKind, list, load, normText, publicView, QUESTIONS, rawToBand, scriptOf, TOTAL_TESTS, type Kind } from "./ielts";

const KINDS: Kind[] = ["reading", "listening"];

describe("IELTS practice tests", () => {
  it("has 30 tests of 40 questions per skill, numbered 1-40 with an answer for each", () => {
    for (const k of KINDS) {
      expect(list(k)).toHaveLength(TOTAL_TESTS);
      for (let n = 1; n <= TOTAL_TESTS; n++) {
        const qs = allQuestions(load(k, n)!);
        expect(qs.map((q) => q.n), `${k} ${n}`).toEqual(Array.from({ length: QUESTIONS }, (_, i) => i + 1));
        for (const q of qs) expect(String(q.answer ?? "").length, `${k} ${n} Q${q.n}`).toBeGreaterThan(0);
      }
    }
  });
  it("scores the full key as 40/40 band 9 and a blank sheet as 0", () => {
    for (const k of KINDS) {
      for (const n of [1, 15, 30]) {
        const t = load(k, n)!;
        const key = Object.fromEntries(allQuestions(t).map((q) => [String(q.n), String(q.type === "completion" ? (q.accept?.[0] ?? q.answer) : q.answer)]));
        const g = grade(k, t, key);
        expect(g.raw, `${k} ${n}`).toBe(40);
        expect(g.band).toBe(9);
        expect(grade(k, t, {})).toMatchObject({ raw: 0, band: 2 });
      }
    }
  });
  it("marks completion answers on accepted wording and ignores case, spacing and punctuation", () => {
    const t = load("reading", 1)!;
    const q = allQuestions(t).find((x) => x.type === "completion")!;
    const good = String(q.accept![0]).toUpperCase() + " . ";
    expect(grade("reading", t, { [q.n]: good }).rows.find((r) => r.n === q.n)!.right).toBe(true);
    expect(grade("reading", t, { [q.n]: "zzz" }).rows.find((r) => r.n === q.n)!.right).toBe(false);
  });
  it("never sends answers, accepted spellings, explanations or transcripts to the browser", () => {
    for (const k of KINDS) {
      const view = JSON.stringify(publicView(load(k, 3)!));
      expect(view).not.toMatch(/"answer"|"accept"|"explain"|"location"/);
    }
    expect(JSON.stringify(publicView(load("listening", 3)!))).not.toContain('"transcript":[{');
    expect(scriptOf(load("listening", 3)!)).toHaveLength(4);
  });
  it("converts raw scores to indicative bands", () => {
    expect(rawToBand("reading", 30)).toBe(7);
    expect(rawToBand("listening", 32)).toBe(7.5);
    expect(rawToBand("reading", -5)).toBe(2);
    expect(rawToBand("reading", 99)).toBe(9);
    expect(normText("  The  Autumn. ")).toBe("the autumn");
  });
  it("round-trips answers through the URL and rejects junk", () => {
    const a = { "1": "iii", "2": "NOT GIVEN", x: "bad", "3": "   " };
    expect(decodeAnswers(encodeAnswers(a))).toEqual({ "1": "iii", "2": "NOT GIVEN" });
    expect(decodeAnswers("%%%")).toEqual({});
    expect(decodeAnswers("a".repeat(7000))).toEqual({});
    expect(isKind("reading") && !isKind("speaking")).toBe(true);
    expect(load("reading", 0)).toBeNull();
    expect(load("reading", 31)).toBeNull();
  });
});
