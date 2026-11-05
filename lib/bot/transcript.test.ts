import { describe, expect, it } from "vitest";
import { renderTranscript, extractBotText } from "@/lib/bot/transcript";
import type { BotResponse } from "@/lib/bot/context";

/**
 * Pure-function coverage only. flushIdleTranscripts() is exercised against the
 * real database instead (its whole job is a database function plus a Zoho call, and
 * mocking both would only test the mocks); the SQL side — the idle window, the
 * conversation_ids join, the requeue guard — was verified against production
 * when migration 0022 was applied.
 */

const at = (hhmm: string) => `2026-08-06T${hhmm}:00+05:30`;

describe("renderTranscript", () => {
  it("renders both sides in order, with IST timestamps", () => {
    const out = renderTranscript([
      { role: "visitor", content: "which agents we have?", created_at: at("15:07") },
      { role: "bot", content: "GrowQR runs a squad of AI agents.", created_at: at("15:07") },
      { role: "visitor", content: "what vera does for me?", created_at: at("15:09") },
    ]);
    expect(out).toBe(
      "[15:07] Visitor: which agents we have?\n" +
        "[15:07] GrowQR AI: GrowQR runs a squad of AI agents.\n" +
        "[15:09] Visitor: what vera does for me?",
    );
  });

  // Zoho rejects a Note over 32,000 characters outright, and a rejected Note
  // means no transcript at all. Keeping the tail rather than the head is
  // deliberate: what someone asked just before they left is what a rep needs.
  it("truncates a long chat from the front, keeping the end", () => {
    const rows = Array.from({ length: 4000 }, (_, i) => ({
      role: i % 2 ? "bot" : "visitor",
      content: `message ${i} ${"x".repeat(40)}`,
      created_at: at("15:07"),
    }));
    const out = renderTranscript(rows);
    expect(out.length).toBeLessThan(32_000);
    expect(out.startsWith("… earlier messages omitted …")).toBe(true);
    expect(out.endsWith(`message 3999 ${"x".repeat(40)}`)).toBe(true);
  });
});

describe("extractBotText", () => {
  it("takes the plain replies", () => {
    const res: BotResponse = { action: "reply", replies: ["Hi there", "How can I help?"] };
    expect(extractBotText(res)).toEqual(["Hi there", "How can I help?"]);
  });

  // The moment the bot opens a qualification form the action is "context" and
  // the prompt lives inside questions[], not replies. Missing it would leave
  // the bot apparently silent for the whole B2B qualification — the most
  // interesting stretch of the conversation.
  it("takes the prompt out of a context question", () => {
    const res: BotResponse = {
      action: "context",
      context_id: "b2b_qualify_demo_request",
      questions: [
        { name: "use_case", replies: ["What are you hoping to use GrowQR for?"] },
        { name: "email", replies: [{ text: "Your work email?", validate: { type: "email" } }] },
      ],
    };
    expect(extractBotText(res)).toEqual([
      "What are you hoping to use GrowQR for?",
      "Your work email?",
    ]);
  });

  it("returns nothing for a trigger with no output", () => {
    expect(extractBotText({ action: "reply", replies: [] })).toEqual([]);
  });
});
