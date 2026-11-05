import { createAdminClient } from "@/lib/data/server";
import { createLogger } from "@/lib/log";
import {
  createLeadTask,
  createLeadNote,
  updateLead,
  type ZohoUpsertResult,
} from "@/lib/crm/zoho-client";
import { logEvent } from "@/lib/bot/events";
import { sendBotLeadNotification } from "@/lib/bot/notify";
import type { Tables } from "@/types/database";
import { BOT_INTENT_LABELS, type BotIntent } from "@/lib/bot/intents";

const log = createLogger("bot-crm");

/**
 * The webhook's only inline write is queueBotLead (a single database function,
 * ~50-100ms — well inside the 5-second response budget); visit tracking
 * (touchVisitor) runs from after(), off the response path. Everything past
 * that — Zoho Lead/Task/Note creation, the audit trail, the notification
 * email — happens off the response path: fast-path via next/server after()
 * (see lib/bot/router.ts) with the existing cron-driven sync sweep
 * (lib/crm/sync.ts runSyncSweep) as the reconciliation layer, exactly like
 * every other CRM-synced form in this repo. The webhook never calls Zoho or
 * Resend directly.
 */

export interface QualifiedLead {
  conversationId: string;
  /** Per-device visitor key. Null degrades to email/conversation matching. */
  avuid?: string | null;
  intent: BotIntent;
  useCase?: string | null;
  name?: string | null;
  email: string;
  company?: string | null;
  designation?: string | null;
  teamSize?: string | null;
  countryCode?: string | null;
  pagePath?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
}

/**
 * Queue a qualified B2B lead, deduplicated against visitors we've already
 * seen. All matching and merging happens inside resolve_bot_lead() (migration
 * 0012) so it is one atomic statement — two concurrent turns cannot both
 * insert, which a read-then-write in TypeScript could not prevent.
 *
 * Match order: email → avuid → conversation → insert. The avuid step is
 * guarded on email agreement, because a shared device (office machine, campus
 * lab, kiosk) gives two different people the same avuid, and merging them
 * would destroy the second person's data. See the migration for the full
 * rationale and the merge rules.
 *
 * A matched row is ENRICHED, not replaced: gaps are filled, use_case
 * accumulates, first-touch UTM is preserved, visit_count increments once per
 * conversation, and the row is re-queued so the new information reaches Zoho.
 * Because it is the same row, zoho_task_created and notification_sent stay
 * true, so the visitor's second visit cannot produce a second Task or a
 * second notification email.
 *
 * Returns the row id AND whether the row actually needs a CRM push, so the
 * caller can skip the after() fast path on a turn that changed nothing; null
 * on failure (logged here — the reconciliation sweep cannot help with a row
 * that was never written).
 *
 * `requeued` matters because captureB2cLead() calls this on EVERY message.
 * Before migration 0022, resolve_bot_lead reset a 'synced' row back to
 * 'pending' unconditionally, so a five-message chat produced seven Zoho writes
 * (measured on the 2026-08-06 smoke test) — one insert and six updates that
 * re-sent identical data. Zoho's daily API credits are finite; at real chat
 * volume that is how you quietly exhaust them. Now the RPC only requeues when
 * a column Zoho actually sees has changed, and reports which it did.
 */
export async function queueBotLead(
  lead: QualifiedLead,
): Promise<{ leadId: number; requeued: boolean } | null> {
  const admin = createAdminClient();

  const { data, error } = await admin.rpc("resolve_bot_lead", {
    p_conversation_id: lead.conversationId,
    p_avuid: lead.avuid ?? undefined,
    p_intent: lead.intent,
    p_email: lead.email,
    p_name: lead.name ?? undefined,
    p_company: lead.company ?? undefined,
    p_designation: lead.designation ?? undefined,
    p_team_size: lead.teamSize ?? undefined,
    p_use_case: lead.useCase ?? undefined,
    p_country_code: lead.countryCode ?? undefined,
    p_page_path: lead.pagePath ?? undefined,
    p_utm_source: lead.utmSource ?? undefined,
    p_utm_medium: lead.utmMedium ?? undefined,
    p_utm_campaign: lead.utmCampaign ?? undefined,
  });

  const resolved = data?.[0];
  if (error || !resolved) {
    // The visitor already has their confirmation reply; a queue failure here
    // is an ops problem, not something to surface mid-conversation.
    log.error(`queueBotLead failed for ${lead.conversationId}:`, error);
    return null;
  }

  log.info(
    `${lead.conversationId} resolved to bot_leads#${resolved.lead_id} ` +
      `(matched_on=${resolved.matched_on}, visit=${resolved.visits}, ` +
      `requeued=${resolved.requeued})`,
  );
  return { leadId: resolved.lead_id, requeued: resolved.requeued };
}

/**
 * Record a visit. Runs for EVERY turn, including visitors who never qualify —
 * that's what lets an abandoned chat be enriched when the person returns days
 * later, since there is no bot_leads row to hang the history on yet.
 *
 * Must be called from after(), never inline: visit tracking is analytics and
 * has no business spending any of SalesIQ's 5-second response budget.
 *
 * visit_count increments only when the conversation id changes, so it counts
 * visits rather than messages. A visitor with no avuid is skipped (logged
 * once per turn) and dedupe falls back to email/conversation matching.
 */
export async function touchVisitor(params: {
  avuid: string | null;
  conversationId: string;
  pagePath?: string | null;
  countryCode?: string | null;
  email?: string | null;
}): Promise<void> {
  if (!params.avuid) {
    // Requirement: if avuid is missing, log it rather than failing silently —
    // it means visitor tracking is degraded for this conversation.
    log.warn(`${params.conversationId} has no avuid — visitor tracking skipped`);
    return;
  }

  const admin = createAdminClient();
  const { error } = await admin.rpc("touch_bot_visitor", {
    p_avuid: params.avuid,
    p_conversation_id: params.conversationId,
    p_page_path: params.pagePath ?? undefined,
    p_country_code: params.countryCode ?? undefined,
    p_email: params.email ?? undefined,
  });
  if (error) {
    log.error(`touchVisitor failed for ${params.avuid}:`, error);
  }
}

/**
 * Point an existing conversation's lead at a different email, after the
 * visitor says "change email".
 *
 * Two paths, and the second is the reason this can't just re-run the normal
 * sync: once a Lead exists in Zoho it is keyed on the OLD address, and
 * upsertLead matches on Email — pushing the new address through it would
 * create a second Lead and strand the first. So a synced row is updated by
 * record id instead (updateLead), which renames the lead we already have.
 * An unsynced row needs none of that: the queued sync will simply use the new
 * address when it runs.
 *
 * Returns false when the conversation has no lead yet, so the caller can say
 * so rather than silently pretending something changed.
 */
export async function changeLeadEmail(params: {
  conversationId: string;
  email: string;
}): Promise<boolean> {
  const admin = createAdminClient();

  const { data: row, error } = await admin
    .from("bot_leads")
    .select("id, zoho_lead_id")
    .or(`conversation_id.eq.${params.conversationId},conversation_ids.cs.{${params.conversationId}}`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !row) {
    log.warn(`changeLeadEmail: no lead for conversation ${params.conversationId}`, error);
    return false;
  }

  const { error: updateError } = await admin
    .from("bot_leads")
    .update({ email: params.email })
    .eq("id", row.id);
  if (updateError) {
    log.error(`changeLeadEmail: row update failed for bot_leads#${row.id}:`, updateError);
    return false;
  }

  if (row.zoho_lead_id) {
    try {
      await updateLead(row.zoho_lead_id, { Email: params.email });
      await logEvent({
        conversationId: params.conversationId,
        leadId: row.id,
        eventType: "lead_created",
        payload: { zoho_lead_id: row.zoho_lead_id, action: "email_changed" },
      });
    } catch (zohoError) {
      // the database already holds the new address, so the row is the source of
      // truth and a reconciliation can still fix Zoho. Don't fail the visitor's
      // request over it.
      log.error(`changeLeadEmail: Zoho update failed for lead ${row.zoho_lead_id}:`, zohoError);
    }
  }

  return true;
}

/** Log a question the router could not confidently match, for KB backlog review. */
export async function logUnanswered(params: {
  conversationId?: string | null;
  question: string;
  pagePath?: string | null;
  countryCode?: string | null;
  /**
   * "ai" when the AI fallback served this turn. The row is still written: an
   * AI answer means the deterministic layer had a gap, and suppressing the row
   * would hide the KB backlog exactly when it matters most. See migration 0013
   * and AI_FALLBACK_DESIGN.md §8.2.
   */
  answeredBy?: "ai" | null;
}): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("bot_unanswered").insert({
    conversation_id: params.conversationId ?? null,
    question: params.question,
    page_path: params.pagePath ?? null,
    country_code: params.countryCode ?? null,
    answered_by: params.answeredBy ?? null,
  });
  if (error) {
    log.error("logUnanswered failed:", error);
  }
}

/**
 * afterSync hook for the bot_leads CRM source (registered in
 * lib/crm/sources.ts). Runs from the sync sweep, once the Lead exists.
 * Sequence per the approved workflow: Task → Note → email notification,
 * each guarded by its own `_created`/`_sent` flag so a hook re-run (partial
 * earlier failure, or the reconciliation sweep re-visiting a row the after()
 * fast path already handled) never double-creates or double-emails.
 * Every step — success or failure — writes a bot_events row, so the full
 * chain is inspectable after the fact, not just bot_leads' final state.
 */
export async function botLeadAfterSync(
  row: Tables<"bot_leads">,
  result: ZohoUpsertResult,
): Promise<void> {
  const admin = createAdminClient();
  const ctx = { conversationId: row.conversation_id, leadId: row.id };

  await logEvent({ ...ctx, eventType: "lead_created", payload: { zoho_lead_id: result.id, action: result.action } });

  if (!row.zoho_task_created) {
    try {
      const dueDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
      const intentLabel = BOT_INTENT_LABELS[row.intent as BotIntent] ?? row.intent;
      await createLeadTask({
        leadId: result.id,
        subject: `Follow up: ${intentLabel} — ${row.company ?? row.email ?? "unknown"}`,
        dueDate,
        description: row.use_case ?? undefined,
      });
      await admin.from("bot_leads").update({ zoho_task_created: true }).eq("id", row.id);
      await logEvent({ ...ctx, eventType: "task_created" });
    } catch (error) {
      log.error(`bot_leads#${row.id} task creation failed:`, error);
      await logEvent({
        ...ctx,
        eventType: "task_created",
        status: "failed",
        payload: { error: error instanceof Error ? error.message : String(error) },
      });
    }
  }

  // Notes are the ONE artifact that is per-visit rather than per-lead. Tasks
  // and notifications stay one-per-person (their boolean flags never reset),
  // but if Notes worked the same way, everything a returning visitor told us
  // would land in the database and in the Lead's fields and never reach sales as
  // readable context. So the gate is a counter: one Note per visit, never per
  // turn and never per retry, because zoho_notes_count only ever advances to
  // the visit_count it already observed.
  const visits = row.visit_count ?? 1;
  const notesWritten = row.zoho_notes_count ?? 0;
  if (notesWritten < visits) {
    try {
      const content = [
        `Intent: ${row.intent}`,
        row.use_case ? `Use case: ${row.use_case}` : null,
        row.designation ? `Designation: ${row.designation}` : null,
        row.team_size ? `Team size: ${row.team_size}` : null,
        row.last_page_path ?? row.page_path ? `Page: ${row.last_page_path ?? row.page_path}` : null,
        visits > 1 ? `Visits so far: ${visits}` : null,
        // ADDED 0022: without this the CRM was a dead end — the Note named an
        // intent and a page and gave no way at all to find the chat it came
        // from, even though the database had the whole exchange. The transcript
        // itself arrives as its own Note once the conversation goes quiet
        // (lib/bot/transcript.ts); this line is what ties the two together,
        // and it is written immediately rather than waiting for that flush.
        //
        // The LAST conversation id, not row.conversation_id: that column holds
        // the visitor's FIRST chat forever, and every later one is appended to
        // conversation_ids. A "Return visit 3" Note pointing at the chat from
        // two months ago would be worse than no pointer at all.
        `SalesIQ conversation: ${row.conversation_ids?.at(-1) ?? row.conversation_id}`,
      ]
        .filter(Boolean)
        .join("\n");
      await createLeadNote({
        leadId: result.id,
        title:
          visits > 1
            ? `Return visit ${visits} via SalesIQ chat`
            : "Qualified via SalesIQ chat",
        content,
      });
      await admin
        .from("bot_leads")
        .update({ zoho_notes_count: visits, zoho_note_created: true })
        .eq("id", row.id);
      await logEvent({ ...ctx, eventType: "note_created", payload: { visit: visits } });
    } catch (error) {
      log.error(`bot_leads#${row.id} note creation failed:`, error);
      await logEvent({
        ...ctx,
        eventType: "note_created",
        status: "failed",
        payload: { error: error instanceof Error ? error.message : String(error) },
      });
    }
  }

  // Team notification: B2B-qualified leads only. Every general_inquiry row is
  // an organic B2C chat (see captureB2cLead() in router.ts) — at solution-page
  // volume that would be a Resend email per chat, drowning out the actually
  // actionable B2B qualifications this notification exists for. Marked
  // notification_sent=true without sending, not left false: the sweep's
  // afterSyncFilter (sources.ts) retries on notification_sent=false forever,
  // and a general_inquiry row must never re-enter that loop.
  if (!row.notification_sent) {
    if (row.intent === "general_inquiry") {
      await admin.from("bot_leads").update({ notification_sent: true }).eq("id", row.id);
    } else {
      try {
        await sendBotLeadNotification(row, result.id);
        await admin.from("bot_leads").update({ notification_sent: true }).eq("id", row.id);
        await logEvent({ ...ctx, eventType: "email_sent" });
      } catch (error) {
        log.error(`bot_leads#${row.id} notification failed:`, error);
        await logEvent({
          ...ctx,
          eventType: "email_sent",
          status: "failed",
          payload: { error: error instanceof Error ? error.message : String(error) },
        });
      }
    }
  }
}
