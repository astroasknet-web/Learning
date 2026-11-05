import { createAdminClient } from "@/lib/data/server";
import { createLogger } from "@/lib/log";
import { createLeadNote } from "@/lib/crm/zoho-client";
import { logEvent } from "@/lib/bot/events";
import type { BotResponse } from "@/lib/bot/context";

const log = createLogger("bot-transcript");

/**
 * Chat transcripts, and how they reach the CRM.
 *
 * WHY THIS EXISTS. Before this module a qualified Lead's only Note read
 * "Intent: general_inquiry / Page: /" — no transcript, and not even the
 * conversation id, so there was no way back from the CRM record to the chat
 * that produced it. bot_events was not a substitute: it is an audit trail of
 * what the pipeline DID (ai_answered, handoff_requested…), it has no row at
 * all for a deterministic KB answer, and it never held the bot's reply text.
 *
 * WHY IDLENESS. SalesIQ's webhook bot calls us with handler = trigger |
 * message | context and nothing else — there is no end-of-chat handler, so
 * "the visitor is done" is never something we are told. Writing the Note per
 * turn would mean a Note per message; writing it on the first turn would mean
 * a transcript of one line. So a conversation is considered finished when it
 * has gone quiet for IDLE_MINUTES, and the flush runs from the CRM cron.
 *
 * (Zoho's own SalesIQ↔CRM integration would attach the real Chats related
 * list, transcript and visitor score — but only to records SalesIQ itself
 * created, and ours come in through the CRM API. That is portal
 * configuration, not code. This module is what makes the Lead useful whether
 * or not that link is ever switched on.)
 */

/** How long a conversation must be silent before we treat it as finished. */
const IDLE_MINUTES = 20;

/** Conversations flushed per cron run. The sweep has a 60s budget to share. */
const FLUSH_LIMIT = 25;

/**
 * How long a stored turn is kept. These are chat transcripts — personal data
 * whose only downstream consumer is the Zoho Note, which by then already has
 * its own copy. Anything still unwritten at this age never will be: the claim
 * query stops looking after 7 days, so a chat that produced no lead by then
 * produced none at all.
 */
const RETENTION_DAYS = 90;

/**
 * Zoho's Note_Content ceiling is 32,000 characters. Stay well under it: a Note
 * that is rejected wholesale is worse than one that says "…truncated".
 */
const MAX_NOTE_CHARS = 28_000;

/** One line of chat, either side. */
interface TranscriptRow {
  role: string;
  content: string;
  created_at: string;
}

/**
 * Everything the visitor actually saw this turn.
 *
 * `replies` is only part of it: when the bot opens a qualification form the
 * action is "context" and the prompt the visitor reads lives inside
 * questions[].replies, not in the top-level replies array. Reading only the
 * latter would produce a transcript where the bot falls silent exactly at the
 * moment it starts asking for a company name — the most interesting part of a
 * B2B chat.
 */
export function extractBotText(response: BotResponse): string[] {
  const out = [...(response.replies ?? [])];
  for (const q of response.questions ?? []) {
    const first = q.replies?.[0];
    out.push(typeof first === "string" ? first : (first?.text ?? ""));
  }
  return out.filter(Boolean);
}

/**
 * Record one webhook turn — the visitor's message and whatever the bot said
 * back — verbatim and in order.
 *
 * Runs for EVERY conversation, not only qualified ones, for the same reason
 * touchVisitor() does: a chat that produces no lead today can produce one when
 * the same person comes back next week, and by then the history is gone if we
 * never wrote it.
 *
 * Must be called from after(), never inline. It is a plain insert (~30-50ms),
 * but nothing the visitor sees depends on it, so it has no business inside
 * SalesIQ's 5-second response budget. Swallows its own errors: losing a
 * transcript line must never be the reason a reply fails to send.
 */
export async function recordTurn(params: {
  conversationId: string;
  visitorText?: string | null;
  replies?: readonly string[];
  pagePath?: string | null;
}): Promise<void> {
  const rows: Array<{
    conversation_id: string;
    role: "visitor" | "bot";
    content: string;
    page_path: string | null;
  }> = [];

  const visitor = params.visitorText?.trim();
  if (visitor) {
    rows.push({
      conversation_id: params.conversationId,
      role: "visitor",
      content: visitor,
      page_path: params.pagePath ?? null,
    });
  }

  // Multiple replies are one bot turn as far as the reader is concerned, so
  // they join into a single row rather than N — a transcript should read the
  // way the chat window looked.
  const reply = (params.replies ?? []).map((r) => r.trim()).filter(Boolean).join("\n");
  if (reply) {
    rows.push({
      conversation_id: params.conversationId,
      role: "bot",
      content: reply,
      page_path: params.pagePath ?? null,
    });
  }

  // A trigger event (visitor lands, says nothing, bot has no reply yet) has
  // neither side. Writing an empty pair would put blank lines in every
  // transcript.
  if (!rows.length) return;

  const admin = createAdminClient();
  const { error } = await admin.from("bot_messages").insert(rows);
  if (error) {
    log.error(`recordTurn failed for ${params.conversationId}:`, error);
  }
}

/**
 * Render stored turns as the Note body. Plain text, not HTML: Zoho's
 * Note_Content is a plain-text field and any markup shows up literally.
 *
 * Truncation keeps the END of the conversation when a chat runs long — the
 * last thing someone asked before they left is what a rep needs, far more than
 * how the chat opened.
 */
export function renderTranscript(rows: readonly TranscriptRow[]): string {
  const lines = rows.map((row) => {
    const time = new Date(row.created_at).toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const who = row.role === "bot" ? "GrowQR AI" : "Visitor";
    return `[${time}] ${who}: ${row.content}`;
  });

  let body = lines.join("\n");
  if (body.length > MAX_NOTE_CHARS) {
    body = `… earlier messages omitted …\n\n${body.slice(-MAX_NOTE_CHARS)}`;
  }
  return body;
}

/**
 * Write the transcript of every conversation that has gone quiet into its
 * Zoho Lead, as a Note.
 *
 * Ordering is deliberate — Zoho first, mark second. The reverse would lose a
 * transcript permanently the one time Zoho is down; this way a failure leaves
 * the rows unsynced and the next run simply retries them. The cost of a crash
 * between the two is a duplicate Note, which is noise, not data loss.
 *
 * Called from the CRM cron (app/api/cron/crm-sync). Best-effort by design: it
 * returns a count and never throws, so a transcript problem cannot fail the
 * sweep that leads depend on.
 */
export async function flushIdleTranscripts(): Promise<{
  flushed: number;
  failed: number;
  purged: number;
}> {
  const admin = createAdminClient();
  let flushed = 0;
  let failed = 0;
  const purged = await purgeOldTranscripts(admin);

  const { data: claims, error } = await admin.rpc("claim_idle_transcripts", {
    p_idle_minutes: IDLE_MINUTES,
    p_limit: FLUSH_LIMIT,
  });
  if (error) {
    log.error("claim_idle_transcripts failed:", error);
    return { flushed, failed, purged };
  }
  if (!claims?.length) return { flushed, failed, purged };

  for (const claim of claims) {
    const { data: rows, error: rowsError } = await admin
      .from("bot_messages")
      .select("id, role, content, created_at")
      .eq("conversation_id", claim.conversation_id)
      .is("synced_at", null)
      .order("created_at", { ascending: true });

    if (rowsError || !rows?.length) {
      if (rowsError) log.error(`transcript read failed for ${claim.conversation_id}:`, rowsError);
      continue;
    }

    const day = new Date(rows[0].created_at).toLocaleDateString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    try {
      await createLeadNote({
        leadId: claim.zoho_lead_id,
        title: `Chat transcript — ${day}`,
        // The conversation id is the pointer back to SalesIQ. It is the only
        // thing that makes this Note searchable against the chat it came from,
        // so it goes in the body regardless of how the transcript renders.
        content: [
          `SalesIQ conversation: ${claim.conversation_id}`,
          `Messages: ${rows.length}`,
          "",
          renderTranscript(rows),
        ].join("\n"),
      });

      const { error: markError } = await admin
        .from("bot_messages")
        .update({ synced_at: new Date().toISOString() })
        .in("id", rows.map((r) => r.id));
      if (markError) {
        // The Note is already in Zoho. Leaving the rows unsynced means the next
        // run writes it again — annoying, but the alternative (claiming success
        // we can't confirm) silently drops transcripts, which is worse.
        log.error(`transcript mark failed for ${claim.conversation_id}:`, markError);
      }

      await logEvent({
        conversationId: claim.conversation_id,
        leadId: claim.lead_id,
        eventType: "transcript_synced",
        payload: { messages: rows.length, zoho_lead_id: claim.zoho_lead_id },
      });
      flushed += 1;
    } catch (zohoError) {
      failed += 1;
      log.error(`transcript note failed for ${claim.conversation_id}:`, zohoError);
      await logEvent({
        conversationId: claim.conversation_id,
        leadId: claim.lead_id,
        eventType: "transcript_synced",
        status: "failed",
        payload: { error: zohoError instanceof Error ? zohoError.message : String(zohoError) },
      });
    }
  }

  if (flushed || failed) {
    log.info(`transcript flush: ${flushed} written, ${failed} failed`);
  }
  return { flushed, failed, purged };
}

/**
 * Retention. bot_messages is written for every visitor who ever types
 * something, qualified or not, so without this it grows forever and holds
 * personal data long past any use for it. Runs BEFORE the flush so an
 * expired row can never be picked up and written to Zoho on its way out.
 *
 * Best-effort: a purge failure is logged and the flush continues.
 */
async function purgeOldTranscripts(
  admin: ReturnType<typeof createAdminClient>,
): Promise<number> {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await admin
    .from("bot_messages")
    .delete()
    .lt("created_at", cutoff)
    .select("id");
  if (error) {
    log.error("transcript purge failed:", error);
    return 0;
  }
  const count = data?.length ?? 0;
  if (count) log.info(`purged ${count} transcript row(s) older than ${RETENTION_DAYS} days`);
  return count;
}
