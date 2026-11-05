import { all, run } from "../portal/db";
import { log } from "./leads";

/**
 * The student's route to an offer, beyond the application itself: English tests, aptitude tests, internship, community service (NGO
 * certificate) and the written/financial pieces (port of Crm\Path). Each is tracked per lead.
 */
export const STATUS: Record<string, string> = { not_started: "Not started", in_progress: "In progress", booked: "Exam booked", completed: "Completed", certified: "Certificate received" };

/** kind => [label, group, hint for the detail field, document type that proves it] */
export const KINDS: Record<string, [string, string, string, string]> = {
  ielts: ["IELTS", "English proficiency", "Band, e.g. 7.0 overall (L/R/W/S)", "english_test"],
  toefl: ["TOEFL iBT", "English proficiency", "Total out of 120", "english_test"],
  pte: ["PTE Academic", "English proficiency", "Overall out of 90", "english_test"],
  duolingo: ["Duolingo English Test", "English proficiency", "Score out of 160", "english_test"],
  sat: ["SAT", "Aptitude test", "Total out of 1600", "sat_score"],
  act: ["ACT", "Aptitude test", "Composite out of 36", "sat_score"],
  gre: ["GRE", "Aptitude test", "Total out of 340", "gre_gmat_score"],
  gmat: ["GMAT", "Aptitude test", "Total out of 805", "gre_gmat_score"],
  internship: ["Internship", "Profile building", "Organisation, role, duration", "internship_cert"],
  community_service: ["Community service (NGO certificate)", "Profile building", "NGO name, hours served", "community_cert"],
  sop: ["Statement of purpose", "Application writing", "Draft status / reviewer", "sop"],
  lor: ["Letters of recommendation", "Application writing", "Referees and status", "lor"],
  financials: ["Proof of funds", "Finance", "Sponsor and amount", "financial"],
  passport: ["Passport valid for the course", "Identity", "Expiry date", "passport"],
};

export interface Milestone { id: number; lead_id: number; kind: string; status: string; target_date: string | null; exam_date: string | null; score: string; detail: string; updated_at: string }

export async function ensureAll(leadId: number): Promise<void> {
  for (const k of Object.keys(KINDS)) await run("INSERT INTO crm_milestones (lead_id, kind) VALUES ($1,$2) ON CONFLICT (lead_id, kind) DO NOTHING", [leadId, k]);
}

export async function forLead(leadId: number): Promise<Record<string, Milestone | null>> {
  await ensureAll(leadId);
  const rows = await all<Milestone>("SELECT * FROM crm_milestones WHERE lead_id = $1", [leadId]);
  const by = new Map(rows.map((r) => [r.kind, r]));
  return Object.fromEntries(Object.keys(KINDS).map((k) => [k, by.get(k) ?? null]));
}

const date = (v: unknown): string | null => (/^\d{4}-\d{2}-\d{2}$/.test(String(v ?? "")) ? String(v) : null);

export async function save(leadId: number, kind: string, d: Record<string, unknown>, actor: number): Promise<string | null> {
  if (!KINDS[kind]) return "Unknown step.";
  const status = STATUS[String(d.status ?? "")] ? String(d.status) : "not_started";
  await ensureAll(leadId);
  const score = Array.from(String(d.score ?? "").trim()).slice(0, 30).join("");
  await run("UPDATE crm_milestones SET status = $1, target_date = $2, exam_date = $3, score = $4, detail = $5, updated_at = NOW() WHERE lead_id = $6 AND kind = $7", [
    status, date(d.target_date), date(d.exam_date), score, Array.from(String(d.detail ?? "").trim()).slice(0, 255).join(""), leadId, kind,
  ]);
  await log(leadId, actor, "system", `${KINDS[kind][0]}: ${STATUS[status]}${score !== "" ? ` (${score})` : ""}.`);
  return null;
}

/** Share of the path that is done (completed or certified), as a percentage, ignoring English tests the student does not need. */
export function progress(milestones: Record<string, Pick<Milestone, "status"> | null>): number {
  const finished = (m: Pick<Milestone, "status"> | null) => !!m && ["completed", "certified"].includes(m.status);
  let done = 0;
  let total = 0;
  const englishDone = Object.entries(milestones).some(([k, m]) => KINDS[k][1] === "English proficiency" && finished(m));
  let englishCounted = false;
  for (const [k, m] of Object.entries(milestones)) {
    if (KINDS[k][1] === "English proficiency") {
      if (englishCounted) continue; // one English test is enough
      englishCounted = true;
      total++;
      done += englishDone ? 1 : 0;
      continue;
    }
    if (["sat", "act", "gre", "gmat"].includes(k) && (!m || m.status === "not_started")) continue; // only counted once the student has started one
    total++;
    done += finished(m) ? 1 : 0;
  }
  return total > 0 ? Math.round((done / total) * 100) : 0;
}
