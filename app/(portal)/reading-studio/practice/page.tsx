import type { Metadata } from "next";
import { PortalPage } from "@/components/portal/shell";
import { Card, Crumbs, Flash, Locked, StartButton } from "@/components/reading/ui";
import { studentPage } from "@/lib/reading/page";
import { hasPremium } from "@/lib/reading/access";
import { SKILLS, isSkill } from "@/lib/reading/taxonomy";

export const metadata: Metadata = { title: "Practice | English Reading Studio | GrowQR", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Where chart links and plan days land: says what the practice is, then a button starts it (starting is a form post, never a link). */
export default async function PracticePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { me } = await studentPage("/reading-studio/practice");
  const premium = await hasPremium(me.id);
  const skill = sp.skill && isSkill(sp.skill) ? sp.skill : null;
  const kind = sp.kind === "timed" ? "timed" : "practice";
  const back = `/reading-studio/practice${skill ? `?skill=${skill}` : kind === "timed" ? "?kind=timed" : ""}`;
  return (
    <PortalPage user={me} active="reading-studio" title={skill ? `Practise: ${SKILLS[skill].label}` : "Timed reading"} wide>
      <Crumbs items={[{ href: "/reading-studio/dashboard", label: "My English Reading Studio" }, { label: "Practice" }]} />
      <Flash text={sp.e} />
      {skill ? (
        <Card title="What this practice is">
          <p className="max-w-prose text-[15px] leading-relaxed text-ink-2">{SKILLS[skill].why}</p>
          <p className="mt-2 max-w-prose text-[15px] leading-relaxed text-ink-2"><strong className="text-ink">Try this: </strong>{SKILLS[skill].practice}</p>
          <p className="mt-2 text-[14px] text-ink-3">You get questions on this skill, preferring ones you have not seen, and an explanation straight after each answer.</p>
        </Card>
      ) : (
        <Card title="What timed reading is"><p className="max-w-prose text-[15px] leading-relaxed text-ink-2">One passage and its questions against a clock sized to the passage. Speed counts only together with accuracy, and your reading time is an estimate.</p></Card>
      )}
      {premium ? <StartButton kind={kind} skill={skill ?? undefined} back={back}>Start</StartButton> : <Locked headline="Targeted and timed practice are part of the package" body="The package adds practice on any skill with immediate feedback, timed reading, and a 7-day plan that chooses what to practise." source="practice" />}
    </PortalPage>
  );
}
