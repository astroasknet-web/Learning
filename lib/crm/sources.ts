import type { Tables } from "@/types/database";
import type { ZohoUpsertResult } from "@/lib/crm/zoho-client";
import {
  buildB2bLeadPayload,
  buildContactSalesPayload,
  buildSeekerWaitlistPayload,
  buildBotLeadPayload,
  buildCallBookingPayload,
  type ZohoLeadRecord,
} from "@/lib/crm/payload";
import { botLeadAfterSync } from "@/lib/bot/crm";
import { callBookingAfterSync, resolveBookingPerson } from "@/lib/crm/call-booking";

/**
 * Registry of CRM-synced tables. Adding a form to the CRM is a registry
 * entry + a payload builder — nothing else. Rollout is per-source: flags
 * flip one at a time in Phase 5 (b2b first), independent of the global
 * CRM_SYNC_ENABLED kill switch.
 */

export type CrmSourceKey =
  | "b2b_leads"
  | "contact_messages"
  | "seeker_waitlist"
  | "bot_leads"
  | "call_bookings";

/**
 * Which Zoho record a submission resolved to.
 *
 * Every source except call_bookings always resolves to a Lead — that is what
 * upsertLead does. Bookings additionally have to recognise a person who is
 * already a CONTACT (a converted Lead), because upsertLead's duplicate check
 * only searches the Leads module and would otherwise create a second, duplicate
 * record for an existing customer.
 */
export interface PersonResolution extends ZohoUpsertResult {
  type: "lead" | "contact";
}

export interface CrmSourceDefinition<K extends CrmSourceKey = CrmSourceKey> {
  table: K;
  /** Per-source rollout flag (Phase 5). All dark until then. */
  enabled: boolean;
  /** Row → Zoho record; null means "excluded by rule" → row marked 'skipped'. */
  buildPayload: (row: Tables<K>) => ZohoLeadRecord | null;
  /**
   * Optional override for "which Zoho record does this person map to". Absent
   * means the historical behaviour — upsert a Lead on Email — and the four
   * original sources deliberately leave it absent so nothing about them changes.
   * A source that sets this must also have zoho_contact_id and crm_record_type
   * columns, since the sync engine writes them.
   */
  resolvePerson?: (payload: ZohoLeadRecord) => Promise<PersonResolution>;
  /**
   * Optional post-upsert hook (Task/Note creation, etc). Runs only after a
   * successful Lead sync. A hook failure is logged by the caller and never
   * fails the Lead sync itself — the Lead already exists and is the part
   * that matters most.
   */
  afterSync?: (row: Tables<K>, result: PersonResolution) => Promise<void>;
  /**
   * `.or()` filter string selecting already-'synced' rows whose
   * afterSync hook still has incomplete work (e.g. one `_created` flag still
   * false). Required alongside `afterSync` for the hook to ever be retried:
   * a Task/Note/notification failure never flips `crm_sync_status` off
   * 'synced', so the sweep's normal pending/failed drain can never see these
   * rows again — this is a second, independent lane the sweep runs per
   * source, keyed on this filter instead of crm_sync_status.
   */
  afterSyncFilter?: string;
}

export const CRM_SOURCES: { readonly [K in CrmSourceKey]: CrmSourceDefinition<K> } = {
  b2b_leads: {
    table: "b2b_leads",
    enabled: true, // live since Phase 5a (still gated by CRM_SYNC_ENABLED)
    buildPayload: buildB2bLeadPayload,
  },
  contact_messages: {
    table: "contact_messages",
    enabled: true, // live since Phase 5c — builder returns null for type≠sales
    buildPayload: buildContactSalesPayload,
  },
  seeker_waitlist: {
    table: "seeker_waitlist",
    enabled: true, // live since Phase 5c
    buildPayload: buildSeekerWaitlistPayload,
  },
  bot_leads: {
    table: "bot_leads",
    enabled: true,
    buildPayload: buildBotLeadPayload,
    afterSync: botLeadAfterSync,
    // zoho_notes_pending is a generated column (visit_count > zoho_notes_count):
    // a returning visitor needs a fresh Note even though task/notification
    // stay one-per-person, and PostgREST .or() cannot compare two columns.
    afterSyncFilter:
      "zoho_task_created.eq.false,zoho_notes_pending.eq.true,notification_sent.eq.false",
  },
  call_bookings: {
    table: "call_bookings",
    enabled: true,
    buildPayload: buildCallBookingPayload,
    resolvePerson: resolveBookingPerson,
    afterSync: callBookingAfterSync,
    // Two independent lanes of incomplete hook work. zoho_notes_pending and
    // notifications_pending are generated columns (counter < events_count)
    // because PostgREST .or() cannot compare two columns — the same trick
    // bot_leads uses. A rescheduled or cancelled booking bumps events_count,
    // which is what re-opens both lanes for that row.
    afterSyncFilter: "zoho_task_created.eq.false,zoho_notes_pending.eq.true",
  },
  // newsletter_subscribers deliberately absent (locked decision A2).
};

/** Global kill switch: false → rows queue as 'pending', drained later. */
export function isCrmSyncEnabled(): boolean {
  return process.env.CRM_SYNC_ENABLED === "true";
}
