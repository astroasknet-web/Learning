import { createHmac, timingSafeEqual } from "node:crypto";
import { all, one, run, val } from "../portal/db";
import { appUrl, send } from "../portal/mail";

/**
 * GrowQR's own course enrolment and progress tracking (port of Portal\Learning). Courses are taught on GrowQR; GrowQR keeps
 * its own record so the portal stays independent: the student ticks module checkpoints, and a completion earns trust in tiers:
 *   self         completed by the student's own ticks
 *   certificate  completed + a certificate link on an allowed domain
 *   verified     confirmed by a signed LMS webhook (or an admin)
 * Only certificate/verified completions feed Skill Passport matching.
 *
 * Environment: LMS_CERTIFICATE_HOSTS (comma list of allowed certificate hosts; none by default), LMS_WEBHOOK_SECRET (enables /api/lms-webhook).
 */
export type Tier = "verified" | "certificate" | "self";

export interface Enrolment {
  id: number; user_id: number; course_id: number; status: "enrolled" | "in_progress" | "completed"; done: number[]; progress: number; started_at: string;
  completed_at: string | null; certificate_url: string; certificate_code: string; verified: boolean; verified_via: string; updated_at: string; tier: Tier | null;
}

/** Checkpoints = one per module plus the hands-on project. */
export const checkpoints = (course: { modules: number }): number => Math.max(1, Math.trunc(course.modules)) + 1;

export function tier(e: { status: string; verified: number | boolean; certificate_url: string | null }): Tier | null {
  if (e.status !== "completed") return null;
  if (Number(e.verified) === 1 || e.verified === true) return "verified";
  return String(e.certificate_url ?? "").trim() !== "" ? "certificate" : "self";
}

function hydrate(r: Record<string, unknown>): Enrolment {
  let done: number[] = [];
  try {
    const v = JSON.parse(String(r.done_json ?? "[]"));
    if (Array.isArray(v)) done = v.map((x) => Math.trunc(Number(x)));
  } catch {
    /* none */
  }
  const e = { ...(r as object), done, progress: Number(r.progress), verified: Number(r.verified) === 1, certificate_url: String(r.certificate_url ?? ""), certificate_code: String(r.certificate_code ?? "") } as unknown as Enrolment;
  e.tier = tier({ status: e.status, verified: e.verified, certificate_url: e.certificate_url });
  return e;
}

export async function find(userId: number, courseId: number): Promise<Enrolment | null> {
  const r = await one("SELECT * FROM course_enrolments WHERE user_id = $1 AND course_id = $2", [userId, courseId]);
  return r ? hydrate(r) : null;
}

export async function enrol(userId: number, courseId: number): Promise<void> {
  await run("INSERT INTO course_enrolments (user_id, course_id, status, done_json, progress, started_at, updated_at) VALUES ($1,$2,'enrolled','[]',0,NOW(),NOW()) ON CONFLICT (user_id, course_id) DO NOTHING", [userId, courseId]);
}

export async function unenrol(userId: number, courseId: number): Promise<void> {
  // Verified completions are a permanent record; everything else can be dropped.
  await run("DELETE FROM course_enrolments WHERE user_id = $1 AND course_id = $2 AND verified = 0", [userId, courseId]);
}

/**
 * Save the exact set of ticked checkpoints. Returns the updated enrolment, or null if not allowed (not enrolled, or a verified completion
 * which is locked).
 */
export async function setDone(userId: number, course: { id: number; title: string; modules: number }, ticked: unknown[]): Promise<Enrolment | null> {
  const e = await find(userId, course.id);
  const total = checkpoints(course);
  if (!e || e.verified) return null;
  const done = [...new Set(ticked.map((x) => Math.trunc(Number(x))).filter((i) => Number.isFinite(i) && i >= 0 && i < total))].sort((a, b) => a - b);
  const n = done.length;
  const status = n === 0 ? "enrolled" : n >= total ? "completed" : "in_progress";
  const wasCompleted = e.status === "completed";
  await run("UPDATE course_enrolments SET done_json = $1, progress = $2, status = $3, completed_at = $4, updated_at = NOW() WHERE id = $5", [
    JSON.stringify(done), Math.round((n / total) * 100), status, status === "completed" ? e.completed_at ?? new Date().toISOString().slice(0, 19).replace("T", " ") : null, e.id,
  ]);
  if (status === "completed" && !wasCompleted) await courseCompleted(userId, course.title);
  return find(userId, course.id);
}

const certHosts = (): string[] => (process.env.LMS_CERTIFICATE_HOSTS ?? "").split(",").map((h) => h.trim().toLowerCase()).filter(Boolean);

/** Is this an acceptable certificate link? https on an allowed host. */
export function validCertificateUrl(u: string): boolean {
  if (Buffer.byteLength(u) > 255) return false;
  let p: URL;
  try {
    p = new URL(u);
  } catch {
    return false;
  }
  if (p.protocol !== "https:" || !p.hostname || p.username || p.password) return false;
  const host = p.hostname.toLowerCase();
  return certHosts().some((a) => host === a || host.endsWith("." + a));
}

/** Returns an error message, or null on success. */
export async function attachCertificate(userId: number, course: { id: number }, certUrl: string, code: string): Promise<string | null> {
  const e = await find(userId, course.id);
  if (!e || e.status !== "completed") return "Finish every checkpoint before adding your certificate.";
  const u = certUrl.trim();
  if (!validCertificateUrl(u)) return "Paste the certificate link (it must start with https:// and be on an allowed address).";
  await run("UPDATE course_enrolments SET certificate_url = $1, certificate_code = $2, updated_at = NOW() WHERE id = $3", [u, Array.from(code.trim()).slice(0, 60).join(""), e.id]);
  return null;
}

// ---- reads -----------------------------------------------------------------------------------------------------------

export interface MyCourse extends Enrolment { slug: string; title: string; modules: number; hours: string; badge: string; icon: string; level_label: string; cat_name: string; c1: string; c2: string }

/** All of a student's enrolments with course info, newest activity first. */
export async function forUser(userId: number): Promise<MyCourse[]> {
  const rows = await all(
    `SELECT e.*, c.slug, c.title, c.modules, c.hours, c.badge, c.icon, c.level_label, cc.name AS cat_name, cc.c1, cc.c2
     FROM course_enrolments e JOIN courses c ON c.id = e.course_id JOIN course_categories cc ON cc.key_name = c.category
     WHERE e.user_id = $1 ORDER BY e.updated_at DESC`,
    [userId],
  );
  return rows.map((r) => ({ ...hydrate(r), slug: String(r.slug), title: String(r.title), modules: Number(r.modules), hours: String(r.hours), badge: String(r.badge), icon: String(r.icon), level_label: String(r.level_label), cat_name: String(r.cat_name), c1: String(r.c1), c2: String(r.c2) }));
}

/** A course taught on GrowQR was finished by passing every graded quiz: record it as verified (by GrowQR) so it counts toward the Skill Passport. */
export async function verifyNative(userId: number, courseId: number): Promise<void> {
  await run("UPDATE course_enrolments SET verified = 1, verified_via = 'growqr', updated_at = NOW() WHERE user_id = $1 AND course_id = $2 AND status = 'completed' AND verified = 0", [userId, courseId]);
}

// ---- LMS webhook -----------------------------------------------------------------------------------------------------

/** Record a completion confirmed by the LMS. Returns an error message, or null. */
export async function completeFromLms(email: string, slug: string, certUrl: string, certCode: string): Promise<string | null> {
  const u = await one<{ id: number }>("SELECT id FROM users WHERE email = $1 AND role = 'student'", [email.trim().toLowerCase()]);
  const c = await one<{ id: number; title: string; modules: number }>("SELECT id, title, modules FROM courses WHERE slug = $1", [slug]);
  if (!u) return "unknown user";
  if (!c) return "unknown course";
  const total = checkpoints(c);
  const cert = validCertificateUrl(certUrl) ? certUrl : "";
  const existing = await find(u.id, c.id);
  await run(
    `INSERT INTO course_enrolments (user_id, course_id, status, done_json, progress, started_at, completed_at, certificate_url, certificate_code, verified, verified_via, updated_at)
     VALUES ($1,$2,'completed',$3,100,NOW(),NOW(),$4,$5,1,'lms',NOW())
     ON CONFLICT (user_id, course_id) DO UPDATE SET status = 'completed', done_json = EXCLUDED.done_json, progress = 100, completed_at = COALESCE(course_enrolments.completed_at, NOW()),
       certificate_url = CASE WHEN EXCLUDED.certificate_url <> '' THEN EXCLUDED.certificate_url ELSE course_enrolments.certificate_url END,
       certificate_code = CASE WHEN EXCLUDED.certificate_code <> '' THEN EXCLUDED.certificate_code ELSE course_enrolments.certificate_code END,
       verified = 1, verified_via = 'lms', updated_at = NOW()`,
    [u.id, c.id, JSON.stringify(Array.from({ length: total }, (_, i) => i)), cert, Array.from(certCode).slice(0, 60).join("")],
  );
  if (!existing || existing.status !== "completed") await courseCompleted(u.id, c.title);
  return null;
}

const safeEq = (a: string, b: string): boolean => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/**
 * Optional, signed completion callback. X-Timestamp (unix seconds) and X-Signature = hex(HMAC_SHA256(secret, timestamp + "." + rawBody)).
 * Disabled until LMS_WEBHOOK_SECRET is set. Stale (over 5 minutes) and replayed requests are refused.
 */
export async function handleWebhook(raw: string, ts: string, sig: string): Promise<{ status: number; body: Record<string, unknown> }> {
  const secret = process.env.LMS_WEBHOOK_SECRET ?? "";
  if (secret === "") return { status: 404, body: { error: "webhook disabled" } };
  if (!/^\d+$/.test(ts) || Math.abs(Date.now() / 1000 - Number(ts)) > 300) return { status: 401, body: { error: "stale or missing timestamp" } };
  const s = sig.toLowerCase();
  if (!safeEq(createHmac("sha256", secret).update(`${ts}.${raw}`).digest("hex"), s)) return { status: 401, body: { error: "bad signature" } };
  const nonce = "whsig:" + createHmac("sha256", "n").update(s).digest("hex");
  if (Number(await val("SELECT COUNT(*) FROM auth_throttle WHERE bucket = $1", [nonce])) > 0) return { status: 409, body: { error: "replay" } };
  await run("INSERT INTO auth_throttle (bucket, created_at) VALUES ($1, NOW())", [nonce]);
  let j: Record<string, unknown> = {};
  try {
    const v = JSON.parse(raw);
    if (v && typeof v === "object") j = v;
  } catch {
    /* handled below */
  }
  if (!j.email || !j.course_slug) return { status: 400, body: { error: "email and course_slug are required" } };
  const err = await completeFromLms(String(j.email), String(j.course_slug), String(j.certificate_url ?? ""), String(j.certificate_code ?? ""));
  return err ? { status: 422, body: { error: err } } : { status: 200, body: { ok: true } };
}

async function courseCompleted(userId: number, title: string): Promise<void> {
  const u = await one<{ email: string; name: string }>("SELECT email, name FROM users WHERE id = $1", [userId]);
  if (!u) return;
  await send(u, `Course completed: ${title}`, "Course completed. Well done", [
    `You completed ${title}.`,
    "Completed courses count toward your Skill Passport, which raises your match score on roles that need these skills.",
  ], ["Open my courses", await appUrl("my-courses")], "course_completed");
}
