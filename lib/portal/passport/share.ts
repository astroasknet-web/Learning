import { randomInt } from "node:crypto";
import { all, one, run, tx, val } from "../db";
import { isBot, referrerHost, visitorHash } from "../tracker";
import * as pc from "./credential";
import { profile } from "./profile";

/**
 * A student's public, QR-verifiable passport: what is shared, who has looked, and the signed snapshot (port of
 * Portal\PassportShare.php). Private by default. Everything shown publicly comes from the signed credential, never from live data.
 */
export const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L: easy to read aloud and to type
export const CODE_LEN = 12;
export const STYLES: Record<string, string> = {
  first_initial: "First name and last initial (Priya S.)",
  initials: "Initials only (P.S.)",
  full: "Full name",
};

export interface ShareOptions {
  name_style?: string;
  show_score?: boolean | number;
  show_skills?: boolean | number;
  show_courses?: boolean | number;
  show_college?: boolean | number;
}

export interface PassportRow {
  id: number;
  user_id: number;
  code: string;
  is_public: number;
  display_name: string;
  name_style: string;
  show_score: number;
  show_skills: number;
  show_courses: number;
  show_college: number;
  consented_at: string | null;
  withdrawn_at: string | null;
}

export interface CredentialRow {
  id: number;
  passport_id: number;
  jti: string;
  kid: string;
  jwt: string;
  issued_at: string;
  expires_at: string;
  status: string;
}

export const validCode = (code: string): boolean => new RegExp(`^[${ALPHABET}]{${CODE_LEN}}$`).test(code);

function newCode(): string {
  let c = "";
  for (let i = 0; i < CODE_LEN; i++) c += ALPHABET[randomInt(0, ALPHABET.length)];
  return c;
}

export function displayName(full: string, style: string): string {
  const parts = full.trim().split(/\s+/u).filter(Boolean);
  if (!parts.length) return "GrowQR learner";
  const initial = (p: string) => Array.from(p)[0].toUpperCase();
  const first = parts[0];
  const last = parts.length > 1 ? parts[parts.length - 1] : "";
  if (style === "full") return parts.join(" ");
  if (style === "initials") return parts.slice(0, 3).map(initial).join(".") + ".";
  return first + (last !== "" ? " " + initial(last) + "." : "");
}

const ymd = (ts: string): string => {
  const d = new Date(ts.includes("T") ? ts : ts.replace(" ", "T") + "Z");
  return Number.isNaN(d.getTime()) ? new Date().toISOString().slice(0, 10) : d.toISOString().slice(0, 10);
};
const utcStamp = (t: number): string => new Date(t * 1000).toISOString().slice(0, 19).replace("T", " ");

// ------------------------------------------------------------------ reading

export async function forUser(uid: number): Promise<PassportRow | null> {
  return one<PassportRow>("SELECT * FROM passports WHERE user_id = $1", [uid]);
}

/** The public passport for a code, with its current credential, or null. */
export async function byCode(code: string): Promise<(PassportRow & { credential: CredentialRow | null }) | null> {
  if (!validCode(code)) return null;
  const p = await one<PassportRow>("SELECT * FROM passports WHERE code = $1", [code]);
  if (!p) return null;
  const credential = await one<CredentialRow>("SELECT * FROM passport_credentials WHERE passport_id = $1 AND status = 'active' ORDER BY id DESC LIMIT 1", [p.id]);
  return { ...p, credential };
}

export interface ViewStats {
  total: number;
  d7: number;
  d30: number;
  qr: number;
  last: string | null;
}

export async function stats(passportId: number): Promise<ViewStats> {
  const r = await one<{ total: number; d7: number; d30: number; qr: number; last: string | null }>(
    `SELECT COUNT(*) AS total,
        COUNT(*) FILTER (WHERE created_at >= LOCALTIMESTAMP(0) - INTERVAL '7 days') AS d7,
        COUNT(*) FILTER (WHERE created_at >= LOCALTIMESTAMP(0) - INTERVAL '30 days') AS d30,
        COUNT(*) FILTER (WHERE via = 'qr') AS qr,
        MAX(created_at) AS last
       FROM passport_views WHERE passport_id = $1`,
    [passportId],
  );
  return { total: Number(r?.total ?? 0), d7: Number(r?.d7 ?? 0), d30: Number(r?.d30 ?? 0), qr: Number(r?.qr ?? 0), last: r?.last ?? null };
}

/** Count a look at a passport. Bots are ignored; the same visitor within 10 minutes counts once. */
export async function recordView(passportId: number, viaQr: boolean, ctx: { ip: string; ua: string; referer: string; host: string }): Promise<void> {
  if (isBot(ctx.ua)) return;
  const visitor = visitorHash(ctx.ip, ctx.ua);
  const dup = await val("SELECT 1 FROM passport_views WHERE passport_id = $1 AND visitor = $2 AND created_at > LOCALTIMESTAMP(0) - INTERVAL '10 minutes' LIMIT 1", [passportId, visitor]);
  if (dup !== null) return;
  const ref = referrerHost(ctx.referer, ctx.host);
  await run("INSERT INTO passport_views (passport_id, visitor, via, referrer) VALUES ($1,$2,$3,$4)", [passportId, visitor, viaQr ? "qr" : "link", ref !== "" ? ref : null]);
}

// ------------------------------------------------------------------ building the snapshot

type Json = Record<string, unknown>;

/** What goes into the signed credential, limited to what the student chose to show. */
export async function snapshot(uid: number, opts: ShareOptions, fullName: string): Promise<Json> {
  const p = await profile(uid);
  const rq = p?.rq;
  if (!p || !rq || typeof rq.overall?.score !== "number") throw new Error("Score your resume first: a passport needs an RQ Score.");
  const out: Json = { name: displayName(fullName, String(opts.name_style ?? "first_initial")) };

  if (opts.show_score) {
    const sections: Array<{ name: string; percent: number }> = [];
    for (const s of rq.sections ?? []) {
      if (s.applicable) {
        const pts = Number(s.points_per_section ?? 20);
        sections.push({ name: String(s.name), percent: Math.round((Number(s.section_score) / Math.max(1, pts)) * 100) });
      }
    }
    out.rq = {
      score: Math.round(Number(rq.overall.score)),
      scale: 100,
      grade: p.rq_grade ?? "",
      scoredAt: ymd(p.rq_updated_at ?? new Date().toISOString()),
      method: "GrowQR deterministic resume scoring, engine v" + String(rq.version ?? "1"),
      sections,
    };
    if (rq.career?.stage) out.careerStage = rq.career.stage;
    if (rq.domain?.label) out.field = rq.domain.label;
  }
  if (opts.show_skills) {
    const skills: Array<{ name: string; evidence: string }> = [];
    for (const raw of p.skills.slice(0, 20)) {
      const s = String(raw).trim();
      if (s === "") continue;
      skills.push({ name: Array.from(s).slice(0, 60).join(""), evidence: Buffer.byteLength(s) >= 3 && p.learned !== "" && p.learned.includes(s.toLowerCase()) ? "course" : "resume" });
    }
    out.skills = skills;
  }
  if (opts.show_courses) {
    const rows = await all<{ title: string; verified: number; certificate_url: string | null; completed_at: string | null }>(
      "SELECT c.title, e.verified, e.certificate_url, e.completed_at FROM course_enrolments e JOIN courses c ON c.id = e.course_id WHERE e.user_id = $1 AND e.status = 'completed' ORDER BY e.completed_at DESC LIMIT 12",
      [uid],
    );
    out.courses = rows.map((r) => ({
      title: r.title,
      completedAt: r.completed_at ? ymd(r.completed_at) : null,
      evidence: Number(r.verified) === 1 ? "lms_verified" : (r.certificate_url ?? "").trim() !== "" ? "certificate_link" : "self_reported",
    }));
  }
  if (opts.show_college && p.college.trim() !== "") out.college = Array.from(p.college.trim()).slice(0, 160).join("");
  return out;
}

// ------------------------------------------------------------------ publishing

const flag = (v: unknown): number => (v ? 1 : 0);

/** Publish (or refresh) the student's public passport. Previous versions stay verifiable but are marked superseded. Returns the public code. */
export async function publish(uid: number, fullName: string, opts: ShareOptions): Promise<string> {
  const style = STYLES[String(opts.name_style ?? "")] ? String(opts.name_style) : "first_initial";
  const flags = { name_style: style, show_score: flag(opts.show_score), show_skills: flag(opts.show_skills), show_courses: flag(opts.show_courses), show_college: flag(opts.show_college) };
  if (!flags.show_score) throw new Error("The RQ Score is the heart of a passport, so it has to be shown. You can hide skills, courses and college.");
  const snap = await snapshot(uid, flags, fullName); // throws when there is no scored resume

  // Create the passport row first and sign outside any transaction (signing publishes the key through another connection).
  let p = await forUser(uid);
  for (let attempt = 0; attempt < 5 && !p; attempt++) {
    await run("INSERT INTO passports (user_id, code) VALUES ($1,$2) ON CONFLICT DO NOTHING", [uid, newCode()]);
    p = await forUser(uid);
  }
  if (!p) throw new Error("Could not create the passport. Please try again.");
  const passport = p;
  const issued = await pc.issue(passport.code, snap);
  await tx(async (c) => {
    await c.query("UPDATE passport_credentials SET status = 'superseded' WHERE passport_id = $1 AND status = 'active'", [passport.id]);
    await c.query("INSERT INTO passport_credentials (passport_id, jti, kid, jwt, issued_at, expires_at) VALUES ($1,$2,$3,$4,$5,$6)", [passport.id, issued.jti, issued.kid, issued.jwt, utcStamp(issued.issued), utcStamp(issued.expires)]);
    await c.query(
      `UPDATE passports SET is_public = 1, display_name = $1, name_style = $2, show_score = $3, show_skills = $4, show_courses = $5, show_college = $6,
         consented_at = COALESCE(consented_at, LOCALTIMESTAMP(0)), withdrawn_at = NULL, updated_at = LOCALTIMESTAMP(0) WHERE id = $7`,
      [String(snap.name), style, flags.show_score, flags.show_skills, flags.show_courses, flags.show_college, passport.id],
    );
  });
  return passport.code;
}

/** Take the passport offline. Every credential issued for it is revoked, so old copies stop verifying as current. */
export async function withdraw(uid: number): Promise<void> {
  const p = await forUser(uid);
  if (!p) return;
  await tx(async (c) => {
    await c.query("UPDATE passport_credentials SET status = 'revoked' WHERE passport_id = $1 AND status <> 'revoked'", [p.id]);
    await c.query("UPDATE passports SET is_public = 0, withdrawn_at = LOCALTIMESTAMP(0), updated_at = LOCALTIMESTAMP(0) WHERE id = $1", [p.id]);
  });
}

// ------------------------------------------------------------------ moving to another domain

async function otherAddress(): Promise<Array<{ passport_id: number; code: string; claims: Json }>> {
  const mine = await pc.did();
  const out: Array<{ passport_id: number; code: string; claims: Json }> = [];
  const rows = await all<{ passport_id: number; code: string; jwt: string }>(
    "SELECT c.passport_id, p.code, c.jwt FROM passport_credentials c JOIN passports p ON p.id = c.passport_id WHERE c.status = 'active' AND p.is_public = 1 ORDER BY c.id LIMIT 5000",
  );
  for (const r of rows) {
    const body = pc.unb64u(r.jwt.split(".")[1] ?? "");
    let payload: { issuer?: { id?: string }; credentialSubject?: { passport?: Json } } | null = null;
    try {
      payload = body ? JSON.parse(body.toString("utf8")) : null;
    } catch {
      payload = null;
    }
    if (payload && payload.issuer?.id !== mine) out.push({ passport_id: r.passport_id, code: r.code, claims: payload.credentialSubject?.passport ?? {} });
  }
  return out;
}

/** How many public passports still carry the old address (0 once re-issued). */
export async function staleIssuerCount(): Promise<number> {
  return (await otherAddress()).length;
}

/**
 * After the site moves to a new address, re-sign every public passport under the new address. The signed content is copied
 * unchanged, codes stay the same, and the old credentials are kept as superseded so they still verify as authentic.
 */
export async function reissueAll(): Promise<number> {
  let n = 0;
  for (const p of await otherAddress()) {
    try {
      const issued = await pc.issue(p.code, p.claims);
      await tx(async (c) => {
        await c.query("UPDATE passport_credentials SET status = 'superseded' WHERE passport_id = $1 AND status = 'active'", [p.passport_id]);
        await c.query("INSERT INTO passport_credentials (passport_id, jti, kid, jwt, issued_at, expires_at) VALUES ($1,$2,$3,$4,$5,$6)", [p.passport_id, issued.jti, issued.kid, issued.jwt, utcStamp(issued.issued), utcStamp(issued.expires)]);
      });
      n++;
    } catch (e) {
      console.error("passport reissue:", (e as Error).message);
    }
  }
  return n;
}

// ------------------------------------------------------------------ sharing helpers

export async function url(code: string, qr = false): Promise<string> {
  return (await pc.base()) + "v/" + code + (qr ? "?q=1" : "");
}

/** LinkedIn "Add to profile" (certifications) link. The holder must be signed in to LinkedIn; GrowQR is not affiliated with LinkedIn. */
export async function linkedInUrl(code: string, issuedTs: number, expiresTs: number): Promise<string> {
  const i = new Date(issuedTs * 1000);
  const e = new Date(expiresTs * 1000);
  const q = new URLSearchParams({
    startTask: "CERTIFICATION_NAME",
    name: "GrowQR Verified Skill Passport",
    organizationName: "GrowQR",
    issueYear: String(i.getUTCFullYear()),
    issueMonth: String(i.getUTCMonth() + 1),
    expirationYear: String(e.getUTCFullYear()),
    expirationMonth: String(e.getUTCMonth() + 1),
    certUrl: await url(code),
    certId: code,
  });
  return "https://www.linkedin.com/profile/add?" + q.toString().replace(/\+/g, "%20");
}
