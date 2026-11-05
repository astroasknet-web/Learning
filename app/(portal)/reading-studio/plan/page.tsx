import type { Metadata } from "next";
import Link from "next/link";
import { PortalPage } from "@/components/portal/shell";
import { Card, Crumbs, Locked, StartButton, btnLight, btnPrimary } from "@/components/reading/ui";
import { studentPage } from "@/lib/reading/page";
import { hasAnalytics } from "@/lib/reading/access";
import { recentAssessments } from "@/lib/reading/store";
import { buildResults } from "@/lib/reading/views";

export const metadata: Metadata = { title: "My 7-day plan | English Reading Studio | GrowQR", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function PlanPage() {
  const { me } = await studentPage("/reading-studio/plan");
  const premium = await hasAnalytics(me.id);
  const latest = (await recentAssessments(me.id, 1))[0];
  const v = premium && latest ? await buildResults(me.id, latest.publicId) : null;
  return (
    <PortalPage user={me} active="reading-studio" title="My 7-day plan" subtitle="Built from your answers and the study time you gave us." wide>
      <Crumbs items={[{ href: "/reading-studio/dashboard", label: "My English Reading Studio" }, { label: "7-day plan" }]} />
      {!premium ? <Locked headline="A plan built from your answers" body="The 7-day plan is part of the package. It uses your result to choose what to practise each day and ends with a fresh assessment so you can measure the change." source="plan" /> : !latest || !v?.plan ? (
        <Card><p className="text-[15px] text-ink-2">Take an assessment first; the plan is built from it.</p><div className="mt-3"><StartButton kind="fresh" back="/reading-studio/plan">Start a fresh assessment</StartButton></div></Card>
      ) : (
        <>
          <Card title="Your week"><p className="mb-3 text-[14.5px] text-ink-2">{v.plan.note}</p>
            <ol className="space-y-3">{v.plan.days.map((d) => (
              <li key={d.day} className="rounded-xl border border-black/10 p-4">
                <p className="text-[12.5px] font-semibold uppercase tracking-wide text-ink-3">Day {d.day} · about {d.minutes} minutes</p>
                <h3 className="mt-0.5 text-[16px] font-semibold text-ink">{d.title}</h3>
                <p className="mt-1 text-[14.5px] leading-relaxed text-ink-2">{d.task}</p>
                <div className="mt-2.5">
                  {d.action.kind === "practice" && d.action.skill ? <StartButton kind="practice" skill={d.action.skill} back="/reading-studio/plan" className={btnLight}>{d.action.label}</StartButton>
                    : d.action.kind === "timed" ? <StartButton kind="timed" back="/reading-studio/plan" className={btnLight}>{d.action.label}</StartButton>
                    : d.action.kind === "fresh" ? <StartButton kind="fresh" back="/reading-studio/plan" className={btnLight}>{d.action.label}</StartButton>
                    : <Link href={`/reading-studio/results/${v.id}#review`} className={btnLight}>{d.action.label}</Link>}
                </div>
              </li>))}</ol></Card>
          <Link href={`/reading-studio/results/${v.id}`} className={btnPrimary}>Back to my results</Link>
        </>
      )}
    </PortalPage>
  );
}
