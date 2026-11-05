/**
 * Parses the raw SalesIQ webhook payload into the normalised BotSession shape
 * the router works with. See docs/salesiq-bot/CONTEXT_SCHEMA.ts for the
 * design rationale and docs/salesiq-bot/WEBHOOK_CONTRACT.md for what's
 * confirmed vs. not.
 *
 * ⚠ UNCONFIRMED KEYS: Zoho's own reference docs never enumerated the exact
 * `visitor` map field names (checked multiple times this session — not
 * retrievable). Every visitor/custom-info field below is read via a
 * candidate-key list rather than a single hardcoded key, so a wrong guess
 * degrades to `null` instead of throwing. Once docs/salesiq-bot's capture
 * endpoint has logged one real payload, replace the candidate lists with the
 * confirmed keys and delete this comment.
 */

import type { BotIntent } from "@/lib/bot/intents";
import { isLiveCountry } from "@/lib/currency";

export interface RawSalesIqPayload {
  handler?: "trigger" | "message" | "context";
  operation?: "chat" | "message";
  org_id?: string;
  visitor?: Record<string, unknown>;
  message?: { text?: string };
  context_id?: string;
  [key: string]: unknown;
}

/** What the website sends via $zoho.salesiq.visitor.info() — see Task 3. */
export interface GrowQRVisitorContext {
  page: string | null;
  audience: string | null;
  solution: string | null;
  country: string | null;
  currency: string | null;
  utm_source: string | null;
  utm_campaign: string | null;
  logged_in: boolean;
}

export interface BotSession {
  /** Per-conversation key. Never use for visitor identity — see `avuid`. */
  conversationId: string;
  /** Per-device visitor key, null when SalesIQ doesn't send one. */
  avuid: string | null;
  text: string;
  operation: "chat" | "message" | null;
  contextId: string | null;
  visitor: {
    name: string | null;
    email: string | null;
    phone: string | null;
    country: string | null;
    currentPage: string | null;
  };
  /** Null on social channels (Instagram) — no website context exists there. */
  context: GrowQRVisitorContext | null;
}

function firstString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

/** Candidate containers for custom visitor attributes — key name unconfirmed. */
function customInfo(visitor: Record<string, unknown>): Record<string, unknown> {
  for (const key of ["custominfo", "custom_info", "additional_info", "customInfo"]) {
    const value = visitor[key];
    if (value && typeof value === "object") return value as Record<string, unknown>;
  }
  return {};
}

function parseGrowQRContext(visitor: Record<string, unknown>): GrowQRVisitorContext | null {
  const info = customInfo(visitor);
  // No custom info at all is the normal case for social channels — return
  // null rather than an all-null object, so callers can tell "no website
  // context" apart from "website context with everything empty".
  if (Object.keys(info).length === 0) return null;

  return {
    page: firstString(info, ["page"]),
    audience: firstString(info, ["audience"]),
    solution: firstString(info, ["solution"]),
    country: firstString(info, ["country"]),
    currency: firstString(info, ["currency"]),
    utm_source: firstString(info, ["utm_source"]),
    utm_campaign: firstString(info, ["utm_campaign"]),
    logged_in: info.logged_in === true || info.logged_in === "true",
  };
}

/**
 * Idempotency key across turns of the same chat. `visitor.*` id fields ONLY —
 * `context_id` (the flow name, e.g. "b2b_qualify_recruiter_inquiry") and
 * `org_id` (the whole SalesIQ portal's id) are both constant across every
 * conversation on the account and must never be used here: a bug that briefly
 * shipped this way meant every visitor with the same intent collapsed onto
 * one conversation_id, so a second recruiter's lead would silently overwrite
 * the first one's row via the upsert-on-conflict. Caught in testing before
 * any real lead was affected — see the incident note in WEBHOOK_CONTRACT.md.
 */
function conversationId(payload: RawSalesIqPayload): string {
  const visitor = payload.visitor ?? {};
  // Keys CONFIRMED 2026-07-31 from a real website-widget payload:
  //   active_conversation_id — per-CONVERSATION, present on live traffic.
  //   avuid                  — per-VISITOR device id, stable across sessions.
  //
  // This function returns the CONVERSATION key, and that is all it is for.
  // For visitor identity use visitorId() below — never this.
  //
  // A previous comment here claimed the opposite, that this resolved to a
  // per-visitor value so repeat visitors would update their own bot_leads
  // row. It never did: active_conversation_id is present on live traffic and
  // always won, so every visit produced a fresh key and therefore a fresh
  // lead row (and with it a duplicate Zoho Task, Note and notification
  // email). The real lead in the table proves it — conversation_id
  // 227090000000078003 is an 18-digit Zoho conversation id, not an avuid.
  // Deduplication now lives in resolve_bot_lead() (migration 0012), keyed on
  // email → avuid → conversation, in that order.
  const fromVisitor = firstString(visitor, ["active_conversation_id", "avuid"]);
  // Never let a missing id silently collide across conversations — a
  // synthetic fallback is at least unique per invocation, even though it
  // breaks idempotency for that one edge case (better than a shared "unknown").
  return fromVisitor ?? `unknown-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * The VISITOR key: SalesIQ's per-device id, stable across conversations and
 * sessions. Null when SalesIQ doesn't send one (social channels, and possibly
 * some website cases we have not observed) — callers must degrade to
 * email/conversation matching rather than assume it exists.
 */
function visitorId(payload: RawSalesIqPayload): string | null {
  return firstString(payload.visitor ?? {}, ["avuid", "visitorid", "visitor_id", "uvid"]);
}

export function parseSession(payload: RawSalesIqPayload): BotSession {
  const visitor = payload.visitor ?? {};

  return {
    conversationId: conversationId(payload),
    avuid: visitorId(payload),
    text: payload.message?.text?.trim() ?? "",
    operation: payload.operation ?? null,
    contextId: payload.context_id ?? null,
    visitor: {
      name: firstString(visitor, ["name", "visitor_name"]),
      email: firstString(visitor, ["email", "visitor_email"]),
      phone: firstString(visitor, ["phone", "contact_number", "mobile"]),
      // country_code FIRST, confirmed from a real payload: SalesIQ sends
      // `country: "India"` (display name) alongside `country_code: "IN"`.
      // isLiveCountry() expects the ISO code, so the old country-first order
      // would have silently failed every region check that fell back to the
      // visitor object (i.e. whenever our own custom_info was absent).
      country: firstString(visitor, ["country_code", "countrycode", "country"]),
      currentPage: firstString(visitor, [
        "current_page_url",
        "current_page",
        "currenturl",
        "last_page",
      ]),
    },
    context: parseGrowQRContext(visitor),
  };
}

/** Best-known country for region/availability logic: our context first, SalesIQ's guess second. */
export function resolveCountry(session: BotSession): string | null {
  return session.context?.country ?? session.visitor.country;
}

/** Best-known page path, same preference order as resolveCountry. */
export function resolvePage(session: BotSession): string | null {
  return session.context?.page ?? session.visitor.currentPage;
}

/**
 * Is this visitor in a market where subscriptions are actually purchasable?
 * Reuses `isLiveCountry()` from lib/currency.ts — the exact function the
 * website itself uses (Pricing.tsx's isWaitlist logic) — never a
 * bot-specific reimplementation. An unresolved country is treated as
 * not-live, matching the website's own default.
 */
export function resolveIsLive(session: BotSession): boolean {
  return isLiveCountry(resolveCountry(session));
}

/** In-flight qualification state, keyed by conversation, for the process lifetime. */
export interface QualificationState {
  intent: BotIntent;
  step: number;
  answers: Record<string, string>;
}

// ── Shared context-question wire helpers ────────────────────────────────────

/**
 * Question shape confirmed 2026-07-31 against Zoho's actual SIQ Scripts
 * sample (bot-siq-scripts-message-handler-2.0.html) — a Deluge sample, but
 * the Map/Collection literals it builds via response.put()/questions.insert()
 * translate directly to this JSON shape. There is no `label` field: the
 * prompt text lives in `replies` (an array — either a bare string, or one
 * object carrying `text` + `validate` together). `input` only appears for
 * `calendar`/`timeslots` in the documented sample; `select` has no confirmed
 * example anywhere, so its shape here is a best-effort continuation of the
 * same pattern, not verified.
 */
export interface BotQuestion {
  name: string;
  replies: [string] | [{ text: string; validate?: Record<string, string> }];
  input?: { type: string; options?: string[] };
}

export interface BotResponse {
  action: "reply" | "context" | "forward";
  replies?: string[];
  suggestions?: string[];
  context_id?: string;
  questions?: BotQuestion[];
}

export function question(
  name: string,
  text: string,
  opts?: { validate?: Record<string, string>; input?: { type: string; options?: string[] } },
): BotQuestion {
  return {
    name,
    replies: opts?.validate ? [{ text, validate: opts.validate }] : [text],
    ...(opts?.input ? { input: opts.input } : {}),
  };
}

/**
 * Best-effort parse of a completed context's collected answers. Tries JSON
 * first (most likely shape for a multi-field context), then falls back to
 * whatever string fields SalesIQ sent at the top level. Returns null rather
 * than guessing when nothing parses — callers must handle that as "collection
 * failed" and hand off rather than fabricate a lead.
 */
export function parseContextAnswers(payload: RawSalesIqPayload): Record<string, unknown> | null {
  const raw = (payload as Record<string, unknown>).answers;
  if (typeof raw === "string" && raw.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
    } catch {
      // fall through
    }
  }
  if (raw && typeof raw === "object") return raw as Record<string, unknown>;
  return null;
}

/**
 * A completed context's per-field answer value shape was never confirmed
 * against a real payload (WEBHOOK_CONTRACT.md flagged this as UNCONFIRMED) —
 * a live test crashed on `answers.audience.trim is not a function`, proving
 * at least `select` fields don't arrive as plain strings. Handles the shapes
 * a Zoho form answer is plausibly serialized as: a bare string, a
 * single-element array (multi-select widgets commonly do this even for a
 * single pick), or an object carrying the picked value/label. Returns
 * undefined rather than guessing further.
 */
export function answerString(value: unknown): string | undefined {
  if (typeof value === "string") return value.trim() || undefined;
  if (Array.isArray(value)) return answerString(value[0]);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return answerString(obj.value ?? obj.label ?? obj.text);
  }
  return undefined;
}
