import type { Metadata } from "next";
import Link from "next/link";
import { PortalPage } from "@/components/portal/shell";
import ChartCard from "@/components/reading/Charts";
import { Card, Crumbs, Locked, btnLight, when } from "@/components/reading/ui";
import { studentPage } from "@/lib/reading/page";
import { buildProgress } from "@/lib/reading/views";
import { KIND_LABEL, type Kind } from "@/lib/reading/taxonomy";

export const metadata: Metadata = { title: "My reading progress | English Reading Studio | GrowQR", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function ProgressPage() {
  const { me } = await studentPage("/reading-studio/progress");
  const p = await buildProgress(me.id);
  return (
    <PortalPage user={me} active="reading-studio" title="My reading progress" subtitle="Like is compared with like: a harder passage is not counted as a decline." wide="full">
      <Crumbs items={[{ href: "/reading-studio/dashboard", label: "My English Reading Studio" }, { label: "Progress" }]} />
      {!p.total ? <Card><p className="text-[15px] text-ink-2">No assessments yet. <Link className="underline" href="/reading-studio/dashboard">Take your starting assessment</Link> and your progress will build here.</p></Card> : null}

      {p.premium && p.trend ? (
        <Card id="trend" title="Your last five comparable assessments">
          <p className="text-[15px] text-ink-2">{p.trend.message}</p>
          <ul className="mt-2 space-y-1 text-[14.5px] text-ink-2">
            {p.trend.wpmChange !== null ? <li>Reading speed (estimate): {p.trend.wpmChange > 0 ? "+" : ""}{p.trend.wpmChange} words per minute across the window.</li> : null}
            {p.trend.comprehensionChange !== null ? <li>Comprehension: {p.trend.comprehensionChange > 0 ? "+" : ""}{p.trend.comprehensionChange} points.</li> : null}
            {p.trend.slope !== null ? <li>Average change per assessment: {p.trend.slope > 0 ? "+" : ""}{p.trend.slope} points.</li> : <li>A trend line needs at least three comparable assessments, so none is drawn yet.</li>}
          </ul>
        </Card>
      ) : null}

      {p.premium && (p.trendChart || p.progressChart) ? (
        <div className="mb-5 grid gap-5 xl:grid-cols-2">{p.trendChart ? <ChartCard chart={p.trendChart} /> : null}{p.progressChart ? <ChartCard chart={p.progressChart} /> : null}</div>
      ) : null}

      {p.premium && p.skillProgress ? (
        <Card id="skills" title="Skills over time">
          <div className="grid gap-5 md:grid-cols-3">
            <div><h3 className="text-[15px] font-semibold text-ink">Improved</h3>{p.skillProgress.improved.length ? <ul className="mt-2 space-y-1 text-[14.5px] text-ink-2">{p.skillProgress.improved.map((s) => <li key={s.skill}>{s.label} (+{s.change})</li>)}</ul> : <p className="mt-2 text-[14px] text-ink-3">None yet by five points or more between assessments.</p>}</div>
            <div><h3 className="text-[15px] font-semibold text-ink">Still building</h3>{p.skillProgress.stillWeak.length ? <ul className="mt-2 space-y-1 text-[14.5px] text-ink-2">{p.skillProgress.stillWeak.map((s) => <li key={s.skill}>{s.label} ({Math.round(s.accuracy ?? 0)}% over {s.attempted})</li>)}</ul> : <p className="mt-2 text-[14px] text-ink-3">No skill is confirmed as still weak.</p>}</div>
            <div><h3 className="text-[15px] font-semibold text-ink">Repeated errors</h3><p className="mt-2 text-[14.5px] text-ink-2">{p.skillProgress.recurringNow} skill{p.skillProgress.recurringNow === 1 ? "" : "s"} with the same kind of miss in more than one passage.</p></div>
          </div>
          {p.readiness ? <p className="mt-4 rounded-lg bg-cream-2 p-3.5 text-[14.5px] text-ink-2"><strong className="text-ink">Ready for the next level? </strong>{p.readiness}</p> : null}
        </Card>
      ) : null}

      {p.international.attempts ? (
        <Card id="international" title="International exams: IELTS Reading">
          <p className="text-[14.5px] text-ink-2">{p.international.attempts} attempt{p.international.attempts === 1 ? "" : "s"}{p.international.best !== null ? `; best band ${p.international.best}` : ""}. Shown as the band each test gave. These are not broken down by reading skill, because IELTS question types differ from the Studio&apos;s skills.</p>
          <ul className="mt-3 space-y-1.5 text-[14px] text-ink-2">{p.international.recent.map((a) => <li key={`${a.test}-${a.at}`}>{when(a.at.replace(" ", "T") + "Z")} · Test {a.test}: {a.raw} of {a.total} correct{a.band !== null ? `, band ${a.band}` : ""}</li>)}</ul>
          <Link href="/practice-tests/ielts-reading" className={`${btnLight} mt-3`}>Open IELTS Reading tests</Link>
        </Card>
      ) : null}

      {p.timeline.length ? (
        <Card id="timeline" title={p.premium ? "Timeline" : "Your latest assessment"}>
          <ol className="space-y-3">
            {p.timeline.map((t) => (
              <li key={t.id} className="rounded-xl border border-black/10 p-4">
                <p className="text-[12.5px] font-semibold uppercase tracking-wide text-ink-3">{when(t.at)} · {KIND_LABEL[t.kind as Kind]}{t.completion === "partial" ? " · partial" : ""}</p>
                <p className="mt-1 text-[15px] text-ink">Score {t.overall ?? "n/a"} / 100 (provisional){t.wpm !== null ? ` · ${Math.round(t.wpm)} wpm (estimate)` : ""}{t.comprehensionPct !== null ? ` · comprehension ${Math.round(t.comprehensionPct)}%` : ""} · {t.correct} of {t.total} correct</p>
                {p.premium ? <p className="mt-1 text-[13.5px] text-ink-3">{t.note}</p> : null}
                <Link href={`/reading-studio/results/${t.id}`} className="mt-1.5 inline-block text-[14px] font-semibold text-orange-deep underline">Open</Link>
              </li>
            ))}
          </ol>
        </Card>
      ) : null}

      {!p.premium && p.total ? (
        <Locked headline="Keep your full history" body={`You have ${p.total} assessment${p.total === 1 ? "" : "s"} on record. The package keeps every one, compares like with like, draws your trend once there are three comparable results, and shows which skills have improved.`} source="progress" />
      ) : null}
      <div className="mt-5"><Link href="/reading-studio/dashboard" className={btnLight}>Back to my dashboard</Link></div>
    </PortalPage>
  );
}
