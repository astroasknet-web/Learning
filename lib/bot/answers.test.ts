import { describe, expect, it } from "vitest";
import { findAnswer, hasSubstance, kbSize, trimToWordLimit } from "@/lib/bot/answers";

/**
 * These lock in the scoring constants in answers.ts. Every case below is a
 * defect that was actually observed while tuning — the weights are balanced
 * against each other, so a change that fixes one query usually breaks another
 * (raising the definition bonus silently killed context prioritisation once).
 * If you retune, expect to run these.
 */

describe("kb snapshot", () => {
  it("is populated", () => {
    expect(kbSize()).toBeGreaterThan(20);
  });
});

describe("findAnswer — informational questions", () => {
  it("answers a definition query with the defining article, not one that merely mentions it", () => {
    // Regression: returned "Can GrowQR help me get a job?" (tie on the single
    // token "growqr", winner was arbitrary).
    expect(findAnswer("what is growqr")?.title).toBe("What is GrowQR?");
  });

  it("prefers the RQ definition over the how-to-improve article", () => {
    // Regression: "How do I improve my RQ Score?" won because it contains both
    // "rq" and "score", while the definition title omits "score".
    expect(findAnswer("what is rq score")?.title).toBe("What is RQ (Readiness Quotient)?");
  });

  it("distinguishes personal from organisational data privacy", () => {
    // Regression: "my" was a stopword, so the enterprise article won.
    expect(findAnswer("is my data secure")?.title).toBe("How is my personal data protected?");
    expect(findAnswer("how is our organisation data secured")?.title).toBe(
      "How is our organisation's data secured?",
    );
  });

  it("matches other core informational questions", () => {
    expect(findAnswer("what is the refund policy")?.title).toBe("What is the refund policy?");
    expect(findAnswer("how is this different from chatgpt")?.title).toBe(
      "How is GrowQR different from ChatGPT?",
    );
    expect(findAnswer("what agents do you have")?.title).toBe("What AI agents does GrowQR offer?");
  });
});

describe("findAnswer — page context prioritisation", () => {
  it("routes a vague question to the article for the visitor's solution page", () => {
    expect(findAnswer("tell me about growqr", { solution: "institutes", audience: "Institute" })?.title).toBe(
      "Does GrowQR work for universities and institutes?",
    );
    expect(findAnswer("tell me about growqr", { solution: "recruiters", audience: "Recruiter" })?.title).toBe(
      "What do recruiters get from GrowQR?",
    );
  });

  it("still answers an explicit definition query with the definition regardless of page", () => {
    // Deliberate: "what is growqr" is a direct question with a direct answer.
    // Context breaks ties on vague questions, it does not override intent.
    expect(findAnswer("what is growqr", { solution: "institutes", audience: "Institute" })?.title).toBe(
      "What is GrowQR?",
    );
  });

  it("never lifts an irrelevant article past the threshold on context alone", () => {
    expect(findAnswer("asdkjfh qwerty nonsense", { solution: "institutes" })).toBeNull();
  });
});

describe("findAnswer — refusing to answer", () => {
  it("returns null for gibberish and off-topic questions", () => {
    expect(findAnswer("asdkjfh qwerty nonsense")).toBeNull();
    expect(findAnswer("what's the weather in paris")).toBeNull();
    expect(findAnswer("")).toBeNull();
  });
});

describe("hasSubstance", () => {
  it("rejects greetings and filler that must never open a qualification form", () => {
    // Observed live: "hi" on /solutions/institutes fell through to the page
    // context tiebreak and opened a 5-question lead form, which then ate the
    // visitor's real question as the first answer.
    for (const filler of ["hi", "hello", "hey", "ok", "thanks", "  ", "so"]) {
      expect(hasSubstance(filler)).toBe(false);
    }
  });

  it("accepts anything with a topical token", () => {
    for (const real of ["pricing", "tell me about growqr", "we need placements"]) {
      expect(hasSubstance(real)).toBe(true);
    }
  });
});

describe("trimToWordLimit", () => {
  it("leaves short text untouched", () => {
    expect(trimToWordLimit("one two three", 10)).toBe("one two three");
  });

  it("cuts at a sentence boundary when one falls late enough to keep most of the text", () => {
    const text = "One two three four five six. Seven eight nine ten eleven twelve thirteen.";
    expect(trimToWordLimit(text, 8)).toBe("One two three four five six.");
  });

  it("ellipsizes when no late sentence boundary exists", () => {
    const text = "one two three four five six seven eight nine ten eleven twelve";
    expect(trimToWordLimit(text, 5)).toBe("one two three four five…");
  });

  it("keeps every snapshot answer within the house limit", () => {
    for (const q of ["what is growqr", "what is the refund policy", "what agents do you have"]) {
      const answer = findAnswer(q);
      expect(answer).not.toBeNull();
      expect(answer!.text.split(/\s+/).length).toBeLessThanOrEqual(150);
    }
  });
});
