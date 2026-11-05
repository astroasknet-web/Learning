import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PortalPage } from "@/components/portal/shell";
import { Card, Crumbs, Stat, btnLight, sourceLabel, when } from "@/components/mathstudio/ui";
import { studentPage } from "@/lib/mathstudio/page";
import { buildAttempt } from "@/lib/mathstudio/views";
import { COGNITIVE_LABEL } from "@/lib/mathstudio/taxonomy";

export const metadata: Metadata = { title: "Attempt analysis | Mathematics Studio | GrowQR", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
const DL = ["", "Foundational", "Easy", "Medium", "Hard", "Advanced"];

export default async function AttemptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { me } = await studentPage(`/math-studio/attempt/${id}`);
  const v = await buildAttempt(me.id, Number(id));
  if (!v) notFound();
  const a = v.attempt, o = v.overall, th = "py-2 pr-3 text-left font-medium text-ink-4";
  return (
    <PortalPage user={me} active="math-studio" title={a.label} subtitle={`${sourceLabel(a.source)} · ${when(a.finishedAt)}`} wide="full">
      <Crumbs items={[{ href: "/math-studio/dashboard", label: "Mathematics Studio" }, { href: "/math-studio/history", label: "History" }, { label: "Attempt" }]} />
      <section className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Performance" value={o.score === null ? "n/a" : `${o.score}/100`} tone="teal" />
        <Stat label="Accuracy" value={o.accuracy.pct === null ? "n/a" : `${Math.round(o.accuracy.pct)}%`} sub={`${o.accuracy.correct}/${o.accuracy.attempted}`} />
        <Stat label="Skipped" value={o.accuracy.skipped} />
        <Stat label="Speed" value={o.speed.measurable ? `${o.speed.medianSecs}s` : "Not timed"} sub="median" />
      </section>
      <Card title="Every question">
        {!v.questions.length ? <p className="text-[14.5px] text-ink-3">Question-level detail is part of the Mathematics Studio.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-[14px]">
              <thead><tr><th scope="col" className={th}>#</th><th scope="col" className={th}>Topic</th><th scope="col" className={th}>Skill</th><th scope="col" className={th}>Difficulty</th><th scope="col" className={th}>Result</th><th scope="col" className={th}>Time</th></tr></thead>
              <tbody>{v.questions.map((q, i) => (
                <tr key={i} className={`border-t border-black/[0.07] ${q.correct ? "" : q.skipped ? "" : "bg-orange-lighter/40"}`}>
                  <td className="py-2 pr-3 text-ink-4">{i + 1}</td>
                  <th scope="row" className="py-2 pr-3 text-left font-medium text-ink">{q.topicName}</th>
                  <td className="py-2 pr-3 text-ink-3">{COGNITIVE_LABEL[q.cognitive as keyof typeof COGNITIVE_LABEL] ?? q.cognitive}</td>
                  <td className="py-2 pr-3">{DL[q.difficulty]}</td>
                  <td className="py-2 pr-3">{q.skipped ? <span className="text-ink-4">Skipped</span> : q.correct ? <span className="font-semibold text-emerald-700">Correct</span> : <span className="font-semibold text-orange-deep">Incorrect</span>}</td>
                  <td className="py-2">{q.seconds === null ? "–" : `${q.seconds}s${q.expectedSecs ? ` / ${q.expectedSecs}s` : ""}`}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-[12.5px] text-ink-4">The question statements and worked solutions live in each test module (to keep answer keys in one place); this view analyses how you did, topic by topic. For the GRE mocks the per-question time is not recorded, so it shows a dash.</p>
      </Card>
      <div className="mt-2"><Link href="/math-studio/history" className={btnLight}>Back to history</Link></div>
    </PortalPage>
  );
}
