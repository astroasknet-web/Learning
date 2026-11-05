import type { Metadata } from "next";
import Link from "next/link";
import { PortalPage } from "@/components/portal/shell";
import { Card, Crumbs, EvidenceTag, Locked, btnLight } from "@/components/mathstudio/ui";
import { studentPage } from "@/lib/mathstudio/page";
import { buildWeaknesses } from "@/lib/mathstudio/views";
import { EVIDENCE_LABEL } from "@/lib/mathstudio/taxonomy";
import { PRIORITY_LABEL } from "@/lib/mathstudio/recommend";

export const metadata: Metadata = { title: "Weakness analysis | Mathematics Studio | GrowQR", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
const prio = (k: string) => (k === "foundational" ? 1 : k === "slow" || k === "hurried" ? 3 : 2) as 1 | 2 | 3;

export default async function Weaknesses() {
  const { me } = await studentPage("/math-studio/weaknesses");
  const v = await buildWeaknesses(me.id);
  return (
    <PortalPage user={me} active="math-studio" title="Weakness analysis" subtitle="Specific, evidence-based findings — not just a low score — ranked by what matters most." wide="full">
      <Crumbs items={[{ href: "/math-studio/dashboard", label: "Mathematics Studio" }, { label: "Weaknesses" }]} />
      {!v ? <Locked headline="Evidence-based weakness detection" body="The full diagnosis — what is weak, the evidence from your own tests, the likely cause and what to do — is part of the Mathematics Studio." source="weaknesses" /> : (
        <>
          {v.dataNote ? <p className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-[14.5px] text-amber-900">{v.dataNote}</p> : null}
          {v.weaknesses.length ? v.weaknesses.map((w, i) => (
            <Card key={i}>
              <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-cream-3 px-2.5 py-1 text-[11.5px] font-semibold text-ink-2">Priority {prio(w.kind)}: {PRIORITY_LABEL[prio(w.kind)]}</span><h2 className="text-[18px] font-semibold text-ink">{w.topicName}</h2><EvidenceTag label={EVIDENCE_LABEL[w.evidenceLevel]} /></div>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{w.observed}</p>
              <dl className="mt-3 grid gap-x-6 gap-y-2 text-[14px] sm:grid-cols-2">
                <div><dt className="text-ink-4">Evidence from your tests</dt><dd className="text-ink-2">{w.evidence}</dd></div>
                <div><dt className="text-ink-4">Why it matters</dt><dd className="text-ink-2">{w.impact}</dd></div>
                <div><dt className="text-ink-4">What to do</dt><dd className="text-ink-2">{w.action}</dd></div>
                <div><dt className="text-ink-4">Practise at</dt><dd className="text-ink-2">{["", "foundational", "easy", "medium", "hard", "advanced"][w.practiceDifficulty]} level</dd></div>
                <div className="sm:col-span-2"><dt className="text-ink-4">How you will know it improved</dt><dd className="text-ink-2">{w.measure}</dd></div>
              </dl>
            </Card>
          )) : <Card><p className="text-[15px] text-ink-2">No weakness is confirmed with the evidence so far. That is good news; keep taking tests and anything that emerges will be shown here with its evidence.</p></Card>}
        </>
      )}
      <div className="mt-2"><Link href="/math-studio/dashboard" className={btnLight}>Back to my Studio</Link>{v ? <Link href="/math-studio/plan" className={`${btnLight} ml-2`}>My practice plan</Link> : null}</div>
    </PortalPage>
  );
}
