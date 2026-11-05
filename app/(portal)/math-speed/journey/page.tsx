import type { Metadata } from "next";
import Link from "next/link";
import { PortalPage } from "@/components/portal/shell";
import { Bar, Card, Flash, StartButton, StatusChip, Unlock, btnLight, btnPrimary, seconds } from "@/components/mathspeed/ui";
import { buildJourney } from "@/lib/mathspeed/dashboard";
import { enrolledStudent } from "@/lib/mathspeed/page";
import { achievementsOf, practiceDays, recentSessions } from "@/lib/mathspeed/store";
import { streak } from "@/lib/mathspeed/achievements";
import { dueSkills, isMastered } from "@/lib/mathspeed/mastery";
import { localDay } from "@/lib/mathspeed/personalise";
import { buyLink, courseAccess, courseFeeNow } from "@/lib/mathspeed/access";

export const metadata: Metadata = { title: "My Learning Journey | Mathematics Speed Enhancement Studio | GrowQR" };
export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = { practice: "Practise", drill: "Timed drill", level: "Level Assessment", progress: "Progress Assessment", mastery: "Mastery Assessment", foundation: "Foundation Check", revision: "Revision", review: "Daily review", diagnostic: "Placement check", benchmark: "Benchmark" };

export default async function JourneyPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { me, snap } = await enrolledStudent("/math-speed/journey");
  const [access, fee, days, achievements, recent] = await Promise.all([courseAccess(me.id), courseFeeNow(), practiceDays(me.id), achievementsOf(me.id), recentSessions(me.id, 6)]);
  const journey = buildJourney({
    enrolled: true,
    diagnosticDone: snap.enrolment.diagnosticDone,
    progress: snap.progress,
    bestPct: new Map([...snap.levels].filter(([, l]) => l.bestPct > 0).map(([n, l]) => [n, l.bestPct])),
    startedAnything: snap.modules.size > 0 || recent.length > 0,
  });
  const due = dueSkills(snap.states, new Date());
  const mastered = [...snap.states.values()].filter(isMastered).length;
  const run = streak(days, localDay(snap.enrolment.country));
  const placedAny = journey.levels.some((l) => l.placed);
  const cur = journey.currentLevel;

  return (
    <PortalPage user={me} active="math-speed" title="My Learning Journey" subtitle={journey.courseName} wide="full">
      <Flash text={sp.e} />
      {access === null ? <div className="mb-5"><Unlock feeMinor={fee?.amountMinor ?? null} buy={buyLink()} signedIn /></div> : null}

      <section className="mb-5 grid gap-5 lg:grid-cols-[1.6fr_1fr]" aria-label="Where you are">
        <div className="rounded-2xl border border-black/[0.08] bg-white p-5 shadow-card sm:p-6">
          <p className="text-[13px] font-semibold uppercase tracking-wider text-ink-4">Current level</p>
          <h2 className="mt-1 text-[24px] font-bold text-ink">{cur ? <>Level {cur.letter}: {cur.title}</> : "All 15 levels complete"}</h2>
          {cur ? (
            <div className="mt-4">
              <div className="mb-1.5 flex items-center justify-between text-[14px] text-ink-3"><span>Module progress</span><b className="text-ink">{journey.moduleProgress}%</b></div>
              <Bar pct={journey.moduleProgress} label="Module progress in this level" />
            </div>
          ) : null}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            {journey.next.href ? <Link href={journey.next.href} className={`${btnPrimary} text-[16px]`}>{journey.next.label}</Link> : <span className="inline-flex min-h-[48px] items-center rounded-lg bg-cream-3 px-6 text-[15px] font-semibold text-ink-3">{journey.next.label}</span>}
            {journey.next.note ? <p className="max-w-md text-[14px] text-ink-3">{journey.next.note}</p> : null}
          </div>
          <p className="mt-4 text-[13.5px] text-ink-4">Whole course: {journey.modulesDone} of {journey.modulesTotal} modules finished ({journey.overallProgress}%).</p>
        </div>

        <div className="grid grid-cols-2 gap-3 self-start">
          {[["Points", snap.enrolment.xp.toLocaleString("en-IN")], ["Days in a row", String(run)], ["Skills mastered", String(mastered)], ["Due for review", String(due.length)]].map(([k, v]) => (
            <div key={k} className="rounded-2xl border border-black/[0.08] bg-white p-4 shadow-card"><p className="text-[12.5px] text-ink-4">{k}</p><p className="text-[26px] font-bold text-ink">{v}</p></div>
          ))}
          <div className="col-span-2 flex flex-wrap gap-2">
            {due.length ? <StartButton kind="review" back="/math-speed/journey" className={btnLight}>Start today&apos;s review ({due.length} skills)</StartButton> : <span className="text-[13.5px] text-ink-3">Nothing is due for review today.</span>}
            {placedAny ? <StartButton kind="foundation" back="/math-speed/journey" className={btnLight}>Foundation Check</StartButton> : null}
          </div>
        </div>
      </section>

      <Card title="The 15 levels" id="levels">
        <ol className="divide-y divide-black/[0.07]">
          {journey.levels.map((l) => {
            const status = !l.authored && l.status !== "completed" ? "soon" : l.status;
            const open = l.status !== "locked";
            return (
              <li key={l.letter} className="flex flex-wrap items-center gap-3 py-3.5" aria-label={`Level ${l.letter}, ${l.title}`}>
                <span aria-hidden className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[18px] font-bold ${l.status === "completed" ? "bg-green-100 text-green-900" : l.status === "in_progress" ? "bg-orange text-white" : "bg-cream-3 text-ink-3"}`}>{l.letter}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[16px] font-semibold text-ink">{open && l.authored ? <Link href={`/math-speed/level/${l.letter}`} className="hover:underline">Level {l.letter}: {l.title}</Link> : <>Level {l.letter}: {l.title}</>}</p>
                  <p className="text-[13.5px] text-ink-3">
                    {l.placed ? "Placed past this level from your placement check. It stays open to study; take its Level Assessment any time. " : ""}
                    {l.authored ? `${l.modulesDone} of ${l.modulesTotal} modules${l.bestPct !== null ? ` · best assessment ${l.bestPct}%` : ""}` : "The lessons for this level are still being written."}
                  </p>
                </div>
                <StatusChip status={status} />
              </li>
            );
          })}
        </ol>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Achievements">
          {achievements.length ? <ul className="space-y-2">{achievements.slice(0, 8).map((a, i) => <li key={i} className="flex items-start gap-3 text-[14.5px]"><span aria-hidden className="mt-0.5 text-[18px]">★</span><span><b className="text-ink">{a.title}</b><span className="block text-ink-3">{a.detail}</span></span></li>)}</ul> : <p className="text-[14.5px] text-ink-3">Complete a level, answer 20 questions with 95% accuracy, get faster on a skill, or practise 7 days in a row to earn your first.</p>}
        </Card>
        <Card title="Recent practice">
          {recent.length ? (
            <ul className="divide-y divide-black/[0.06] text-[14.5px]">
              {recent.map((r, i) => <li key={i} className="flex items-center justify-between gap-3 py-2"><span className="text-ink">{KIND_LABEL[r.kind] ?? r.kind}{r.ref ? ` ${r.ref}` : ""}</span><span className="text-ink-3">{r.accuracy}% · {seconds(r.medianMs)} per answer</span></li>)}
            </ul>
          ) : <p className="text-[14.5px] text-ink-3">Your practice will appear here.</p>}
          <p className="mt-3 text-[13.5px]"><Link href="/math-speed/progress" className="underline">See all my skills and progress</Link></p>
        </Card>
      </div>
      <p className="mt-2 text-[13px] text-ink-4"><Link href="/math-speed/enrol" className="underline">Change my preferences</Link></p>
    </PortalPage>
  );
}
