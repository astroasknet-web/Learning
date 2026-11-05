import { createAdminClient } from "@/lib/data/server";
import { createLogger } from "@/lib/log";
import {
  createContactNote,
  createContactTask,
  createLeadNote,
  createLeadTask,
  searchContactByEmail,
  updateTask,
  upsertLead,
} from "@/lib/crm/zoho-client";
import type { PersonResolution } from "@/lib/crm/sources";
import type { ZohoLeadRecord } from "@/lib/crm/payload";
import { eventTypeLabel } from "@/lib/cal";
import type { Tables } from "@/types/database";

/**
 * Zoho behaviour specific to Cal.com bookings: who the booking attaches to, and
 * what gets created once it has.
 */

const log = createLogger("crm-call-booking");

type Booking = Tables<"call_bookings">;

/**
 * Decide which Zoho record this person is.
 *
 * upsertLead deduplicates on Email inside the LEADS MODULE ONLY. The moment a
 * Lead is converted it becomes a Contact and vanishes from that search, so a
 * booking by an existing customer would create a fresh Lead — a duplicate of a
 * person the CRM already knows, which is exactly what requirement 3 rules out.
 * So Contacts are checked first (locked decision D4).
 *
 * searchContactByEmail THROWS on a transient failure rather than returning
 * null, and that is load-bearing: a null would read as "no Contact exists" and
 * fall straight through to creating the duplicate. A throw sends the row back to
 * 'failed' for the cron to retry, which is the only safe response to "we don't
 * know yet".
 */
export async function resolveBookingPerson(payload: ZohoLeadRecord): Promise<PersonResolution> {
  const contactId = await searchContactByEmail(payload.Email);
  if (contactId) {
    log.info(`${payload.Email} is an existing Contact (${contactId}) — no Lead created`);
    return { type: "contact", id: contactId, action: "update" };
  }
  return { type: "lead", ...(await upsertLead({ ...payload })) };
}

/** YYYY-MM-DD in IST — Zoho Due_Date is a date, and the team works in IST. */
function dueDateFor(startTime: string): string {
  const start = new Date(startTime);
  const istDate = new Date(start.getTime() + 5.5 * 60 * 60 * 1000);
  return istDate.toISOString().slice(0, 10);
}

function whenIst(startTime: string): string {
  return `${new Date(startTime).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  })} IST`;
}

function noteContent(booking: Booking): string {
  return [
    `Status: ${booking.status}`,
    `Scheduled: ${whenIst(booking.start_time)}`,
    booking.attendee_timezone ? `Attendee timezone: ${booking.attendee_timezone}` : null,
    booking.company ? `Company: ${booking.company}` : null,
    booking.team_size ? `Team size: ${booking.team_size}` : null,
    booking.source ? `Booked from: ${booking.source}` : null,
    booking.page_path ? `Page: ${booking.page_path}` : null,
    booking.utm_campaign ? `Campaign: ${booking.utm_campaign}` : null,
    booking.meeting_url ? `Meeting: ${booking.meeting_url}` : null,
    booking.cancellation_reason ? `Cancellation reason: ${booking.cancellation_reason}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * afterSync hook for call_bookings. Runs once the Lead or Contact exists.
 *
 * Task and Note policy, and why they differ:
 *
 *  - TASK: exactly one per booking, guarded by zoho_task_created. NOT one per
 *    person the way bot_leads does it — each booked call is its own commitment
 *    with its own date, and a second call deserves a second reminder. A
 *    cancellation does not create a new Task; it defers and renames the
 *    existing one, because "booked then cancelled" is history a salesperson
 *    wants to see rather than a row that silently disappears.
 *  - NOTE: one per lifecycle event, counter-gated on zoho_notes_count <
 *    events_count. Reschedules and cancellations are precisely the things
 *    field updates cannot convey — without a Note they would be invisible in
 *    the record.
 *
 * Every step is individually guarded and individually failure-tolerant: the
 * Lead/Contact already exists by the time this runs, so a Task or Note failure
 * is logged and left for the sweep's afterSync lane, never allowed to fail the
 * sync itself.
 */
export async function callBookingAfterSync(
  row: Booking,
  result: PersonResolution,
): Promise<void> {
  const admin = createAdminClient();
  const label = eventTypeLabel(row.cal_event_type_id);
  const who = row.company?.trim() || row.attendee_name || row.email;
  const isContact = result.type === "contact";

  // ── Task ────────────────────────────────────────────────────────────────
  if (!row.zoho_task_created) {
    try {
      const subject =
        row.status === "cancelled"
          ? `Call CANCELLED: ${who} — was ${whenIst(row.start_time)}`
          : `Call scheduled: ${who} — ${whenIst(row.start_time)}`;

      const taskId = isContact
        ? await createContactTask({
            contactId: result.id,
            subject,
            dueDate: dueDateFor(row.start_time),
            description: noteContent(row),
          })
        : await createLeadTask({
            leadId: result.id,
            subject,
            dueDate: dueDateFor(row.start_time),
            description: noteContent(row),
          });

      await admin
        .from("call_bookings")
        .update({ zoho_task_created: true, zoho_task_id: taskId })
        .eq("id", row.id);
    } catch (error) {
      log.error(`call_bookings#${row.id} task creation failed:`, error);
    }
  } else if (row.zoho_task_id && (row.status === "cancelled" || row.status === "rescheduled")) {
    // The Task already exists and the booking has since moved or died. Update in
    // place rather than creating a second one: two open Tasks for one call is
    // how a follow-up queue becomes untrustworthy.
    try {
      await updateTask(
        row.zoho_task_id,
        row.status === "cancelled"
          ? {
              Subject: `Call CANCELLED: ${who} — was ${whenIst(row.start_time)}`,
              Status: "Deferred",
            }
          : {
              Subject: `Call scheduled: ${who} — ${whenIst(row.start_time)}`,
              Due_Date: dueDateFor(row.start_time),
            },
      );
    } catch (error) {
      log.error(`call_bookings#${row.id} task update failed:`, error);
    }
  }

  // ── Note ────────────────────────────────────────────────────────────────
  const events = row.events_count ?? 1;
  if ((row.zoho_notes_count ?? 0) < events) {
    try {
      const title =
        row.status === "cancelled"
          ? `Call cancelled (${label})`
          : row.status === "rescheduled"
            ? `Call rescheduled (${label})`
            : `Call booked via Cal.com (${label})`;

      if (isContact) {
        await createContactNote({ contactId: result.id, title, content: noteContent(row) });
      } else {
        await createLeadNote({ leadId: result.id, title, content: noteContent(row) });
      }

      // Advance to the observed count rather than incrementing: if two events
      // landed while Zoho was unreachable, one Note describing the current state
      // is more useful than a backlog of stale ones.
      await admin.from("call_bookings").update({ zoho_notes_count: events }).eq("id", row.id);
    } catch (error) {
      log.error(`call_bookings#${row.id} note creation failed:`, error);
    }
  }
}
