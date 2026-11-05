import { beforeEach, describe, expect, it, vi } from "vitest";
import { routeMessage, PRICING_REPLY_LIVE, PRICING_REPLY_NOT_LIVE, HANDOFF_CHIP } from "@/lib/bot/router";
import { findAnswer } from "@/lib/bot/answers";
import { actReply } from "@/lib/bot/smalltalk";
import type { RawSalesIqPayload, BotResponse } from "@/lib/bot/context";

/**
 * Unit tests for routeMessage() itself — the one thing golden.test.ts
 * deliberately does NOT exercise (see that file's module doc: it only
 * measures the deterministic floor below the router). Every I/O dependency
 * is mocked, so this suite is free and deterministic: no OpenAI, no database,
 * no real next/server after() scope. Covers what the router adds on top of
 * the deterministic layers — pricing (live/not-live/B2B), escalation/handoff
 * (strong vs weak), fallback order (first miss vs second miss, with/without
 * page context), conversational-act handoff, and context completions.
 */

const queueBotLeadMock = vi.hoisted(() => vi.fn());
const logUnansweredMock = vi.hoisted(() => vi.fn());
const touchVisitorMock = vi.hoisted(() => vi.fn());
const changeLeadEmailMock = vi.hoisted(() => vi.fn());
const logEventMock = vi.hoisted(() => vi.fn());
const syncLeadToZohoMock = vi.hoisted(() => vi.fn());
const createAdminClientMock = vi.hoisted(() => vi.fn());
const isAiEnabledMock = vi.hoisted(() => vi.fn());
const tryAiAnswerMock = vi.hoisted(() => vi.fn());

// next/server's after() needs a request context vitest doesn't have — record
// callbacks instead of invoking them, so the real implementation never runs.
// Matches the pattern in lib/forms/handler.test.ts. Tests that care what a
// hook does call drainAfterCallbacks() explicitly; every other test keeps the
// original "scheduled but never run" behaviour.
const afterCallbacks = vi.hoisted(() => [] as Array<() => unknown>);

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (cb: () => unknown) => {
    afterCallbacks.push(cb);
  },
}));

async function drainAfterCallbacks(): Promise<void> {
  const pending = afterCallbacks.splice(0);
  for (const cb of pending) await cb();
}

vi.mock("@/lib/data/server", () => ({
  createAdminClient: createAdminClientMock,
}));

vi.mock("@/lib/crm/sync", () => ({
  syncLeadToZoho: syncLeadToZohoMock,
}));

vi.mock("@/lib/bot/crm", () => ({
  queueBotLead: queueBotLeadMock,
  logUnanswered: logUnansweredMock,
  touchVisitor: touchVisitorMock,
  changeLeadEmail: changeLeadEmailMock,
}));

vi.mock("@/lib/bot/events", () => ({
  logEvent: logEventMock,
}));

vi.mock("@/lib/ai/answer", () => ({
  isAiEnabled: isAiEnabledMock,
  tryAiAnswer: tryAiAnswerMock,
}));

/** Stubs the bot_unanswered count query handleFallback runs to tell first vs second miss. */
function stubUnansweredCount(count: number) {
  createAdminClientMock.mockReturnValue({
    from: () => ({
      select: () => ({
        eq: () => Promise.resolve({ count, error: null }),
      }),
    }),
  });
}

interface PayloadOpts {
  solution?: string;
  audience?: string;
  country?: string;
  email?: string;
  name?: string;
  handler?: "trigger" | "message" | "context";
  contextId?: string;
  answers?: Record<string, unknown>;
  withContext?: boolean;
}

function makePayload(text: string, opts: PayloadOpts = {}): RawSalesIqPayload {
  const withContext = opts.withContext ?? true;
  return {
    handler: opts.handler ?? "message",
    operation: "chat",
    context_id: opts.contextId,
    message: { text },
    visitor: {
      avuid: "visitor-1",
      active_conversation_id: "conv-1",
      email: opts.email,
      name: opts.name,
      country_code: opts.country,
      ...(withContext
        ? {
            custom_info: {
              solution: opts.solution,
              audience: opts.audience,
              country: opts.country,
            },
          }
        : {}),
    },
    ...(opts.answers ? { answers: opts.answers } : {}),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  afterCallbacks.length = 0;
  stubUnansweredCount(0);
  queueBotLeadMock.mockResolvedValue({ leadId: 1, requeued: true });
  syncLeadToZohoMock.mockResolvedValue({ outcome: "synced" });
  changeLeadEmailMock.mockResolvedValue(true);
  isAiEnabledMock.mockReturnValue(false); // deterministic-only unless a test opts in
});

describe("pricing rules", () => {
  it("returns the India-figures reply for a live market", async () => {
    const res = await routeMessage(makePayload("how much does it cost", { country: "IN" }));
    expect(res).toMatchObject({ action: "reply", replies: [PRICING_REPLY_LIVE] });
  });

  it("returns the waitlist reply for a not-live market", async () => {
    const res = await routeMessage(makePayload("how much does it cost", { country: "US" }));
    expect(res).toMatchObject({ action: "reply", replies: [PRICING_REPLY_NOT_LIVE] });
  });

  it("treats an unresolved country as not-live", async () => {
    const res = await routeMessage(makePayload("what are your plans"));
    expect(res).toMatchObject({ action: "reply", replies: [PRICING_REPLY_NOT_LIVE] });
  });

  it("never shows the consumer plan table to a B2B visitor", async () => {
    const enterprise = findAnswer("how much does growqr cost for enterprises");
    expect(enterprise).not.toBeNull(); // sanity: the article this depends on still exists

    const res = await routeMessage(
      makePayload("how much does it cost", { solution: "institutes", country: "IN" }),
    );

    expect(res.action).toBe("reply");
    expect(res.replies).toEqual([enterprise!.text]);
    expect(res.replies?.[0]).not.toContain("₹699");
  });
});

describe("escalation / handoff logic", () => {
  it("auto-forwards a strong, unambiguous request for a human", async () => {
    const res = await routeMessage(makePayload("talk to a human"));
    expect(res).toEqual<BotResponse>({
      action: "forward",
      replies: ["Sure, connecting you with our team now."],
    });
    expect(logEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "handoff_requested" }),
    );
  });

  it("only offers, never forces, a handoff on a weak signal", async () => {
    const res = await routeMessage(makePayload("i need help"));
    expect(res).toEqual<BotResponse>({
      action: "reply",
      replies: ["Would you like me to connect you with our team?"],
      suggestions: [HANDOFF_CHIP],
    });
    // A weak signal must never auto-forward or log a handoff.
    expect(logEventMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "handoff_requested" }),
    );
  });

  it("closes warmly on a decline act instead of offering a handoff (2026-08-03 fix)", async () => {
    // A bare "no thanks" is satisfaction ("anything else?" -> "no thanks"),
    // not dissatisfaction — it must not carry the handoff chip. Genuine
    // frustration is still caught separately by the weak human-request
    // signal test above.
    const res = await routeMessage(makePayload("no thanks"));
    expect(res).toEqual<BotResponse>({
      action: "reply",
      replies: [actReply("decline", "conv-1:no thanks")],
    });
    expect(res.suggestions).toBeUndefined();
  });
});

describe("fallback order", () => {
  const gibberish = "zzzz zzzz zzzz";

  it("asks the visitor to self-identify on a first miss with no website context", async () => {
    stubUnansweredCount(0);
    const res = await routeMessage(makePayload(gibberish, { withContext: false }));
    expect(res.action).toBe("context");
    expect(res.context_id).toBe("audience_self_identify");
  });

  it("offers a rephrase + escalation chip on a first miss with website context", async () => {
    stubUnansweredCount(0);
    const res = await routeMessage(makePayload(gibberish, { solution: "students" }));
    expect(res.action).toBe("reply");
    expect(res.replies).toEqual([
      "I'm not sure I have a good answer for that. Could you rephrase, or pick one below?",
    ]);
    // Regression guard (2026-08-03): the escalation chip must survive even
    // when the page already supplies its full 2 default suggestions — see the
    // fix in handleFallback's chip slicing.
    expect(res.suggestions).toContain(HANDOFF_CHIP);
    expect(res.suggestions?.length).toBeLessThanOrEqual(2);
  });

  it("still guarantees the escalation chip when the page has no default suggestions", async () => {
    stubUnansweredCount(0);
    // Website context present (so this doesn't hit the self-identify branch)
    // but no solution/audience match, e.g. the homepage — no default chips.
    const res = await routeMessage(makePayload(gibberish, { withContext: true }));
    expect(res.suggestions).toEqual([HANDOFF_CHIP]);
  });

  it("offers (never forces) a human on a second miss", async () => {
    stubUnansweredCount(1);
    const res = await routeMessage(makePayload(gibberish, { solution: "students" }));
    expect(res).toEqual<BotResponse>({
      action: "reply",
      replies: ["Still not finding a good answer for that. Would you like me to connect you with our team?"],
      suggestions: [HANDOFF_CHIP],
    });
  });

  it("logs every miss to the KB backlog", async () => {
    await routeMessage(makePayload(gibberish, { solution: "students" }));
    expect(logUnansweredMock).toHaveBeenCalledWith(
      expect.objectContaining({ question: gibberish }),
    );
  });
});

describe("routing intents", () => {
  it("opens the qualification form for a demo request", async () => {
    const res = await routeMessage(makePayload("book a demo"));
    expect(res.action).toBe("context");
    expect(res.context_id).toBe("b2b_qualify_demo_request");
  });

  it("opens the change-email form", async () => {
    const res = await routeMessage(makePayload("change email"));
    expect(res.action).toBe("context");
    expect(res.context_id).toBe("change_email");
  });
});

describe("context completion", () => {
  it("queues a lead and confirms on a completed B2B qualification", async () => {
    const res = await routeMessage(
      makePayload("", {
        handler: "context",
        contextId: "b2b_qualify_demo_request",
        answers: { use_case: "screening candidates", name: "Jane", email: "jane@acme.com", company: "Acme" },
      }),
    );
    expect(res).toEqual<BotResponse>({
      action: "reply",
      replies: ["Thanks! Our team has received your request and will reach out shortly."],
    });
    expect(queueBotLeadMock).toHaveBeenCalledWith(
      expect.objectContaining({ intent: "demo_request", email: "jane@acme.com", company: "Acme" }),
    );
  });

  it("renames a pre-chat-captured lead to the qualification form's email instead of silently keeping the old one (2026-08-03 fix)", async () => {
    const res = await routeMessage(
      makePayload("", {
        handler: "context",
        contextId: "b2b_qualify_demo_request",
        email: "jane@gmail.com", // captured by SalesIQ's own pre-chat form
        answers: {
          use_case: "screening candidates",
          name: "Jane",
          email: "jane@acme.com", // the work email the visitor just typed
          company: "Acme",
        },
      }),
    );
    expect(res.action).toBe("reply");
    expect(changeLeadEmailMock).toHaveBeenCalledWith({
      conversationId: "conv-1",
      email: "jane@acme.com",
    });
    expect(queueBotLeadMock).toHaveBeenCalledWith(
      expect.objectContaining({ email: "jane@acme.com" }),
    );
  });

  it("does not bother renaming when the form's email matches the pre-chat one", async () => {
    await routeMessage(
      makePayload("", {
        handler: "context",
        contextId: "b2b_qualify_demo_request",
        email: "jane@acme.com",
        answers: {
          use_case: "screening candidates",
          name: "Jane",
          email: "jane@acme.com",
          company: "Acme",
        },
      }),
    );
    expect(changeLeadEmailMock).not.toHaveBeenCalled();
  });

  // Migration 0022. A five-message chat used to produce seven Zoho writes,
  // because resolve_bot_lead reset every 'synced' row back to 'pending' and
  // captureB2cLead runs on every message. The RPC now reports whether anything
  // Zoho can see actually changed, and the router is what has to honour it.
  it("skips the Zoho push when the turn changed nothing (requeued=false)", async () => {
    queueBotLeadMock.mockResolvedValueOnce({ leadId: 7, requeued: false });
    await routeMessage(
      makePayload("", {
        handler: "context",
        contextId: "b2b_qualify_demo_request",
        answers: {
          use_case: "screening candidates",
          name: "Jane",
          email: "jane@acme.com",
          company: "Acme",
        },
      }),
    );
    await drainAfterCallbacks();
    expect(queueBotLeadMock).toHaveBeenCalled();
    expect(syncLeadToZohoMock).not.toHaveBeenCalled();
  });

  it("still pushes to Zoho when the turn brought something new", async () => {
    queueBotLeadMock.mockResolvedValueOnce({ leadId: 7, requeued: true });
    await routeMessage(
      makePayload("", {
        handler: "context",
        contextId: "b2b_qualify_demo_request",
        answers: {
          use_case: "screening candidates",
          name: "Jane",
          email: "jane@acme.com",
          company: "Acme",
        },
      }),
    );
    await drainAfterCallbacks();
    expect(syncLeadToZohoMock).toHaveBeenCalledWith("bot_leads", 7);
  });

  it("hands off when the completed context has no usable data", async () => {
    const res = await routeMessage(
      makePayload("", { handler: "context", contextId: "b2b_qualify_demo_request", answers: {} }),
    );
    expect(res.action).toBe("forward");
    expect(queueBotLeadMock).not.toHaveBeenCalled();
  });

  it("routes a self-identified recruiter into the B2B qualification form", async () => {
    const res = await routeMessage(
      makePayload("", {
        handler: "context",
        contextId: "audience_self_identify",
        answers: { audience: "Recruiter" },
      }),
    );
    expect(res.action).toBe("context");
    expect(res.context_id).toBe("b2b_qualify_recruiter_inquiry");
  });

  it("answers pricing directly for a self-identified individual", async () => {
    const res = await routeMessage(
      makePayload("", {
        handler: "context",
        contextId: "audience_self_identify",
        answers: { audience: "Student / Professional" },
        country: "US",
      }),
    );
    expect(res).toMatchObject({ action: "reply", replies: [PRICING_REPLY_NOT_LIVE] });
  });
});

describe("named-country market availability (deterministic, bypasses AI entirely)", () => {
  // Regression guard for the live-confirmed 2026-08-03 bug: a visitor whose
  // OWN market was live asked "is it live in the USA?" and the AI answered
  // "GrowQR is available in the US" — false, since the US isn't live. See
  // lib/bot/market.ts's module doc. AI is enabled in every test here
  // specifically to prove this never reaches it.
  beforeEach(() => {
    isAiEnabledMock.mockReturnValue(true);
  });

  it("answers about the named country, not the visitor's own market", async () => {
    // Visitor's own resolved market is India (live) — the question is about
    // the US (not live). The reply must be about the US.
    const res = await routeMessage(makePayload("Is it live in the USA?", { country: "IN" }));
    expect(res).toMatchObject({
      action: "reply",
      replies: [
        "GrowQR isn't live in the US yet. You can join the waitlist at growqr.ai and we'll email you when it opens.",
      ],
    });
    expect(tryAiAnswerMock).not.toHaveBeenCalled();
  });

  it("answers live for a live country even when the visitor's own market is not-live", async () => {
    const res = await routeMessage(makePayload("is GrowQR live in India", { country: "US" }));
    expect(res).toMatchObject({
      action: "reply",
      replies: ["Yes, GrowQR is live in India. You can sign up at growqr.ai."],
    });
    expect(tryAiAnswerMock).not.toHaveBeenCalled();
  });

  it("falls through to AI for a market question with no named country", async () => {
    tryAiAnswerMock.mockResolvedValue({
      answer: "Sure, is there anything else about GrowQR I can help with?",
      source: "openai",
      mode: "conversational",
      latencyMs: 500,
      usage: null,
      model: "gpt-4.1",
      confidence: "high",
      sourceIds: [],
      rejection: null,
      usedZohoDocs: false,
    });

    await routeMessage(makePayload("is it live here"));
    expect(tryAiAnswerMock).toHaveBeenCalled();
  });
});

describe("AI-first content answering (mocked, no OpenAI spend)", () => {
  beforeEach(() => {
    isAiEnabledMock.mockReturnValue(true);
  });

  it("serves the AI's answer when it accepts", async () => {
    tryAiAnswerMock.mockResolvedValue({
      answer: "GrowQR is a career-readiness platform with AI agents.",
      source: "openai",
      mode: "grounded",
      latencyMs: 900,
      usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 },
      model: "gpt-4.1",
      confidence: "high",
      sourceIds: ["art_1"],
      rejection: null,
      usedZohoDocs: false,
    });

    const res = await routeMessage(makePayload("what is growqr"));
    expect(res.action).toBe("reply");
    expect(res.replies).toEqual(["GrowQR is a career-readiness platform with AI agents."]);
  });

  it("falls through to the deterministic KB when AI declines", async () => {
    tryAiAnswerMock.mockResolvedValue({
      answer: null,
      source: "human",
      mode: null,
      latencyMs: 400,
      usage: null,
      model: null,
      confidence: null,
      sourceIds: [],
      rejection: "model_declined",
      usedZohoDocs: false,
    });

    const res = await routeMessage(makePayload("what is growqr"));
    expect(res.action).toBe("reply");
    // The KB answer for this exact phrasing, per the golden set.
    expect(res.replies?.[0]).toContain("GrowQR");
    expect(tryAiAnswerMock).toHaveBeenCalled();
  });

  it("replies with the fixed off-topic redirect instead of falling through to the KB/miss flow (2026-08-03)", async () => {
    tryAiAnswerMock.mockResolvedValue({
      answer: null,
      source: "human",
      mode: null,
      latencyMs: 400,
      usage: null,
      model: null,
      confidence: null,
      sourceIds: [],
      rejection: "off_topic",
      usedZohoDocs: false,
    });

    const res = await routeMessage(makePayload("who is modi?"));
    expect(res.action).toBe("reply");
    expect(res.replies?.[0]).toMatch(/outside what I can help with/i);
    expect(logUnansweredMock).not.toHaveBeenCalled();
  });

  it("never calls AI for a keyword-routed intent (pricing/demo/human/change_email)", async () => {
    await routeMessage(makePayload("book a demo"));
    await routeMessage(makePayload("how much does it cost"));
    await routeMessage(makePayload("talk to a human"));
    expect(tryAiAnswerMock).not.toHaveBeenCalled();
  });
});
