import type { Metadata } from "next";
import Link from "next/link";
import { PortalPage } from "@/components/portal/shell";
import { Card, Crumbs, Locked, btnLight } from "@/components/mathstudio/ui";
import { studentPage } from "@/lib/mathstudio/page";
import { buildPlanView } from "@/lib/mathstudio/views";
import { PRIORITY_BLURB, PRIORITY_LABEL, type PriorityBand } from "@/lib/mathstudio/recommend";

export const metadata: Metadata = { title: "Practice plan | Mathematics Studio | GrowQR", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
const DL = ["", "foundational", "easy", "medium", "hard", "advanced"];

export default async function PlanPage() {
  const { me } = await studentPage("/math-studio/plan");
  const v = await buildPlanView(me.id);
  const bands: PriorityBand[] = [1, 2, 3, 4];
  return (
    <PortalPage user={me} active="math-studio" title="Your practice plan" subtitle="Built from your results and sized to your study time. Each step links to real practice on GrowQR." wide="full">
      <Crumbs items={[{ href: "/math-studio/dashboard", label: "Mathematics Studio" }, { label: "Plan" }]} />
      {!v ? <Locked headline="A personalised practice plan" body="A prioritised plan with targets, difficulty and revisit dates, built from your own weaknesses and linked to real practice, is part of the Mathematics Studio." source="plan" /> : !v.plan.steps.length ? (
        <Card><p className="text-[15px] text-ink-2">{v.plan.note}</p><div className="mt-3 flex flex-wrap gap-3"><Link href="/practice-tests/gre-quant" className={btnLight}>GRE Quant mocks</Link><Link href="/math-speed" className={btnLight}>Mathematics Speed studio</Link></div></Card>
      ) : (
        <>
          <p className="mb-4 text-[14.5px] text-ink-2">{v.plan.note}</p>
          {bands.filter((b) => v.plan.steps.some((s) => s.priority === b)).map((b) => (
            <Card key={b} title={`Priority ${b}: ${PRIORITY_LABEL[b]}`} id={`p${b}`}>
              <p className="mb-3 text-[13.5px] text-ink-3">{PRIORITY_BLURB[b]}</p>
              <ol className="space-y-3">
                {v.plan.steps.filter((s) => s.priority === b).map((s, i) => (
                  <li key={i} className="rounded-xl border border-black/10 p-4">
                    <h3 className="text-[16px] font-semibold text-ink">{s.topicName}</h3>
                    <p className="mt-1 text-[14.5px] text-ink-2">{s.why}</p>
                    <p className="mt-1 text-[14.5px] text-ink-2"><strong className="text-ink">Do: </strong>{s.action}</p>
                    <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-[13.5px] text-ink-3">
                      <div><dt className="inline font-medium">Practise: </dt><dd className="inline">{s.questionCount} questions at {DL[s.difficulty]} level</dd></div>
                      <div><dt className="inline font-medium">Target: </dt><dd className="inline">{s.targetMastery}/100</dd></div>
                      <div><dt className="inline font-medium">Revisit in: </dt><dd className="inline">{s.revisitDays} days</dd></div>
                    </dl>
                    <p className="mt-1 text-[13px] text-ink-3"><strong>Mastered when:</strong> {s.masteredWhen}</p>
                    <Link href={s.practice.href} className="mt-2 inline-block text-[14px] font-semibold text-orange-deep underline">{s.practice.label}</Link>
                  </li>
                ))}
              </ol>
            </Card>
          ))}
        </>
      )}
      <div className="mt-2"><Link href="/math-studio/dashboard" className={btnLight}>Back to my Studio</Link></div>
    </PortalPage>
  );
}
