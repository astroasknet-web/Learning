import type { Metadata } from "next";
import Link from "next/link";
import { PortalPage } from "@/components/portal/shell";
import ChartCard from "@/components/mathstudio/Charts";
import { Bar, Card, Crumbs, EvidenceTag, Locked, Stat, btnLight, btnPrimary } from "@/components/mathstudio/ui";
import { studentPage } from "@/lib/mathstudio/page";
import { buildStudio } from "@/lib/mathstudio/views";
import { getStudyMinutes } from "@/lib/mathstudio/store";
import { FREE_FEATURES, PREMIUM_FEATURES, feeNow } from "@/lib/mathstudio/access";
import { PRIORITY_LABEL } from "@/lib/mathstudio/recommend";
import { studyMinutesAction } from "../actions";

export const metadata: Metadata = { title: "My Mathematics Studio | GrowQR", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function MathStudio() {
  const { me } = await studentPage("/math-studio/dashboard");
  const [v, fee, minutes] = await Promise.all([buildStudio(me.id), feeNow().catch(() => null), getStudyMinutes(me.id)]);
  const t = v.tiles;
  return (
    <PortalPage user={me} active="math-studio" title="Mathematics Studio" subtitle="One performance engine across every maths test you take on GrowQR." wide="full">
      <Crumbs items={[{ label: "Mathematics Studio" }]} />

      {!v.hasData ? (
        <Card tone="soft" title="Your Studio fills in automatically">
          <p className="max-w-prose text-[15px] leading-relaxed text-ink-2">Take any mathematics test on the platform and it feeds straight into your Studio: no uploading, no entering scores. Start with a <Link href="/practice-tests/gre-quant" className="font-semibold underline">GRE Quant mock</Link> or the <Link href="/math-speed" className="font-semibold underline">Mathematics Speed studio</Link>, and your analytics appear here.</p>
        </Card>
      ) : (
        <>
          {/* summary cards */}
          <section className="mb-5" aria-label="Summary">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <Stat label="Performance score" value={t.overall === null ? "n/a" : <>{t.overall}<span className="text-[14px] font-normal text-ink-3">/100</span></>} sub={t.band ?? "provisional"} tone="teal" hint="A configurable blend of mastery, accuracy, efficiency and consistency" />
              <Stat label="Accuracy" value={t.accuracyPct === null ? "n/a" : `${Math.round(t.accuracyPct)}%`} sub={`${t.correct} right · ${t.incorrect} wrong · ${t.skipped} skipped`} />
              <Stat label="Avg topic mastery" value={t.masteryAvg === null ? "n/a" : `${Math.round(t.masteryAvg)}`} sub={`${t.topicsAssessed} topics assessed`} />
              <Stat label="Solving speed" value={t.speed} sub="median, where timed" />
              <Stat label="Consistency" value={t.consistency === null ? "n/a" : `${Math.round(t.consistency)}`} sub="across comparable attempts" />
              <Stat label="Tests completed" value={t.tests} sub={`${t.attempted} questions`} />
              <Stat label="Needs attention" value={t.needAttention} sub="topics below target" tone="rust" />
              <Stat label="Change" value={t.improvement === null ? "–" : `${t.improvement > 0 ? "+" : ""}${Math.round(t.improvement)}`} sub="recent vs earlier mastery" />
            </div>
            <p className="mt-2 text-[12px] text-ink-4">{v.engineNote}</p>
            {v.dataNote ? <p className="mt-1 text-[13px] text-ink-3">{v.dataNote}</p> : null}
          </section>

          {/* study time */}
          <Card title="Study time" className="!mb-5">
            <form action={studyMinutesAction} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="back" value="/math-studio/dashboard" />
              <div><label htmlFor="mins" className="block text-[13.5px] text-ink-3">Minutes a day you can study</label><select id="mins" name="minutes" defaultValue={minutes ?? 30} className="mt-1 min-h-[44px] rounded-lg border border-black/20 bg-white px-3 text-[15px]">{[15, 20, 30, 45, 60, 90].map((m) => <option key={m} value={m}>{m} minutes</option>)}</select></div>
              <button type="submit" className={btnLight}>Save</button>
            </form>
          </Card>

          {/* strongest / weakest */}
          <Card title="What you are doing well, and what to build next" id="summary">
            <div className="grid gap-5 md:grid-cols-2">
              <div><h3 className="text-[15px] font-semibold text-ink">Strengths</h3>{v.strengths.length ? <ul className="mt-2 space-y-1.5 text-[14.5px] text-ink-2">{v.strengths.map((s) => <li key={s.topic}>{s.message}</li>)}</ul> : <p className="mt-2 text-[14.5px] text-ink-3">No topic is secure yet. Keep practising and it will show here.</p>}</div>
              <div><h3 className="text-[15px] font-semibold text-ink">To build next</h3>{(v.premium ? v.mastery!.filter((m) => m.band === "support" || m.band === "developing").slice(0, 3) : v.weakest).length ? (
                <ul className="mt-2 space-y-1.5 text-[14.5px] text-ink-2">{(v.premium ? v.mastery!.filter((m) => m.band === "support" || m.band === "developing").slice(0, 3).map((m) => ({ topic: m.topic, topicName: m.topicName, score: m.score, items: m.items, evidence: "" })) : v.weakest).map((m) => <li key={m.topic}>{m.topicName}: {Math.round(m.score)}/100 over {m.items} question{m.items === 1 ? "" : "s"}</li>)}</ul>
              ) : <p className="mt-2 text-[14.5px] text-ink-3">No topic stands out as weak with the questions seen so far.</p>}</div>
            </div>
          </Card>

          {v.premium ? (
            <>
              {v.charts && Object.values(v.charts).some(Boolean) ? (
                <Card title="Your charts" id="charts">
                  <div className="grid gap-5 xl:grid-cols-2">{Object.values(v.charts).filter(Boolean).map((c) => <ChartCard key={c!.id} chart={c!} />)}</div>
                  <p className="mt-4 text-[13px] text-ink-3">Charts appear only where there is enough data. Nothing here compares you with other students.</p>
                </Card>
              ) : <Card title="Your charts"><p className="text-[14.5px] text-ink-3">A few more questions and your charts will draw here.</p></Card>}

              {v.weaknesses && v.weaknesses.length ? (
                <Card title="Top things to fix" id="weaknesses">
                  <ol className="space-y-3">{v.weaknesses.slice(0, 3).map((w, i) => (
                    <li key={i} className="rounded-xl border border-black/10 p-4">
                      <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-cream-3 px-2 py-0.5 text-[11.5px] font-semibold text-ink-2">{PRIORITY_LABEL[(w.kind === "foundational" ? 1 : w.kind === "slow" || w.kind === "hurried" ? 3 : 2) as 1 | 2 | 3]}</span><h3 className="text-[16px] font-semibold text-ink">{w.topicName}</h3><EvidenceTag label={({ insufficient: "Insufficient data", preliminary: "Preliminary insight", developing: "Developing evidence", strong: "Strong evidence" } as const)[w.evidenceLevel]} /></div>
                      <p className="mt-1.5 text-[14.5px] text-ink-2">{w.observed} {w.evidence}</p>
                      <p className="mt-1 text-[14px] text-ink-2"><strong className="text-ink">Do: </strong>{w.action}</p>
                    </li>))}</ol>
                  <Link href="/math-studio/weaknesses" className={`${btnLight} mt-4`}>Full weakness analysis</Link>
                </Card>
              ) : null}

              {v.planPreview && v.planPreview.steps.length ? (
                <Card title="Your practice plan" id="plan">
                  <p className="mb-3 text-[14.5px] text-ink-2">{v.planPreview.note}</p>
                  <ol className="space-y-2.5">{v.planPreview.steps.slice(0, 3).map((s, i) => <li key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-black/10 p-3"><span className="text-[14.5px] text-ink"><strong>{s.topicName}</strong> · {s.questionCount} questions at {["", "foundational", "easy", "medium", "hard", "advanced"][s.difficulty]} level</span><Link href={s.practice.href} className="text-[13.5px] font-semibold text-orange-deep underline">{s.practice.label}</Link></li>)}</ol>
                  <Link href="/math-studio/plan" className={`${btnPrimary} mt-4`}>Open the full plan</Link>
                </Card>
              ) : null}

              <div className="flex flex-wrap gap-3">
                <Link href="/math-studio/topics" className={btnLight}>Topic mastery</Link>
                <Link href="/math-studio/history" className={btnLight}>History</Link>
                <Link href="/math-studio/weaknesses" className={btnLight}>Weaknesses</Link>
                <Link href="/math-studio/plan" className={btnLight}>Practice plan</Link>
              </div>
            </>
          ) : v.locked ? (
            <>
              {v.trendMsg ? <Card title="Your progress"><p className="text-[14.5px] text-ink-2">{v.trendMsg}</p></Card> : null}
              <Card title="Go deeper with the Mathematics Studio" tone="soft">
                <ul className="grid gap-4 md:grid-cols-2">{v.locked.pitches.map((p) => <li key={p.key} className="rounded-xl border border-dashed border-orange/60 bg-white p-4"><p className="text-[12px] font-semibold uppercase tracking-wide text-orange-deep">In the Studio</p><h3 className="mt-1 text-[16.5px] font-semibold text-ink">{p.headline}</h3><p className="mt-1.5 text-[14.5px] leading-relaxed text-ink-2">{p.body}</p></li>)}</ul>
                <div className="mt-5 grid gap-5 md:grid-cols-2">
                  <div><p className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-ink-3">Free for every student</p><ul className="space-y-1.5 text-[14.5px] text-ink-2">{FREE_FEATURES.map((f) => <li key={f}>✓ {f}</li>)}</ul></div>
                  <div><p className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-orange-deep">With the Studio</p><ul className="space-y-1.5 text-[14.5px] text-ink-2">{PREMIUM_FEATURES.map((f) => <li key={f}>+ {f}</li>)}</ul></div>
                </div>
                <Link href="/math-studio/upgrade?from=dashboard" className={`${btnPrimary} mt-5`}>See the Studio{fee ? ` (₹${(fee.amountMinor / 100).toLocaleString("en-IN")})` : ""}</Link>
                <p className="mt-3 text-[13px] text-ink-3">{v.locked.counts.charts} chart{v.locked.counts.charts === 1 ? "" : "s"} and {v.locked.counts.weaknesses} finding{v.locked.counts.weaknesses === 1 ? "" : "s"} are ready from your {v.locked.counts.topics} assessed topics. No hidden score is implied that was not measured.</p>
              </Card>
            </>
          ) : null}
        </>
      )}
    </PortalPage>
  );
}
