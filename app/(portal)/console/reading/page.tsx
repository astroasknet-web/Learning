import type { Metadata } from "next";
import Link from "next/link";
import { box, btnLine, ConsolePage, Stats } from "@/components/admin/console-page";
import { adminStats, contentQuality, recentAudit } from "@/lib/reading/admin";
import { ensureSeed } from "@/lib/reading/store";
import { adminGate } from "../gate";

export const metadata: Metadata = { title: "Reading Studio | Console | GrowQR", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const th = "py-2 pr-3 text-left font-medium text-ink-4";
const KIND: Record<string, string> = { diagnostic: "Starting assessments", practice: "Level practice", mastery: "Mastery checks", recall: "Delayed recall", timed: "Timed reading", fresh: "Fresh assessments" };

export default async function ReadingConsole() {
  const me = await adminGate("/console/reading");
  await ensureSeed();
  const [st, audit, cq] = await Promise.all([adminStats(), recentAudit(25), contentQuality()]);
  const sub = (v: number | null, unit = "") => (st.suppressed || v === null ? "withheld" : `${v}${unit}`);
  return (
    <ConsolePage me={me} tab="reading" title="English Reading Studio" subtitle="Content, scoring settings, levels and aggregate reports. Reports describe groups only.">
      <nav aria-label="Reading Studio sections" className="mb-5 flex flex-wrap gap-2 text-[14px]">
        <Link href="/console/reading/content" className={btnLine + " inline-flex items-center"}>Passages and questions</Link>
        <Link href="/console/reading/settings" className={btnLine + " inline-flex items-center"}>Scoring settings and levels</Link>
        <Link href="/console/payments/catalogue" className={btnLine + " inline-flex items-center"}>Package price and access</Link>
        <a href="/console/reading/export" className={btnLine + " inline-flex items-center"}>Download aggregate CSV</a>
      </nav>
      <Stats items={[["Students who started", st.students], ["Completed assessments", st.completed], ["Partial", st.partial], ["Not finished (over 24 h)", st.abandoned]]} />
      <Stats items={[["Package holders", st.premium], ["Upgrade clicks", st.ctaClicks], ["Conversion", sub(st.conversion, "%"), `of students with a result${st.suppressed ? `; withheld until ${st.minCohort} students` : ""}`], ["Average overall score", sub(st.avgOverall), "provisional, complete assessments"]]} />
      <section className={box} aria-labelledby="by-h">
        <h2 id="by-h" className="mb-3 text-[18px] font-semibold text-ink">Assessments by kind, and where upgrade clicks come from</h2>
        <div className="grid gap-6 md:grid-cols-2">
          <ul className="space-y-1 text-[14.5px]">{st.byKind.length ? st.byKind.map((k) => <li key={k.kind} className="flex justify-between border-b border-black/[0.06] py-1"><span>{KIND[k.kind] ?? k.kind}</span><strong>{k.n}</strong></li>) : <li className="text-ink-3">No assessments yet.</li>}</ul>
          <ul className="space-y-1 text-[14.5px]">{st.bySource.length ? st.bySource.map((k) => <li key={k.source} className="flex justify-between border-b border-black/[0.06] py-1"><span>{k.source}</span><strong>{k.n}</strong></li>) : <li className="text-ink-3">No upgrade clicks yet.</li>}</ul>
        </div>
      </section>
      <section className={box} aria-labelledby="hard-h">
        <h2 id="hard-h" className="mb-1 text-[18px] font-semibold text-ink">Most frequently missed question types and skills</h2>
        <p className="mb-3 text-[13px] text-ink-3">Shown only for groups of at least {st.minCohort} students, so no individual can be identified.</p>
        {st.hardTypes && st.hardTypes.length ? (
          <div className="grid gap-6 md:grid-cols-2">
            <table className="w-full text-[14px]"><thead><tr><th className={th}>Question type</th><th className={th}>Answers</th><th className={th}>Accuracy</th></tr></thead><tbody>{st.hardTypes.map((t) => <tr key={t.qtype} className="border-t border-black/[0.07]"><td className="py-1.5 pr-3">{t.label}</td><td className="pr-3">{t.answers}</td><td>{t.accuracy}%</td></tr>)}</tbody></table>
            <table className="w-full text-[14px]"><thead><tr><th className={th}>Skill</th><th className={th}>Answers</th><th className={th}>Accuracy</th></tr></thead><tbody>{(st.hardSkills ?? []).map((t) => <tr key={t.skill} className="border-t border-black/[0.07]"><td className="py-1.5 pr-3">{t.label}</td><td className="pr-3">{t.answers}</td><td>{t.accuracy}%</td></tr>)}</tbody></table>
          </div>
        ) : <p className="text-[14px] text-ink-3">Withheld: fewer than {st.minCohort} students have answered. You can change this threshold in the scoring settings.</p>}
      </section>
      <section className={box} aria-labelledby="rev-h">
        <h2 id="rev-h" className="mb-2 text-[18px] font-semibold text-ink">Content review</h2>
        <p className="text-[14.5px] text-ink-2">{st.reviewBacklog.passages} passage{st.reviewBacklog.passages === 1 ? "" : "s"} and {st.reviewBacklog.questions} question{st.reviewBacklog.questions === 1 ? "" : "s"} have not been signed off by a person. The starting bank was authored for this studio; an educator should review keys and explanations before wide release. AI-drafted content cannot be approved without that review.</p>
      </section>
      <section className={box} aria-labelledby="cq-h">
        <h2 id="cq-h" className="mb-2 text-[18px] font-semibold text-ink">Question quality check</h2>
        <p className="text-[14.5px] text-ink-2">{cq.keyIsLongest} of {cq.mcq} approved multiple-choice questions ({cq.keyIsLongestPct}%) have the correct option as the longest; {cq.keyOverDouble} have a key at least 1.8 times the average option length. Correct option by position: {cq.byPosition.slice(0, 4).map((n, i) => String.fromCharCode(65 + i) + " " + n).join(", ")}.</p>
        <p className={`mt-1 text-[14px] ${cq.keyIsLongestPct > 45 ? "font-medium text-amber-800" : "text-ink-3"}`}>{cq.note}</p>
      </section>
      <section className={box} aria-labelledby="aud-h">
        <h2 id="aud-h" className="mb-3 text-[18px] font-semibold text-ink">Audit log (latest 25)</h2>
        {audit.length ? <div className="overflow-x-auto"><table className="w-full min-w-[40rem] text-[13.5px]"><thead><tr><th className={th}>When (UTC)</th><th className={th}>Who</th><th className={th}>What</th><th className={th}>Detail</th></tr></thead><tbody>{audit.map((a) => <tr key={a.id} className="border-t border-black/[0.07] align-top"><td className="py-1.5 pr-3 whitespace-nowrap">{a.at.slice(0, 19)}</td><td className="pr-3">{a.actor}</td><td className="pr-3">{a.action} · {a.entity} {a.entityId}</td><td className="break-all text-ink-3">{a.detail.slice(0, 160)}</td></tr>)}</tbody></table></div> : <p className="text-[14px] text-ink-3">Nothing has been changed yet.</p>}
      </section>
    </ConsolePage>
  );
}
