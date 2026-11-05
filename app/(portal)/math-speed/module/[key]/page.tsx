import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PortalPage } from "@/components/portal/shell";
import { Card, Crumbs, Flash, StartButton, Unlock, btnDark, btnLight, btnPrimary } from "@/components/mathspeed/ui";
import { LEVELS, moduleByKey, nextModule } from "@/lib/mathspeed/curriculum";
import { enrolledStudent } from "@/lib/mathspeed/page";
import { ctxFor } from "@/lib/mathspeed/personalise";
import { moduleOpen } from "@/lib/mathspeed/rules";
import { buyLink, courseAccess, courseFeeNow, moduleIsFree } from "@/lib/mathspeed/access";
import { buildQuestion, skill } from "@/lib/mathspeed/skills";
import { readAction } from "../../actions";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ key: string }> }): Promise<Metadata> {
  const m = moduleByKey((await params).key);
  return { title: m ? `Module ${m.n}: ${m.title} | Level ${LEVELS[m.level - 1].letter} | GrowQR` : "Module | GrowQR" };
}

export default async function ModulePage({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { key } = await params;
  const sp = await searchParams;
  const m = moduleByKey(key);
  if (!m) notFound();
  const lv = LEVELS[m.level - 1];
  const { me, snap } = await enrolledStudent(`/math-speed/module/${m.key}`);
  const [access, fee] = await Promise.all([courseAccess(me.id), courseFeeNow()]);
  const free = moduleIsFree(m.key);
  const unlocked = free || access !== null;
  const open = moduleOpen(m.level, m.n, snap.progress);
  const row = snap.modules.get(m.key);
  const done = snap.progress.doneModules.has(m.key);
  const read = Boolean(row?.readAt);
  const next = nextModule(m.key);
  const back = `/math-speed/module/${m.key}`;
  const ctx = ctxFor(snap.enrolment.country, snap.enrolment.ageBand);
  const prevMod = m.n > 1 ? lv.modules[m.n - 2] : null;
  const examples = unlocked && open && m.lesson ? m.skills.slice(0, 2).flatMap((id) => [buildQuestion(id, 2, 31, ctx), buildQuestion(id, 5, 57, ctx)]).slice(0, 3) : [];
  const skillNames = m.skills.map((id) => skill(id)?.title ?? id).join(", ");

  return (
    <PortalPage user={me} active="math-speed" title={`Module ${m.n}: ${m.title}`} subtitle={`Level ${lv.letter}: ${lv.title}`} wide>
      <Crumbs items={[{ href: "/math-speed/journey", label: "My Learning Journey" }, { href: `/math-speed/level/${lv.letter}`, label: `Level ${lv.letter}` }, { label: `Module ${m.n}` }]} />
      <Flash text={sp.e} />
      {free ? <p className="mb-5 rounded-xl bg-green-50 p-3.5 text-[14.5px] text-green-900">Free sample. Level A, Module 1 is free for every student. {access === null ? "The rest of the course opens with the full course." : ""}</p> : null}

      {!open ? (
        <Card><p className="text-[15px] text-ink-2">{prevMod ? `Finish Module ${prevMod.n}: ${prevMod.title} first. Modules open in order so each one builds on the last.` : "This level is not open yet."}</p><div className="mt-3 flex gap-2">{prevMod ? <Link href={`/math-speed/module/${prevMod.key}`} className={btnPrimary}>Go to Module {prevMod.n}</Link> : null}<Link href="/math-speed/journey" className={btnLight}>My journey</Link></div></Card>
      ) : !unlocked ? (
        <>
          <Card title="About this module"><p className="text-[15px] text-ink-2">{m.lesson?.blurb}</p><p className="mt-2 text-[14px] text-ink-3">Skills practised: {skillNames}.</p></Card>
          <Unlock feeMinor={fee?.amountMinor ?? null} buy={buyLink()} signedIn />
        </>
      ) : !m.lesson ? (
        <Card><p className="text-[15px] text-ink-2">The lessons for this module are still being written.</p></Card>
      ) : (
        <>
          {done ? <p className="mb-5 rounded-xl bg-green-50 p-3.5 text-[14.5px] text-green-900">You have finished this module. You can still revisit it or practise more.</p> : null}

          <Card title="Learn" id="learn">
            <p className="mb-3 text-[15px] font-medium text-ink">{m.lesson.blurb}</p>
            {m.lesson.learn.map((p) => <p key={p} className="mb-3 text-[15.5px] leading-relaxed text-ink-2">{p}</p>)}
            <h3 className="mb-1.5 mt-4 text-[15px] font-semibold text-ink">The method</h3>
            <ol className="list-decimal space-y-1.5 pl-5 text-[15.5px] text-ink-2">{m.lesson.steps.map((s) => <li key={s}>{s}</li>)}</ol>
            {examples.length ? (
              <div className="mt-5 space-y-3">
                <h3 className="text-[15px] font-semibold text-ink">Worked examples</h3>
                {examples.map((q, i) => (
                  <div key={i} className="rounded-xl bg-cream-2 p-4">
                    <p className="text-[16px] font-semibold text-ink">{q.prompt}</p>
                    {q.options ? <p className="mt-1 text-[13.5px] text-ink-3">Options: {q.options.join(" · ")}</p> : null}
                    <ul className="mt-1.5 list-disc pl-5 text-[14.5px] text-ink-2">{q.working.map((w) => <li key={w}>{w}</li>)}</ul>
                    <p className="mt-1.5 text-[14.5px] font-semibold text-ink">Answer: {q.answer}{q.unit ? ` ${q.unit}` : ""}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </Card>

          <Card title="Understand" id="understand">
            {m.lesson.understand.map((p) => <p key={p} className="mb-3 text-[15.5px] leading-relaxed text-ink-2">{p}</p>)}
            <h3 className="mb-1.5 mt-3 text-[15px] font-semibold text-ink">Watch out for</h3>
            <ul className="list-disc space-y-1 pl-5 text-[15.5px] text-ink-2">{m.lesson.mistakes.map((s) => <li key={s}>{s}</li>)}</ul>
            <p className="mt-4 rounded-xl bg-orange-lighter p-3.5 text-[15px] font-semibold text-ink">Remember: {m.lesson.tip}</p>
          </Card>

          <Card title="Practise" id="practise">
            {!read ? (
              <form action={readAction} className="mb-4 rounded-xl bg-amber-50 p-4">
                <input type="hidden" name="key" value={m.key} />
                <p className="text-[14.5px] text-amber-900">Read Learn and Understand above, then tick them off. A module is finished when you have read both and score 8 out of 10 or better in the graded practice.</p>
                <button type="submit" className={`${btnDark} mt-3`}>I have read Learn and Understand</button>
              </form>
            ) : <p className="mb-4 text-[14.5px] text-green-800">✓ Learn and Understand read.</p>}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-black/10 p-4">
                <h3 className="text-[16px] font-semibold text-ink">Graded practice</h3>
                <p className="mt-1 text-[14px] text-ink-3">10 questions that get harder as you go. You see each answer straight away. {row?.attempts ? `Your best so far: ${row.bestPct}% in ${row.attempts} ${row.attempts === 1 ? "try" : "tries"}.` : "Score 8 or more to pass."}</p>
                <div className="mt-3"><StartButton kind="practice" refKey={m.key} back={back}>{row?.attempts ? "Practise again" : "Start graded practice"}</StartButton></div>
              </div>
              <div className="rounded-xl border border-black/10 p-4">
                <h3 className="text-[16px] font-semibold text-ink">Timed drill</h3>
                <p className="mt-1 text-[14px] text-ink-3">60 seconds. As many correct answers as you can. It trains speed and shows how fast you are getting.</p>
                <div className="mt-3"><StartButton kind="drill" refKey={m.key} back={back} className={btnLight}>Start a 60-second drill</StartButton></div>
              </div>
            </div>
            {done && next ? <div className="mt-5"><Link href={`/math-speed/module/${next.key}`} className={btnPrimary}>Next: Module {next.n}, {next.title}</Link></div> : null}
            {done && !next ? <div className="mt-5"><Link href={`/math-speed/level/${lv.letter}#assessment`} className={btnPrimary}>On to the Level Assessment</Link></div> : null}
          </Card>
        </>
      )}
    </PortalPage>
  );
}
