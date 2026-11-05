import { all, one, run, val } from "../portal/db";
import type { SearchJob } from "./job-search";

/** Internship postings: queries and creation (port of Portal\Jobs). Rows are mapped to the shape the pages use. */
export interface Job extends SearchJob {
  id: number;
  slug: string;
  ini: string;
  color: string;
  stipend: number;
  weeks: number;
  openings: number;
  applicants: number;
  deadline: string;
  resp: number | null;
  do: string[];
  req: string[];
  perks: string[];
  q: string;
  status: string;
  sample: boolean;
  owner: number | null;
  verified: boolean;
  days_left: number | null;
  match: number | null;
}

const BASE = `SELECT i.*, c.name AS company, c.color, c.resp_rate, c.verified AS co_verified, c.owner_user_id,
    (SELECT COUNT(*) FROM applications a WHERE a.internship_id = i.id) AS applicants
  FROM internships i JOIN companies c ON c.id = i.company_id`;
const LIVE = " i.status = 'live' AND (i.deadline IS NULL OR i.deadline >= CURRENT_DATE)";

type Row = Record<string, unknown>;
const dec = (j: unknown): string[] => {
  try {
    const v = JSON.parse(String(j ?? ""));
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
};
const DAY = 86400000;
const ts = (s: string): number => Date.parse(s.replace(" ", "T") + (s.includes("T") || s.length > 10 ? "Z" : "T00:00:00Z"));

export function map(r: Row): Job {
  const ini = String(r.company).trim().split(/\s+/).map((w) => Array.from(w)[0]?.toUpperCase() ?? "").join("");
  const posted = r.posted_at ? Math.max(0, Math.floor((Date.now() - ts(String(r.posted_at))) / DAY)) : 0;
  const today = Math.floor(Date.now() / DAY) * DAY;
  const deadline = r.deadline ? String(r.deadline).slice(0, 10) : new Date(Date.now() + 30 * DAY).toISOString().slice(0, 10);
  return {
    id: Number(r.id),
    slug: String(r.slug),
    title: String(r.title),
    company: String(r.company),
    ini: Array.from(ini).slice(0, 2).join(""),
    color: String(r.color),
    loc: String(r.location),
    mode: String(r.mode),
    cat: String(r.category),
    stipend: Number(r.stipend),
    weeks: Number(r.weeks),
    badge: String(r.badge),
    skills: dec(r.skills_json),
    posted,
    openings: Number(r.openings),
    applicants: Number(r.applicants ?? 0),
    deadline,
    resp: r.resp_rate === null || r.resp_rate === undefined ? null : Number(r.resp_rate),
    about: String(r.about),
    do: dec(r.do_json),
    req: dec(r.req_json),
    perks: dec(r.perks_json),
    q: String(r.question ?? ""),
    status: String(r.status),
    sample: Number(r.is_sample) === 1,
    owner: r.owner_user_id === null || r.owner_user_id === undefined ? null : Number(r.owner_user_id),
    verified: Number(r.co_verified ?? 0) === 1,
    days_left: r.deadline ? Math.ceil((ts(String(r.deadline).slice(0, 10)) - today) / DAY) : null,
    match: null,
  };
}

export async function live(): Promise<Job[]> {
  return (await all(`${BASE} WHERE${LIVE} ORDER BY i.posted_at DESC, i.id DESC`)).map(map);
}

/** Live listing by slug (public), or any status for its owner / admin. */
export async function bySlug(slug: string, viewer: { id: number; role: string } | null = null): Promise<Job | null> {
  const r = await one(`${BASE} WHERE i.slug = $1`, [slug]);
  if (!r) return null;
  const j = map(r);
  const canSee = r.status === "live" || (viewer !== null && (viewer.role === "admin" || (viewer.role === "employer" && j.owner === viewer.id)));
  return canSee ? j : null;
}

export async function byId(id: number): Promise<Job | null> {
  const r = await one(`${BASE} WHERE i.id = $1`, [id]);
  return r ? map(r) : null;
}

export async function forEmployer(userId: number): Promise<Job[]> {
  return (await all(`${BASE} WHERE c.owner_user_id = $1 ORDER BY i.created_at DESC`, [userId])).map(map);
}

export async function pending(): Promise<Job[]> {
  return (await all(`${BASE} WHERE i.status = 'pending' ORDER BY i.created_at ASC`)).map(map);
}

export interface Company { id: number; owner_user_id: number | null; name: string; domain: string; verified: number }
export async function companyOf(userId: number): Promise<Company | null> {
  return one<Company & Record<string, unknown>>("SELECT * FROM companies WHERE owner_user_id = $1 ORDER BY id LIMIT 1", [userId]);
}

export interface NewJob { title: string; company: string; cat: string; mode: string; loc: string; stipend: number; weeks: number; openings: number; about: string; skills: string[]; question: string }

/** Create a pending posting for an employer's company. Returns the slug and the new id. */
export async function create(companyId: number, d: NewJob): Promise<{ slug: string; id: number }> {
  const base = `${d.title}-${d.company}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  let slug = base.slice(0, 150);
  let n = 1;
  while ((await val("SELECT id FROM internships WHERE slug = $1", [slug])) !== null) slug = base.slice(0, 140) + "-" + ++n;
  const deadline = new Date(Date.now() + 45 * DAY).toISOString().slice(0, 10);
  const id = await val<number>(
    `INSERT INTO internships (company_id, slug, title, category, location, mode, stipend, weeks, openings, badge, about, do_json, req_json, perks_json, skills_json, question, status, deadline, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'pending',$17,NOW()) RETURNING id`,
    [companyId, slug, d.title, d.cat, d.mode === "Remote" ? "Remote" : d.loc, d.mode, d.stipend, d.weeks, d.openings, "Paid internship", d.about, "[]", "[]", "[]", JSON.stringify(d.skills), d.question, deadline],
  );
  return { slug, id: Number(id) };
}

/** Admin sets "Verified stipend" only after escrow is actually funded. */
export async function setBadge(id: number, badge: string): Promise<void> {
  if (["Verified stipend", "PPO possible", "Paid internship"].includes(badge)) await run("UPDATE internships SET badge = $1 WHERE id = $2", [badge, id]);
}

export async function setStatus(id: number, status: string): Promise<void> {
  if (!["live", "rejected", "closed"].includes(status)) return;
  await run("UPDATE internships SET status = $1, posted_at = CASE WHEN $1::text = 'live' AND posted_at IS NULL THEN NOW() ELSE posted_at END WHERE id = $2", [status, id]);
  if (status === "live") await run("UPDATE companies SET verified = 1 WHERE id = (SELECT company_id FROM internships WHERE id = $1)", [id]);
}
