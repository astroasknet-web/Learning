import { all, one, run, val } from "../portal/db";
import * as A from "./catalogue";
import * as funds from "./funds";
import * as notify from "./notify";
import { application, audit } from "./store";
import * as vault from "./vault";

/**
 * Visa case tracker (port of Portal\Visa): one case per application the student has been offered or has accepted. The student enters the
 * appointment themselves (GrowQR does not book embassy slots); we give reminders, a calendar file and a readiness check.
 */
export const STAGES: Record<string, string> = {
  preparing: "Preparing documents", booked: "Appointment booked", attended: "Appointment attended", pending: "Decision pending", approved: "Visa approved", refused: "Visa refused",
};
const AFTER_APPOINTMENT = ["attended", "pending", "approved", "refused"];

export interface Case {
  id: number; user_id: number; application_id: number; stage: string; appointment_at: string | null; biometrics_at: string | null; centre: string; notes: string;
  reminded_7: string | null; reminded_1: string | null; uni_name: string; country_key: string; app_status?: string; program?: string; intake?: string; uni_slug?: string;
}

/** Create a case for every application that has reached the offer stage. */
export async function ensureCases(uid: number): Promise<void> {
  await run(
    `INSERT INTO sa_visa (user_id, application_id, created_at, updated_at)
     SELECT user_id, id, NOW(), NOW() FROM sa_applications WHERE user_id = $1 AND status IN ('offer','accepted') ON CONFLICT (application_id) DO NOTHING`,
    [uid],
  );
}

export async function forUser(uid: number): Promise<Case[]> {
  await ensureCases(uid);
  return all<Case>(
    `SELECT v.*, a.status AS app_status, a.program, a.intake, u.name AS uni_name, u.slug AS uni_slug, u.country_key
     FROM sa_visa v JOIN sa_applications a ON a.id = v.application_id JOIN sa_universities u ON u.id = a.university_id
     WHERE v.user_id = $1 ORDER BY CASE a.status WHEN 'accepted' THEN 0 ELSE 1 END, v.id`,
    [uid],
  );
}

export async function find(id: number): Promise<Case | null> {
  return one<Case>("SELECT v.*, u.name AS uni_name, u.country_key FROM sa_visa v JOIN sa_applications a ON a.id = v.application_id JOIN sa_universities u ON u.id = a.university_id WHERE v.id = $1", [id]);
}

/** Parse a <input type="datetime-local"> value: null when empty, "" when malformed, else "YYYY-MM-DD HH:MM:00". */
export function parseLocal(v: string): string | null {
  const s = v.trim();
  if (s === "") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(s);
  if (!m) return "";
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d, h, mi));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d || dt.getUTCHours() !== h || dt.getUTCMinutes() !== mi) return "";
  return `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}:00`;
}

const ts = (s: string): number => Date.parse(s.replace(" ", "T") + "Z");

export async function save(uid: number, id: number, input: Record<string, unknown>, now = Date.now()): Promise<string | null> {
  const c = await find(id);
  if (!c || Number(c.user_id) !== uid) return "Visa case not found.";
  const stage = String(input.stage ?? "");
  if (!STAGES[stage]) return "Choose where you are in the visa process.";
  const appt = parseLocal(String(input.appointment_at ?? ""));
  const bio = parseLocal(String(input.biometrics_at ?? ""));
  if (appt === "" || bio === "") return "Enter the date and time in the format shown.";
  for (const d of [appt, bio]) if (d !== null && (ts(d) < now - 366 * 86400000 || ts(d) > now + 731 * 86400000)) return "That date looks wrong. Check the year.";
  if (stage !== "preparing" && appt === null) return 'Add your appointment date to move past "Preparing documents".';
  if (AFTER_APPOINTMENT.includes(stage) && appt !== null && ts(appt) > now) return "Your appointment is still in the future, so it cannot be marked as attended or decided yet.";
  const centre = Array.from(String(input.centre ?? "").trim()).slice(0, 80).join("");
  const notes = Array.from(String(input.notes ?? "").trim()).slice(0, 500).join("");
  const moved = appt !== (c.appointment_at ? String(c.appointment_at).slice(0, 19) : null); // a moved appointment should be reminded again
  await run("UPDATE sa_visa SET stage = $1, appointment_at = $2, biometrics_at = $3, centre = $4, notes = $5, reminded_7 = $6, reminded_1 = $7, updated_at = NOW() WHERE id = $8", [
    stage, appt, bio, centre, notes, moved ? null : c.reminded_7, moved ? null : c.reminded_1, id,
  ]);
  await audit(uid, uid, "visa.update", `${c.uni_name}: ${stage}`);
  return null;
}

export interface ReadinessItem { 0: string; 1: boolean; 2: string }

/** Readiness checklist for one visa case. */
export async function readiness(uid: number, c: Case): Promise<{ items: ReadinessItem[]; done: number; total: number }> {
  const app = await application(Number(c.application_id));
  const country = await A.country(c.country_key);
  const uni = await A.universityById(app?.university_id ?? 0);
  const visaItems = country?.visa?.steps?.length ?? 0; // the PHP version counted the keys of the visa block (always 2); the steps are what the student ticks
  const ticked = app?.visa_done.length ?? 0;
  let fundsOk = false;
  if (uni && country) fundsOk = funds.coverage(await funds.pool(uid), funds.target(uni, country).min_inr).status === "ready";
  const practiced = Number(await val("SELECT COUNT(*) FROM sa_mock_sessions WHERE user_id = $1 AND country_key = $2 AND finished_at IS NOT NULL", [uid, c.country_key])) > 0;
  const items: ReadinessItem[] = [
    ["Offer accepted", app?.status === "accepted", "/abroad#apps"],
    ["Required documents verified", (await vault.unverifiedRequired(uid)).length === 0, "/abroad/documents"],
    ["Funds fully documented", fundsOk, "/abroad/funds"],
    [`Visa checklist complete (${ticked}/${visaItems})`, visaItems > 0 && ticked >= visaItems, "/abroad#apps"],
    ["Appointment booked", c.appointment_at !== null, "/abroad/visa"],
    ["Mock interview practised", practiced, `/abroad/interview?c=${c.country_key}`],
  ];
  return { items, done: items.filter((i) => i[1]).length, total: items.length };
}

/** Calendar file for the appointment (floating local time at the centre). `stamp` is only for tests. */
export function ics(c: Pick<Case, "id" | "uni_name" | "centre" | "appointment_at">, stamp = new Date()): string {
  const [datePart, timePart] = String(c.appointment_at).slice(0, 19).split(/[ T]/);
  const start = new Date(`${datePart}T${timePart}Z`);
  const end = new Date(start.getTime() + 3600000);
  const f = (d: Date) => d.toISOString().slice(0, 19).replace(/[-:]/g, "");
  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//GrowQR//Visa//EN", "CALSCALE:GREGORIAN", "BEGIN:VEVENT",
    `UID:visa-${Number(c.id)}@growqr`,
    "DTSTAMP:" + stamp.toISOString().slice(0, 19).replace(/[-:]/g, "") + "Z",
    "DTSTART:" + f(start),
    "DTEND:" + f(end),
    "SUMMARY:" + esc("Visa appointment: " + c.uni_name),
    "LOCATION:" + esc(String(c.centre ?? "")),
    "DESCRIPTION:" + esc("Carry your passport, appointment confirmation and the documents on your checklist. Time is local to the centre."),
    "BEGIN:VALARM", "TRIGGER:-P1D", "ACTION:DISPLAY", "DESCRIPTION:Visa appointment tomorrow", "END:VALARM",
    "END:VEVENT", "END:VCALENDAR",
  ];
  return lines.join("\r\n") + "\r\n";
}

/** Send due reminders (7-day and 1-day). Safe to run repeatedly; each reminder is sent once per appointment. Returns the number queued. */
export async function sendDueReminders(): Promise<number> {
  let n = 0;
  const rows = await all<Case>(
    `SELECT v.*, u.name AS uni_name FROM sa_visa v JOIN sa_applications a ON a.id = v.application_id JOIN sa_universities u ON u.id = a.university_id
     WHERE v.stage = 'booked' AND v.appointment_at > NOW() AND v.appointment_at <= (NOW() + INTERVAL '7 days')`,
  );
  for (const v of rows) {
    const hours = (ts(String(v.appointment_at)) - Date.now()) / 3600000;
    if (hours <= 30 && v.reminded_1 === null) {
      await notify.visaReminder(Number(v.user_id), { uni_name: v.uni_name, appointment_at: String(v.appointment_at), centre: v.centre }, 1);
      await run("UPDATE sa_visa SET reminded_1 = NOW(), reminded_7 = COALESCE(reminded_7, NOW()) WHERE id = $1", [v.id]);
      n++;
    } else if (hours > 30 && v.reminded_7 === null) {
      await notify.visaReminder(Number(v.user_id), { uni_name: v.uni_name, appointment_at: String(v.appointment_at), centre: v.centre }, 7);
      await run("UPDATE sa_visa SET reminded_7 = NOW() WHERE id = $1", [v.id]);
      n++;
    }
  }
  return n;
}
