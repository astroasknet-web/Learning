import { all, one, run, val } from "../portal/db";
import * as notify from "./notify";

/** Applications, the status pipeline and its audit trail (port of Portal\Applications). */
export const STAGES = ["Applied", "Viewed", "Shortlisted", "Interview", "Offered", "Hired", "Rejected"] as const;
export type Stage = (typeof STAGES)[number];

export interface ApplyInput { note: string; answer: string; phone: string; avail: string; file?: string | null; file_name?: string | null; resume_text?: string | null; match?: number | null }

/** The new application id, or null if the student already applied. */
export async function apply(jobId: number, studentId: number, d: ApplyInput): Promise<number | null> {
  const id = await val<number>(
    `INSERT INTO applications (internship_id, student_id, status, note, answer, phone, availability, resume_file, resume_name, resume_text, match_score, created_at, updated_at)
     VALUES ($1,$2,'Applied',$3,$4,$5,$6,$7,$8,$9,$10,NOW(),NOW()) ON CONFLICT (internship_id, student_id) DO NOTHING RETURNING id`,
    [jobId, studentId, d.note, d.answer, d.phone, d.avail, d.file ?? null, d.file_name ?? null, d.resume_text ?? null, d.match ?? null],
  );
  if (id === null) return null;
  await event(Number(id), "Applied", "Application submitted", studentId);
  await notify.applicationCreated(Number(id));
  return Number(id);
}

export async function event(appId: number, status: string, note: string, actor: number | null): Promise<void> {
  await run("INSERT INTO application_events (application_id, status, note, actor_user_id, created_at) VALUES ($1,$2,$3,$4,NOW())", [appId, status, Array.from(note).slice(0, 255).join(""), actor]);
}

export async function appliedJobIds(studentId: number): Promise<number[]> {
  return (await all<{ internship_id: number }>("SELECT internship_id FROM applications WHERE student_id = $1", [studentId])).map((r) => Number(r.internship_id));
}

export async function existing(jobId: number, studentId: number): Promise<{ id: number; status: string } | null> {
  return one<{ id: number; status: string }>("SELECT id, status FROM applications WHERE internship_id = $1 AND student_id = $2", [jobId, studentId]);
}

export interface StudentApplication { id: number; status: string; created_at: string; updated_at: string; match_score: number | null; title: string; slug: string; company: string; last_note: string | null }

/** A student's applications with the latest employer note. */
export async function forStudent(studentId: number): Promise<StudentApplication[]> {
  return all<StudentApplication>(
    `SELECT a.id, a.status, a.created_at, a.updated_at, a.match_score, i.title, i.slug, c.name AS company,
        (SELECT e.note FROM application_events e WHERE e.application_id = a.id ORDER BY e.id DESC LIMIT 1) AS last_note
     FROM applications a JOIN internships i ON i.id = a.internship_id JOIN companies c ON c.id = i.company_id
     WHERE a.student_id = $1 ORDER BY a.updated_at DESC`,
    [studentId],
  );
}

export async function events(appId: number): Promise<Array<{ status: string; note: string; created_at: string }>> {
  return all("SELECT status, note, created_at FROM application_events WHERE application_id = $1 ORDER BY id DESC", [appId]);
}

export interface CompletedCourse { title: string; verified: number; certificate_url: string | null; tier: "verified" | "certificate" | "self" }

/** Completed courses (any tier) for employers to see, per student. */
export async function completedTitles(userId: number): Promise<CompletedCourse[]> {
  const rows = await all<Omit<CompletedCourse, "tier">>(
    `SELECT c.title, e.verified, e.certificate_url FROM course_enrolments e JOIN courses c ON c.id = e.course_id
     WHERE e.user_id = $1 AND e.status = 'completed' ORDER BY e.completed_at DESC`,
    [userId],
  );
  return rows.map((r) => ({ ...r, tier: Number(r.verified) === 1 ? "verified" : String(r.certificate_url ?? "").trim() !== "" ? "certificate" : "self" }));
}

export interface Applicant extends Record<string, unknown> { id: number; student_id: number; name: string; email: string; skills: string[]; courses: CompletedCourse[] }

/** Applicants for one posting, best match first. */
export async function forJob(jobId: number): Promise<Applicant[]> {
  const rows = await all<Record<string, unknown>>(
    `SELECT a.*, u.name, u.email, sp.college, sp.rq_overall, sp.rq_grade, sp.skills
     FROM applications a JOIN users u ON u.id = a.student_id LEFT JOIN student_profiles sp ON sp.user_id = a.student_id
     WHERE a.internship_id = $1 ORDER BY COALESCE(a.match_score, 0) DESC, a.created_at ASC`,
    [jobId],
  );
  const out: Applicant[] = [];
  for (const r of rows) {
    let skills: string[] = [];
    try {
      const v = JSON.parse(String(r.skills ?? "[]"));
      if (Array.isArray(v)) skills = v.map(String);
    } catch {
      /* none */
    }
    out.push({ ...r, id: Number(r.id), student_id: Number(r.student_id), name: String(r.name), email: String(r.email), skills, courses: await completedTitles(Number(r.student_id)) });
  }
  return out;
}

/** Application + its posting owner, for authorisation checks. */
export async function withOwner(appId: number): Promise<(Record<string, unknown> & { owner_user_id: number | null; title: string; status: string }) | null> {
  return one(`SELECT a.*, i.title, c.owner_user_id FROM applications a JOIN internships i ON i.id = a.internship_id JOIN companies c ON c.id = i.company_id WHERE a.id = $1`, [appId]);
}

/** Move an application to a stage. The caller must already have verified ownership. */
export async function move(appId: number, status: string, note: string, actor: number): Promise<boolean> {
  if (!(STAGES as readonly string[]).includes(status)) return false;
  if (status === "Rejected" && note.trim() === "") return false; // platform rule: every rejection carries a reason
  await run("UPDATE applications SET status = $1, updated_at = NOW() WHERE id = $2", [status, appId]);
  await event(appId, status, note !== "" ? note : "Moved to " + status, actor);
  await notify.statusChanged(appId, status, note);
  return true;
}

/** Opening an application as the employer marks it Viewed (once). */
export async function markViewed(appId: number, actor: number): Promise<void> {
  if ((await val("SELECT status FROM applications WHERE id = $1", [appId])) === "Applied") await move(appId, "Viewed", "Viewed by employer", actor);
}

export async function counts(userId: number): Promise<{ live_roles: number; pending_roles: number; total_apps: number; new_apps: number }> {
  const r = await one<Record<string, unknown>>(
    `SELECT COUNT(DISTINCT CASE WHEN i.status = 'live' THEN i.id END) AS live_roles,
            COUNT(DISTINCT CASE WHEN i.status = 'pending' THEN i.id END) AS pending_roles,
            COUNT(a.id) AS total_apps,
            SUM(CASE WHEN a.created_at > (NOW() - INTERVAL '7 days') THEN 1 ELSE 0 END) AS new_apps
     FROM internships i JOIN companies c ON c.id = i.company_id LEFT JOIN applications a ON a.internship_id = i.id
     WHERE c.owner_user_id = $1`,
    [userId],
  );
  return { live_roles: Number(r?.live_roles ?? 0), pending_roles: Number(r?.pending_roles ?? 0), total_apps: Number(r?.total_apps ?? 0), new_apps: Number(r?.new_apps ?? 0) };
}
