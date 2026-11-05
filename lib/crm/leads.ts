import { randomBytes } from "node:crypto";
import { all, one, run, val } from "../portal/db";
import { audit } from "../abroad/store";
import { isManager, type Viewer } from "./access";
import * as docs from "./docs";

/** Leads, the pipeline, activities and follow-up tasks (port of Crm\Leads). */
export const STAGES: Record<string, string> = {
  new: "New lead", contacted: "Contacted", counselling_scheduled: "Counselling scheduled", counselling_done: "Counselling completed", interested: "Interested",
  app_started: "Application started", app_submitted: "Application submitted", offer: "Offer received", deposit_paid: "Deposit / paid", visa_applied: "Visa applied",
  visa_approved: "Visa approved", enrolled: "Enrolled", on_hold: "On hold", lost: "Lost",
};
export const SOURCES: Record<string, string> = { walk_in: "Walk-in", website: "Website enquiry", referral: "Referral", instagram: "Instagram", facebook: "Facebook", google: "Google / ads", whatsapp: "WhatsApp", event: "Seminar / event", college: "College tie-up", other: "Other" };
export const COUNTRIES = ["USA", "UK", "Canada", "Australia", "Germany", "France", "Ireland", "New Zealand", "UAE", "Singapore", "Netherlands", "Italy", "Other"];
export const KINDS: Record<string, string> = { note: "Note", call: "Call", whatsapp: "WhatsApp", email: "Email", meeting: "Meeting" };
export const LOST_REASONS = ["Budget", "Chose another consultant", "Not eligible", "Postponed plans", "No response", "Visa risk", "Other"];
export const APP_STATUS: Record<string, string> = { planned: "Planned", submitted: "Submitted", offer: "Offer received", accepted: "Accepted", declined: "Declined by student", rejected: "Rejected" };

export const stageIndex = (s: string): number => Object.keys(STAGES).indexOf(s);

export interface Lead {
  id: number; name: string; phone: string; email: string; city: string; source: string; qualification: string; percentage: number | null; pref_country: string; pref_course: string;
  intake: string; budget_inr: number | null; stage: string; lost_reason: string; counsellor_id: number | null; counsellor_name?: string | null; user_id: number | null; access_token: string;
  consent_at: string | null; last_contact_at: string | null; next_followup_at: string | null; enrolled_at: string | null; created_by: number | null; created_at: string; updated_at: string;
}

const cut = (v: unknown, n: number): string => Array.from(String(v ?? "").trim()).slice(0, n).join("");
const num = (v: unknown): number | null => (v === "" || v === undefined || v === null ? null : Number(v));

// ---- visibility -----------------------------------------------------------------------------------------------------------

/** SQL fragment + params limiting leads to what the user may see. Placeholders start at $1 (callers shift them with `from`). */
export async function scope(user: Viewer, alias = "l", from = 1): Promise<[string, unknown[]]> {
  if (await isManager(user)) return ["1=1", []];
  return [`(${alias}.counsellor_id = $${from} OR ${alias}.counsellor_id IS NULL)`, [user.id]];
}

export async function canView(user: Viewer, lead: Pick<Lead, "counsellor_id">): Promise<boolean> {
  return (await isManager(user)) || lead.counsellor_id === null || Number(lead.counsellor_id) === user.id;
}

export async function canEdit(user: Viewer, lead: Pick<Lead, "counsellor_id">): Promise<boolean> {
  return (await isManager(user)) || Number(lead.counsellor_id ?? 0) === user.id;
}

function mapLead(r: Record<string, unknown>): Lead {
  const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  return { ...(r as object), id: Number(r.id), percentage: n(r.percentage), budget_inr: n(r.budget_inr), counsellor_id: n(r.counsellor_id), user_id: n(r.user_id), created_by: n(r.created_by) } as Lead;
}

export async function find(id: number): Promise<Lead | null> {
  const r = await one("SELECT l.*, c.name AS counsellor_name FROM crm_leads l LEFT JOIN users c ON c.id = l.counsellor_id WHERE l.id = $1", [id]);
  return r ? mapLead(r) : null;
}

export async function findByToken(token: string): Promise<Lead | null> {
  if (!/^[a-f0-9]{32}$/.test(token)) return null;
  const r = await one("SELECT l.*, c.name AS counsellor_name FROM crm_leads l LEFT JOIN users c ON c.id = l.counsellor_id WHERE l.access_token = $1", [token]);
  return r ? mapLead(r) : null;
}

// ---- create / update ------------------------------------------------------------------------------------------------------

export const phone = (p: string): string => p.replace(/[^\d+]/g, "").slice(0, 20);

export async function duplicate(ph: string, email: string): Promise<{ id: number; name: string } | null> {
  if (ph !== "") {
    const digits = ph.replace(/\D/g, "").slice(-10);
    if (digits.length >= 7) {
      const r = await one<{ id: number; name: string }>("SELECT id, name FROM crm_leads WHERE RIGHT(REGEXP_REPLACE(phone, '[^0-9]', ''), 10) = $1 LIMIT 1", [digits]);
      if (r) return r;
    }
  }
  return email !== "" ? one<{ id: number; name: string }>("SELECT id, name FROM crm_leads WHERE email = $1 LIMIT 1", [email]) : null;
}

const validEmail = (e: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && !e.includes("..");

/** Returns [new id, error, possible duplicate]. */
export async function create(d: Record<string, unknown>, actor: number | null, assignToActor = true): Promise<[number | null, string | null, { id: number; name: string } | null]> {
  const name = String(d.name ?? "").trim();
  const ph = phone(String(d.phone ?? ""));
  const email = String(d.email ?? "").trim().toLowerCase();
  if (name === "" || Array.from(name).length > 120) return [null, "Enter the student's name.", null];
  if (ph === "" && email === "") return [null, "Enter a phone number or an email address so we can reach the student.", null];
  if (email !== "" && !validEmail(email)) return [null, "That email address does not look right.", null];
  const dup = await duplicate(ph, email);
  if (dup && !d.force) return [null, `This looks like an existing lead: ${dup.name} (#${dup.id}).`, dup];
  const pct = num(d.percentage);
  const budget = d.budget_inr === "" || d.budget_inr === undefined ? null : Math.max(0, parseInt(String(d.budget_inr).replace(/\D/g, ""), 10) || 0);
  const src = SOURCES[String(d.source ?? "")] ? String(d.source) : "other";
  const id = Number(await val(
    `INSERT INTO crm_leads (name, phone, email, city, source, qualification, percentage, pref_country, pref_course, intake, budget_inr, counsellor_id, access_token, consent_at, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id`,
    [name, ph, email, cut(d.city, 80), src, cut(d.qualification, 80), pct === null ? null : Math.max(0, Math.min(100, pct)), cut(d.pref_country, 40), cut(d.pref_course, 120), cut(d.intake, 30), budget,
      assignToActor && actor ? actor : null, randomBytes(16).toString("hex"), d.consent ? new Date().toISOString().slice(0, 19).replace("T", " ") : null, actor],
  ));
  await log(id, actor, "system", `Lead created (${SOURCES[src]}).`);
  return [id, null, null];
}

export async function update(id: number, d: Record<string, unknown>, actor: number): Promise<void> {
  const pct = num(d.percentage);
  const budget = d.budget_inr === "" || d.budget_inr === undefined ? null : Math.max(0, parseInt(String(d.budget_inr).replace(/\D/g, ""), 10) || 0);
  let email = String(d.email ?? "").trim().toLowerCase();
  if (email !== "" && !validEmail(email)) email = "";
  await run("UPDATE crm_leads SET name = $1, phone = $2, email = $3, city = $4, qualification = $5, percentage = $6, pref_country = $7, pref_course = $8, intake = $9, budget_inr = $10, updated_at = NOW() WHERE id = $11", [
    cut(d.name, 120) || "Unnamed", phone(String(d.phone ?? "")), email, cut(d.city, 80), cut(d.qualification, 80), pct === null ? null : Math.max(0, Math.min(100, pct)), cut(d.pref_country, 40), cut(d.pref_course, 120), cut(d.intake, 30), budget, id,
  ]);
  await log(id, actor, "system", "Profile updated.");
}

// ---- pipeline -------------------------------------------------------------------------------------------------------------

export async function move(id: number, to: string, actor: number, note = ""): Promise<string | null> {
  const lead = await find(id);
  if (!lead || !STAGES[to]) return "Unknown lead or stage.";
  if (lead.stage === to) return null;
  if (to === "lost" && note.trim() === "") return "Choose why this lead was lost.";
  if (to === "enrolled" && Number(await val("SELECT COUNT(*) FROM crm_applications WHERE lead_id = $1 AND status IN ('offer','accepted')", [id])) === 0) return "Add an application with an offer before marking the student as enrolled.";
  const enr = to === "enrolled" ? ", enrolled_at = NOW()" : lead.stage === "enrolled" ? ", enrolled_at = NULL" : "";
  await run(`UPDATE crm_leads SET stage = $1, lost_reason = $2, updated_at = NOW()${enr} WHERE id = $3`, [to, to === "lost" ? cut(note, 160) : "", id]);
  await log(id, actor, "stage", `${STAGES[lead.stage]} -> ${STAGES[to]}${note !== "" && to !== "lost" ? ": " + note : ""}${to === "lost" ? ` (${note})` : ""}`);
  return null;
}

export async function assign(id: number, to: number | null, actor: number): Promise<void> {
  const name = to ? String(await val("SELECT name FROM users WHERE id = $1", [to])) : "the unassigned pool";
  await run("UPDATE crm_leads SET counsellor_id = $1, updated_at = NOW() WHERE id = $2", [to, id]);
  await log(id, actor, "system", `Assigned to ${name}.`);
}

export async function log(leadId: number, actor: number | null, kind: string, body: string): Promise<void> {
  await run("INSERT INTO crm_activities (lead_id, actor_id, kind, body) VALUES ($1,$2,$3,$4)", [leadId, actor, kind, Array.from(body).slice(0, 1000).join("")]);
  if (["call", "whatsapp", "email", "meeting"].includes(kind)) await run("UPDATE crm_leads SET updated_at = NOW(), last_contact_at = NOW() WHERE id = $1", [leadId]);
}

export async function activities(leadId: number, limit = 60): Promise<Array<Record<string, unknown> & { actor: string | null; kind: string; body: string; created_at: string }>> {
  return all(`SELECT a.*, u.name AS actor FROM crm_activities a LEFT JOIN users u ON u.id = a.actor_id WHERE a.lead_id = $1 ORDER BY a.created_at DESC, a.id DESC LIMIT ${Math.trunc(limit)}`, [leadId]);
}

/** A datetime-local value ("2026-11-03T09:30") as a database timestamp; null clears it. */
const localToTs = (v: string | null): string | null => {
  if (!v) return null;
  const m = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/.exec(v);
  return m ? `${m[1]} ${m[2]}:00` : null;
};

export async function setFollowup(id: number, when: string | null): Promise<void> {
  await run("UPDATE crm_leads SET next_followup_at = $1 WHERE id = $2", [localToTs(when), id]);
}

// ---- tasks ----------------------------------------------------------------------------------------------------------------

export async function addTask(leadId: number, assignee: number, title: string, due: string): Promise<void> {
  const ts = localToTs(due) ?? new Date(Date.now() + 86400000).toISOString().slice(0, 19).replace("T", " ");
  await run("INSERT INTO crm_tasks (lead_id, assignee_id, title, due_at) VALUES ($1,$2,$3,$4)", [leadId, assignee, cut(title, 160), ts]);
}

export async function tasks(leadId: number): Promise<Array<Record<string, unknown> & { id: number; title: string; due_at: string; done_at: string | null; assignee: string | null }>> {
  return all("SELECT t.*, u.name AS assignee FROM crm_tasks t LEFT JOIN users u ON u.id = t.assignee_id WHERE t.lead_id = $1 ORDER BY (t.done_at IS NOT NULL), t.due_at", [leadId]);
}

export async function completeTask(taskId: number, user: Viewer): Promise<void> {
  const t = await one<{ id: number; lead_id: number; assignee_id: number | null; counsellor_id: number | null; title: string }>("SELECT t.*, l.counsellor_id FROM crm_tasks t JOIN crm_leads l ON l.id = t.lead_id WHERE t.id = $1", [taskId]);
  if (t && ((await isManager(user)) || Number(t.assignee_id) === user.id || Number(t.counsellor_id) === user.id)) {
    await run("UPDATE crm_tasks SET done_at = NOW() WHERE id = $1 AND done_at IS NULL", [taskId]);
    await log(t.lead_id, user.id, "system", "Task done: " + t.title);
  }
}

// ---- listing --------------------------------------------------------------------------------------------------------------

export interface SearchFilter { q?: string; stage?: string; counsellor?: string; country?: string; source?: string; due?: string; all?: boolean }

export async function search(user: Viewer, f: SearchFilter, limit = 50, offset = 0): Promise<{ rows: Lead[]; total: number }> {
  const p: unknown[] = [];
  const add = (v: unknown) => (p.push(v), "$" + p.length);
  const w: string[] = [];
  const [sc, sp] = await scope(user, "l", 1);
  if (sp.length) {
    p.push(...sp);
    w.push(sc);
  } else w.push(sc);
  if (f.q) {
    const like = add("%" + f.q.trim().toLowerCase().replace(/[\\%_]/g, (c) => "\\" + c) + "%");
    w.push(`(LOWER(l.name) LIKE ${like} OR LOWER(l.email) LIKE ${like} OR l.phone LIKE ${like} OR LOWER(l.pref_course) LIKE ${like})`);
  }
  if (f.stage && STAGES[f.stage]) w.push(`l.stage = ${add(f.stage)}`);
  else if (!f.all) w.push("l.stage NOT IN ('lost','enrolled')");
  if (f.counsellor) w.push(f.counsellor === "none" ? "l.counsellor_id IS NULL" : `l.counsellor_id = ${add(parseInt(f.counsellor, 10) || 0)}`);
  if (f.country) w.push(`l.pref_country = ${add(f.country)}`);
  if (f.source && SOURCES[f.source]) w.push(`l.source = ${add(f.source)}`);
  if (f.due === "overdue") w.push("l.next_followup_at < NOW() AND l.stage NOT IN ('lost','enrolled')");
  else if (f.due === "today") w.push("l.next_followup_at::date = CURRENT_DATE AND l.stage NOT IN ('lost','enrolled')");
  else if (f.due === "stale") w.push("COALESCE(l.last_contact_at, l.created_at) < NOW() - INTERVAL '7 day' AND l.stage NOT IN ('lost','enrolled','on_hold')");
  const cond = w.join(" AND ");
  const total = Number(await val(`SELECT COUNT(*) FROM crm_leads l WHERE ${cond}`, p));
  const rows = await all(`SELECT l.*, c.name AS counsellor_name FROM crm_leads l LEFT JOIN users c ON c.id = l.counsellor_id WHERE ${cond} ORDER BY (l.next_followup_at IS NULL), l.next_followup_at ASC, l.updated_at DESC LIMIT ${Math.trunc(limit)} OFFSET ${Math.trunc(offset)}`, p);
  return { rows: rows.map(mapLead), total };
}

/** Count of leads per stage inside the user's scope. */
export async function stageCounts(user: Viewer): Promise<Record<string, number>> {
  const [sc, sp] = await scope(user);
  const out = Object.fromEntries(Object.keys(STAGES).map((k) => [k, 0]));
  for (const r of await all<{ stage: string; n: number }>(`SELECT l.stage, COUNT(*) AS n FROM crm_leads l WHERE ${sc} GROUP BY l.stage`, sp)) out[r.stage] = Number(r.n);
  return out;
}

/** Remove a lead and every file it owns (privacy requests). */
export async function erase(id: number, actor: number): Promise<void> {
  await docs.deleteAllFor(id);
  await run("DELETE FROM crm_leads WHERE id = $1", [id]);
  await audit(actor, null, "crm.lead.erase", "lead #" + id);
}

// ---- applications ---------------------------------------------------------------------------------------------------------

export async function applications(leadId: number): Promise<Array<Record<string, unknown> & { id: number; university: string; program: string; intake: string; status: string; offer_type: string }>> {
  return all("SELECT * FROM crm_applications WHERE lead_id = $1 ORDER BY created_at", [leadId]);
}

export async function addApplication(leadId: number, d: Record<string, unknown>, actor: number): Promise<string | null> {
  const uni = cut(d.university, 160);
  if (uni === "") return "Enter the university name.";
  await run("INSERT INTO crm_applications (lead_id, university, country, program, intake) VALUES ($1,$2,$3,$4,$5)", [leadId, uni, cut(d.country, 40), cut(d.program, 160), cut(d.intake, 30)]);
  await log(leadId, actor, "system", `Application planned: ${uni}.`);
  return null;
}

export async function setApplication(appId: number, status: string, offerTypeIn: string, actor: number): Promise<string | null> {
  const a = await one<{ id: number; lead_id: number; university: string }>("SELECT * FROM crm_applications WHERE id = $1", [appId]);
  if (!a || !APP_STATUS[status]) return "Unknown application.";
  const offerType = ["conditional", "unconditional"].includes(offerTypeIn) ? offerTypeIn : "";
  await run(
    `UPDATE crm_applications SET status = $1::text, offer_type = $2, applied_at = CASE WHEN $1::text IN ('submitted','offer','accepted') AND applied_at IS NULL THEN NOW() ELSE applied_at END,
       offer_at = CASE WHEN $1::text IN ('offer','accepted') AND offer_at IS NULL THEN NOW() ELSE offer_at END, updated_at = NOW() WHERE id = $3`,
    [status, status === "offer" || status === "accepted" ? offerType : "", appId],
  );
  await log(a.lead_id, actor, "system", `${a.university}: ${APP_STATUS[status]}${offerType && ["offer", "accepted"].includes(status) ? ` (${offerType})` : ""}.`);
  // keep the funnel honest: an application moving forward lifts the lead's stage, never lowers it
  const lead = await find(a.lead_id);
  const target = status === "submitted" ? "app_submitted" : ["offer", "accepted"].includes(status) ? "offer" : null;
  if (lead && target && !["lost", "on_hold"].includes(lead.stage) && stageIndex(lead.stage) < stageIndex(target)) await move(lead.id, target, actor, "automatic from application");
  return null;
}


