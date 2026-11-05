import type { Metadata } from "next";
import { PortalPage } from "@/components/portal/shell";
import { Bar, Card, Crumbs, seconds } from "@/components/mathspeed/ui";
import { ACHIEVEMENT_INFO } from "@/lib/mathspeed/achievements";
import { LEVELS } from "@/lib/mathspeed/curriculum";
import { effectiveMastery } from "@/lib/mathspeed/mastery";
import { enrolledStudent } from "@/lib/mathspeed/page";
import { achievementsOf, benchmarks, recentSessions } from "@/lib/mathspeed/store";
import { skill } from "@/lib/mathspeed/skills";

export const metadata: Metadata = { title: "My skills and progress | Mathematics Speed Enhancement Studio | GrowQR" };
export const dynamic = "force-dynamic";

const day = (s: string): string => s.slice(0, 10);

export default async function ProgressPage() {
  const { me, snap } = await enrolledStudent("/math-speed/progress");
  const [earned, bench, recent] = await Promise.all([achievementsOf(me.id), benchmarks(me.id), recentSessions(me.id, 20)]);
  const now = new Date();
  const have = new Set(earned.map((a) => a.code));
  return (
    <PortalPage user={me} active="math-speed" title="My skills and progress" subtitle="Mastery is accuracy, speed, and how far you have climbed. A skill you have mastered comes back for review before it fades." wide="full">
      <Crumbs items={[{ href: "/math-speed/journey", label: "My Learning Journey" }, { label: "Skills and progress" }]} />

      <Card title="Achievements">
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(ACHIEVEMENT_INFO).map(([code, info]) => (
            <li key={code} className={`rounded-xl border p-4 ${have.has(code) ? "border-orange/40 bg-orange-lighter" : "border-black/10 bg-cream-2"}`}>
              <p className="text-[15px] font-semibold text-ink"><span aria-hidden>{have.has(code) ? "★ " : "☆ "}</span>{info.title}</p>
              <p className="mt-1 text-[13px] text-ink-3">{info.how}</p>
              <p className="mt-1.5 text-[12.5px] font-semibold text-ink-2">{earned.filter((a) => a.code === code).length ? `Earned ${earned.filter((a) => a.code === code).length} time${earned.filter((a) => a.code === code).length === 1 ? "" : "s"}` : "Not yet"}</p>
            </li>
          ))}
        </ul>
      </Card>

      {bench.length ? (
        <Card title="Your benchmarks">
          <table className="w-full text-left text-[14.5px]">
            <thead className="text-ink-3"><tr><th className="py-1.5">Date</th><th>Accuracy</th><th>Typical time per correct answer</th></tr></thead>
            <tbody>{bench.map((b, i) => <tr key={i} className="border-t border-black/[0.06]"><td className="py-1.5">{day(b.at)}</td><td>{b.accuracy}%</td><td>{seconds(b.medianMs)}</td></tr>)}</tbody>
          </table>
        </Card>
      ) : null}

      <Card title="Skills by level">
        {LEVELS.map((lv) => {
          const ids = [...new Set(lv.modules.flatMap((m) => m.skills))].filter((id) => snap.states.has(id));
          if (!ids.length) return null;
          return (
            <div key={lv.n} className="mb-5 last:mb-0">
              <h3 className="mb-2 text-[15px] font-semibold text-ink">Level {lv.letter}: {lv.title}</h3>
              <ul className="grid gap-x-8 gap-y-2 md:grid-cols-2">
                {ids.map((id) => {
                  const s = snap.states.get(id)!;
                  const m = effectiveMastery(s, now);
                  const due = s.nextReviewAt !== null && new Date(s.nextReviewAt) <= now;
                  return (
                    <li key={id} className="text-[14px]">
                      <div className="flex items-center justify-between gap-3"><span className="text-ink">{skill(id)?.title ?? id}</span><span className="tabular-nums text-ink-3">{Math.round(m)}%{s.masteredAt ? " · mastered" : ""}{due ? " · review due" : ""}</span></div>
                      <Bar pct={m} label={`Mastery of ${skill(id)?.title ?? id}`} />
                      <p className="mt-0.5 text-[12px] text-ink-4">{s.attempts} answers · {Math.round(s.acc * 100)}% accuracy{s.ms ? ` · ${seconds(s.ms)} typical` : ""}{s.baselineMs && s.ms && s.baselineN >= 5 ? ` (started at ${seconds(s.baselineMs)})` : ""}</p>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
        {!snap.states.size ? <p className="text-[14.5px] text-ink-3">Your skills will appear here after your first round of practice.</p> : null}
      </Card>

      <Card title="Recent rounds">
        {recent.length ? <table className="w-full text-left text-[14px]"><thead className="text-ink-3"><tr><th className="py-1.5">Date</th><th>Kind</th><th>Questions</th><th>Accuracy</th><th>Typical time</th></tr></thead><tbody>{recent.map((r, i) => <tr key={i} className="border-t border-black/[0.06]"><td className="py-1.5">{day(r.at)}</td><td>{r.kind}{r.ref ? ` ${r.ref}` : ""}</td><td>{r.total}</td><td>{r.accuracy}%</td><td>{seconds(r.medianMs)}</td></tr>)}</tbody></table> : <p className="text-[14.5px] text-ink-3">No rounds yet.</p>}
      </Card>
    </PortalPage>
  );
}
