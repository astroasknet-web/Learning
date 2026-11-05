import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PortalPage } from "@/components/portal/shell";
import { Card, Crumbs, Flash, StartButton, StatusChip, Unlock, btnLight, btnPrimary } from "@/components/mathspeed/ui";
import { LEVELS, level, levelNumber } from "@/lib/mathspeed/curriculum";
import { enrolledStudent } from "@/lib/mathspeed/page";
import { MASTERY_LEVELS } from "@/lib/mathspeed/plan";
import { isPlaced, levelAssessmentGate, levelStatus, masteryAssessmentGate, moduleOpen, progressAssessmentGate } from "@/lib/mathspeed/rules";
import { buyLink, courseAccess, courseFeeNow } from "@/lib/mathspeed/access";
import { skill } from "@/lib/mathspeed/skills";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ letter: string }> }): Promise<Metadata> {
  const lv = level(levelNumber((await params).letter));
  return { title: lv ? `Level ${lv.letter}: ${lv.title} | Mathematics Speed Enhancement Studio | GrowQR` : "Level | GrowQR" };
}

export default async function LevelPage({ params, searchParams }: { params: Promise<{ letter: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { letter } = await params;
  const sp = await searchParams;
  const n = levelNumber(letter);
  const lv = level(n);
  if (!lv || !/^[A-Oa-o]$/.test(letter)) notFound();
  const { me, snap } = await enrolledStudent(`/math-speed/level/${lv.letter}`);
  const [access, fee] = await Promise.all([courseAccess(me.id), courseFeeNow()]);
  const p = snap.progress;
  const status = levelStatus(n, p);
  const placed = isPlaced(n, p);
  const row = snap.levels.get(n);
  const gate = levelAssessmentGate(n, p);
  const prog = progressAssessmentGate(n, p);
  const doneCount = lv.modules.filter((m) => p.doneModules.has(m.key)).length;
  const back = `/math-speed/level/${lv.letter}`;
  const weakTitles = (row?.weak ?? []).map((id) => skill(id)?.title ?? id);

  return (
    <PortalPage user={me} active="math-speed" title={`Level ${lv.letter}: ${lv.title}`} subtitle={lv.summary} wide>
      <Crumbs items={[{ href: "/math-speed/journey", label: "My Learning Journey" }, { label: `Level ${lv.letter}` }]} />
      <Flash text={sp.e} />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <StatusChip status={!lv.authored && status !== "completed" ? "soon" : status} />
        {placed ? <span className="text-[13.5px] text-ink-3">Placed past this level. It stays open for you to study.</span> : null}
        <span className="text-[13.5px] text-ink-3">{doneCount} of {lv.modules.length} modules finished</span>
      </div>
      {access === null && n > 1 ? <div className="mb-5"><Unlock feeMinor={fee?.amountMinor ?? null} buy={buyLink()} signedIn /></div> : null}

      {status === "locked" ? (
        <Card><p className="text-[15px] text-ink-2">This level opens when you pass the Level Assessment for Level {LEVELS[n - 2].letter}.</p><div className="mt-3"><Link href="/math-speed/journey" className={btnLight}>Back to my journey</Link></div></Card>
      ) : !lv.authored ? (
        <Card><p className="text-[15px] text-ink-2">The lessons for this level are still being written, so it cannot be started yet. You will find it here when it opens.</p></Card>
      ) : (
        <>
          <Card title="Modules" id="modules">
            <ol className="divide-y divide-black/[0.07]">
              {lv.modules.map((m) => {
                const done = p.doneModules.has(m.key);
                const open = moduleOpen(n, m.n, p);
                const r = snap.modules.get(m.key);
                return (
                  <li key={m.key} className="flex flex-wrap items-center gap-3 py-3">
                    <span aria-hidden className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[14px] font-bold ${done ? "bg-green-100 text-green-900" : open ? "bg-orange-light text-orange-deep" : "bg-cream-3 text-ink-4"}`}>{done ? "✓" : m.n}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[15.5px] font-semibold text-ink">{open ? <Link href={`/math-speed/module/${m.key}`} className="hover:underline">Module {m.n}: {m.title}</Link> : <>Module {m.n}: {m.title}</>}</p>
                      <p className="text-[13px] text-ink-3">{m.lesson?.blurb}{r && r.attempts ? ` · best practice ${r.bestPct}%` : ""}</p>
                    </div>
                    <span className="text-[12.5px] font-semibold text-ink-3">{done ? "Finished" : open ? "Open" : "Locked"}</span>
                  </li>
                );
              })}
            </ol>
          </Card>

          <Card title="Assessments" id="assessment">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-black/10 p-4">
                <h3 className="text-[16px] font-semibold text-ink">Level Assessment</h3>
                <p className="mt-1 text-[14px] text-ink-3">30 questions across everything in this level. You need {lv.pass}% to {p.completed.has(n) ? "keep this level complete" : "unlock the next level"}. If a skill lets you down you get targeted revision on just that skill, not the whole level again.</p>
                {row?.bestPct ? <p className="mt-1 text-[13.5px] text-ink-3">Your best so far: {row.bestPct}%{p.completed.has(n) ? " (passed)" : ""}.</p> : null}
                {row?.revisionPending ? (
                  <div className="mt-3 rounded-lg bg-amber-50 p-3 text-[14px] text-amber-900">
                    <p className="font-semibold">Revise these skills first</p>
                    <p>{weakTitles.length ? weakTitles.join(", ") : "Your weakest skills in this level."}</p>
                    <div className="mt-2"><StartButton kind="revision" refKey={String(n)} back={back} className={btnPrimary}>Start revision</StartButton></div>
                  </div>
                ) : null}
                <div className="mt-3">
                  {gate.ok ? <StartButton kind="level" refKey={String(n)} back={back}>{p.completed.has(n) ? "Retake the Level Assessment" : "Take the Level Assessment"}</StartButton> : <p className="text-[14px] font-medium text-ink-2" id="gate-reason">{gate.reason}</p>}
                </div>
              </div>
              <div className="rounded-xl border border-black/10 p-4">
                <h3 className="text-[16px] font-semibold text-ink">Progress Assessment</h3>
                <p className="mt-1 text-[14px] text-ink-3">A shorter check on the modules you have finished so far. It does not unlock anything; it shows which skills need another look and puts them into your daily review.</p>
                <div className="mt-3">{prog.ok ? <StartButton kind="progress" refKey={String(n)} back={back} className={btnLight}>Take a Progress Assessment</StartButton> : <p className="text-[14px] font-medium text-ink-2">{prog.reason}</p>}</div>
              </div>
              {MASTERY_LEVELS.includes(n) ? (
                <div className="rounded-xl border border-black/10 p-4 md:col-span-2">
                  <h3 className="text-[16px] font-semibold text-ink">Mastery Assessment</h3>
                  <p className="mt-1 text-[14px] text-ink-3">40 questions from every level up to Level {lv.letter}. It pulls everything back together and refreshes your earlier skills. You need 85%.</p>
                  <div className="mt-3">{masteryAssessmentGate(n, p).ok ? <StartButton kind="mastery" refKey={String(n)} back={back} className={btnLight}>Take the Mastery Assessment</StartButton> : <p className="text-[14px] font-medium text-ink-2">{masteryAssessmentGate(n, p).reason}</p>}</div>
                </div>
              ) : null}
              {n === 15 && (status === "in_progress" || p.completed.has(15)) ? (
                <div className="rounded-xl border border-black/10 p-4 md:col-span-2">
                  <h3 className="text-[16px] font-semibold text-ink">Your speed and accuracy benchmark</h3>
                  <p className="mt-1 text-[14px] text-ink-3">The same 20 questions at the same difficulty each time, so you can see your own speed and accuracy change.</p>
                  <div className="mt-3"><StartButton kind="benchmark" refKey="O" back={back} className={btnLight}>Take the benchmark</StartButton></div>
                </div>
              ) : null}
            </div>
          </Card>
        </>
      )}
    </PortalPage>
  );
}
