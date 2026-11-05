import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PortalPage } from "@/components/portal/shell";
import { Card, Crumbs, StartButton, btnLight, btnPrimary, seconds } from "@/components/mathspeed/ui";
import { LEVELS, level, moduleByKey, nextModule } from "@/lib/mathspeed/curriculum";
import { coach } from "@/lib/mathspeed/feedback";
import { enrolledStudent } from "@/lib/mathspeed/page";
import { questionsOf } from "@/lib/mathspeed/plan";
import { placementSummary } from "@/lib/mathspeed/rules";
import { getDiagnostic, getSession } from "@/lib/mathspeed/store";
import { skill } from "@/lib/mathspeed/skills";
import { chooseStartAction } from "../../actions";

export const metadata: Metadata = { title: "Results | Mathematics Speed Enhancement Studio | GrowQR", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const KIND: Record<string, string> = { practice: "Graded practice", drill: "Timed drill", level: "Level Assessment", progress: "Progress Assessment", mastery: "Mastery Assessment", foundation: "Foundation Check", revision: "Targeted revision", review: "Daily review", diagnostic: "Placement check", benchmark: "Benchmark" };

export default async function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { me } = await enrolledStudent(`/math-speed/results/${id}`);
  const s = await getSession(me.id, id);
  if (!s) notFound();
  if (s.status !== "submitted" || !s.result) redirect(`/math-speed/session/${id}`);
  const r = s.result;
  const qs = questionsOf(s.plan);
  const allowed = qs.map((q) => q.allowedMs).sort((a, b) => a - b);
  const typical = allowed.length ? allowed[Math.floor(allowed.length / 2)] : null;
  const c = coach({ total: r.total, accuracy: r.accuracy, inTime: r.inTime, medianMs: r.medianMs, typicalAllowedMs: typical });
  const mistakes = r.answers.map((a, i) => ({ a, q: qs[i] })).filter((x) => x.q && !x.a.correct).slice(0, 12);
  const mod = s.plan.kind === "practice" || s.plan.kind === "drill" ? moduleByKey(s.plan.ref) : null;
  const lvNum = s.plan.kind === "level" || s.plan.kind === "progress" || s.plan.kind === "revision" ? Number(s.plan.ref) : mod?.level ?? 0;
  const lv = level(lvNum);
  const diag = s.plan.kind === "diagnostic" ? await getDiagnostic(me.id) : null;
  const placement = r.events.find((e) => e.type === "placement");
  const levelDone = r.events.find((e) => e.type === "level");
  const nextMod = mod ? nextModule(mod.key) : null;
  const perMinute = r.seconds > 0 ? Math.round((r.correct / r.seconds) * 600) / 10 : null;
  const back = mod ? `/math-speed/module/${mod.key}` : lv ? `/math-speed/level/${lv.letter}` : "/math-speed/journey";

  return (
    <PortalPage user={me} active="math-speed" title={`${KIND[r.kind] ?? "Results"}${mod ? `: ${mod.title}` : lv && r.kind !== "diagnostic" ? `: Level ${lv.letter}` : ""}`} subtitle={c.headline} wide>
      <Crumbs items={[{ href: "/math-speed/journey", label: "My Learning Journey" }, { label: "Results" }]} />

      {r.events.length ? (
        <div className="mb-5 space-y-2" aria-label="What happened">
          {r.events.map((e, i) => (
            <p key={i} className={`rounded-xl p-3.5 text-[15px] font-medium ${e.type === "note" ? "bg-cream-2 text-ink-2" : "bg-green-50 text-green-900"}`}>
              {e.type === "module" ? `Module finished: ${e.title}.` : e.type === "level" ? `Level Completed: ${e.title}. The next level is open.` : e.type === "achievement" ? `Achievement: ${e.title} (${e.detail})` : e.type === "mastered" ? `Mastered: ${e.title}.` : e.type === "placement" ? `Placement: you will begin at Level ${LEVELS[e.level - 1].letter}.` : e.type === "revision-done" ? "Revision done. You can retake the Level Assessment." : e.text}
            </p>
          ))}
        </div>
      ) : null}

      <section className="mb-5 grid gap-4 sm:grid-cols-3" aria-label="Your numbers">
        <div className="rounded-2xl border border-black/[0.08] bg-white p-5 shadow-card"><p className="text-[12.5px] text-ink-4">Score</p><p className="text-[30px] font-bold text-ink">{r.correct} of {r.total}</p><p className="text-[14px] text-ink-3">{r.accuracy}% accuracy{r.passMark !== null ? ` · pass mark ${r.passMark}%` : ""}</p>{r.passed !== null ? <p className={`mt-1 text-[14px] font-semibold ${r.passed ? "text-green-700" : "text-red-700"}`}>{r.passed ? "Passed" : "Not passed yet"}</p> : null}</div>
        <div className="rounded-2xl border border-black/[0.08] bg-white p-5 shadow-card"><p className="text-[12.5px] text-ink-4">Speed</p><p className="text-[30px] font-bold text-ink">{seconds(r.medianMs)}</p><p className="text-[14px] text-ink-3">typical time per correct answer{typical ? ` (about ${seconds(typical)} allowed)` : ""}</p>{perMinute !== null ? <p className="mt-1 text-[14px] text-ink-2">{perMinute} correct per minute</p> : null}</div>
        <div className="rounded-2xl border border-black/[0.08] bg-white p-5 shadow-card"><p className="text-[12.5px] text-ink-4">In time</p><p className="text-[30px] font-bold text-ink">{r.inTime}%</p><p className="text-[14px] text-ink-3">of correct answers inside the time allowed</p><p className="mt-1 text-[14px] text-ink-2">+{r.xp} points</p></div>
      </section>

      <Card title={c.headline}><p className="text-[15.5px] text-ink-2">{c.detail}</p></Card>

      {r.perSkill.length > 1 || r.weak.length ? (
        <Card title="By skill">
          <ul className="divide-y divide-black/[0.06]">
            {r.perSkill.map((p) => (
              <li key={p.skill} className="flex items-center justify-between gap-3 py-2 text-[14.5px]">
                <span className="text-ink">{skill(p.skill)?.title ?? p.skill}{r.weak.includes(p.skill) ? <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11.5px] font-semibold text-amber-900">Needs work</span> : null}</span>
                <span className="tabular-nums text-ink-3">{p.right} of {p.asked}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {mistakes.length ? (
        <Card title="Answers to look at again">
          <ul className="space-y-3">
            {mistakes.map(({ a, q }, i) => (
              <li key={i} className="rounded-xl bg-cream-2 p-3.5 text-[14.5px]">
                <p className="font-semibold text-ink">{q.prompt}</p>
                <p className="text-ink-3">You answered: {a.response || "nothing"} · Correct answer: <b className="text-ink">{q.answer}{q.unit && q.kind === "number" ? ` ${q.unit}` : ""}</b></p>
                <ul className="mt-1 list-disc pl-5 text-ink-2">{q.working.map((w) => <li key={w}>{w}</li>)}</ul>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {r.kind === "diagnostic" ? (
        <Card title={placement ? "Your starting level" : "Next set"}>
          {placement && diag?.recommended ? (
            <>
              <p className="text-[15.5px] text-ink-2">{placementSummary(diag.recommended)}</p>
              {diag.recommended > 1 ? (
                <form action={chooseStartAction} className="mt-3 flex flex-wrap items-end gap-3">
                  <div>
                    <label htmlFor="level" className="text-[14px] font-semibold text-ink">Or begin earlier</label>
                    <select id="level" name="level" defaultValue={diag.recommended} className="mt-1 min-h-[48px] rounded-lg border border-black/20 bg-white px-3 text-[15px]">{LEVELS.slice(0, diag.recommended).map((l) => <option key={l.n} value={l.n}>Level {l.letter}: {l.title}</option>)}</select>
                  </div>
                  <button type="submit" className={btnLight}>Use this level</button>
                </form>
              ) : null}
              <div className="mt-4"><Link href="/math-speed/journey" className={btnPrimary}>Go to my learning journey</Link></div>
            </>
          ) : (
            <><p className="mb-3 text-[15px] text-ink-2">Thanks. Based on that set, the check will try a {r.passed ? "higher" : "lower"} level next.</p><StartButton kind="diagnostic" back="/math-speed/diagnostic">Next set</StartButton></>
          )}
        </Card>
      ) : null}

      <div className="mt-2 flex flex-wrap gap-3">
        {r.kind === "practice" && nextMod && r.events.some((e) => e.type === "module") ? <Link href={`/math-speed/module/${nextMod.key}`} className={btnPrimary}>Next: Module {nextMod.n}, {nextMod.title}</Link> : null}
        {r.kind === "practice" && mod && !nextMod && r.events.some((e) => e.type === "module") ? <Link href={`/math-speed/level/${LEVELS[mod.level - 1].letter}#assessment`} className={btnPrimary}>On to the Level Assessment</Link> : null}
        {(r.kind === "practice" || r.kind === "drill") && mod ? <StartButton kind={r.kind} refKey={mod.key} back={back} className={r.events.some((e) => e.type === "module") ? btnLight : btnPrimary}>{r.kind === "drill" ? "Another drill" : "Practise again"}</StartButton> : null}
        {r.kind === "level" && levelDone ? <Link href="/math-speed/journey" className={btnPrimary}>See my learning journey</Link> : null}
        {r.kind === "level" && !r.passed && lv ? <Link href={`/math-speed/level/${lv.letter}#assessment`} className={btnPrimary}>Revise the weak skills</Link> : null}
        {r.kind === "revision" && lv ? <Link href={`/math-speed/level/${lv.letter}#assessment`} className={btnPrimary}>Back to the Level Assessment</Link> : null}
        {r.kind === "review" || r.kind === "foundation" || r.kind === "progress" || r.kind === "mastery" || r.kind === "benchmark" ? <Link href="/math-speed/journey" className={btnPrimary}>Back to my journey</Link> : null}
        {r.kind !== "diagnostic" ? <Link href={back} className={btnLight}>{mod ? "Back to the module" : "Back"}</Link> : null}
      </div>
    </PortalPage>
  );
}
