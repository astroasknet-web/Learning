import type { Metadata } from "next";
import Link from "next/link";
import { PortalPage } from "@/components/portal/shell";
import { Card, Crumbs, Locked, btnLight, sourceLabel, when } from "@/components/mathstudio/ui";
import { studentPage } from "@/lib/mathstudio/page";
import { buildHistory } from "@/lib/mathstudio/views";

export const metadata: Metadata = { title: "History | Mathematics Studio | GrowQR", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function History() {
  const { me } = await studentPage("/math-studio/history");
  const v = await buildHistory(me.id);
  return (
    <PortalPage user={me} active="math-studio" title="History" subtitle="Every test you have taken, and how your topics have moved." wide="full">
      <Crumbs items={[{ href: "/math-studio/dashboard", label: "Mathematics Studio" }, { label: "History" }]} />
      {v.premium && (v.movement.improved.length || v.movement.slipped.length) ? (
        <Card title="What has moved">
          <p className="text-[14.5px] text-ink-2">{v.trendMsg}</p>
          <div className="mt-3 grid gap-5 md:grid-cols-2">
            <div><h3 className="text-[15px] font-semibold text-ink">Improved</h3>{v.movement.improved.length ? <ul className="mt-2 space-y-1 text-[14.5px] text-ink-2">{v.movement.improved.map((m) => <li key={m.topic}>{m.topicName}: {Math.round(m.before)} → {Math.round(m.after)} (+{m.delta})</li>)}</ul> : <p className="mt-2 text-[14px] text-ink-3">Nothing has risen by 5+ yet.</p>}</div>
            <div><h3 className="text-[15px] font-semibold text-ink">Slipped</h3>{v.movement.slipped.length ? <ul className="mt-2 space-y-1 text-[14.5px] text-ink-2">{v.movement.slipped.map((m) => <li key={m.topic}>{m.topicName}: {Math.round(m.before)} → {Math.round(m.after)} ({m.delta})</li>)}</ul> : <p className="mt-2 text-[14px] text-ink-3">Nothing has slipped.</p>}</div>
          </div>
        </Card>
      ) : null}

      <Card title={v.premium ? "Every attempt" : "Your latest attempt"}>
        {v.rows.length ? (
          <ol className="space-y-3">
            {v.rows.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-black/10 p-4">
                <div>
                  <p className="text-[12.5px] font-semibold uppercase tracking-wide text-ink-3">{when(a.at)} · {sourceLabel(a.source)}</p>
                  <p className="mt-0.5 text-[15.5px] font-semibold text-ink">{a.label}</p>
                  <p className="mt-0.5 text-[13.5px] text-ink-3">{a.items} questions{a.overall !== null ? ` · performance ${a.overall}/100` : ""}{a.accuracy !== null ? ` · ${Math.round(a.accuracy)}% accuracy` : ""}</p>
                </div>
                {v.premium ? <Link href={`/math-studio/attempt/${a.id}`} className={btnLight}>Question-level analysis</Link> : null}
              </li>
            ))}
          </ol>
        ) : <p className="text-[14.5px] text-ink-3">No tests yet.</p>}
        {!v.premium ? <div className="mt-4"><Locked headline="Your full history and question-level analysis" body="Keeping every attempt, comparing them, and opening the question-by-question analysis of any test is part of the Mathematics Studio." source="history" /></div> : null}
      </Card>
      <div className="mt-2"><Link href="/math-studio/dashboard" className={btnLight}>Back to my Studio</Link></div>
    </PortalPage>
  );
}
