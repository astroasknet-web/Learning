import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PortalPage } from "@/components/portal/shell";
import { Card, Crumbs, Flash, Locked, StartButton, btnDark, btnLight } from "@/components/reading/ui";
import { studentPage } from "@/lib/reading/page";
import { hasPremium } from "@/lib/reading/access";
import { levelStatesFor } from "@/lib/reading/store";
import { lessonReadAction } from "../../actions";

export const metadata: Metadata = { title: "Level | English Reading Studio | GrowQR", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function LevelPage({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { key } = await params;
  const sp = await searchParams;
  const { me } = await studentPage(`/reading-studio/levels/${key}`);
  const [states, premium] = await Promise.all([levelStatesFor(me.id), hasPremium(me.id)]);
  const lv = states.find((s) => s.key === key.toUpperCase());
  if (!lv) notFound();
  const first = states[0].key === lv.key;
  const back = `/reading-studio/levels/${lv.key}`;
  const canSee = lv.unlocked && (premium || first); // Level A's lesson is the free sample
  return (
    <PortalPage user={me} active="reading-studio" title={`Level ${lv.key}: ${lv.name}`} subtitle={lv.objective} wide>
      <Crumbs items={[{ href: "/reading-studio/dashboard", label: "My English Reading Studio" }, { label: `Level ${lv.key}` }]} />
      <Flash text={sp.e} />
      {!lv.unlocked ? <Card><p className="text-[15px] text-ink-2">This level opens when the level before it is mastered: a mastery check at the pass mark, with practice completed. Levels open by what you show, not by time.</p></Card> : null}
      {canSee ? (
        <>
          <Card title="What you will learn" id="objectives"><ul className="list-disc space-y-1.5 pl-5 text-[15px] text-ink-2">{lv.lesson.objectives.map((o) => <li key={o}>{o}</li>)}</ul></Card>
          <Card title="Guided lesson" id="lesson">
            <div className="max-w-prose space-y-3 text-[16px] leading-[1.8] text-ink">{lv.lesson.lesson.map((p) => <p key={p}>{p}</p>)}</div>
            <h3 className="mt-5 text-[15px] font-semibold text-ink">Quick tips</h3>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[15px] text-ink-2">{lv.lesson.tips.map((t) => <li key={t}>{t}</li>)}</ul>
            <form action={lessonReadAction} className="mt-4"><input type="hidden" name="level" value={lv.key} /><button type="submit" className={btnLight}>I have read this lesson</button></form>
          </Card>
        </>
      ) : lv.unlocked ? (
        <Locked headline={`Level ${lv.key} is part of the package`} body="The package opens all ten levels, each with a guided lesson, practice with immediate feedback and a mastery check. The Level A lesson is free." source="level" />
      ) : null}
      {canSee && premium ? (
        <Card title="Practise and prove it" id="practice">
          <p className="mb-1 text-[14.5px] text-ink-2">{lv.message}</p>
          <p className="mb-4 text-[13.5px] text-ink-3">Pass mark: {lv.passPct}% on the mastery check, with the practice completed. The mastery check uses questions you have not practised.</p>
          <div className="flex flex-wrap gap-3">
            <StartButton kind="practice" level={lv.key} back={back} className={btnDark}>Start practice</StartButton>
            <StartButton kind="mastery" level={lv.key} back={back} className={btnLight}>Take the mastery check</StartButton>
            {lv.timed ? <StartButton kind="timed" back={back} className={btnLight}>Timed reading</StartButton> : null}
          </div>
          {lv.bestMasteryPct !== null ? <p className="mt-3 text-[13.5px] text-ink-3">Best mastery check so far: {lv.bestMasteryPct}%.</p> : null}
        </Card>
      ) : null}
      {canSee && !premium ? <Locked headline="Practice and the mastery check" body="Practice with immediate feedback and the mastery check that opens the next level are part of the package." source="level-practice" /> : null}
    </PortalPage>
  );
}
