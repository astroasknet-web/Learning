import Link from "next/link";
import type { ReactNode } from "react";
import { appUrl } from "@/lib/portal/mail";
import * as pc from "@/lib/portal/passport/credential";
import * as share from "@/lib/portal/passport/share";
import { Analytics, pretty, up } from "@/lib/admin/analytics";
import { reissuePassportsAction } from "@/app/(portal)/console/actions";
import { Donut, Funnel, HBars, LineChart, inr, num, pct, short } from "./charts";
import { Card, DTable, Grid, Kpi, KpiGrid, type Cell } from "./analytics-ui";

type R = Record<string, unknown>;
const s = (v: unknown): string => String(v ?? "");
const i = (v: unknown): number => Math.trunc(Number(v) || 0);
const shortDate = (ts: unknown, long = false) => (ts ? new Date(s(ts).replace(" ", "T") + (s(ts).length > 10 ? "Z" : "T00:00:00Z")).toLocaleDateString("en-GB", long ? { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" } : { day: "numeric", month: "short", timeZone: "UTC" }) : "");
const maskEmail = (e: string) => { const [u, d = ""] = e.split("@"); return `${u.slice(0, 1)}***@${d}`; };
const lbl = (rows: R[], f: (v: string) => string = (x) => x): Array<[string, number]> => rows.map((r) => [f(s(r.label)), i(r.n)]);
const named = (m: Record<string, number>, f: (k: string) => string): Record<string, number> => Object.fromEntries(Object.entries(m).map(([k, v]) => [f(k), v]));
const destLabel = (p: string): string => {
  let d = p;
  try { d = decodeURIComponent(p); } catch { /* keep raw */ }
  if (d === "/shop" || d === "/") return "Shop home";
  let m = /^\/shop\?cat=(.+)$/.exec(d);
  if (m) return `Category: ${m[1]}`;
  m = /^\/shop\/category\/(.+)$/.exec(d);
  return m ? `Category: ${up(m[1].replace(/-/g, " "))}` : d;
};

export async function TabBody({ tab, an, label, reissued }: { tab: string; an: Analytics; label: string; reissued?: number }): Promise<ReactNode> {
  const url = (t: string) => `/console/analytics?tab=${t}&range=${an.days}`;
  const rangeL = label.toLowerCase();
  const dates = an.dates();

  if (tab === "overview") {
    const [o, t, att, act, topPages, ref, dev, aud] = await Promise.all([an.overview(), an.traffic(), an.attention(), an.activation(), an.topPages(), an.referrers(), an.devices(), an.audience()]);
    const u = o.users;
    return (
      <>
        <KpiGrid>
          <Kpi label="Total users" value={short(u.total)} href={url("users")} now={u.new_c} prev={u.new_p} note={`+${num(u.new_c)} this period`} spark={o.spark.signups} />
          <Kpi label="Unique visitors" value={short(t.visitors)} href={url("overview")} now={t.visitors} prev={t.prev.visitors} note="counted once per day" spark={t.series.visitors} />
          <Kpi label="Page views" value={short(t.views)} href={url("overview")} now={t.views} prev={t.prev.views} spark={t.series.views} />
          <Kpi label="Active users" value={short(u.active)} href={url("users")} note={`${pct(u.active, u.total)} signed in this period`} />
          <Kpi label="Live internships" value={num(o.live_roles)} href={url("internships")} note={`${num(o.live_roles_all)} incl. samples`} />
          <Kpi label="Internship applications" value={short(o.apps[0])} href={url("internships")} now={o.apps[0]} prev={o.apps[1]} note={`${num(o.apps_total)} all time`} spark={o.spark.apps} />
          <Kpi label="Course enrolments" value={short(o.enrol[0])} href={url("courses")} now={o.enrol[0]} prev={o.enrol[1]} note={`${num(o.enrol_total)} all time`} spark={o.spark.enrol} />
          <Kpi label="Study-abroad students" value={short(o.sa[0])} href={url("abroad")} now={o.sa[0]} prev={o.sa[1]} note={`${num(o.sa_total)} in total`} spark={o.spark.sa} />
          <Kpi label="Resumes scored" value={short(o.resumes[0])} href={url("resumes")} now={o.resumes[0]} prev={o.resumes[1]} note={`${num(o.resumes_total)} all time`} spark={o.spark.resumes} />
          <Kpi label="E-book clicks to MathStudy" value={short(t.clicks)} href={url("ebooks")} now={t.clicks} prev={t.prev.clicks} note={`${num(t.clickers)} people`} spark={t.series.clicks} tone="hl" />
          <Kpi label="Employers" value={num(u.employers)} href={url("internships")} note={`${num(u.students)} students`} />
          <Kpi label="Email verified" value={pct(u.verified, u.total)} href={url("users")} note={`${num(u.verified)} of ${num(u.total)}`} />
        </KpiGrid>
        <Grid>
          <Card title="Traffic" wide hint={t.tracking_since ? `Counting since ${shortDate(t.tracking_since, true)}. No cookies, no IP addresses stored.` : "Counting starts when the first visitor loads a page."}>
            <LineChart labels={t.dates} series={{ "Page views": t.series.views, "Unique visitors": t.series.visitors }} title={`Page views and unique visitors per day, ${label}`} />
          </Card>
          <Card title="New signups" link={url("users")} linkLabel="Users"><LineChart labels={dates} series={{ Signups: o.spark.signups }} title={`New user signups per day, ${label}`} compact /></Card>
          <Card title="What new students did" hint="Students who joined in this period, and how many went on to each step."><Funnel steps={act.map(([l, v, tb]) => [l, v, tb ? url(tb) : undefined])} /></Card>
          <Card title="Needs your attention" link="/console" linkLabel="Review queue">
            {att.length ? <ul className="space-y-2">{att.map((a) => <li key={a[0]}><Link href={a[2]} className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-[14px] ${a[3] === "bad" ? "bg-red-50 text-red-900" : a[3] === "warn" ? "bg-amber-50 text-amber-900" : "bg-cream-3 text-ink-2"}`}><span><b>{num(a[1])}</b> {a[0]}</span><span aria-hidden="true">&rarr;</span></Link></li>)}</ul>
              : <p className="text-[14px] text-emerald-800">&#10003; All clear. Nothing is waiting for you.</p>}
          </Card>
        </Grid>
        <Grid>
          <DTable id="top_pages" title="Most viewed pages" headers={["Page", "Views", "Visitors"]} empty="No page views recorded yet. They appear as visitors browse the site."
            rows={topPages.map((r): Cell[] => [{ text: s(r.path) + (r.item ? ` / ${s(r.item)}` : ""), href: s(r.path) }, i(r.views), i(r.visitors)])} />
          <Card title="Where visitors come from" hint="External sites that sent visitors. Direct visits are not listed."><HBars title="Top referrers" rows={ref.map((r) => [s(r.label), i(r.n)])} /></Card>
          <Card title="Devices"><Donut parts={dev} title="Visitors by device" /></Card>
          <Card title="Who is browsing" hint="Guest = not signed in."><Donut parts={aud} title="Page views by signed-in role" /></Card>
        </Grid>
      </>
    );
  }

  if (tab === "users") {
    const [d, ov] = await Promise.all([an.users(), an.overview()]);
    const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return (
      <>
        <KpiGrid>
          <Kpi label="Total users" value={num(d.total)} now={ov.users.new_c} prev={ov.users.new_p} note={`+${num(ov.users.new_c)} this period`} spark={d.signups} />
          <Kpi label="Active today" value={num(d.dau)} note="signed in, last 24 hours" />
          <Kpi label="Active this week" value={num(d.wau)} note="last 7 days" />
          <Kpi label="Active this month" value={num(d.mau)} note="last 30 days" />
          <Kpi label="Stickiness" value={pct(d.dau, d.mau)} note="daily / monthly active" />
          <Kpi label="Email verified" value={pct(d.verified, d.total)} note={`${num(d.stuck)} unverified for 3+ days`} tone={d.stuck > 0 ? "warn" : ""} />
          <Kpi label="Never signed in" value={num(d.never_logged)} note={`${pct(d.never_logged, d.total)} of users`} />
          <Kpi label="Staff with two-step login" value={pct(d.staff_mfa, d.staff_total)} note={`${d.staff_mfa} of ${d.staff_total} admins and counselors`} tone={d.staff_mfa < d.staff_total ? "bad" : ""} />
        </KpiGrid>
        <Grid>
          <Card title="Signups by role" wide><LineChart labels={dates} series={d.by_role_series} title={`New signups per day by role, ${label}`} /></Card>
          <Card title="Users by role"><Donut parts={named(d.roles, up)} title="Users by role" centre={short(d.total)} /></Card>
          <Card title="Signups by weekday" hint={`${label}.`}><HBars title="Signups by weekday" rows={[1, 2, 3, 4, 5, 6, 0].map((x) => [wd[x], d.weekday[String(x)] ?? 0])} /></Card>
          <DTable id="recent_users" title="Newest accounts" headers={["~Name", "~Role", "~Email", "~Joined", "~Verified", "~Last sign-in"]}
            rows={d.recent.map((r): Cell[] => [s(r.name), up(s(r.role)), maskEmail(s(r.email)), shortDate(r.created_at, true), r.email_verified_at ? "Yes" : "No", r.last_login_at ? shortDate(r.last_login_at) : "never"])} />
        </Grid>
      </>
    );
  }

  if (tab === "internships") {
    const d = await an.internships();
    const live = d.status.live ?? 0;
    const apps = Object.values(d.apps_by_status).reduce((a, b) => a + b, 0);
    const st = d.stipend;
    const postings = Object.keys(d.status).length ? d.status : d.status_all;
    return (
      <>
        <KpiGrid>
          <Kpi label="Live internships" value={num(live)} note={`${num(d.status.pending ?? 0)} waiting for review`} tone={(d.status.pending ?? 0) > 0 ? "warn" : ""} />
          <Kpi label="Applications" value={num(apps)} note={label} spark={d.apps_series} />
          <Kpi label="Companies" value={num(d.companies)} note={`${num(d.companies_verified)} verified`} />
          <Kpi label="Median stipend" value={st.med !== null && st.med !== undefined ? `${inr(Number(st.med))}/mo` : "n/a"} note={st.lo !== null && st.lo !== undefined ? `${inr(Number(st.lo))} to ${inr(Number(st.hi))}` : ""} />
          <Kpi label="First reply time" value={d.reply_hours === null ? "n/a" : d.reply_hours < 48 ? `${num(d.reply_hours, 1)} hrs` : `${num(d.reply_hours / 24, 1)} days`} note="employer response, average" />
          <Kpi label="Average match" value={d.avg_match === null ? "n/a" : `${num(d.avg_match)}%`} note="skills match on applications" />
          <Kpi label="Saved by students" value={num(d.saved)} note="bookmarked roles" />
          <Kpi label="Hired" value={num(d.apps_by_status.Hired ?? 0)} note="in this period" />
        </KpiGrid>
        <Grid>
          <Card title="Applications" wide link="/console" linkLabel="Review queue"><LineChart labels={dates} series={{ Applications: d.apps_series }} title={`Internship applications per day, ${label}`} /></Card>
          <Card title="Where applications stand" hint={`Applications made in ${rangeL}, by where they are now.`}><HBars title="Applications by current status" rows={Object.entries(d.apps_by_status)} /></Card>
          <Card title="Postings by status" link="/console" linkLabel="Review queue" hint={Object.keys(d.status).length ? "" : "Includes sample roles until real postings arrive."}><Donut parts={named(postings, pretty)} title="Internship postings by status" /></Card>
          <Card title="Live roles by category"><HBars title="Live roles by category" rows={lbl(d.category)} /></Card>
          <Card title="Work mode"><Donut parts={d.mode} title="Live roles by work mode" /></Card>
          <DTable id="top_internships" title="Internships by applications" headers={["Role", "~Company", "~Status", "Views", "Applications", "Apply rate", "Saved"]} empty="No internships yet." link="/console" linkLabel="Review queue"
            rows={d.top.map((r): Cell[] => [{ text: s(r.title), href: `/internships/${s(r.slug)}` }, s(r.company), pretty(s(r.status)), i(r.views), i(r.apps), i(r.views) > 0 ? pct(i(r.apps), i(r.views), 1) : "n/a", i(r.saved)])} />
        </Grid>
      </>
    );
  }

  if (tab === "courses") {
    const d = await an.courses();
    const done = d.status.Completed;
    return (
      <>
        <KpiGrid>
          <Kpi label="Courses in catalogue" value={num(d.courses_total)} href="/courses" />
          <Kpi label="Enrolments" value={num(d.enrol_total)} note={`${num(d.series.reduce((a, b) => a + b, 0))} in ${rangeL}`} spark={d.series} />
          <Kpi label="Learners" value={num(d.learners)} note="students enrolled in at least one course" />
          <Kpi label="Completion rate" value={pct(done, d.enrol_total)} note={`${num(done)} completed`} />
          <Kpi label="Certificates verified" value={num(d.certs)} note="via LMS link or webhook" />
          <Kpi label="Average progress" value={d.avg_progress === null ? "n/a" : `${num(d.avg_progress)}%`} note="across all enrolments" />
        </KpiGrid>
        <Grid>
          <Card title="Enrolments and completions" wide link="/courses" linkLabel="Course catalogue"><LineChart labels={dates} series={{ Enrolments: d.series, Completions: d.completions }} title={`Course enrolments and completions per day, ${label}`} /></Card>
          <Card title="Learner status"><Donut parts={d.status} title="Enrolments by status" /></Card>
          <Card title="Enrolments by field"><HBars title="Enrolments by field" rows={lbl(d.category)} /></Card>
          <DTable id="top_courses" title="Courses by enrolment" headers={["Course", "~Field", "Enrolled", "Completed", "Completion", "Avg progress", "Views (period)"] } empty="No enrolments yet."
            rows={d.top.map((r): Cell[] => [{ text: s(r.title), href: `/courses/${s(r.slug)}` }, s(r.cat), i(r.enrolled), i(r.done), pct(i(r.done), i(r.enrolled)), `${i(r.prog)}%`, i(r.views)])} />
          <DTable id="viewed_courses" title="Most viewed courses" headers={["Course", "Views", "Enrolled (all time)", "Enrolled per view"]} empty="Course page views will appear once visitors browse the catalogue."
            rows={d.viewed.map((r): Cell[] => [{ text: s(r.title), href: `/courses/${s(r.slug)}` }, i(r.views), i(r.enrolled), pct(i(r.enrolled), i(r.views), 1)])} />
        </Grid>
      </>
    );
  }

  if (tab === "abroad") {
    const d = await an.abroad();
    const appsN = Object.values(d.apps).reduce((a, b) => a + b, 0);
    const sanc = d.loans.reduce((a, l) => a + i(l.sanc), 0);
    const loanN = d.loans.reduce((a, l) => a + i(l.n), 0);
    const order = ["ONBOARDING", "DOC_COLLECTION", "IN_REVIEW", "APPLIED", "OFFER_RECEIVED", "VISA", "DEPARTED"];
    const stageRows: Array<[string, number]> = [...new Set([...order, ...Object.keys(d.stages)])].filter((k) => d.stages[k] !== undefined).map((k) => [pretty(k), d.stages[k]]);
    return (
      <>
        <KpiGrid>
          <Kpi label="Students" value={num(d.profiles)} note={`${num(d.series.reduce((a, b) => a + b, 0))} joined in ${rangeL}`} spark={d.series} />
          <Kpi label="University applications" value={num(appsN)} note={`${num(d.offers)} offers`} />
          <Kpi label="Funds declared" value={inr(d.funds_total)} note="proof of funds, all students" />
          <Kpi label="Loans sanctioned" value={inr(sanc)} note={`${num(loanN)} loan applications`} />
          <Kpi label="Mock interviews" value={num(d.mock.n)} note={`avg score ${d.mock.avg === null ? "n/a" : `${d.mock.avg}%`}`} />
          <Kpi label="Documents flagged" value={num(d.docs_flagged)} href="/console/abroad" note="by the file scanner" tone={d.docs_flagged > 0 ? "bad" : ""} />
          <Kpi label="Without a counselor" value={num(d.unassigned)} href="/console/abroad" note="students not yet assigned" tone={d.unassigned > 0 ? "warn" : ""} />
        </KpiGrid>
        <Grid>
          <Card title="New study-abroad students" wide link="/console/abroad" linkLabel="Study abroad ops"><LineChart labels={dates} series={{ "New students": d.series }} title={`New study-abroad profiles per day, ${label}`} /></Card>
          <Card title="Journey stage"><HBars title="Students by journey stage" rows={stageRows} /></Card>
          <Card title="University applications"><Donut parts={named(d.apps, pretty)} title="University applications by status" /></Card>
          <Card title="Most shortlisted countries"><HBars title="Shortlists by country" rows={lbl(d.countries)} /></Card>
          <Card title="Country pages viewed" hint={`${label}.`}><HBars title="Country page views" rows={lbl(d.country_views, (x) => x.toUpperCase())} /></Card>
          <Card title="Documents"><Donut parts={named(d.docs, pretty)} title="Documents by status" /></Card>
          <Card title="Document types"><HBars title="Documents by type" rows={lbl(d.docs_types, pretty)} /></Card>
          <Card title="Visa progress"><Donut parts={named(d.visa, pretty)} title="Visa cases by stage" /></Card>
          <DTable id="universities" title="Universities students want" headers={["University", "~Country", "Shortlisted", "Applied"]} rows={d.unis.map((r): Cell[] => [{ text: s(r.name), href: `/universities/${s(r.slug)}` }, s(r.country), i(r.shortlisted), i(r.applied)])} />
          <DTable id="loans" title="Education loans" headers={["Status", "Cases", "Requested", "Sanctioned"]} empty="No loan cases yet." rows={d.loans.map((l): Cell[] => [pretty(s(l.status)), i(l.n), `₹${short(i(l.amt))}`, `₹${short(i(l.sanc))}`])} />
          <DTable id="counselors" title="Counselor caseload" headers={["Counselor", "Students"]} empty="No counselors yet." link="/console/abroad" linkLabel="Study abroad ops" rows={d.counselors.map((r): Cell[] => [{ text: s(r.name), href: "/console/abroad" }, i(r.cases)])} />
        </Grid>
      </>
    );
  }

  if (tab === "resumes") {
    const d = await an.resumes();
    const st = d.studio;
    const tool = d.tool;
    const allTries = d.total + d.rej_total;
    const gain = st.avg_gain === null || st.avg_gain === undefined ? null : Number(st.avg_gain);
    return (
      <>
        <KpiGrid>
          <Kpi label="Resumes stored" value={num(d.total)} note={`${num(d.users)} students`} spark={d.uploaded} />
          <Kpi label="Average RQ score" value={d.avg_rq === null ? "n/a" : num(d.avg_rq, 1)} note="current resumes, out of 100" />
          <Kpi label="Non-resumes stopped" value={num(d.rej_total)} note={`${pct(d.rej_total, allTries, 1)} of all uploads`} spark={d.rejected} tone="hl" />
          <Kpi label="Resume Studio users" value={num(i(st.resumes))} href="/console/studio" note={`${num(i(st.saves))} saved updates, ${num(i(st.saves_recent))} in ${rangeL}`} />
          <Kpi label="Average score gain" value={gain === null ? "n/a" : `${gain > 0 ? "+" : ""}${num(gain, 1)}`} href="/console/studio" note="from first import to latest update" />
          <Kpi label="Pro members" value={num(i(st.pro))} href="/console/studio" note={`revenue ${inr(i(st.revenue) / 100)} all time`} tone="hl" />
          <Kpi label="Public passports" value={num(i(d.passports.public_n))} note={`${num(i(d.passports.ever_n))} ever published`} tone="hl" />
          <Kpi label="Passport views" value={num(i(d.passport_views.n))} note={`${num(i(d.passport_views.qr))} from the QR code, ${rangeL}`} spark={d.passport_series} />
          <Kpi label="Free score tool runs" value={num(i(tool.n))} note={`${num(i(tool.recent))} in ${rangeL}`} spark={d.tool_series} />
          <Kpi label="Free tool average" value={tool.avg === null || tool.avg === undefined ? "n/a" : num(Number(tool.avg), 1)} note="public resume checker" />
        </KpiGrid>
        <Grid>
          <Card title="Resume uploads" wide><LineChart labels={dates} series={{ "Scored resumes": d.uploaded, "Stopped (not a resume)": d.rejected }} title={`Resume uploads and rejected non-resume uploads per day, ${label}`} /></Card>
          <Card title="RQ score spread" hint="Current resume of each student, in bands of ten."><HBars title="Current resumes by score band" rows={d.buckets.map((b): [string, number] => [`${i(b.b)} to ${i(b.b) + 9}`, i(b.n)])} /></Card>
          <Card title="Grades"><Donut parts={d.grades} title="Resume grades" /></Card>
          <Card title="How resumes arrive"><Donut parts={named(d.sources, (k) => k.toUpperCase())} title="Resumes by source" /></Card>
          <Card title="What people uploaded instead" hint={`Documents the resume check stopped, ${rangeL}.`}><HBars title="Rejected document types" rows={lbl(d.rej_types, up)} /></Card>
          <Card title="Free tool: fields"><HBars title="Free tool submissions by field" rows={lbl(d.domains, up)} /></Card>
          <Card title="Free tool: career stage"><HBars title="Free tool submissions by career stage" rows={lbl(d.stages, up)} /></Card>
        </Grid>
      </>
    );
  }

  if (tab === "ebooks") {
    const d = await an.ebooks();
    const t = d.traffic;
    const names: Record<string, string> = { nav: "Navigation bar", footer: "Footer", home: "Homepage band", courses: "Courses page", abroad: "Study-abroad page", dashboard: "Student dashboard" };
    return (
      <>
        <KpiGrid>
          <Kpi label="Clicks to MathStudy.in" value={num(t.clicks)} now={t.clicks} prev={t.prev.clicks} note={label} spark={t.series.clicks} tone="hl" />
          <Kpi label="People who clicked" value={num(t.clickers)} note="counted once per day" />
          <Kpi label="Clicks per 100 visitors" value={t.visitors > 0 ? num((t.clicks / t.visitors) * 100, 1) : "n/a"} note="e-book interest" />
          <Kpi label="From signed-in users" value={pct(d.signed_in, t.clicks)} note={`${num(d.signed_in)} clicks`} />
          <Kpi label="Visits back from MathStudy" value={num(d.back)} note="needs a GrowQR link on mathstudy.in" />
          <Kpi label="All-time clicks" value={num(d.total_clicks)} note={t.tracking_since ? `since ${shortDate(t.tracking_since, true)}` : "tracking starts now"} />
        </KpiGrid>
        <Grid>
          <Card title="E-book clicks" wide link="https://mathstudy.in/shop" linkLabel="Open the MathStudy shop"><LineChart labels={t.dates} series={{ Clicks: t.series.clicks }} title={`Clicks to MathStudy.in per day, ${label}`} /></Card>
          <Card title="Which placement works" hint="Use this to decide where to put more e-book links."><HBars title="Clicks by placement" rows={d.placements.map((r): [string, number, undefined, string] => [names[s(r.label)] ?? s(r.label), i(r.n), undefined, `${num(i(r.people))} people`])} /></Card>
          <Card title="Where they went"><HBars title="Clicks by MathStudy page" rows={d.dest.map((r): [string, number] => [destLabel(s(r.label)), i(r.n)])} /></Card>
          <Card title="Devices"><Donut parts={named(d.device, up)} title="Clicks by device" /></Card>
          <Card title="Sales happen on MathStudy.in" wide>
            <p className="text-[14px] text-ink-2 mb-3">GrowQR can count who clicked. Purchases and revenue are recorded on MathStudy.in itself. Every link carries <code>utm_source=growqr</code> and the placement name, so MathStudy&rsquo;s own analytics can attribute orders to GrowQR.</p>
            <p className="flex gap-3"><a className="min-h-[44px] inline-flex items-center px-4 rounded-lg bg-ink text-white text-[14px] font-semibold" href="https://mathstudy.in/admin/analytics" target="_blank" rel="noopener noreferrer">MathStudy sales dashboard</a>
              <a className="min-h-[44px] inline-flex items-center px-4 rounded-lg border border-black/[0.15] text-[14px]" href="https://mathstudy.in/shop" target="_blank" rel="noopener noreferrer">Shop</a></p>
          </Card>
        </Grid>
      </>
    );
  }

  if (tab === "colleges") {
    const d = await an.colleges();
    return (
      <>
        <KpiGrid>
          <Kpi label="Colleges in directory" value={num(d.total)} note="searchable by students" />
          <Kpi label="Waiting for review" value={num(d.pending_n)} href="/console/colleges" note="added by students" tone={d.pending_n > 0 ? "warn" : ""} />
          <Kpi label="Students with a college" value={pct(d.students_set, d.students)} note={`${num(d.students_set)} of ${num(d.students)}`} />
          <Kpi label="Typed but not in directory" value={num(d.unmatched)} note="free-text colleges to review" />
        </KpiGrid>
        <Grid>
          <Card title="Directory by state"><HBars title="Colleges by state" rows={lbl(d.states)} /></Card>
          <Card title="Source"><Donut parts={named(d.by_source, (k) => k.toUpperCase())} title="Colleges by source" /></Card>
          <Card title="Type"><Donut parts={named(d.by_kind, up)} title="Institutions by type" /></Card>
          <Card title="Colleges students chose" wide><HBars title="Most common student colleges" rows={lbl(d.chosen)} /></Card>
          <DTable id="pending_colleges" title="Waiting for review" headers={["College", "~State", "Submissions", "Added"]} empty="Nothing waiting." link="/console/colleges" linkLabel="Review"
            rows={d.pending.map((r): Cell[] => [s(r.name), s(r.state), i(r.submit_count), shortDate(r.created_at)])} />
        </Grid>
      </>
    );
  }

  if (tab === "system") {
    const d = await an.system();
    const ob = d.outbox;
    const base = await appUrl();
    const mailOn = !!process.env.RESEND_API_KEY;
    const storageDir = process.env.STORAGE_DIR ?? "";
    const sodium = pc.available();
    const stale = await share.staleIssuerCount().catch(() => 0);
    const did = await pc.did().catch(() => "");
    const pcBase = await pc.base().catch(() => base);
    type Chk = ["ok" | "warn" | "bad", string, string];
    const checks: Chk[] = [
      [!base || /example|localhost/.test(base) ? "warn" : "ok", "Public address (PORTAL_APP_URL)", !base || /example|localhost/.test(base) ? `Currently ${base || "not set"}. Email links will point there.` : base],
      [mailOn ? "ok" : "bad", "Email sending", mailOn ? "Resend is configured" : "RESEND_API_KEY is not set, so no email is actually sent and signup verification cannot work."],
      [storageDir ? "ok" : "warn", "File storage (STORAGE_DIR)", storageDir ? `Files are kept in ${storageDir}` : "Not set, so uploads go in the app folder and a redeploy may remove them. Set STORAGE_DIR to a folder outside the app."],
      [!sodium ? "bad" : "ok", "Passport signing (QR-verifiable passports)", sodium ? "PASSPORT_SIGNING_SEED is set (stable across redeploys)" : "PASSPORT_SIGNING_SEED is missing or shorter than 32 characters, so students cannot publish passports."],
      [d.migrations > 0 ? "ok" : "warn", "Database migrations", d.migrations > 0 ? `${d.migrations} recorded` : "No migration record (schema_meta). Set PORTAL_AUTO_MIGRATE=1 or run npm run portal:migrate."],
      [process.env.PORTAL_MFA_REQUIRE_STAFF === "false" ? "warn" : "ok", "Two-step login for staff", process.env.PORTAL_MFA_REQUIRE_STAFF === "false" ? "Not required" : "Required"],
      [d.events_total > 0 ? "ok" : "warn", "Traffic tracking", d.events_total > 0 ? `${num(d.events_total)} events recorded` : "No events yet"],
    ];
    const icon = { ok: "✓", warn: "!", bad: "✕" } as const;
    const tone = { ok: "text-emerald-800 bg-emerald-50", warn: "text-amber-900 bg-amber-50", bad: "text-red-900 bg-red-50" } as const;
    return (
      <>
        {reissued !== undefined ? <p role="status" className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-[14px] text-emerald-900">&#10003; Re-issued {reissued} passport(s) for the current address.</p> : null}
        <KpiGrid>
          <Kpi label="Database size" value={d.db_size ?? "n/a"} note="MySQL" />
          <Kpi label="Emails sent" value={num(ob.sent ?? 0)} note={`${num(ob.logged ?? 0)} only logged`} />
          <Kpi label="Emails failed" value={num(ob.failed ?? 0)} note={`${num(ob.pending ?? 0)} waiting`} tone={(ob.failed ?? 0) > 0 ? "bad" : ""} />
          <Kpi label="Sign-in limits hit (24h)" value={num(d.throttle_24h)} note="rate-limit events, possible guessing" />
          <Kpi label="Events tracked" value={num(d.events_total)} note="page views and clicks" />
          <Kpi label="Node" value={process.version} note={storageDir ? "storage folder set" : "default storage folder"} />
        </KpiGrid>
        <Grid>
          <Card title="Setup checklist" wide>
            <ul className="space-y-2">{checks.map((c) => <li key={c[1]} className={`flex gap-3 rounded-lg px-3 py-2.5 text-[14px] ${tone[c[0]]}`}><span aria-hidden="true" className="font-bold w-4 text-center">{icon[c[0]]}</span><span><b>{c[1]}</b><small className="block"><span className="sr-only">{c[0] === "ok" ? "Good. " : c[0] === "warn" ? "Warning. " : "Needs action. "}</span>{c[2]}</small></span></li>)}</ul>
          </Card>
          <Card title="Passport address (domain)" wide>
            <p className="text-[14px] text-ink-2 mb-3">Passports and their QR codes are tied to this address: <b>{pcBase}</b> (issuer <code>{did}</code>). To change it, set <code>PORTAL_APP_URL</code>, then re-issue.</p>
            {stale > 0 ? (
              <>
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 text-[14px] text-amber-900 mb-3"><b>{stale}</b> public passport(s) were signed for a different address. Re-issue them so they verify at the new address. Codes and content stay the same.</p>
                <form action={reissuePassportsAction}><button className="min-h-[44px] px-4 rounded-lg bg-ink text-white text-[14px] font-semibold" type="submit">Re-issue all public passports</button></form>
              </>
            ) : <p className="text-[14px] text-emerald-800">&#10003; All public passports match the current address.</p>}
          </Card>
          <Card title="Biggest tables"><HBars title="Rows per table" rows={lbl(d.tables)} /></Card>
          <Card title="Sign-in limits by type" hint="Last 24 hours."><HBars title="Rate-limit events by type" rows={lbl(d.throttle_by)} /></Card>
          <DTable id="failed_mail" title="Recent failed emails" headers={["~Kind", "~Error", "~When"]} empty="No failed emails." rows={d.failed_mail.map((r): Cell[] => [s(r.kind), s(r.error), shortDate(r.created_at)])} />
        </Grid>
      </>
    );
  }
  return null;
}
