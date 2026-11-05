import type { Metadata } from "next";
import Link from "next/link";
import { box, btnDark, btnLine, ConsolePage, Stats } from "@/components/admin/console-page";
import { adminStats, integrationStatus, recentAudit } from "@/lib/mathstudio/admin";
import { ensureSeed } from "@/lib/mathstudio/store";
import { topicById } from "@/lib/mathstudio/taxonomy";
import { adminGate } from "../gate";
import { reprocessAction } from "./actions";

export const metadata: Metadata = { title: "Mathematics Studio | Console | GrowQR", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
const th = "py-2 pr-3 text-left font-medium text-ink-4";

export default async function MathConsole() {
  const me = await adminGate("/console/math");
  await ensureSeed();
  const [status, st, audit] = await Promise.all([integrationStatus(), adminStats(), recentAudit(25)]);
  const sub = (v: number | null, u = "") => (st.suppressed || v === null ? "withheld" : `${v}${u}`);
  return (
    <ConsolePage me={me} tab="math" title="Mathematics Studio" subtitle="Integration status, scoring settings, taxonomy and aggregate reports. Reports describe groups only.">
      <nav aria-label="Sections" className="mb-5 flex flex-wrap gap-2 text-[14px]">
        <Link href="/console/math/settings" className={btnLine + " inline-flex items-center"}>Scoring settings & taxonomy</Link>
        <Link href="/console/payments/catalogue" className={btnLine + " inline-flex items-center"}>Price & access</Link>
        <a href="/console/math/export" className={btnLine + " inline-flex items-center"}>Download aggregate CSV</a>
      </nav>
      <Stats items={[["Students with a profile", st.students], ["Attempts processed", st.attempts], ["Questions analysed", st.items], ["Studio holders", st.premium]]} />
      <Stats items={[["Upgrade clicks", st.ctaClicks], ["Conversion", sub(st.conversion, "%"), st.suppressed ? `withheld until ${st.minCohort} students` : "of students with a profile"], ["Average performance", sub(st.avgScore), "provisional"], ["", ""]]} />

      <section className={box} aria-labelledby="int-h">
        <h2 id="int-h" className="mb-1 text-[18px] font-semibold text-ink">Test integration</h2>
        <p className="mb-3 text-[13px] text-ink-3">Every completed maths test feeds the engine automatically. &ldquo;Processed&rdquo; is what the Studio holds; &ldquo;available&rdquo; is what the source has. If they differ, a reprocess catches up (also run it after changing the scoring settings).</p>
        <div className="overflow-x-auto"><table className="w-full min-w-[40rem] text-[14px]">
          <thead><tr><th className={th}>Source</th><th className={th}>Processed</th><th className={th}>Available</th><th className={th}>Questions</th><th className={th}>Students</th><th className={th}>Last</th></tr></thead>
          <tbody>{status.map((s) => <tr key={s.source} className="border-t border-black/[0.07]"><th scope="row" className="py-2 pr-3 text-left font-medium">{s.label}</th><td className="pr-3">{s.processed}</td><td className="pr-3">{s.available === null ? "–" : s.available}{s.available !== null && s.available > s.processed ? <span className="ml-1 font-semibold text-amber-800">({s.available - s.processed} to process)</span> : null}</td><td className="pr-3">{s.items}</td><td className="pr-3">{s.students}</td><td>{s.lastAt ? s.lastAt.slice(0, 16) : "–"}</td></tr>)}</tbody>
        </table></div>
        <form action={reprocessAction} className="mt-4"><button type="submit" className={btnDark}>Reprocess all from source</button></form>
      </section>

      {st.hardestTopics ? (
        <section className={box} aria-labelledby="hard-h">
          <h2 id="hard-h" className="mb-1 text-[18px] font-semibold text-ink">Hardest topics across students</h2>
          <p className="mb-3 text-[13px] text-ink-3">Lowest average mastery, shown only for groups of at least {st.minCohort} students.</p>
          <table className="w-full max-w-lg text-[14px]"><thead><tr><th className={th}>Topic</th><th className={th}>Avg mastery</th><th className={th}>Students</th></tr></thead><tbody>{st.hardestTopics.map((t) => <tr key={t.topic} className="border-t border-black/[0.07]"><td className="py-1.5 pr-3">{topicById(t.topic)?.name ?? t.topic}</td><td className="pr-3">{t.avg}</td><td>{t.students}</td></tr>)}</tbody></table>
        </section>
      ) : <section className={box}><p className="text-[14px] text-ink-3">Aggregate topic figures are withheld until at least {st.minCohort} students have a profile.</p></section>}

      <section className={box} aria-labelledby="aud-h">
        <h2 id="aud-h" className="mb-3 text-[18px] font-semibold text-ink">Audit log (latest 25)</h2>
        {audit.length ? <div className="overflow-x-auto"><table className="w-full min-w-[40rem] text-[13.5px]"><thead><tr><th className={th}>When (UTC)</th><th className={th}>Who</th><th className={th}>What</th><th className={th}>Detail</th></tr></thead><tbody>{audit.map((a) => <tr key={a.id} className="border-t border-black/[0.07] align-top"><td className="py-1.5 pr-3 whitespace-nowrap">{a.at.slice(0, 19)}</td><td className="pr-3">{a.actor}</td><td className="pr-3">{a.action} · {a.entity} {a.entityId}</td><td className="break-all text-ink-3">{a.detail.slice(0, 140)}</td></tr>)}</tbody></table></div> : <p className="text-[14px] text-ink-3">Nothing logged yet.</p>}
      </section>
    </ConsolePage>
  );
}
