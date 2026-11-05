import { describe, expect, it } from "vitest";
import { decodeAnswers, encodeAnswers, grade, loadBank, mock, publicView, QUESTIONS, TOTAL_TESTS } from "./gre";

describe("GRE Quant practice tests", () => {
  it("loads the bank: 1,040 four-option questions with a valid key", () => {
    const b = loadBank();
    expect(b).toHaveLength(1040);
    expect(b.every((q) => q.options.length === 4 && q.correct >= 0 && q.correct < 4 && q.q.length > 5)).toBe(true);
  });
  it("builds 30 mocks of 27 questions that never share a question and cover many topics", () => {
    const seen = new Set<number>();
    for (let n = 1; n <= TOTAL_TESTS; n++) {
      const qs = mock(n);
      expect(qs, `mock ${n}`).toHaveLength(QUESTIONS);
      expect(new Set(qs.map((q) => q.topic)).size).toBeGreaterThanOrEqual(26);
      for (const q of qs) {
        expect(seen.has(q.id), `repeat ${q.id}`).toBe(false);
        seen.add(q.id);
      }
    }
    expect(seen.size).toBe(30 * QUESTIONS);
    expect(mock(5).map((q) => q.id)).toEqual(mock(5).map((q) => q.id));
    expect(mock(0)).toEqual([]);
    expect(mock(31)).toEqual([]);
  });
  it("never exposes the key in the public view", () => {
    expect(JSON.stringify(publicView(mock(3)))).not.toMatch(/correct|explain|topic/);
  });
  it("grades by id, ignores foreign ids, and estimates a scaled score", () => {
    const qs = mock(2);
    const all = Object.fromEntries(qs.map((q) => [String(q.id), q.correct]));
    expect(grade(2, all)).toMatchObject({ raw: 27, total: 27, percent: 100, scaled: 170 });
    expect(grade(2, {})).toMatchObject({ raw: 0, scaled: 130 });
    const forged = { ...all, "99999": 1 };
    expect(grade(2, forged).raw).toBe(27);
    const half = Object.fromEntries(qs.slice(0, 14).map((q) => [String(q.id), q.correct]));
    expect(grade(2, half).raw).toBe(14);
    expect(grade(2, { [String(qs[0].id)]: 9 }).raw).toBe(0);
  });
  it("round-trips answers through the URL and rejects junk", () => {
    expect(decodeAnswers(encodeAnswers({ "12": 3, "x": 1, "13": 7 } as never))).toEqual({ "12": 3 });
    expect(decodeAnswers("%%%")).toEqual({});
  });
});
