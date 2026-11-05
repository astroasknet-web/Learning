import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { APIUserAbortError } from "openai";
import { tryAiAnswer } from "@/lib/ai/answer";

/**
 * Mock AI tests — the OpenAI client itself is mocked, so these cost nothing
 * and never touch the network. Verifies tryAiAnswer()'s outcome shape and its
 * delegation to the guards (lib/ai/guards.ts, unit-tested separately) for
 * every branch the real router depends on: grounded answer, conversational
 * answer, decline, timeout, hallucination rejection, no matching source,
 * disabled, and misconfigured.
 *
 * Retrieval (lib/ai/retrieval.ts) is mocked too, so these tests don't depend
 * on the live KB snapshot's content — only on the shape tryAiAnswer builds
 * around whatever retrieval returns.
 */

const createCompletionMock = vi.hoisted(() => vi.fn());
const retrieveKbArticlesMock = vi.hoisted(() => vi.fn());
const retrieveZohoDocsMock = vi.hoisted(() => vi.fn());

vi.mock("openai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("openai")>();
  class MockOpenAI {
    chat = { completions: { create: createCompletionMock } };
    constructor(_opts: unknown) {
      void _opts;
    }
  }
  return { ...actual, default: MockOpenAI };
});

vi.mock("@/lib/ai/retrieval", () => ({
  retrieveKbArticles: retrieveKbArticlesMock,
  retrieveZohoDocs: retrieveZohoDocsMock,
}));

const SOURCE_ARTICLE = {
  id: "art_1",
  title: "What is GrowQR?",
  text: "GrowQR is a career readiness platform. It gives you 7 AI agents to close the gaps.",
  score: 5.2,
};

function completionResponse(body: Record<string, unknown>, overrides: Record<string, unknown> = {}) {
  return {
    choices: [{ message: { content: JSON.stringify(body) } }],
    usage: { prompt_tokens: 500, completion_tokens: 30, total_tokens: 530 },
    model: "gpt-4.1",
    ...overrides,
  };
}

const baseParams = {
  question: "what is growqr",
  solution: null,
  audience: null,
  isLiveMarket: true,
  conversationId: "test-convo-1",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("OPENAI_API_KEY", "sk-test-key-1234567890abcdef");
  vi.stubEnv("OPENAI_MODEL", "gpt-4.1");
  vi.stubEnv("BOT_AI_ENABLED", "true");
  retrieveKbArticlesMock.mockReturnValue([SOURCE_ARTICLE]);
  retrieveZohoDocsMock.mockReturnValue([]);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("tryAiAnswer — eligibility gates (no API call)", () => {
  it("hands off without calling the model when AI is disabled", async () => {
    vi.stubEnv("BOT_AI_ENABLED", "false");
    const outcome = await tryAiAnswer(baseParams);
    expect(outcome).toMatchObject({ answer: null, rejection: "disabled" });
    expect(createCompletionMock).not.toHaveBeenCalled();
  });

  it("hands off without calling the model when misconfigured", async () => {
    vi.stubEnv("OPENAI_API_KEY", "short");
    const outcome = await tryAiAnswer(baseParams);
    expect(outcome).toMatchObject({ answer: null, rejection: "misconfigured" });
    expect(createCompletionMock).not.toHaveBeenCalled();
  });

  it("hands off on a too-short message without calling the model", async () => {
    const outcome = await tryAiAnswer({ ...baseParams, question: "x" });
    expect(outcome).toMatchObject({ answer: null, rejection: "too_short" });
    expect(createCompletionMock).not.toHaveBeenCalled();
  });
});

describe("tryAiAnswer — grounded answer", () => {
  it("serves a cited, high-confidence grounded answer", async () => {
    createCompletionMock.mockResolvedValue(
      completionResponse({
        answered: true,
        mode: "grounded",
        confidence: "high",
        answer: "GrowQR is a career readiness platform with 7 AI agents.",
        source_ids: ["art_1"],
      }),
    );

    const outcome = await tryAiAnswer(baseParams);

    expect(outcome.answer).toBe("GrowQR is a career readiness platform with 7 AI agents.");
    expect(outcome.rejection).toBeNull();
    expect(outcome.mode).toBe("grounded");
    expect(outcome.source).toBe("openai");
    expect(outcome.sourceIds).toEqual(["art_1"]);
    expect(outcome.usage).toEqual({ prompt_tokens: 500, completion_tokens: 30, total_tokens: 530 });
  });
});

describe("tryAiAnswer — conversational answer", () => {
  it("serves an uncited conversational answer", async () => {
    createCompletionMock.mockResolvedValue(
      completionResponse({
        answered: true,
        mode: "conversational",
        confidence: "high",
        answer: "Happy to help, what would you like to know?",
        source_ids: [],
      }),
    );

    const outcome = await tryAiAnswer({ ...baseParams, question: "can someone help me" });

    expect(outcome.answer).toBe("Happy to help, what would you like to know?");
    expect(outcome.mode).toBe("conversational");
    expect(outcome.rejection).toBeNull();
  });
});

describe("tryAiAnswer — AI decline", () => {
  it("hands off when the model declines (answered=false)", async () => {
    createCompletionMock.mockResolvedValue(
      completionResponse({ answered: false, mode: "grounded", confidence: "low", answer: "", source_ids: [] }),
    );

    const outcome = await tryAiAnswer({ ...baseParams, question: "do you integrate with our ats" });

    expect(outcome.answer).toBeNull();
    expect(outcome.rejection).toBe("model_declined");
    expect(outcome.usage?.total_tokens).toBe(530); // usage still logged even on decline
  });
});

describe("tryAiAnswer — off-topic (2026-08-03)", () => {
  it("hands off with rejection off_topic, without validating any model text, when off_topic=true", async () => {
    createCompletionMock.mockResolvedValue(
      completionResponse({
        answered: false,
        mode: "conversational",
        confidence: "high",
        answer: "",
        source_ids: [],
        off_topic: true,
      }),
    );

    const outcome = await tryAiAnswer({ ...baseParams, question: "who is modi?" });

    expect(outcome.answer).toBeNull();
    expect(outcome.rejection).toBe("off_topic");
  });

  it("ignores off_topic=false and evaluates the answer normally", async () => {
    createCompletionMock.mockResolvedValue(
      completionResponse({
        answered: true,
        mode: "grounded",
        confidence: "high",
        answer: "GrowQR is a career readiness platform.",
        source_ids: ["art_1"],
        off_topic: false,
      }),
    );

    const outcome = await tryAiAnswer({ ...baseParams, question: "what is growqr" });

    expect(outcome.answer).toBe("GrowQR is a career readiness platform.");
    expect(outcome.rejection).toBeNull();
  });
});

describe("tryAiAnswer — no matching source", () => {
  it("hands off cleanly when retrieval finds nothing and the model declines", async () => {
    retrieveKbArticlesMock.mockReturnValue([]);
    retrieveZohoDocsMock.mockReturnValue([]);
    createCompletionMock.mockResolvedValue(
      completionResponse({ answered: false, mode: "grounded", confidence: "low", answer: "", source_ids: [] }),
    );

    const outcome = await tryAiAnswer({ ...baseParams, question: "do you have case studies" });

    expect(outcome.answer).toBeNull();
    expect(outcome.rejection).toBe("model_declined");
  });

  it("rejects a citation of a source id that was never retrieved", async () => {
    retrieveKbArticlesMock.mockReturnValue([]);
    retrieveZohoDocsMock.mockReturnValue([]);
    createCompletionMock.mockResolvedValue(
      completionResponse({
        answered: true,
        mode: "grounded",
        confidence: "high",
        answer: "GrowQR gives you 7 AI agents.",
        source_ids: ["art_1"], // fabricated — not in validIds since retrieval returned nothing
      }),
    );

    const outcome = await tryAiAnswer(baseParams);

    expect(outcome.answer).toBeNull();
    expect(outcome.rejection).toBe("unknown_source:art_1");
  });
});

describe("tryAiAnswer — hallucination rejection", () => {
  it("rejects an invented number not present in any retrieved source", async () => {
    createCompletionMock.mockResolvedValue(
      completionResponse({
        answered: true,
        mode: "grounded",
        confidence: "high",
        answer: "GrowQR gives you 42 AI agents.",
        source_ids: ["art_1"],
      }),
    );

    const outcome = await tryAiAnswer(baseParams);

    expect(outcome.answer).toBeNull();
    expect(outcome.rejection).toBe("ungrounded_number:42");
    expect(outcome.mode).toBe("grounded"); // rejection metadata still carries what was attempted
  });

  it("rejects an ungrounded claim keyword", async () => {
    createCompletionMock.mockResolvedValue(
      completionResponse({
        answered: true,
        mode: "grounded",
        confidence: "high",
        answer: "Yes, GrowQR integrates with Greenhouse and Workday.",
        source_ids: ["art_1"],
      }),
    );

    const outcome = await tryAiAnswer({ ...baseParams, question: "does it integrate with our ats" });

    expect(outcome.answer).toBeNull();
    expect(outcome.rejection).toBe("ungrounded_claim:integrat");
  });

  it("rejects a price the deterministic pricing branch must own", async () => {
    createCompletionMock.mockResolvedValue(
      completionResponse({
        answered: true,
        mode: "grounded",
        confidence: "high",
        answer: "The Monthly plan is ₹1,999 per month.",
        source_ids: ["art_1"],
      }),
    );

    const outcome = await tryAiAnswer({ ...baseParams, question: "how much is the monthly plan" });

    expect(outcome.answer).toBeNull();
    expect(outcome.rejection).toBe("pricing_claim");
  });
});

describe("tryAiAnswer — timeout", () => {
  it("classifies an aborted request as a timeout, not a generic error", async () => {
    createCompletionMock.mockRejectedValue(new APIUserAbortError());

    const outcome = await tryAiAnswer(baseParams);

    expect(outcome.answer).toBeNull();
    expect(outcome.rejection).toBe("timeout");
  });
});

describe("tryAiAnswer — API error", () => {
  it("classifies a non-abort failure as api_error", async () => {
    createCompletionMock.mockRejectedValue(new Error("connection reset"));

    const outcome = await tryAiAnswer(baseParams);

    expect(outcome.answer).toBeNull();
    expect(outcome.rejection).toBe("api_error");
  });

  it("hands off when the response body is empty", async () => {
    createCompletionMock.mockResolvedValue({
      choices: [{ message: { content: null } }],
      usage: { prompt_tokens: 10, completion_tokens: 0, total_tokens: 10 },
      model: "gpt-4.1",
    });

    const outcome = await tryAiAnswer(baseParams);

    expect(outcome.answer).toBeNull();
    expect(outcome.rejection).toBe("empty_response");
  });

  it("hands off when the response body is not valid JSON", async () => {
    createCompletionMock.mockResolvedValue({
      choices: [{ message: { content: "not json" } }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      model: "gpt-4.1",
    });

    const outcome = await tryAiAnswer(baseParams);

    expect(outcome.answer).toBeNull();
    expect(outcome.rejection).toBe("unparseable_json");
  });
});

/**
 * Telemetry added 2026-08-03 (no retrieval/prompt behavior changed) — for the
 * two review cases in the AI testing strategy: retrieval quality (top-k
 * scored candidates vs. what got cited) and conversational declines (the
 * model's raw, un-defaulted mode). Consumed by logAiOutcome() in
 * lib/bot/router.ts, which is not exercised here (mocked in router.test.ts) —
 * these tests only pin the AiOutcome fields it reads.
 */
describe("tryAiAnswer — telemetry", () => {
  it("carries the full scored retrieval set regardless of what got cited", async () => {
    createCompletionMock.mockResolvedValue(
      completionResponse({
        answered: true,
        mode: "grounded",
        confidence: "high",
        answer: "GrowQR gives you 7 AI agents.",
        source_ids: ["art_1"],
      }),
    );

    const outcome = await tryAiAnswer(baseParams);

    expect(outcome.retrievedKb).toEqual([SOURCE_ARTICLE]);
  });

  it("still carries retrieval data when the model declines", async () => {
    createCompletionMock.mockResolvedValue(
      completionResponse({ answered: false, mode: "grounded", confidence: "low", answer: "", source_ids: [] }),
    );

    const outcome = await tryAiAnswer(baseParams);

    expect(outcome.rejection).toBe("model_declined");
    expect(outcome.retrievedKb).toEqual([SOURCE_ARTICLE]);
  });

  it("preserves the model's raw mode even on a rejected answer", async () => {
    createCompletionMock.mockResolvedValue(
      completionResponse({
        answered: true,
        mode: "conversational",
        confidence: "high",
        answer: "We guarantee our team will reach out.", // ungrounded_claim rejection
        source_ids: [],
      }),
    );

    const outcome = await tryAiAnswer({ ...baseParams, question: "tell me a joke" });

    expect(outcome.answer).toBeNull();
    expect(outcome.rawMode).toBe("conversational");
  });

  it("reports no retrieval and no raw mode on an eligibility-gate handoff", async () => {
    vi.stubEnv("BOT_AI_ENABLED", "false");
    const outcome = await tryAiAnswer(baseParams);

    expect(outcome.retrievedKb).toEqual([]);
    expect(outcome.rawMode).toBeNull();
  });
});

/**
 * Regression guard for the live-confirmed 2026-08-03 bug (see
 * lib/bot/market.ts's module doc): the model conflated "my own market is
 * live" with "the country named in the question is live." The real fix is
 * the deterministic check in lib/bot/router.ts, which never even reaches
 * here — this only pins that the DEFENSE-IN-DEPTH context wiring (the
 * visitor's own country, named explicitly) actually reaches the prompt sent
 * to the model, so rule 4's "different country" instruction has something to
 * compare against.
 */
describe("tryAiAnswer — visitor country in the prompt (defense in depth)", () => {
  it("names the visitor's own country in the user message sent to the model", async () => {
    createCompletionMock.mockResolvedValue(
      completionResponse({
        answered: true,
        mode: "conversational",
        confidence: "high",
        answer: "GrowQR is not live there yet. You can join the waitlist at growqr.ai.",
        source_ids: [],
      }),
    );

    await tryAiAnswer({ ...baseParams, visitorCountry: "IN", question: "is it live in the USA" });

    const sentMessages = createCompletionMock.mock.calls[0][0].messages;
    const userMessage = sentMessages.find((m: { role: string }) => m.role === "user").content as string;
    expect(userMessage).toContain("visitor's own country: India");
  });

  it("reports the country as unknown rather than omitting it when undetected", async () => {
    createCompletionMock.mockResolvedValue(
      completionResponse({ answered: false, mode: "grounded", confidence: "low", answer: "", source_ids: [] }),
    );

    await tryAiAnswer({ ...baseParams, visitorCountry: null });

    const sentMessages = createCompletionMock.mock.calls[0][0].messages;
    const userMessage = sentMessages.find((m: { role: string }) => m.role === "user").content as string;
    expect(userMessage).toContain("visitor's own country: unknown");
  });
});
