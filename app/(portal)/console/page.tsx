import type { Metadata } from "next";
import { one } from "@/lib/portal/db";
import * as JB from "@/lib/market/jobs";
import { btnDark, btnLine, box, ConsolePage, Stats } from "@/components/admin/console-page";
import { adminGate } from "./gate";
import { roleDecisionAction } from "./actions";

export const metadata: Metadata = { title: "Admin review queue | GrowQR", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function Queue() {
  const me = await adminGate("/console");
  const queue = await JB.pending();
  const st = (await one<Record<string, unknown>>(`SELECT (SELECT COUNT(*) FROM users WHERE role='student') AS students,
    (SELECT COUNT(*) FROM users WHERE role='employer') AS employers,
    (SELECT COUNT(*) FROM internships WHERE status='live' AND is_sample=0) AS live_roles,
    (SELECT COUNT(*) FROM applications) AS apps`)) ?? {};
  return (
    <ConsolePage me={me} tab="queue" title="Review queue" subtitle="Approve employer postings before they go live.">
      <Stats items={[["Students", Number(st.students ?? 0)], ["Employers", Number(st.employers ?? 0)], ["Live real roles", Number(st.live_roles ?? 0)], ["Applications", Number(st.apps ?? 0)]]} />
      <h2 className="text-[18px] font-semibold text-ink mb-3">Waiting for review ({queue.length})</h2>
      {!queue.length ? <p className="text-[14px] text-ink-3">Nothing to review.</p> : null}
      {queue.map((j) => (
        <article key={j.id} className={box}>
          <h3 className="text-[17px] font-semibold text-ink">{j.title}</h3>
          <p className="text-[14px] text-ink-3 mb-2">{j.company} &middot; {j.loc} ({j.mode}) &middot; &#8377;{j.stipend.toLocaleString("en-IN")}/mo &middot; {j.weeks} weeks &middot; {j.openings} opening(s)</p>
          <p className="text-[14px] text-ink-2 whitespace-pre-line mb-2">{j.about}</p>
          <ul className="flex flex-wrap gap-2 mb-3">{j.skills.map((k) => <li key={k} className="px-2.5 py-1 rounded-full bg-cream-3 text-[12px]">{k}</li>)}</ul>
          <div className="flex flex-wrap items-center gap-3">
            <form action={roleDecisionAction} className="flex flex-wrap items-center gap-3">
              <input type="hidden" name="id" value={j.id} /><input type="hidden" name="act" value="approve" />
              
              <button className={btnDark} type="submit">Approve</button>
            </form>
            <form action={roleDecisionAction}><input type="hidden" name="id" value={j.id} /><input type="hidden" name="act" value="reject" /><button className={btnLine} type="submit">Reject</button></form>
            <a className="text-[14px] underline" href={`/internships/${j.slug}`} target="_blank" rel="noopener noreferrer">Preview</a>
          </div>
        </article>
      ))}
    </ConsolePage>
  );
}
