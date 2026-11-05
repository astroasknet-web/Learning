import { describe, expect, it } from "vitest";
import { parseSession, resolveCountry, resolvePage } from "@/lib/bot/context";

/**
 * These tests exist because of a specific production bug, and the first one is
 * the regression guard for it.
 *
 * conversationId() resolves `active_conversation_id ?? avuid`. On live website
 * traffic active_conversation_id IS present, so it always won — which was
 * correct for a conversation key but was ALSO being used as the visitor key.
 * Every visit therefore produced a new bot_leads row, and with it a duplicate
 * Zoho Task, Note and notification email.
 *
 * The fix is that the two keys are now separate fields. If anyone ever
 * collapses them again, the first test here fails.
 */

/** Shaped after the real payload captured 2026-07-31. */
function payload(visitor: Record<string, unknown> = {}) {
  return {
    handler: "message" as const,
    operation: "chat" as const,
    visitor: {
      active_conversation_id: "227090000000078003",
      avuid: "7f3c9a1e2b8d4c6a",
      name: "Sahil",
      email: "sahil@growqr.ai",
      country: "India",
      country_code: "IN",
      current_page_url: "/solutions/institutes",
      ...visitor,
    },
    message: { text: "hello" },
  };
}

describe("parseSession identity keys", () => {
  it("keeps the conversation key and the visitor key distinct", () => {
    const session = parseSession(payload());

    expect(session.conversationId).toBe("227090000000078003");
    expect(session.avuid).toBe("7f3c9a1e2b8d4c6a");
    // The whole bug in one assertion: these must never be the same value when
    // both are present.
    expect(session.conversationId).not.toBe(session.avuid);
  });

  it("still reads avuid when it is the only id present", () => {
    const session = parseSession(payload({ active_conversation_id: undefined }));
    expect(session.conversationId).toBe("7f3c9a1e2b8d4c6a");
    expect(session.avuid).toBe("7f3c9a1e2b8d4c6a");
  });

  it("reports a missing avuid as null rather than inventing one", () => {
    // Dedupe must degrade to email/conversation matching, not fabricate a
    // device id that would merge unrelated visitors.
    const session = parseSession(payload({ avuid: undefined }));
    expect(session.avuid).toBeNull();
    expect(session.conversationId).toBe("227090000000078003");
  });

  it("falls back to a unique synthetic conversation id, never a shared constant", () => {
    const a = parseSession({ visitor: {} });
    const b = parseSession({ visitor: {} });
    expect(a.conversationId).not.toBe(b.conversationId);
    expect(a.avuid).toBeNull();
  });
});

describe("parseSession visitor fields", () => {
  it("prefers the ISO country_code over the display name", () => {
    // isLiveCountry() expects "IN", not "India" — a country-first order
    // silently broke every region check.
    expect(parseSession(payload()).visitor.country).toBe("IN");
  });

  it("prefers our own custom_info context over SalesIQ's guesses", () => {
    const session = parseSession(
      payload({
        custom_info: { page: "/pricing", country: "AE", solution: "institutes" },
      }),
    );
    expect(resolvePage(session)).toBe("/pricing");
    expect(resolveCountry(session)).toBe("AE");
    expect(session.context?.solution).toBe("institutes");
  });

  it("returns a null context when there is no custom info at all", () => {
    // Social channels carry no website context — callers must be able to tell
    // that apart from "website context with empty values".
    expect(parseSession(payload()).context).toBeNull();
  });
});
