import { all, run } from "../portal/db";
import { createLogger } from "../log";

/**
 * Internships from public job feeds (Adzuna, India), shown below the native listings as "More internships from the web".
 * They are stored apart from `internships` and are link-out only: no GrowQR application, no verified stipend, no match score.
 *
 * Environment: ADZUNA_APP_ID, ADZUNA_APP_KEY (server only; never logged and never sent to the browser).
 */
const log = createLogger("external-internships");

export interface ExternalJob {
  id: number;
  title: string;
  company: string;
  location: string | null;
  summary: string;
  stipend: string | null;
  url: string;
  posted: number; // days ago
}

const DAY = 86_400_000;
const MAX_AGE_DAYS = 30;
const INTERN_TITLE = /intern|trainee|apprentice/i;

export const adzunaConfigured = (): boolean => Boolean(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY);

const clip = (s: unknown, n: number): string => String(s ?? "").trim().slice(0, n);

export function stripHtml(s: unknown): string {
  return String(s ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/** Only http(s) links are ever stored, so a feed cannot plant a javascript: or data: URL. */
export function safeUrl(u: unknown): string | null {
  try {
    const x = new URL(String(u ?? "").trim());
    return x.protocol === "http:" || x.protocol === "https:" ? x.toString().slice(0, 600) : null;
  } catch {
    return null;
  }
}

/** Adzuna salaries are annual rupees; show a monthly figure so it reads like a stipend. Advertised only, never verified. */
export function stipendText(min: unknown, max: unknown): string | null {
  const lo = Math.round(Number(min) || 0);
  const hi = Math.round(Number(max) || 0);
  if (!lo && !hi) return null;
  const m = (v: number) => "₹" + Math.round(v / 12).toLocaleString("en-IN");
  return lo && hi && lo !== hi ? `${m(lo)} to ${m(hi)} a month` : `${m(hi || lo)} a month`;
}

interface AdzunaResult {
  id?: string | number;
  title?: string;
  description?: string;
  redirect_url?: string;
  created?: string;
  salary_min?: number;
  salary_max?: number;
  company?: { display_name?: string };
  location?: { display_name?: string };
}

export interface Candidate {
  sourceId: string;
  title: string;
  company: string;
  location: string | null;
  summary: string;
  stipend: string | null;
  url: string;
  postedAt: Date;
  expiresAt: Date;
}

/** Keep internship-type titles with a safe link; drop everything else the aggregator mixed in. */
export function toCandidate(j: AdzunaResult, now = new Date()): Candidate | null {
  const sourceId = clip(j.id, 80);
  const title = clip(stripHtml(j.title), 200);
  const url = safeUrl(j.redirect_url);
  if (!sourceId || !url || !INTERN_TITLE.test(title)) return null;
  const created = j.created ? new Date(j.created) : now;
  const postedAt = Number.isNaN(created.getTime()) ? now : created;
  return {
    sourceId,
    title,
    company: clip(stripHtml(j.company?.display_name), 160) || "Company not listed",
    location: clip(stripHtml(j.location?.display_name), 160) || null,
    summary: clip(stripHtml(j.description), 1500),
    stipend: stipendText(j.salary_min, j.salary_max),
    url,
    postedAt,
    expiresAt: new Date(postedAt.getTime() + MAX_AGE_DAYS * DAY),
  };
}

export interface SyncResult {
  ok: boolean;
  added: number;
  skipped: number;
  received?: number; // how many raw results Adzuna returned, so "0 saved" can be told apart from "Adzuna sent nothing"
  error?: string;
}

/** Pull the latest India internships from Adzuna into external_internships. Safe to run repeatedly (upsert on the provider id). */
export async function syncAdzuna(pages = 2): Promise<SyncResult> {
  if (!adzunaConfigured()) return { ok: false, added: 0, skipped: 0, error: "ADZUNA_APP_ID / ADZUNA_APP_KEY not set" };
  const seen = new Set<string>();
  let added = 0;
  let skipped = 0;
  let received = 0;
  for (const what of ["internship", "intern"]) {
    for (let p = 1; p <= Math.min(5, Math.max(1, pages)); p++) {
      const qs = new URLSearchParams({
        app_id: process.env.ADZUNA_APP_ID as string,
        app_key: process.env.ADZUNA_APP_KEY as string,
        results_per_page: "50",
        what_phrase: what,
        max_days_old: String(MAX_AGE_DAYS),
        sort_by: "date",
      });
      let results: AdzunaResult[];
      try {
        const res = await fetch(`https://api.adzuna.com/v1/api/jobs/in/search/${p}?${qs}`, { signal: AbortSignal.timeout(15_000), cache: "no-store" });
        // Never echo the URL in an error: it carries the key.
        if (!res.ok) return { ok: false, added, skipped, error: `Adzuna responded ${res.status}` };
        results = ((await res.json()) as { results?: AdzunaResult[] }).results ?? [];
      } catch (e) {
        return { ok: false, added, skipped, error: `Adzuna request failed (${e instanceof Error ? e.name : "error"})` };
      }
      received += results.length;
      if (!results.length) break;
      for (const j of results) {
        const c = toCandidate(j);
        if (!c || seen.has(c.sourceId)) {
          skipped++;
          continue;
        }
        seen.add(c.sourceId);
        added += await run(
          `INSERT INTO external_internships (source, source_id, title, company, location, summary, stipend_text, apply_url, posted_at, expires_at)
           VALUES ('adzuna',$1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT (source, source_id) DO UPDATE SET title = EXCLUDED.title, summary = EXCLUDED.summary, stipend_text = EXCLUDED.stipend_text,
             apply_url = EXCLUDED.apply_url, fetched_at = NOW()`,
          [c.sourceId, c.title, c.company, c.location, c.summary, c.stipend, c.url, c.postedAt, c.expiresAt],
        );
      }
    }
  }
  await run("DELETE FROM external_internships WHERE expires_at < NOW() - INTERVAL '7 days'").catch((e) =>
    log.warn("cleanup failed:", e instanceof Error ? e.message : e),
  );
  return { ok: true, added, skipped, received };
}

let lastAttempt = 0;
let lastResult: SyncResult | null = null;

/**
 * Run the sync at most about once a day, for schedulers that fire often (the 10-minute portal cron on Hostinger).
 * Skips when the newest row was fetched under `hours` ago, and never tries more than once an hour per process, so an empty or
 * failing feed cannot hammer the Adzuna API.
 */
export async function syncIfStale(hours = 20): Promise<SyncResult & { skipped_reason?: string; last_result?: SyncResult | null }> {
  if (!adzunaConfigured()) return { ok: false, added: 0, skipped: 0, skipped_reason: "keys not set" };
  // Repeat the earlier attempt's outcome so a rate-limited call still shows why nothing was saved.
  if (Date.now() - lastAttempt < 3_600_000) return { ok: true, added: 0, skipped: 0, skipped_reason: "tried within the last hour", last_result: lastResult };
  try {
    const rows = await all<{ last: string | null }>("SELECT MAX(fetched_at) AS last FROM external_internships");
    const last = rows[0]?.last ? Date.parse(String(rows[0].last).replace(" ", "T") + "Z") : 0;
    if (last && Date.now() - last < hours * 3_600_000) return { ok: true, added: 0, skipped: 0, skipped_reason: "fresh" };
  } catch (e) {
    log.warn("external_internships is not ready:", e instanceof Error ? e.message : e);
    return { ok: false, added: 0, skipped: 0, error: "table missing: run the migration" };
  }
  lastAttempt = Date.now();
  lastResult = await syncAdzuna();
  return lastResult;
}

type Row = Record<string, unknown>;

/** Live external listings, newest first, optionally narrowed by the search words. Never throws: a missing table just means "none yet". */
export async function live(opts: { q?: string; limit?: number } = {}): Promise<ExternalJob[]> {
  const limit = Math.min(30, Math.max(1, opts.limit ?? 12));
  const words = (opts.q ?? "")
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[%_\\]/g, ""))
    .filter(Boolean)
    .slice(0, 5);
  const where = ["expires_at > NOW()"];
  const params: unknown[] = [];
  for (const w of words) {
    params.push(`%${w}%`);
    where.push(`(LOWER(title) LIKE $${params.length} OR LOWER(company) LIKE $${params.length} OR LOWER(COALESCE(location,'')) LIKE $${params.length})`);
  }
  params.push(limit);
  try {
    const rows = await all<Row>(`SELECT * FROM external_internships WHERE ${where.join(" AND ")} ORDER BY posted_at DESC, id DESC LIMIT $${params.length}`, params);
    return rows.map((r) => ({
      id: Number(r.id),
      title: String(r.title),
      company: String(r.company),
      location: r.location ? String(r.location) : null,
      summary: String(r.summary),
      stipend: r.stipend_text ? String(r.stipend_text) : null,
      url: String(r.apply_url),
      posted: Math.max(0, Math.floor((Date.now() - Date.parse(String(r.posted_at).replace(" ", "T") + "Z")) / DAY)),
    }));
  } catch (e) {
    log.warn("could not read external internships:", e instanceof Error ? e.message : e);
    return [];
  }
}
