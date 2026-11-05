/* eslint-disable @typescript-eslint/no-explicit-any */
import { randomUUID } from "node:crypto";
import { all, tx, type Conn } from "@/lib/portal/db";
import { toDbTime } from "./schema";

/**
 * The database functions the marketing code calls with rpc(). They used to be Postgres functions; here each one is a
 * transaction, with the same inputs and the same returned columns.
 */
type Args = Record<string, any>;
type Fn = (a: Args) => Promise<Record<string, unknown>[]>;

const blank = (v: unknown): string | null => {
  const s = v === null || v === undefined ? "" : String(v).trim();
  return s === "" ? null : s;
};

/** Retry once when two requests collide on the same row (deadlock or duplicate key). */
async function retrying<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    const n = (e as { errno?: number }).errno;
    if (n === 1213 || n === 1062) return fn();
    throw e;
  }
}

const counts = (sql: string): Fn => async () => (await all<{ k: string; total: number }>(sql)).map((r) => ({ ...r, total: Number(r.total) }));

/* ------------------------------------------------------------------ cal.com bookings --------------------------------------------- */

const COALESCED = ["title", "meeting_url", "attendee_name", "attendee_timezone", "company", "team_size"] as const;
const ATTRIBUTION = ["source", "page_path", "country_code", "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "landing_page", "referrer"] as const;

function parseBooking(b: unknown): Args {
  if (typeof b === "string") { try { return JSON.parse(b); } catch { return {}; } }
  return (b ?? {}) as Args;
}

const jsonOrNull = (v: unknown): string | null => (v === undefined || v === null ? null : JSON.stringify(v));
const timeOrNull = (v: unknown): unknown => (v === undefined || v === null ? null : toDbTime(v));
const bigOrNull = (v: unknown): number | null => (v === undefined || v === null || v === "" ? null : Number(v));

async function applyCalBooking(a: Args): Promise<Record<string, unknown>[]> {
  const uid = String(a.p_cal_uid);
  const at = toDbTime(a.p_event_at) as string;
  const b = parseBooking(a.p_booking);
  const supersedes = blank(a.p_supersedes);
  const disposable = b.is_disposable_email === true || b.is_disposable_email === "true";

  return retrying(() => tx(async (c: Conn) => {
    const summary = async (id: string, applied: boolean, isNew: boolean) => {
      const r = (await c.query<{ events_count: number; status: string }>("SELECT events_count, status FROM call_bookings WHERE id = $1", [id])).rows[0];
      return [{ booking_id: id, applied, is_new: isNew, events_count: Number(r?.events_count ?? 1), status: r?.status ?? "booked" }];
    };
    const existing = async (u: string) => (await c.query<{ id: string; last_event_at: string }>("SELECT id, last_event_at FROM call_bookings WHERE cal_uid = $1 FOR UPDATE", [u])).rows[0];

    // Fields every update fills only when the new event carries a value; and fields where the first value wins.
    const fillGaps = (sets: string[], vals: unknown[]): void => {
      const add = (col: string, v: unknown) => { vals.push(v); sets.push(`${col} = COALESCE($${vals.length}, ${col})`); };
      for (const k of COALESCED) add(k, blank(b[k]) ?? null);
      add("cal_booking_id", bigOrNull(b.cal_booking_id));
      add("cal_event_type_id", bigOrNull(b.cal_event_type_id));
      add("intent_id", blank(b.intent_id));
      for (const k of ATTRIBUTION) add(k, blank(b[k]));
    };
    const reset = "crm_sync_status = CASE WHEN crm_sync_status IN ('syncing','skipped') THEN crm_sync_status ELSE 'pending' END, crm_sync_attempts = 0, crm_sync_error = NULL, events_count = events_count + 1, updated_at = CURRENT_TIMESTAMP(3)";

    // A reschedule: Cal.com mints a new uid, so the existing row moves onto it instead of a second row being inserted.
    if (supersedes && !(await existing(uid))) {
      const prior = await existing(supersedes);
      if (prior && at >= String(prior.last_event_at)) {
        const vals: unknown[] = [uid, supersedes, at, blank(b.last_trigger_event), blank(b.status) ?? "rescheduled", timeOrNull(b.start_time), timeOrNull(b.end_time), (timeOrNull(b.rescheduled_at) as string | null) ?? at, jsonOrNull(b.responses), jsonOrNull(b.raw_payload)];
        const sets = ["cal_uid = $1", "rescheduled_from_uid = $2", "last_event_at = $3", "last_trigger_event = $4", "status = $5", "start_time = $6", "end_time = $7", "rescheduled_at = $8", "responses = COALESCE($9, responses)", "raw_payload = $10"];
        fillGaps(sets, vals);
        vals.push(prior.id);
        await c.query(`UPDATE call_bookings SET ${sets.join(", ")}, ${reset} WHERE id = $${vals.length}`, vals);
        return summary(prior.id, true, false);
      }
      // no prior row, or the event is stale: treat it as a new booking
    }

    const row = await existing(uid);
    if (!row) {
      const id = randomUUID();
      const cols: Array<[string, unknown]> = [
        ["id", id], ["cal_uid", uid], ["cal_booking_id", bigOrNull(b.cal_booking_id)], ["cal_event_type_id", bigOrNull(b.cal_event_type_id)],
        ["rescheduled_from_uid", blank(b.rescheduled_from_uid) ?? supersedes], ["last_event_at", at], ["last_trigger_event", blank(b.last_trigger_event)],
        ["email", blank(b.email)], ["attendee_name", blank(b.attendee_name)], ["attendee_timezone", blank(b.attendee_timezone)], ["company", blank(b.company)], ["team_size", blank(b.team_size)],
        ["title", blank(b.title)], ["start_time", timeOrNull(b.start_time)], ["end_time", timeOrNull(b.end_time)], ["meeting_url", blank(b.meeting_url)], ["status", blank(b.status) ?? "booked"],
        ["booked_at", timeOrNull(b.booked_at) ?? at], ["rescheduled_at", timeOrNull(b.rescheduled_at)], ["cancelled_at", timeOrNull(b.cancelled_at)], ["cancellation_reason", blank(b.cancellation_reason)],
        ["is_disposable_email", disposable ? 1 : 0], ["responses", jsonOrNull(b.responses)], ["raw_payload", jsonOrNull(b.raw_payload)], ["intent_id", blank(b.intent_id)],
        ["source", blank(b.source)], ["country_code", blank(b.country_code)], ["utm_source", blank(b.utm_source)], ["utm_medium", blank(b.utm_medium)], ["utm_campaign", blank(b.utm_campaign)],
        ["utm_term", blank(b.utm_term)], ["utm_content", blank(b.utm_content)], ["gclid", blank(b.gclid)], ["landing_page", blank(b.landing_page)], ["referrer", blank(b.referrer)], ["page_path", blank(b.page_path)],
        ["crm_sync_status", disposable ? "skipped" : "pending"],
      ];
      await c.query(`INSERT INTO call_bookings (${cols.map(([k]) => k).join(", ")}) VALUES (${cols.map((_, i) => "$" + (i + 1)).join(", ")})`, cols.map(([, v]) => v));
      return summary(id, true, true);
    }

    // The same booking again (a cancellation, or a redelivery): apply it only when it is not older than what we hold.
    if (at < String(row.last_event_at)) return summary(row.id, false, false);
    const vals: unknown[] = [at, blank(b.last_trigger_event), blank(b.status) ?? "booked", timeOrNull(b.start_time), timeOrNull(b.end_time), jsonOrNull(b.raw_payload)];
    const sets = ["last_event_at = $1", "last_trigger_event = $2", "status = $3", "start_time = $4", "end_time = $5", "raw_payload = $6"];
    const add = (col: string, v: unknown) => { vals.push(v); sets.push(`${col} = COALESCE($${vals.length}, ${col})`); };
    for (const k of COALESCED) add(k, blank(b[k]));
    add("cal_booking_id", bigOrNull(b.cal_booking_id));
    add("cal_event_type_id", bigOrNull(b.cal_event_type_id));
    add("rescheduled_from_uid", blank(b.rescheduled_from_uid) ?? supersedes);
    add("rescheduled_at", timeOrNull(b.rescheduled_at));
    add("cancelled_at", timeOrNull(b.cancelled_at));
    add("cancellation_reason", blank(b.cancellation_reason));
    add("responses", jsonOrNull(b.responses));
    // First touch wins for attribution: keep what is there, fill only the gaps.
    for (const k of ["intent_id", ...ATTRIBUTION]) { vals.push(blank(b[k])); sets.push(`${k} = COALESCE(${k}, $${vals.length})`); }
    vals.push(row.id);
    await c.query(`UPDATE call_bookings SET ${sets.join(", ")}, ${reset} WHERE id = $${vals.length}`, vals);
    return summary(row.id, true, false);
  }));
}

/* ------------------------------------------------------------------ chat bot ------------------------------------------------------ */

async function touchBotVisitor(a: Args): Promise<Record<string, unknown>[]> {
  const avuid = blank(a.p_avuid);
  if (!avuid) return [];
  return retrying(() => tx(async (c) => {
    await c.query(
      `INSERT INTO bot_visitors (avuid, last_conversation_id, last_page_path, country_code, email) VALUES ($1, $2, $3, $4, $5)
       ON DUPLICATE KEY UPDATE
         visit_count = visit_count + IF(VALUES(last_conversation_id) IS NOT NULL AND NOT (last_conversation_id <=> VALUES(last_conversation_id)), 1, 0),
         last_seen_at = CURRENT_TIMESTAMP(3),
         last_conversation_id = COALESCE(VALUES(last_conversation_id), last_conversation_id),
         last_page_path = COALESCE(VALUES(last_page_path), last_page_path),
         country_code = COALESCE(VALUES(country_code), country_code),
         email = COALESCE(email, VALUES(email))`,
      [avuid, blank(a.p_conversation_id), blank(a.p_page_path), blank(a.p_country_code), blank(a.p_email)],
    );
    const r = (await c.query<{ id: number; visit_count: number }>("SELECT id, visit_count FROM bot_visitors WHERE avuid = $1", [avuid])).rows[0];
    return [{ visitor_id: Number(r.id), visits: Number(r.visit_count) }];
  }));
}

const LEAD_FIELDS = ["email", "name", "company", "designation", "team_size", "use_case", "intent", "country_code", "page_path", "last_page_path", "utm_source", "utm_medium", "utm_campaign", "visit_count"] as const;

async function resolveBotLead(a: Args): Promise<Record<string, unknown>[]> {
  const conv = String(a.p_conversation_id);
  const email = blank(a.p_email);
  const avuid = blank(a.p_avuid);
  const use = blank(a.p_use_case);
  const intent = blank(a.p_intent);

  return retrying(() => tx(async (c) => {
    const find = async (sql: string, p: unknown[]): Promise<number | null> => {
      const r = (await c.query<{ id: number }>(sql, p)).rows[0];
      return r ? Number(r.id) : null;
    };
    let id: number | null = null;
    let matched = "";
    if (email) { id = await find("SELECT id FROM bot_leads WHERE email IS NOT NULL AND LOWER(email) = LOWER($1) ORDER BY created_at ASC LIMIT 1", [email]); if (id) matched = "email"; }
    if (!id && avuid) { id = await find("SELECT id FROM bot_leads WHERE avuid = $1 AND (email IS NULL OR $2 IS NULL OR LOWER(email) = LOWER($2)) ORDER BY created_at ASC LIMIT 1", [avuid, email]); if (id) matched = "avuid"; }
    if (!id) { id = await find("SELECT id FROM bot_leads WHERE conversation_id = $1 OR JSON_CONTAINS(conversation_ids, $2) ORDER BY created_at ASC LIMIT 1", [conv, JSON.stringify(conv)]); if (id) matched = "conversation"; }

    const linkVisitor = async (leadId: number) => {
      if (avuid) await c.query("UPDATE bot_visitors SET bot_lead_id = $1, email = COALESCE(email, $2) WHERE avuid = $3", [leadId, email, avuid]);
    };

    if (!id) {
      await c.query(
        `INSERT INTO bot_leads (conversation_id, conversation_ids, avuid, intent, email, name, company, designation, team_size, use_case, country_code, page_path, last_page_path, utm_source, utm_medium, utm_campaign)
         VALUES ($1, $2, $3, COALESCE($4, 'general_inquiry'), $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
         ON DUPLICATE KEY UPDATE last_visit_at = CURRENT_TIMESTAMP(3)`,
        [conv, JSON.stringify([conv]), avuid, intent, email, blank(a.p_name), blank(a.p_company), blank(a.p_designation), blank(a.p_team_size), use, blank(a.p_country_code), blank(a.p_page_path), blank(a.p_page_path), blank(a.p_utm_source), blank(a.p_utm_medium), blank(a.p_utm_campaign)],
      );
      const r = (await c.query<{ id: number; visit_count: number }>("SELECT id, visit_count FROM bot_leads WHERE conversation_id = $1", [conv])).rows[0];
      await linkVisitor(Number(r.id));
      return [{ lead_id: Number(r.id), matched_on: "new", visits: Number(r.visit_count), requeued: true }];
    }

    const before = (await c.query<Record<string, any>>("SELECT * FROM bot_leads WHERE id = $1 FOR UPDATE", [id])).rows[0];
    const known: string[] = (() => { try { return JSON.parse(before.conversation_ids ?? "[]"); } catch { return []; } })();
    const seen = known.includes(conv);
    const nextIds = seen ? known : [...known, conv];
    let nextUse = before.use_case as string | null;
    if (use) {
      if (nextUse === null) nextUse = use;
      else if (!nextUse.includes(use)) nextUse = `${nextUse}\n\n— return visit —\n${use}`;
    }
    const nextIntent = intent === "general_inquiry" && before.intent && before.intent !== "general_inquiry" ? before.intent : intent ?? before.intent;
    await c.query(
      `UPDATE bot_leads SET
         email = COALESCE(email, $1), name = COALESCE(name, $2), company = COALESCE(company, $3), designation = COALESCE(designation, $4), team_size = COALESCE(team_size, $5),
         avuid = COALESCE(avuid, $6), intent = $7, country_code = COALESCE($8, country_code), page_path = COALESCE($9, page_path), last_page_path = COALESCE($9, last_page_path),
         utm_source = COALESCE(utm_source, $10), utm_medium = COALESCE(utm_medium, $11), utm_campaign = COALESCE(utm_campaign, $12),
         use_case = $13, visit_count = visit_count + $14, conversation_ids = $15, last_visit_at = CURRENT_TIMESTAMP(3)
       WHERE id = $16`,
      [email, blank(a.p_name), blank(a.p_company), blank(a.p_designation), blank(a.p_team_size), avuid, nextIntent, blank(a.p_country_code), blank(a.p_page_path), blank(a.p_utm_source), blank(a.p_utm_medium), blank(a.p_utm_campaign), nextUse, seen ? 0 : 1, JSON.stringify(nextIds), id],
    );
    const after = (await c.query<Record<string, any>>("SELECT * FROM bot_leads WHERE id = $1", [id])).rows[0];
    let requeue = !after.zoho_lead_id || after.crm_sync_status !== "synced" || LEAD_FIELDS.some((f) => (after[f] ?? null) !== (before[f] ?? null));
    if (after.crm_sync_status === "syncing") requeue = false;
    if (requeue) await c.query("UPDATE bot_leads SET crm_sync_status = 'pending', crm_sync_attempts = 0, crm_sync_error = NULL WHERE id = $1", [id]);
    await linkVisitor(id);
    return [{ lead_id: id, matched_on: matched, visits: Number(after.visit_count), requeued: requeue }];
  }));
}

async function claimIdleTranscripts(a: Args): Promise<Record<string, unknown>[]> {
  const idle = Math.max(1, Math.trunc(Number(a.p_idle_minutes ?? 20)));
  const limit = Math.max(1, Math.trunc(Number(a.p_limit ?? 25)));
  const rows = await all<{ conversation_id: string; lead_id: number; zoho_lead_id: string }>(
    `SELECT s.conversation_id, s.lead_id, s.zoho_lead_id FROM (
        SELECT c.conversation_id, l.id AS lead_id, l.zoho_lead_id AS zoho_lead_id, c.last_at,
               ROW_NUMBER() OVER (PARTITION BY c.conversation_id ORDER BY l.created_at ASC, l.id ASC) AS rn
          FROM (SELECT m.conversation_id, MAX(m.created_at) AS last_at FROM bot_messages m
                 WHERE m.synced_at IS NULL AND m.created_at > CURRENT_TIMESTAMP(3) - INTERVAL 7 DAY
                 GROUP BY m.conversation_id HAVING MAX(m.created_at) < CURRENT_TIMESTAMP(3) - INTERVAL ${idle} MINUTE) c
          JOIN bot_leads l ON l.conversation_id = c.conversation_id OR JSON_CONTAINS(l.conversation_ids, JSON_QUOTE(c.conversation_id))
         WHERE l.zoho_lead_id IS NOT NULL
      ) s WHERE s.rn = 1 ORDER BY s.last_at ASC LIMIT ${limit}`,
  );
  return rows.map((r) => ({ conversation_id: r.conversation_id, lead_id: Number(r.lead_id), zoho_lead_id: r.zoho_lead_id }));
}

/* ------------------------------------------------------------------ registry ------------------------------------------------------ */

const FUNCTIONS: Record<string, Fn> = {
  admin_ambassador_status_counts: counts("SELECT status AS k, COUNT(*) AS total FROM ambassador_applications GROUP BY status"),
  admin_internship_status_counts: counts("SELECT status AS k, COUNT(*) AS total FROM internship_applications GROUP BY status"),
  admin_internship_triage_counts: counts("SELECT triage AS k, COUNT(*) AS total FROM internship_applications GROUP BY triage"),
  admin_event_stats: async () => {
    const r = (await all<Record<string, number>>("SELECT (SELECT COUNT(*) FROM events) AS total, (SELECT COUNT(*) FROM events WHERE is_active = 1) AS active, (SELECT COUNT(*) FROM events WHERE is_active = 0) AS inactive, (SELECT COUNT(*) FROM event_registrations) AS total_registrations"))[0];
    return [{ total: Number(r.total), active: Number(r.active), inactive: Number(r.inactive), total_registrations: Number(r.total_registrations) }];
  },
  admin_event_registration_counts: async () => (await all<{ event_id: string; total: number }>("SELECT event_id, COUNT(*) AS total FROM event_registrations GROUP BY event_id")).map((r) => ({ event_id: r.event_id, total: Number(r.total) })),
  apply_cal_booking: applyCalBooking,
  claim_idle_transcripts: claimIdleTranscripts,
  resolve_bot_lead: resolveBotLead,
  touch_bot_visitor: touchBotVisitor,
};

export async function callFunction(name: string, args: Args): Promise<any> {
  const f = FUNCTIONS[name];
  if (!f) throw new Error(`Unknown database function: ${name}`);
  const rows = await f(args);
  // The count functions return { status | triage, total }; give them the column name their callers read.
  if (name === "admin_ambassador_status_counts" || name === "admin_internship_status_counts") return rows.map((r) => ({ status: (r as any).k, total: (r as any).total }));
  if (name === "admin_internship_triage_counts") return rows.map((r) => ({ triage: (r as any).k, total: (r as any).total }));
  return rows;
}
