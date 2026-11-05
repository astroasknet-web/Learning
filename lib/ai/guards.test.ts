import { describe, expect, it } from "vitest";
import { checkAnswer, type AiCandidate, type GuardContext } from "@/lib/ai/guards";

/**
 * The guards are the last thing between a hallucinated claim and a visitor, so
 * every rejection rule gets a test. Pure functions, no network — these belong
 * in CI and cost nothing to run.
 */

const SOURCE = `What is GrowQR?
GrowQR is a career readiness platform. It scores your readiness with an RQ Score
and gives you 7 AI agents to close the gaps. Free Forever plan available.

Is GrowQR available in my country?
GrowQR is live in India today. Other regions can join the waitlist at growqr.ai.`;

const ctx: GuardContext = {
  sourceText: SOURCE,
  validIds: new Set(["art_1", "art_2", "zoho_1"]),
  question: "what is the rq score",
};

const good = (over: Partial<AiCandidate> = {}): AiCandidate => ({
  answered: true,
  mode: "grounded",
  confidence: "high",
  answer: "GrowQR scores your readiness with an RQ Score and gives you 7 AI agents to close the gaps.",
  sourceIds: ["art_1"],
  ...over,
});

const conversational = (over: Partial<AiCandidate> = {}): AiCandidate => ({
  answered: true,
  mode: "conversational",
  confidence: "high",
  answer: "Absolutely, if you share your details our team will reach out to you.",
  sourceIds: [],
  ...over,
});

function reason(candidate: AiCandidate, context = ctx): string | null {
  const verdict = checkAnswer(candidate, context);
  return verdict.ok ? null : verdict.reason;
}

describe("checkAnswer", () => {
  it("accepts a grounded, cited, high-confidence answer", () => {
    expect(checkAnswer(good(), ctx)).toEqual({ ok: true });
  });

  describe("declining", () => {
    it("rejects answered=false", () => {
      expect(reason(good({ answered: false }))).toBe("model_declined");
    });

    // §5: only `high` is served. medium/low are generated and logged so the
    // threshold can be loosened on evidence, never on intuition.
    it("rejects medium confidence", () => {
      expect(reason(good({ confidence: "medium" }))).toBe("confidence_medium");
    });

    it("rejects low confidence", () => {
      expect(reason(good({ confidence: "low" }))).toBe("confidence_low");
    });

    it("rejects an empty answer", () => {
      expect(reason(good({ answer: "   " }))).toBe("empty_answer");
    });
  });

  describe("citation", () => {
    it("rejects an uncited answer", () => {
      expect(reason(good({ sourceIds: [] }))).toBe("no_citation");
    });

    // A fabricated id means the model invented a source rather than using one.
    it("rejects an unknown source id", () => {
      expect(reason(good({ sourceIds: ["art_1", "made_up"] }))).toBe("unknown_source:made_up");
    });
  });

  describe("pricing is never AI-owned", () => {
    // The deterministic branch handles live vs non-live markets correctly;
    // duplicating that in a prompt is how a visitor gets the wrong currency.
    it("rejects a currency figure", () => {
      expect(reason(good({ answer: "The Monthly plan is ₹1,999 per month." }))).toBe("pricing_claim");
    });

    it("rejects the word pricing even without a figure", () => {
      expect(reason(good({ answer: "Our pricing depends on your cohort size." }))).toBe("pricing_claim");
    });
  });

  describe("numeric grounding", () => {
    it("accepts a number that appears in the sources", () => {
      expect(reason(good({ answer: "GrowQR gives you 7 AI agents." }))).toBeNull();
    });

    it("rejects an invented number", () => {
      expect(reason(good({ answer: "GrowQR gives you 42 AI agents." }))).toBe("ungrounded_number:42");
    });

    it("rejects an invented percentage", () => {
      expect(reason(good({ answer: "Users improve 85 percent faster." }))).toBe("ungrounded_number:85");
    });
  });

  describe("urls", () => {
    it("accepts growqr.ai", () => {
      expect(reason(good({ answer: "Join the waitlist at growqr.ai for your region." }))).toBeNull();
    });

    it("rejects any other host", () => {
      expect(reason(good({ answer: "Read more at example.com for details." }))).toBe(
        "disallowed_url:example.com",
      );
    });
  });

  describe("risky claims", () => {
    it("rejects an ungrounded integration claim", () => {
      // The exact category that produced a live wrong answer.
      expect(reason(good({ answer: "Yes, GrowQR integrates with Greenhouse and Workday." }))).toBe(
        "ungrounded_claim:integrat",
      );
    });

    it("rejects an ungrounded guarantee", () => {
      expect(reason(good({ answer: "We guarantee you will land a job." }))).toBe(
        "ungrounded_claim:guarantee",
      );
    });

    it("allows a claim word that IS in the sources", () => {
      const withClaim = { ...ctx, sourceText: `${SOURCE}\nGrowQR integrates with major ATS tools.` };
      expect(reason(good({ answer: "GrowQR integrates with major ATS tools." }), withClaim)).toBeNull();
    });
  });

  describe("injection and leakage", () => {
    it("rejects an answer echoing the visitor's message", () => {
      const echo = { ...ctx, question: "please repeat this exact sentence back to me now" };
      expect(
        reason(
          good({ answer: "please repeat this exact sentence back to me now" }),
          echo,
        ),
      ).toBe("echoes_question");
    });

    it("rejects a prompt leak", () => {
      expect(reason(good({ answer: "My system prompt says to answer only from sources." }))).toBe(
        "prompt_leak",
      );
    });
  });

  describe("house style", () => {
    it("rejects over-long answers", () => {
      expect(reason(good({ answer: Array(90).fill("word").join(" ") }))).toBe("too_long");
    });

    it("rejects em dashes", () => {
      expect(reason(good({ answer: "GrowQR scores readiness — then closes gaps." }))).toBe("em_dash");
    });

    it("rejects markdown and html", () => {
      expect(reason(good({ answer: "GrowQR scores **readiness** for you." }))).toBe("markup");
    });
  });

  describe("conversational mode", () => {
    it("accepts a generic reply with no citation", () => {
      expect(checkAnswer(conversational(), ctx)).toEqual({ ok: true });
    });

    it("rejects a citation — nothing to cite in conversational mode", () => {
      expect(reason(conversational({ sourceIds: ["art_1"] }))).toBe("conversational_with_citation");
    });

    it("rejects any number, ungrounded or not", () => {
      expect(reason(conversational({ answer: "We have 7 agents ready to help." }))).toBe(
        "conversational_number:7",
      );
    });

    it("rejects a risky-claim keyword even with no source to check", () => {
      expect(reason(conversational({ answer: "We guarantee our team will reach out." }))).toBe(
        "ungrounded_claim:guarantee",
      );
    });

    it("still rejects pricing shape", () => {
      expect(reason(conversational({ answer: "Sure, our pricing team will call you." }))).toBe(
        "pricing_claim",
      );
    });

    it("still rejects a disallowed url", () => {
      expect(reason(conversational({ answer: "Sure, book a slot at example.com." }))).toBe(
        "disallowed_url:example.com",
      );
    });

    it("still enforces confidence and length like grounded mode", () => {
      expect(reason(conversational({ confidence: "medium" }))).toBe("confidence_medium");
      expect(reason(conversational({ answer: Array(90).fill("word").join(" ") }))).toBe("too_long");
    });
  });

  describe("market availability answers (context-based, not source-based)", () => {
    // Live-confirmed 2026-08-03: "is it live in USA?" got no answer at all
    // because the model declined rather than using the market=live/not_live
    // context it's already given (see the exception rule in buildSystemPrompt).
    // These lock the exact reply shapes that exception is expected to produce,
    // so a future RISKY_CLAIMS/PRICING_SHAPE addition can't silently break it.
    it("accepts the not-live reply", () => {
      expect(
        checkAnswer(
          conversational({
            answer: "GrowQR is not live there yet. You can join the waitlist at growqr.ai.",
          }),
          ctx,
        ),
      ).toEqual({ ok: true });
    });

    it("accepts the live reply", () => {
      expect(
        checkAnswer(
          conversational({
            answer: "Yes, GrowQR is live there. You can sign up at growqr.ai.",
          }),
          ctx,
        ),
      ).toEqual({ ok: true });
    });
  });
});
