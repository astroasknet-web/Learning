import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/portal/guard";
import * as parents from "@/lib/lms/parents";
import { Card, PortalPage } from "@/components/portal/shell";

export const metadata: Metadata = { title: "Child progress | GrowQR", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const STATE = { done: "bg-emerald-50 text-emerald-900", started: "bg-amber-50 text-amber-900", none: "bg-cream-2 text-ink-3" } as const;

export default async function ChildReport({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireUser("parent");
  const id = Math.trunc(Number((await params).id));
  // The link is checked on every request, so removing it takes effect immediately.
  if (!Number.isInteger(id) || !(await parents.isLinked(me.id, id))) notFound();
  const r = await parents.report(id);
  if (!r) notFound();
  const done = r.courses.filter((c) => c.status === "completed").length;
  return (
    <PortalPage user={me} active="parent" title={r.name} subtitle={<><Link href="/parent" className="underline">All children</Link> · progress report</>} wide>
      <dl className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[["Courses started", r.courses.length], ["Courses completed", done], ["Practice tests taken", r.tests.length], ["Classes", r.classes.length]].map(([k, v]) => (
          <div key={String(k)} className="bg-white rounded-2xl border border-black/[0.08] shadow-card p-5"><dt className="text-[13px] text-ink-3">{k}</dt><dd className="text-[24px] font-bold text-ink">{v}</dd></div>
        ))}
      </dl>
      <Card title="Courses">
        {!r.courses.length ? <p className="text-[14px] text-ink-3">No courses started yet.</p> : (
          <ul className="divide-y divide-black/[0.07]">{r.courses.map((c) => (
            <li key={c.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2"><span className="text-[14px]"><b>{c.title}</b> <span className="text-ink-3">· {c.cat_name}</span></span>
              <span className="text-[13px] font-semibold text-ink-2">{c.status === "completed" ? "Completed" : `${c.progress}%`}</span></li>
          ))}</ul>
        )}
      </Card>
      <Card title="Recent practice tests">
        {!r.tests.length ? <p className="text-[14px] text-ink-3">No practice tests taken yet.</p> : (
          <div className="overflow-x-auto"><table className="w-full text-[14px] min-w-[28rem]">
            <thead><tr className="text-left text-ink-3"><th scope="col" className="py-2 pr-3 font-medium">Test</th><th scope="col" className="py-2 pr-3 font-medium">Score</th><th scope="col" className="py-2 pr-3 font-medium">Date</th></tr></thead>
            <tbody>{r.tests.map((t) => (
              <tr key={t.id} className="border-t border-black/[0.07]"><td className="py-2 pr-3">{t.label} Test {t.test_no}</td><td className="pr-3">{t.raw}/{t.total}{t.band != null ? ` · band ${t.band.toFixed(1)}` : t.score != null ? ` · about ${t.score}` : ""}</td><td className="pr-3 text-ink-3">{t.created_at.slice(0, 10)}</td></tr>
            ))}</tbody>
          </table></div>
        )}
      </Card>
      {r.classes.map((c) => (
        <Card key={c.id} title={`Class: ${c.name}`}>
          <p className="text-[13px] text-ink-3 -mt-2 mb-3">Teacher: {c.teacher}</p>
          {!c.items.length ? <p className="text-[14px] text-ink-3">Nothing assigned yet.</p> : (
            <ul className="divide-y divide-black/[0.07]">{c.items.map((a) => (
              <li key={a.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2"><span className="text-[14px]"><b>{a.title}</b>{a.due_date ? <span className="text-ink-3"> · due {a.due_date}</span> : null}</span>
                <span className={`px-2.5 py-1 rounded-md text-[13px] ${STATE[a.cell.state]}`}>{a.cell.label}</span></li>
            ))}</ul>
          )}
        </Card>
      ))}
      <p className="text-[13px] text-ink-3">You can see study progress only. Contact details, applications and documents are never shown to parents.</p>
    </PortalPage>
  );
}
