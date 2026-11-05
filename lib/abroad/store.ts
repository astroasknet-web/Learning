import { all, one, run, val } from "../portal/db";
import { clientIp, sha256 } from "../portal/security";
import * as A from "./catalogue";
import * as notify from "./notify";
import * as vault from "./vault";

/**
 * A student's study-abroad journey: profile, shortlist, applications, the stage state machine and the audit trail (port of Portal\AbroadStore).
 * Authorisation is enforced here and in the pages: students touch only their own rows; status changes beyond "submit for review" and
 * "accept offer" are admin / counselor actions.
 */
export const CONSENT_VERSION = "2026-10";

// ---- audit & history ------------------------------------------------------------------------------------------------------

export async function audit(actor: number | null, subject: number | null, action: string, detail = ""): Promise<void> {
  let ip = "";
  try {
    ip = sha256(await clientIp()).slice(0, 16);
  } catch {
    /* outside a request (a script or a test) */
  }
  await run("INSERT INTO sa_audit (actor_user_id, subject_user_id, action, detail, ip_hash, created_at) VALUES ($1,$2,$3,$4,$5,NOW())", [actor, subject, action, Array.from(detail).slice(0, 255).join(""), ip]);
}

async function history(uid: number, scope: string, appId: number | null, from: string, to: string, actor: number | null, note = ""): Promise<void> {
  await run("INSERT INTO sa_status_history (user_id, application_id, scope, from_status, to_status, actor_user_id, note, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())", [uid, appId, scope, from, to, actor, Array.from(note).slice(0, 255).join("")]);
}

export async function historyFor(uid: number, limit = 12): Promise<Array<Record<string, unknown> & { actor: string | null }>> {
  return all(`SELECT h.*, u.name AS actor FROM sa_status_history h LEFT JOIN users u ON u.id = h.actor_user_id WHERE h.user_id = $1 ORDER BY h.id DESC LIMIT ${Math.trunc(limit)}`, [uid]);
}

// ---- profile --------------------------------------------------------------------------------------------------------------

export interface SaProfile extends A.Profile {
  user_id: number; score_type: string; score_value: string | null; english_test: string; english_score: string | null; gre: number | null; intake: string; goal: string;
  stage: string; consent_at: string | null; consent_version: string; counselor_id: number | null; country_list: string[]; created_at: string; updated_at: string;
}

export async function profile(uid: number): Promise<SaProfile | null> {
  const p = await one<Record<string, unknown>>("SELECT * FROM sa_profiles WHERE user_id = $1", [uid]);
  if (!p) return null;
  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  return {
    ...(p as object), user_id: Number(p.user_id), academic_index: num(p.academic_index), english_eq: num(p.english_eq), budget_inr: num(p.budget_inr), gre: num(p.gre),
    counselor_id: num(p.counselor_id), score_value: p.score_value === null ? null : String(p.score_value), english_score: p.english_score === null ? null : String(p.english_score),
    country_list: String(p.countries ?? "").split(",").filter(Boolean),
  } as SaProfile;
}

export const isComplete = (p: SaProfile | null): boolean => p !== null && p.academic_index !== null && p.field !== "" && p.consent_at !== null;

export interface ProfileInput { level: string; field: string; score_type: string; score_value: number; english_test: string; english_score: number | null; gre: number | null; budget_inr: number; countries: string[]; intake: string; goal: string }

export async function saveProfile(uid: number, d: ProfileInput, consent: boolean): Promise<void> {
  const index = A.academicIndex(d.score_type, d.score_value);
  const eq = d.english_test === "none" || d.english_score === null ? null : A.englishEq(d.english_test, d.english_score);
  const exists = (await val("SELECT user_id FROM sa_profiles WHERE user_id = $1", [uid])) !== null;
  const base = [d.level, d.field, d.score_type, d.score_value, index, d.english_test, d.english_test === "none" ? null : d.english_score, eq, d.gre, Math.trunc(d.budget_inr), d.countries.join(","), d.intake, d.goal];
  if (exists) {
    await run(
      `UPDATE sa_profiles SET level=$1, field=$2, score_type=$3, score_value=$4, academic_index=$5, english_test=$6, english_score=$7, english_eq=$8, gre=$9, budget_inr=$10, countries=$11, intake=$12, goal=$13,
         consent_version = CASE WHEN consent_at IS NULL AND $14::int = 1 THEN $15 ELSE consent_version END,
         consent_at = COALESCE(consent_at, CASE WHEN $14::int = 1 THEN NOW() ELSE NULL END), updated_at = NOW() WHERE user_id = $16`,
      [...base, consent ? 1 : 0, CONSENT_VERSION, uid],
    );
  } else {
    await run(
      `INSERT INTO sa_profiles (level, field, score_type, score_value, academic_index, english_test, english_score, english_eq, gre, budget_inr, countries, intake, goal, consent_at, consent_version, user_id, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13, CASE WHEN $14::int = 1 THEN NOW() ELSE NULL END, $15, $16, NOW(), NOW())`,
      [...base, consent ? 1 : 0, consent ? CONSENT_VERSION : "", uid],
    );
  }
  await audit(uid, uid, exists ? "profile.update" : "profile.create");
  await syncStage(uid, uid, "Profile saved");
}

// ---- shortlist ------------------------------------------------------------------------------------------------------------

export async function shortlistIds(uid: number): Promise<number[]> {
  return (await all<{ university_id: number }>("SELECT university_id FROM sa_shortlist WHERE user_id = $1", [uid])).map((r) => Number(r.university_id));
}

export async function toggleShortlist(uid: number, uniId: number): Promise<boolean> {
  if ((await val("SELECT university_id FROM sa_shortlist WHERE user_id = $1 AND university_id = $2", [uid, uniId])) !== null) {
    await run("DELETE FROM sa_shortlist WHERE user_id = $1 AND university_id = $2", [uid, uniId]);
    return false;
  }
  if ((await A.universityById(uniId)) === null) return false;
  await run("INSERT INTO sa_shortlist (user_id, university_id, created_at) VALUES ($1,$2,NOW()) ON CONFLICT DO NOTHING", [uid, uniId]);
  return true;
}

// ---- applications ---------------------------------------------------------------------------------------------------------

const APP_SELECT = "SELECT a.*, u.slug AS uni_slug, u.name AS uni_name, u.city, u.country_key, u.band, u.cost_tier FROM sa_applications a JOIN sa_universities u ON u.id = a.university_id";

export interface Application {
  id: number; user_id: number; university_id: number; program: string; intake: string; status: string; offer_type: string; offer_note: string; visa_done: number[];
  uni_slug: string; uni_name: string; city: string; country_key: string; band: number; cost_tier: string; created_at: string; updated_at: string;
}

function mapApp(r: Record<string, unknown>): Application {
  let done: number[] = [];
  try {
    const v = JSON.parse(String(r.visa_done_json ?? "[]"));
    if (Array.isArray(v)) done = v.map((x) => Math.trunc(Number(x)));
  } catch {
    /* none */
  }
  return { ...(r as object), id: Number(r.id), user_id: Number(r.user_id), university_id: Number(r.university_id), band: Number(r.band), visa_done: done } as Application;
}

export async function applications(uid: number): Promise<Application[]> {
  return (await all(`${APP_SELECT} WHERE a.user_id = $1 ORDER BY a.updated_at DESC`, [uid])).map(mapApp);
}

export async function application(id: number): Promise<Application | null> {
  const r = await one(`${APP_SELECT} WHERE a.id = $1`, [id]);
  return r ? mapApp(r) : null;
}

/** Create a draft application from a shortlisted university. Returns the id, or an error message. */
export async function createApplication(uid: number, uniId: number, program: string, intake: string): Promise<number | string> {
  const u = await A.universityById(uniId);
  if (!u) return "University not found.";
  if ((await val("SELECT id FROM sa_applications WHERE user_id = $1 AND university_id = $2", [uid, uniId])) !== null) return "You already have an application for this university.";
  const prog = Array.from(program.trim()).slice(0, 160).join("");
  if (Array.from(prog).length < 3) return "Enter the program you want to apply for.";
  const id = Number(await val("INSERT INTO sa_applications (user_id, university_id, program, intake, status, created_at, updated_at) VALUES ($1,$2,$3,$4,'draft',NOW(),NOW()) RETURNING id", [uid, uniId, prog, Array.from(intake).slice(0, 30).join("")]));
  await history(uid, "application", id, "", "draft", uid, "Application started");
  await audit(uid, uid, "application.create", u.name);
  return id;
}

/** Student submits a draft for counselor review. Returns an error message, or null. */
export async function submitForReview(uid: number, appId: number): Promise<string | null> {
  const a = await application(appId);
  if (!a || a.user_id !== uid) return "Application not found.";
  if (a.status !== "draft") return "This application is already with our team.";
  const p = await profile(uid);
  if (!isComplete(p)) return "Complete your study-abroad profile first.";
  if (p!.english_test === "none") return "Add your English test result (or a planned test date in your profile notes) before submitting.";
  const missing = await vault.missingRequired(uid);
  if (missing.length) return "Upload these required documents first: " + missing.map((t) => vault.TYPES[t].toLowerCase()).join(", ") + ".";
  await run("UPDATE sa_applications SET status = 'in_review', updated_at = NOW() WHERE id = $1", [appId]);
  await history(uid, "application", appId, "draft", "in_review", uid, "Submitted for review");
  await audit(uid, uid, "application.submit", a.uni_name);
  await syncStage(uid, uid, "Application submitted");
  return null;
}

const TRANSITIONS: Record<string, string[]> = { in_review: ["draft", "applied"], applied: ["offer", "declined"], offer: ["accepted", "declined"] };

/**
 * Counselor / admin moves an application. Enforces the allowed transitions and, before dispatch, that required documents are verified.
 * Returns an error message, or null.
 */
export async function adminMove(appId: number, to: string, actor: number, note = "", offerType = ""): Promise<string | null> {
  const a = await application(appId);
  if (!a) return "Application not found.";
  if (!(TRANSITIONS[a.status] ?? []).includes(to)) return `That change is not allowed from "${a.status}".`;
  if (to === "applied") {
    const un = await vault.unverifiedRequired(a.user_id);
    if (un.length) return "Verify these required documents first: " + un.map((t) => vault.TYPES[t].toLowerCase()).join(", ") + ".";
  }
  if (to === "offer" && !["conditional", "unconditional"].includes(offerType)) return "Choose conditional or unconditional for the offer.";
  if (to === "draft" && note.trim() === "") return "Add a note explaining what the student should fix.";
  await run("UPDATE sa_applications SET status = $1, offer_type = $2, offer_note = $3, updated_at = NOW() WHERE id = $4", [
    to, to === "offer" ? offerType : a.offer_type, to === "offer" ? Array.from(note).slice(0, 255).join("") : a.offer_note, appId,
  ]);
  await history(a.user_id, "application", appId, a.status, to, actor, note);
  await audit(actor, a.user_id, "application." + to, a.uni_name);
  await syncStage(a.user_id, actor, "Application " + to);
  await notify.application(a.user_id, a, to, note);
  return null;
}

/** Student answers an offer. Returns an error message, or null. */
export async function answerOffer(uid: number, appId: number, accept: boolean): Promise<string | null> {
  const a = await application(appId);
  if (!a || a.user_id !== uid || a.status !== "offer") return "There is no offer to answer.";
  const to = accept ? "accepted" : "declined";
  await run("UPDATE sa_applications SET status = $1, updated_at = NOW() WHERE id = $2", [to, appId]);
  await history(uid, "application", appId, "offer", to, uid, accept ? "Offer accepted" : "Offer declined");
  await audit(uid, uid, "offer." + to, a.uni_name);
  await syncStage(uid, uid, accept ? "Offer accepted" : "Offer declined");
  return null;
}

export async function toggleVisaItem(uid: number, appId: number, idx: number): Promise<boolean> {
  const a = await application(appId);
  if (!a || a.user_id !== uid || a.status !== "accepted") return false;
  const done = a.visa_done.includes(idx) ? a.visa_done.filter((x) => x !== idx) : [...a.visa_done, idx];
  done.sort((x, y) => x - y);
  await run("UPDATE sa_applications SET visa_done_json = $1, updated_at = NOW() WHERE id = $2", [JSON.stringify(done), appId]);
  return true;
}

// ---- stage state machine --------------------------------------------------------------------------------------------------

/** The stage a student is in, derived from what has actually happened. */
export async function computeStage(uid: number): Promise<string> {
  const p = await profile(uid);
  if (p && p.stage === "ALUMNI") return "ALUMNI";
  if (!isComplete(p)) return "ONBOARDING";
  const statuses = (await all<{ status: string }>("SELECT status FROM sa_applications WHERE user_id = $1", [uid])).map((r) => r.status);
  if (statuses.includes("accepted")) return "VISA_PREP";
  if (statuses.includes("offer")) return "OFFER_RECEIVED";
  if (statuses.includes("applied")) return "APPLIED";
  if (statuses.includes("in_review")) return "IN_REVIEW";
  return "DOC_COLLECTION";
}

/** Persist a stage change (and record it) if the derived stage differs from the stored one. */
export async function syncStage(uid: number, actor: number | null, note = ""): Promise<string> {
  const p = await profile(uid);
  if (!p) return "ONBOARDING";
  const stage = await computeStage(uid);
  if (stage !== p.stage) {
    await run("UPDATE sa_profiles SET stage = $1, updated_at = NOW() WHERE user_id = $2", [stage, uid]);
    await history(uid, "stage", null, p.stage, stage, actor, note);
  }
  return stage;
}

export async function markAlumni(uid: number, actor: number): Promise<string | null> {
  const p = await profile(uid);
  if (!p || p.stage !== "VISA_PREP") return "Only students in the visa stage can be marked as arrived.";
  await run("UPDATE sa_profiles SET stage = 'ALUMNI', updated_at = NOW() WHERE user_id = $1", [uid]);
  await history(uid, "stage", null, "VISA_PREP", "ALUMNI", actor, "Arrived");
  await audit(actor, uid, "stage.alumni");
  return null;
}
