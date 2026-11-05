import "server-only";
import { all, one, val } from "../portal/db";

/**
 * Numbers for the admin analytics dashboard (port of Portal\Analytics). Every method reads straight from the database, so the dashboard
 * always matches reality. A period is the last N days including today; "previous" is the N days before that (for trends).
 * Each query is wrapped so one failing section shows empty instead of breaking the page.
 */
export const RANGES: Record<number, string> = { 7: "Last 7 days", 30: "Last 30 days", 90: "Last 90 days", 365: "Last 12 months" };
export const cleanRange = (v: unknown): number => (Number(v) in RANGES ? Number(v) : 30);

type Row = Record<string, unknown>;
const int = (v: unknown): number => Math.trunc(Number(v) || 0);

async function safe<T>(f: () => Promise<T>, dflt: T): Promise<T> {
  try {
    return await f();
  } catch (e) {
    console.error("analytics:", (e as Error).message);
    return dflt;
  }
}
const n = (sql: string, p: unknown[] = []): Promise<number> => safe(async () => int(await val(sql, p)), 0);
const rows = (sql: string, p: unknown[] = []): Promise<Row[]> => safe(() => all<Row>(sql, p), []);
const one_ = (sql: string, p: unknown[] = []): Promise<Row> => safe(async () => (await one<Row>(sql, p)) ?? {}, {});
/** [{k, n}] -> {k: n} */
const map = (r: Row[], k: string, v = "n"): Record<string, number> => Object.fromEntries(r.map((x) => [String(x[k]), int(x[v])]));

export interface Series { dates: string[]; views: number[]; visitors: number[]; clicks: number[] }

export class Analytics {
  constructor(public readonly days: number) {}

  /** SQL: `col` falls in the current period. */
  cur = (col: string): string => `${col} >= CURRENT_DATE - INTERVAL '${this.days - 1} day'`;
  /** SQL: `col` falls in the previous period of the same length. */
  prev = (col: string): string => `(${col} >= CURRENT_DATE - INTERVAL '${2 * this.days - 1} day' AND ${col} < CURRENT_DATE - INTERVAL '${this.days - 1} day')`;

  /** Y-m-d for every day of the period, oldest first. */
  dates(): string[] {
    const out: string[] = [];
    const t = new Date();
    for (let i = this.days - 1; i >= 0; i--) out.push(new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate() - i)).toISOString().slice(0, 10));
    return out;
  }

  /** Daily counts of rows in `table` by `col` for the period, zero-filled. */
  async daily(table: string, col: string, where = "", agg = "COUNT(*)"): Promise<number[]> {
    const r = await rows(`SELECT ${col}::date AS d, ${agg} AS n FROM ${table} WHERE ${this.cur(col)}${where ? ` AND ${where}` : ""} GROUP BY 1`);
    const m = new Map(r.map((x) => [String(x.d).slice(0, 10), int(x.n)]));
    return this.dates().map((d) => m.get(d) ?? 0);
  }

  /** [current, previous] counts. */
  async pair(table: string, col: string, where = ""): Promise<[number, number]> {
    const r = await one_(`SELECT COUNT(*) FILTER (WHERE ${this.cur(col)}) AS c, COUNT(*) FILTER (WHERE ${this.prev(col)}) AS p FROM ${table} WHERE 1=1${where ? ` AND ${where}` : ""}`);
    return [int(r.c), int(r.p)];
  }

  // ---- site traffic (analytics_events)

  async traffic() {
    const r = await rows(`SELECT created_at::date AS d, COUNT(*) FILTER (WHERE kind = 'view') AS views, COUNT(DISTINCT visitor) FILTER (WHERE kind = 'view') AS visitors,
      COUNT(*) FILTER (WHERE kind = 'click') AS clicks FROM analytics_events WHERE ${this.cur("created_at")} GROUP BY 1`);
    const m = new Map(r.map((x) => [String(x.d).slice(0, 10), x]));
    const dates = this.dates();
    const s: Omit<Series, "dates"> = { views: [], visitors: [], clicks: [] };
    for (const d of dates) for (const k of ["views", "visitors", "clicks"] as const) s[k].push(int(m.get(d)?.[k]));
    const p = await one_(`SELECT COUNT(*) FILTER (WHERE kind = 'view') AS views, COUNT(DISTINCT visitor) FILTER (WHERE kind = 'view') AS visitors,
      COUNT(*) FILTER (WHERE kind = 'click') AS clicks FROM analytics_events WHERE ${this.prev("created_at")}`);
    const c = await one_(`SELECT COUNT(DISTINCT visitor) FILTER (WHERE kind = 'click') AS clickers FROM analytics_events WHERE ${this.cur("created_at")}`);
    const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
    return {
      dates, series: s, views: sum(s.views), clicks: sum(s.clicks), visitors: sum(s.visitors), // visitor-days: each day counts a person once
      prev: { views: int(p.views), visitors: int(p.visitors), clicks: int(p.clicks) }, clickers: int(c.clickers),
      tracking_since: await safe(async () => (await val<string | null>("SELECT MIN(created_at) FROM analytics_events")) ?? null, null),
    };
  }

  topPages = (limit = 12) => rows(`SELECT path, item, COUNT(*) AS views, COUNT(DISTINCT visitor) AS visitors FROM analytics_events WHERE kind = 'view' AND ${this.cur("created_at")} GROUP BY path, item ORDER BY views DESC, path LIMIT ${limit}`);
  referrers = (limit = 8) => rows(`SELECT referrer AS label, COUNT(*) AS n FROM analytics_events WHERE kind = 'view' AND referrer IS NOT NULL AND ${this.cur("created_at")} GROUP BY 1 ORDER BY n DESC LIMIT ${limit}`);
  async devices(): Promise<Record<string, number>> {
    return Object.fromEntries((await rows(`SELECT device, COUNT(DISTINCT visitor) AS n FROM analytics_events WHERE kind = 'view' AND ${this.cur("created_at")} GROUP BY 1 ORDER BY n DESC`)).map((r) => [up(String(r.device)), int(r.n)]));
  }
  async audience(): Promise<Record<string, number>> {
    return Object.fromEntries((await rows(`SELECT COALESCE(role, 'guest') AS r, COUNT(*) AS n FROM analytics_events WHERE kind = 'view' AND ${this.cur("created_at")} GROUP BY 1 ORDER BY n DESC`)).map((r) => [up(String(r.r)), int(r.n)]));
  }

  // ---- overview

  async overview() {
    const u = await one_(`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE role = 'student') AS students, COUNT(*) FILTER (WHERE role = 'employer') AS employers,
      COUNT(*) FILTER (WHERE role = 'counselor') AS counselors, COUNT(*) FILTER (WHERE role = 'admin') AS admins,
      COUNT(*) FILTER (WHERE ${this.cur("created_at")}) AS new_c, COUNT(*) FILTER (WHERE ${this.prev("created_at")}) AS new_p,
      COUNT(*) FILTER (WHERE ${this.cur("last_login_at")}) AS active, COUNT(*) FILTER (WHERE email_verified_at IS NOT NULL) AS verified FROM users`);
    const [apps, enrol, sa, resumes] = await Promise.all([this.pair("applications", "created_at"), this.pair("course_enrolments", "started_at"), this.pair("sa_profiles", "created_at"), this.pair("resumes", "created_at")]);
    const [live_roles, live_roles_all, sa_total, enrol_total, apps_total, resumes_total] = await Promise.all([
      n("SELECT COUNT(*) FROM internships WHERE status = 'live' AND is_sample = 0"), n("SELECT COUNT(*) FROM internships WHERE status = 'live'"), n("SELECT COUNT(*) FROM sa_profiles"),
      n("SELECT COUNT(*) FROM course_enrolments"), n("SELECT COUNT(*) FROM applications"), n("SELECT COUNT(*) FROM resumes"),
    ]);
    const [signups, sApps, sEnrol, sSa, sRes] = await Promise.all([this.daily("users", "created_at"), this.daily("applications", "created_at"), this.daily("course_enrolments", "started_at"), this.daily("sa_profiles", "created_at"), this.daily("resumes", "created_at")]);
    return { users: { total: int(u.total), students: int(u.students), employers: int(u.employers), counselors: int(u.counselors), admins: int(u.admins), new_c: int(u.new_c), new_p: int(u.new_p), active: int(u.active), verified: int(u.verified) },
      apps, enrol, sa, resumes, live_roles, live_roles_all, sa_total, enrol_total, apps_total, resumes_total, spark: { signups, apps: sApps, enrol: sEnrol, sa: sSa, resumes: sRes } };
  }

  /** What students who joined in this period went on to do (parallel steps, not a strict sequence). [label, count, tab|null] */
  async activation(): Promise<Array<[string, number, string | null]>> {
    const w = `role = 'student' AND ${this.cur("created_at")}`;
    const ex = (t: string, c: string, u: string) => n(`SELECT COUNT(*) FROM users u WHERE ${w} AND EXISTS (SELECT 1 FROM ${t} x WHERE x.${c} = u.id)`);
    const [joined, verified, res, apps, courses, sa] = await Promise.all([
      n(`SELECT COUNT(*) FROM users WHERE ${w}`), n(`SELECT COUNT(*) FROM users WHERE ${w} AND email_verified_at IS NOT NULL`),
      ex("resumes", "user_id", ""), ex("applications", "student_id", ""), ex("course_enrolments", "user_id", ""), ex("sa_profiles", "user_id", ""),
    ]);
    return [["Joined", joined, "users"], ["Verified email", verified, null], ["Scored a resume", res, "resumes"], ["Applied to an internship", apps, "internships"], ["Started a course", courses, "courses"], ["Opened a study-abroad profile", sa, "abroad"]];
  }

  /** Things that need an admin right now: [label, count, href, severity]. */
  async attention(): Promise<Array<[string, number, string, "warn" | "bad" | "info"]>> {
    const items: Array<[string, number, string, "warn" | "bad" | "info"]> = [
      ["Internship postings waiting for review", await n("SELECT COUNT(*) FROM internships WHERE status = 'pending'"), "/console", "warn"],
      ["Colleges added by students, waiting for review", await n("SELECT COUNT(*) FROM institutions WHERE status = 'pending'"), "/console/colleges", "warn"],
      ["Study-abroad documents flagged by the scanner", await n("SELECT COUNT(*) FROM sa_documents WHERE scan_status = 'flagged'"), "/console/abroad", "bad"],
      ["Study-abroad documents waiting for verification", await n("SELECT COUNT(*) FROM sa_documents WHERE status = 'uploaded'"), "/console/abroad", "warn"],
      ["Visa appointments in the next 7 days", await n("SELECT COUNT(*) FROM sa_visa WHERE appointment_at >= LOCALTIMESTAMP(0) AND appointment_at < LOCALTIMESTAMP(0) + INTERVAL '7 day'"), "/console/analytics?tab=abroad", "info"],
      ["Staff accounts without two-step login", await n("SELECT COUNT(*) FROM users WHERE role IN ('admin','counselor') AND mfa_enabled_at IS NULL"), "/console/analytics?tab=system", "bad"],
      ["Emails that failed to send", await n("SELECT COUNT(*) FROM mail_outbox WHERE status = 'failed'"), "/console/analytics?tab=system", "bad"],
    ];
    return items.filter((i) => i[1] > 0);
  }

  // ---- users

  async users() {
    const [roles, signups, students, employers, dau, wau, mau, total, verified, never_logged, stuck, staff_total, staff_mfa, weekday, recent] = await Promise.all([
      rows("SELECT role, COUNT(*) AS n FROM users GROUP BY 1 ORDER BY n DESC"), this.daily("users", "created_at"), this.daily("users", "created_at", "role = 'student'"), this.daily("users", "created_at", "role = 'employer'"),
      n("SELECT COUNT(*) FROM users WHERE last_login_at >= LOCALTIMESTAMP(0) - INTERVAL '1 day'"), n("SELECT COUNT(*) FROM users WHERE last_login_at >= LOCALTIMESTAMP(0) - INTERVAL '7 day'"), n("SELECT COUNT(*) FROM users WHERE last_login_at >= LOCALTIMESTAMP(0) - INTERVAL '30 day'"),
      n("SELECT COUNT(*) FROM users"), n("SELECT COUNT(*) FROM users WHERE email_verified_at IS NOT NULL"), n("SELECT COUNT(*) FROM users WHERE last_login_at IS NULL"),
      n("SELECT COUNT(*) FROM users WHERE email_verified_at IS NULL AND created_at < LOCALTIMESTAMP(0) - INTERVAL '3 day'"),
      n("SELECT COUNT(*) FROM users WHERE role IN ('admin','counselor')"), n("SELECT COUNT(*) FROM users WHERE role IN ('admin','counselor') AND mfa_enabled_at IS NOT NULL"),
      rows(`SELECT EXTRACT(DOW FROM created_at)::int AS d, COUNT(*) AS n FROM users WHERE ${this.cur("created_at")} GROUP BY 1`),
      rows("SELECT id, name, role, email, created_at, email_verified_at, last_login_at FROM users ORDER BY id DESC LIMIT 12"),
    ]);
    return { roles: map(roles, "role"), signups, by_role_series: { Students: students, Employers: employers } as Record<string, number[]>, dau, wau, mau, total, verified, never_logged, stuck, staff_total, staff_mfa, weekday: map(weekday, "d"), recent };
  }

  // ---- internships

  async internships() {
    const statusOrder = ["Applied", "Viewed", "Shortlisted", "Interview", "Offered", "Hired", "Rejected"];
    const apps = map(await rows(`SELECT status, COUNT(*) AS n FROM applications WHERE ${this.cur("created_at")} GROUP BY 1`), "status");
    const [status, status_all, category, mode, apps_series, stipend, reply, avg_match, saved, companies, companies_verified, top] = await Promise.all([
      rows("SELECT status, COUNT(*) AS n FROM internships WHERE is_sample = 0 GROUP BY 1 ORDER BY n DESC"), rows("SELECT status, COUNT(*) AS n FROM internships GROUP BY 1 ORDER BY n DESC"),
      rows("SELECT category AS label, COUNT(*) AS n FROM internships WHERE status = 'live' GROUP BY 1 ORDER BY n DESC LIMIT 8"), rows("SELECT mode, COUNT(*) AS n FROM internships WHERE status = 'live' GROUP BY 1 ORDER BY n DESC"),
      this.daily("applications", "created_at"),
      one_("SELECT ROUND(AVG(stipend)) AS avg, (SELECT AVG(x.s) FROM (SELECT stipend AS s, ROW_NUMBER() OVER (ORDER BY stipend) AS rn, COUNT(*) OVER () AS c FROM internships WHERE status = 'live' AND is_sample = 0) x WHERE x.rn IN (FLOOR((x.c + 1) / 2), CEIL((x.c + 1) / 2))) AS med, MIN(stipend) AS lo, MAX(stipend) AS hi FROM internships WHERE status = 'live' AND is_sample = 0"),
      safe(async () => await val<number | null>(`SELECT AVG(TIMESTAMPDIFF(SECOND, a.created_at, e.created_at) / 3600) FROM applications a
        JOIN application_events e ON e.application_id = a.id AND e.id = (SELECT MIN(e2.id) FROM application_events e2 WHERE e2.application_id = a.id AND e2.actor_user_id <> a.student_id)`), null),
      safe(async () => await val<number | null>("SELECT ROUND(AVG(match_score)) FROM applications WHERE match_score IS NOT NULL"), null),
      n("SELECT COUNT(*) FROM saved_internships"), n("SELECT COUNT(*) FROM companies WHERE is_sample = 0"), n("SELECT COUNT(*) FROM companies WHERE is_sample = 0 AND verified = 1"),
      rows(`SELECT i.slug, i.title, c.name AS company, i.status, i.openings,
          (SELECT COUNT(*) FROM applications a WHERE a.internship_id = i.id) AS apps, (SELECT COUNT(*) FROM saved_internships s WHERE s.internship_id = i.id) AS saved,
          (SELECT COUNT(*) FROM analytics_events v WHERE v.kind = 'view' AND v.path IN ('/internships/' || i.slug, '/internship.php') AND (v.item = i.slug OR v.path = '/internships/' || i.slug) AND ${this.cur("v.created_at")}) AS views
        FROM internships i JOIN companies c ON c.id = i.company_id WHERE i.status IN ('live','closed') ORDER BY apps DESC, views DESC, i.id DESC LIMIT 12`),
    ]);
    return { status: map(status, "status"), status_all: map(status_all, "status"), category, mode: map(mode, "mode"), apps_series, apps_by_status: Object.fromEntries(statusOrder.map((s) => [s, apps[s] ?? 0])) as Record<string, number>,
      stipend: { avg: stipend.avg, med: stipend.med, lo: stipend.lo, hi: stipend.hi }, reply_hours: reply === null || reply === undefined ? null : Number(reply), avg_match: avg_match === null || avg_match === undefined ? null : Number(avg_match),
      saved, companies, companies_verified, top };
  }

  // ---- courses

  async courses() {
    const st = map(await rows("SELECT status, COUNT(*) AS n FROM course_enrolments GROUP BY 1"), "status");
    const [courses_total, learners, avg_progress, certs, series, completions, top, viewed, category] = await Promise.all([
      n("SELECT COUNT(*) FROM courses"), n("SELECT COUNT(DISTINCT user_id) FROM course_enrolments"),
      safe(async () => await val<number | null>("SELECT ROUND(AVG(progress)) FROM course_enrolments"), null),
      n("SELECT COUNT(*) FROM course_enrolments WHERE status = 'completed' AND verified = 1"), this.daily("course_enrolments", "started_at"), this.daily("course_enrolments", "completed_at"),
      rows(`SELECT c.slug, c.title, cc.name AS cat, COUNT(e.id) AS enrolled, COUNT(e.id) FILTER (WHERE e.status = 'completed') AS done, ROUND(AVG(e.progress)) AS prog,
          (SELECT COUNT(*) FROM analytics_events v WHERE v.kind = 'view' AND v.path = '/courses/' || c.slug AND ${this.cur("v.created_at")}) AS views
        FROM courses c JOIN course_enrolments e ON e.course_id = c.id LEFT JOIN course_categories cc ON cc.key_name = c.category GROUP BY c.id, c.slug, c.title, cc.name ORDER BY enrolled DESC, c.title LIMIT 12`),
      rows(`SELECT substr(v.path, 10) AS slug, COALESCE(c.title, substr(v.path, 10)) AS title, COUNT(*) AS views, (SELECT COUNT(*) FROM course_enrolments e WHERE e.course_id = c.id) AS enrolled
        FROM analytics_events v LEFT JOIN courses c ON c.slug = substr(v.path, 10) WHERE v.kind = 'view' AND v.path LIKE '/courses/_%' AND ${this.cur("v.created_at")} GROUP BY v.path, c.title, c.id ORDER BY views DESC LIMIT 8`),
      rows("SELECT COALESCE(cc.name, c.category) AS label, COUNT(e.id) AS n FROM course_enrolments e JOIN courses c ON c.id = e.course_id LEFT JOIN course_categories cc ON cc.key_name = c.category GROUP BY 1 ORDER BY n DESC LIMIT 8"),
    ]);
    const enrol_total = Object.values(st).reduce((a, b) => a + b, 0);
    return { courses_total, enrol_total, status: { Enrolled: st.enrolled ?? 0, "In progress": st.in_progress ?? 0, Completed: st.completed ?? 0 } as Record<string, number>, learners,
      avg_progress: avg_progress === null || avg_progress === undefined ? null : Number(avg_progress), certs, series, completions, top, viewed, category };
  }

  // ---- study abroad

  async abroad() {
    const [profiles, series, stages, apps, offers, countries, unis, docs, docs_flagged, docs_types, funds_total, loans, visa, mock, counselors, unassigned, country_views] = await Promise.all([
      n("SELECT COUNT(*) FROM sa_profiles"), this.daily("sa_profiles", "created_at"), rows("SELECT stage, COUNT(*) AS n FROM sa_profiles GROUP BY 1"),
      rows("SELECT status, COUNT(*) AS n FROM sa_applications GROUP BY 1 ORDER BY n DESC"), n("SELECT COUNT(*) FROM sa_applications WHERE status IN ('offer','accepted')"),
      rows("SELECT COALESCE(co.name, u.country_key) AS label, COUNT(*) AS n FROM sa_shortlist s JOIN sa_universities u ON u.id = s.university_id LEFT JOIN sa_countries co ON co.key_name = u.country_key GROUP BY 1 ORDER BY n DESC LIMIT 8"),
      rows(`SELECT u.slug, u.name, COALESCE(co.name, u.country_key) AS country, (SELECT COUNT(*) FROM sa_shortlist s WHERE s.university_id = u.id) AS shortlisted,
          (SELECT COUNT(*) FROM sa_applications a WHERE a.university_id = u.id) AS applied FROM sa_universities u LEFT JOIN sa_countries co ON co.key_name = u.country_key ORDER BY shortlisted DESC, applied DESC, u.name LIMIT 10`),
      rows("SELECT status, COUNT(*) AS n FROM sa_documents GROUP BY 1"), n("SELECT COUNT(*) FROM sa_documents WHERE scan_status = 'flagged'"), rows("SELECT doc_type AS label, COUNT(*) AS n FROM sa_documents GROUP BY 1 ORDER BY n DESC"),
      n("SELECT COALESCE(SUM(amount_inr), 0) FROM sa_funds"),
      rows("SELECT status, COUNT(*) AS n, COALESCE(SUM(amount_inr), 0) AS amt, COALESCE(SUM(sanctioned_inr), 0) AS sanc FROM sa_loans GROUP BY 1 ORDER BY n DESC"),
      rows("SELECT stage, COUNT(*) AS n FROM sa_visa GROUP BY 1 ORDER BY n DESC"), one_("SELECT COUNT(*) AS n, COUNT(finished_at) AS done, ROUND(AVG(score)) AS avg FROM sa_mock_sessions"),
      rows("SELECT u.id, u.name, COUNT(p.user_id) AS cases FROM users u LEFT JOIN sa_profiles p ON p.counselor_id = u.id WHERE u.role = 'counselor' GROUP BY u.id, u.name ORDER BY cases DESC"),
      n("SELECT COUNT(*) FROM sa_profiles WHERE counselor_id IS NULL"),
      rows(`SELECT v.item AS label, COUNT(*) AS n FROM analytics_events v WHERE v.kind = 'view' AND v.path = '/study-abroad/' || COALESCE(v.item, '') AND v.item IS NOT NULL AND ${this.cur("v.created_at")} GROUP BY 1 ORDER BY n DESC LIMIT 8`),
    ]);
    return { profiles, series, stages: map(stages, "stage"), apps: map(apps, "status"), offers, countries, unis, docs: map(docs, "status"), docs_flagged, docs_types, funds_total, loans, visa: map(visa, "stage"),
      mock: { n: int(mock.n), done: int(mock.done), avg: mock.avg === null || mock.avg === undefined ? null : Number(mock.avg) }, counselors, unassigned, country_views };
  }

  // ---- resumes

  async resumes() {
    const [rej, ok, total, users, rej_total, rej_types, sources, avg_rq, grades, buckets, studio, passports, passport_views, passport_series, tool, tool_series, domains, stages] = await Promise.all([
      this.daily("resume_rejections", "created_at"), this.daily("resumes", "created_at"), n("SELECT COUNT(*) FROM resumes"), n("SELECT COUNT(DISTINCT user_id) FROM resumes"), n("SELECT COUNT(*) FROM resume_rejections"),
      rows(`SELECT COALESCE(other_type, 'not a resume') AS label, COUNT(*) AS n FROM resume_rejections WHERE ${this.cur("created_at")} GROUP BY 1 ORDER BY n DESC LIMIT 8`),
      rows("SELECT source, COUNT(*) AS n FROM resumes GROUP BY 1 ORDER BY n DESC"),
      safe(async () => await val<number | null>("SELECT ROUND(AVG(rq_overall), 1) FROM resumes WHERE is_current = 1 AND rq_overall IS NOT NULL"), null),
      rows("SELECT rq_grade, COUNT(*) AS n FROM resumes WHERE is_current = 1 AND rq_grade IS NOT NULL GROUP BY 1 ORDER BY n DESC"),
      rows("SELECT (FLOOR(rq_overall / 10) * 10)::int AS b, COUNT(*) AS n FROM resumes WHERE is_current = 1 AND rq_overall IS NOT NULL GROUP BY 1 ORDER BY 1"),
      one_(`SELECT (SELECT COUNT(*) FROM studio_resumes) AS resumes, (SELECT COUNT(*) FROM studio_versions WHERE kind = 'save') AS saves,
          (SELECT COUNT(*) FROM studio_versions WHERE kind = 'save' AND ${this.cur("created_at")}) AS saves_recent,
          (SELECT COUNT(DISTINCT user_id) FROM studio_subscriptions WHERE starts_at <= LOCALTIMESTAMP(0) AND ends_at > LOCALTIMESTAMP(0)) AS pro,
          (SELECT COALESCE(SUM(amount_paise), 0) FROM studio_payments WHERE status = 'paid') AS revenue,
          (SELECT ROUND(AVG(v2.score - v1.score), 1) FROM studio_versions v1 JOIN studio_versions v2 ON v2.resume_id = v1.resume_id AND v1.kind = 'import'
            AND v2.id = (SELECT MAX(id) FROM studio_versions v3 WHERE v3.resume_id = v1.resume_id AND v3.kind = 'save') WHERE v1.score IS NOT NULL AND v2.score IS NOT NULL) AS avg_gain`),
      one_(`SELECT COUNT(*) FILTER (WHERE is_public = 1) AS public_n, COUNT(*) AS ever_n FROM passports`),
      one_(`SELECT COUNT(*) AS n, COUNT(*) FILTER (WHERE via = 'qr') AS qr FROM passport_views WHERE ${this.cur("created_at")}`), this.daily("passport_views", "created_at"),
      one_(`SELECT COUNT(*) AS n, ROUND(AVG(overall_score), 1) AS avg, COUNT(*) FILTER (WHERE ${this.cur("created_at")}) AS recent FROM qr_submissions`), this.daily("qr_submissions", "created_at"),
      rows("SELECT COALESCE(domain, 'unknown') AS label, COUNT(*) AS n FROM qr_submissions GROUP BY 1 ORDER BY n DESC LIMIT 8"), rows("SELECT COALESCE(career_stage, 'unknown') AS label, COUNT(*) AS n FROM qr_submissions GROUP BY 1 ORDER BY n DESC LIMIT 6"),
    ]);
    return { total, users, uploaded: ok, rejected: rej, rej_total, rej_types, sources: map(sources, "source"), avg_rq: avg_rq === null || avg_rq === undefined ? null : Number(avg_rq), grades: map(grades, "rq_grade"), buckets, studio, passports, passport_views, passport_series, tool, tool_series, domains, stages };
  }

  // ---- e-books (MathStudy.in)

  async ebooks() {
    const [traffic, placements, dest, signed_in, device, back, total_clicks] = await Promise.all([
      this.traffic(),
      rows(`SELECT campaign AS label, COUNT(*) AS n, COUNT(DISTINCT visitor) AS people FROM analytics_events WHERE kind = 'click' AND ${this.cur("created_at")} GROUP BY 1 ORDER BY n DESC`),
      rows(`SELECT COALESCE(item, '/shop') AS label, COUNT(*) AS n FROM analytics_events WHERE kind = 'click' AND ${this.cur("created_at")} GROUP BY 1 ORDER BY n DESC LIMIT 10`),
      n(`SELECT COUNT(*) FROM analytics_events WHERE kind = 'click' AND user_id IS NOT NULL AND ${this.cur("created_at")}`),
      rows(`SELECT device AS label, COUNT(*) AS n FROM analytics_events WHERE kind = 'click' AND ${this.cur("created_at")} GROUP BY 1 ORDER BY n DESC`),
      n(`SELECT COUNT(*) FROM analytics_events WHERE kind = 'view' AND referrer LIKE '%mathstudy.in' AND ${this.cur("created_at")}`), n("SELECT COUNT(*) FROM analytics_events WHERE kind = 'click'"),
    ]);
    return { traffic, placements, dest, signed_in, device: map(device, "label"), back, total_clicks };
  }

  // ---- colleges

  async colleges() {
    const [total, by_source, by_kind, states, pending, pending_n, students, students_set, chosen, unmatched] = await Promise.all([
      n("SELECT COUNT(*) FROM institutions WHERE status = 'approved'"), rows("SELECT source, COUNT(*) AS n FROM institutions WHERE status = 'approved' GROUP BY 1 ORDER BY n DESC"),
      rows("SELECT kind, COUNT(*) AS n FROM institutions WHERE status = 'approved' GROUP BY 1"), rows("SELECT COALESCE(state, 'Not set') AS label, COUNT(*) AS n FROM institutions WHERE status = 'approved' GROUP BY 1 ORDER BY n DESC LIMIT 10"),
      rows("SELECT id, name, state, submit_count, created_at FROM institutions WHERE status = 'pending' ORDER BY submit_count DESC, created_at LIMIT 10"), n("SELECT COUNT(*) FROM institutions WHERE status = 'pending'"),
      n("SELECT COUNT(*) FROM student_profiles"), n("SELECT COUNT(*) FROM student_profiles WHERE college <> ''"),
      rows("SELECT college AS label, COUNT(*) AS n FROM student_profiles WHERE college <> '' GROUP BY 1 ORDER BY n DESC, 1 LIMIT 10"),
      n("SELECT COUNT(*) FROM student_profiles p WHERE p.college <> '' AND NOT EXISTS (SELECT 1 FROM institutions i WHERE i.name_norm = trim(regexp_replace(lower(p.college), '[^a-z0-9]+', ' ')))"),
    ]);
    return { total, by_source: map(by_source, "source"), by_kind: map(by_kind, "kind"), states, pending, pending_n, students, students_set, chosen, unmatched };
  }

  // ---- system

  async system() {
    const [db_size, tables, migrations, outbox, failed_mail, throttle_24h, throttle_by, events_total] = await Promise.all([
      safe(async () => await val<string>("SELECT CONCAT(ROUND(SUM(data_length + index_length) / 1048576, 1), ' MB') FROM information_schema.tables WHERE table_schema = DATABASE()"), null as string | null),
      rows("SELECT table_name AS label, table_rows AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_rows > 0 ORDER BY table_rows DESC LIMIT 12"),
      n("SELECT COUNT(*) FROM schema_meta WHERE k LIKE 'migration:%'"), rows("SELECT status, COUNT(*) AS n FROM mail_outbox GROUP BY 1"),
      rows("SELECT kind, error, created_at FROM mail_outbox WHERE status = 'failed' ORDER BY id DESC LIMIT 5"),
      n("SELECT COUNT(*) FROM auth_throttle WHERE created_at >= LOCALTIMESTAMP(0) - INTERVAL '1 day'"),
      rows("SELECT SUBSTRING_INDEX(bucket, ':', 1) AS label, COUNT(*) AS n FROM auth_throttle WHERE created_at >= LOCALTIMESTAMP(0) - INTERVAL '1 day' GROUP BY 1 ORDER BY n DESC LIMIT 6"), n("SELECT COUNT(*) FROM analytics_events"),
    ]);
    return { db_size, tables, migrations, outbox: map(outbox, "status"), failed_mail, throttle_24h, throttle_by, events_total };
  }
}

/** ucfirst */
export const up = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
/** "OFFER_RECEIVED" -> "Offer received" */
export const pretty = (s: string): string => up(s.toLowerCase().replace(/_/g, " "));
