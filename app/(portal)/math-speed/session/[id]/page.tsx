import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PortalPage } from "@/components/portal/shell";
import DrillRunner, { type ClientQuestion } from "@/components/mathspeed/DrillRunner";
import { LEVELS, moduleByKey } from "@/lib/mathspeed/curriculum";
import { enrolledStudent } from "@/lib/mathspeed/page";
import { questionsOf, type Plan } from "@/lib/mathspeed/plan";
import { getSession } from "@/lib/mathspeed/store";

export const metadata: Metadata = { title: "Practice | Mathematics Speed Enhancement Studio | GrowQR", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Practice modes show right and wrong at once; assessments keep the answers back until the round is handed in. */
const FEEDBACK = new Set(["practice", "drill", "revision", "review"]);

function describe(plan: Plan): { title: string; intro: string[] } {
  const m = moduleByKey(plan.ref);
  switch (plan.kind) {
    case "practice": return { title: m ? `Graded practice: ${m.title}` : "Graded practice", intro: ["10 questions that get harder as you go.", "Score 8 or more to pass."] };
    case "drill": return { title: m ? `Timed drill: ${m.title}` : "Timed drill", intro: ["Answer as many as you can before the clock stops.", "A wrong answer costs more than a slow one: go quickly but not carelessly."] };
    case "level": { const lv = LEVELS[Number(plan.ref) - 1]; return { title: `Level Assessment: Level ${lv?.letter ?? ""}`, intro: ["Everything from this level, at the standard the level expects.", `You need ${lv?.pass ?? 80}% to pass.`, "There is no feedback until the end."] }; }
    case "progress": return { title: "Progress Assessment", intro: ["A check on the modules you have finished so far.", "It unlocks nothing; it shows what needs another look."] };
    case "mastery": return { title: "Mastery Assessment", intro: ["Questions from every level up to this point.", "You need 85%."] };
    case "foundation": return { title: "Foundation Check", intro: ["A short check on the levels you placed past.", "It makes sure the foundations are secure."] };
    case "revision": return { title: "Targeted revision", intro: ["Only the skills that need work, a little gentler than the assessment.", "You see each answer at once."] };
    case "review": return { title: "Daily review", intro: ["Skills you have mastered, brought back so they do not fade.", "You see each answer at once."] };
    case "diagnostic": return { title: "Placement check", intro: ["Five questions. Do your best; there is nothing to lose."] };
    default: return { title: "Benchmark", intro: ["The same 20 questions each time, so your speed and accuracy can be compared with your earlier benchmarks."] };
  }
}

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { me, csrf } = await enrolledStudent(`/math-speed/session/${id}`);
  const s = await getSession(me.id, id);
  if (!s) notFound();
  if (s.status === "submitted") redirect(`/math-speed/results/${id}`);
  const feedback = FEEDBACK.has(s.plan.kind);
  const questions: ClientQuestion[] = questionsOf(s.plan).map((q) => ({
    prompt: q.prompt, kind: q.kind, options: q.options, unit: q.unit, visual: q.visual, allowedMs: q.allowedMs,
    ...(feedback ? { answer: q.answer, tol: q.tol, lowest: q.lowest, working: q.working } : {}),
  }));
  const d = describe(s.plan);
  return (
    <PortalPage user={me} active="math-speed" title={d.title} wide="full">
      <DrillRunner title={d.title} sessionId={s.id} csrf={csrf} questions={questions} seconds={s.plan.seconds} feedback={feedback} intro={d.intro} />
    </PortalPage>
  );
}
