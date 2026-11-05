import { createAdminClient } from "@/lib/data/server";
import { createLogger } from "@/lib/log";
import type { Json } from "@/types/database";

const log = createLogger("bot-events");

/**
 * Must stay in step with the bot_events_event_type_check CHECK constraint
 * (migration 0013). A value missing from that constraint fails the insert at
 * the database, and logEvent() swallows its own errors — so the write would
 * vanish silently. Add to both, or neither.
 */
export type BotEventType =
  | "lead_created"
  | "task_created"
  | "note_created"
  | "email_sent"
  | "handoff_requested"
  // Chat transcript written into the Lead's Zoho Notes — see lib/bot/transcript.ts
  | "transcript_synced"
  // AI fallback layer — see lib/ai/answer.ts
  | "ai_answered"
  | "ai_declined"
  | "ai_rejected"
  | "ai_timeout"
  | "ai_error";

/**
 * Audit trail for the bot lead pipeline — one row per state transition or
 * failed attempt, so `bot_leads`' final state isn't the only record of what
 * happened. A logging failure is itself logged and swallowed: an audit-trail
 * write must never be the thing that breaks lead processing.
 */
export async function logEvent(params: {
  conversationId?: string | null;
  leadId?: number | null;
  eventType: BotEventType;
  status?: "ok" | "failed";
  payload?: Record<string, unknown>;
}): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("bot_events").insert({
    conversation_id: params.conversationId ?? null,
    lead_id: params.leadId ?? null,
    event_type: params.eventType,
    status: params.status ?? "ok",
    // Callers only ever pass plain string/number records (ids, error
    // messages) — structurally JSON-safe, the generated `Json` union just
    // can't express "arbitrary Record<string, unknown>" without this cast.
    payload: (params.payload ?? null) as Json | null,
  });
  if (error) {
    log.error(`logEvent(${params.eventType}) failed:`, error);
  }
}
