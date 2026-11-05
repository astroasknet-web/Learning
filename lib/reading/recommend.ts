import type { Config } from "./config";
import { strongest, weakest, type Cause, type SkillDiagnosis } from "./diagnosis";
import type { ScoreResult } from "./scoring";
import { SKILLS, type QType, type SkillId } from "./taxonomy";

/** Wording generated from the student's own numbers. Every sentence here is built from a count or score that exists; nothing is a fixed template about "your" results. */
export interface ErrorExample { stem: string; chosen: string; correct: string; explanation: string }

const pc = (n: number | null): string => (n === null ? "n/a" : `${Math.round(n)}%`);
const plural = (n: number, w: string): string => `${n} ${w}${n === 1 ? "" : "s"}`;

export function strengthsOf(diags: SkillDiagnosis[], result: ScoreResult | null, max = 3): string[] {
  const out: string[] = [];
  for (const d of strongest(diags, max)) {
    const right = Math.round(d.correct);
    out.push(`You answered ${right} of ${plural(d.attempted, "question")} on ${d.label.toLowerCase()} correctly (${pc(d.accuracy)}) across ${plural(d.distinctPassages, "passage")}${d.confidence === "high" ? "." : `, though this rests on ${d.attempted < 6 ? "a small number of questions" : "limited evidence"} so far.`}`);
  }
  const eff = result?.efficiency;
  if (eff?.reliable && eff.wpm !== null && eff.speedFactor !== null && eff.speedFactor >= 0.9 && (result?.comprehensionPct ?? result?.qaPct ?? 0) >= 70) {
    out.push(`You read at an estimated ${Math.round(eff.wpm)} words per minute and still answered ${pc(result?.comprehensionPct ?? result?.qaPct ?? null)} of comprehension questions correctly: speed and understanding together.`);
  }
  return out;
}

export interface Weakness {
  skill: SkillId;
  label: string;
  accuracy: number;
  questions: number;
  confidence: SkillDiagnosis["confidence"];
  /** One sentence in encouraging, non-judgemental language, built from the numbers. */
  message: string;
  why: string;
  practice: string;
  target: number;
  examples: ErrorExample[];
  repeated: boolean;
}

/** The next accuracy boundary above the student's score (the "next band"), as the target for the next assessment. */
export function targetFor(accuracy: number, cfg: Config): number {
  const edges = [cfg.bands.support, cfg.bands.developing, cfg.bands.progressing];
  const next = edges.find((e) => accuracy < e);
  return next ?? Math.min(100, Math.max(95, Math.ceil(accuracy)));
}

export function weaknessesOf(diags: SkillDiagnosis[], examples: Map<SkillId, ErrorExample[]>, cfg: Config, count = 3): Weakness[] {
  return weakest(diags, count).map((d) => {
    const acc = d.accuracy as number;
    const tail = d.repeatedError ? " The same kind of slip showed up in more than one passage, so it is worth a little focused practice." : d.confidence === "medium" ? " This is based on a modest number of questions, so treat it as a first signal." : "";
    return {
      skill: d.skill,
      label: d.label,
      accuracy: acc,
      questions: d.attempted,
      confidence: d.confidence,
      message: `Your ${d.label.toLowerCase()} accuracy was ${pc(acc)} across ${plural(d.attempted, "question")}. That is a skill to build, and it responds well to practice.${tail}`,
      why: SKILLS[d.skill].why,
      practice: SKILLS[d.skill].practice,
      target: targetFor(acc, cfg),
      examples: (examples.get(d.skill) ?? []).slice(0, 2),
      repeated: d.repeatedError,
    };
  });
}

// ---- the 7-day plan ------------------------------------------------------------------------------------------------------------

export interface PlanDay { day: number; title: string; minutes: number; task: string; action: { kind: "practice" | "timed" | "review" | "fresh" | "level"; skill?: SkillId; label: string } }

const DEFAULT_FOCUS: SkillId[] = ["main_idea", "inference", "vocab_context"];

export interface PlanInput { weak: SkillId[]; causes: Cause[]; studyMinutes: number; assessments: number }

/**
 * Seven days adapted to what was found: three focus days on the weakest confirmed skills (or general practice when none was confirmed), a day on
 * eliminating options, timed reading (longer when pace was flagged), review of incorrect answers, and a fresh assessment to compare. Minutes are
 * scaled to the study time the student has.
 */
export function sevenDayPlan(inp: PlanInput): { days: PlanDay[]; note: string } {
  const focus: SkillId[] = [...inp.weak];
  for (const s of DEFAULT_FOCUS) if (focus.length < 3 && !focus.includes(s)) focus.push(s);
  const general = inp.weak.length === 0;
  const m = Math.max(10, Math.min(120, Math.round(inp.studyMinutes)));
  const pace = inp.causes.some((c) => c.kind === "pace");
  const hurried = inp.causes.some((c) => c.kind === "hurried" || c.kind === "interpretation");
  const f = (s: SkillId): string => SKILLS[s].label.toLowerCase();
  const days: PlanDay[] = [
    { day: 1, title: `Build: ${f(focus[0])}`, minutes: m, task: `${SKILLS[focus[0]].practice} Then complete a practice set on this skill.`, action: { kind: "practice", skill: focus[0], label: `Practise ${f(focus[0])}` } },
    { day: 2, title: `Build: ${f(focus[1])}`, minutes: m, task: `${SKILLS[focus[1]].practice} Then complete a practice set on this skill.`, action: { kind: "practice", skill: focus[1], label: `Practise ${f(focus[1])}` } },
    { day: 3, title: `Build: ${f(focus[2])}`, minutes: m, task: `${SKILLS[focus[2]].practice} Then complete a practice set on this skill.`, action: { kind: "practice", skill: focus[2], label: `Practise ${f(focus[2])}` } },
    { day: 4, title: "Eliminating wrong options", minutes: m, task: hurried ? "For every question, cross out two options and say why each fails before choosing. Your results suggest checking each option pays off." : "For every question, cross out two options and say why each fails before choosing. It is the habit that stops tempting wrong answers.", action: { kind: "practice", skill: "details", label: "Practise careful answering" } },
    { day: 5, title: "Timed reading", minutes: pace ? Math.round(m * 1.25) : m, task: pace ? "Read one passage against the clock without rereading, then answer. Your understanding is solid, so the aim is pace." : "Read one passage against the clock, then answer. Aim to keep your accuracy while you keep to time.", action: { kind: "timed", label: "Start timed reading" } },
    { day: 6, title: "Review your incorrect answers", minutes: Math.max(10, Math.round(m * 0.75)), task: "Go back through the questions you missed, read each explanation, and write in one line why the right answer is supported and yours was not.", action: { kind: "review", label: "Open my last results" } },
    { day: 7, title: "Fresh assessment and compare", minutes: Math.round(m * 1.5), task: "Take a fresh assessment on a passage you have not seen, then compare it with your earlier result.", action: { kind: "fresh", label: "Start a fresh assessment" } },
  ];
  return { days, note: general ? "No skill was confirmed as weak yet, so this plan builds the three skills that most other skills rest on. Take more assessments and it will tailor itself." : `This plan is built from your results: ${focus.slice(0, Math.max(1, Math.min(3, inp.weak.length))).map(f).join(", ")} come first.` };
}

// ---- conversion messages (generated from the student's results) -------------------------------------------------------------------

export interface PitchFacts { strongest: string | null; weakest: string | null; wrong: number; assessedSkills: number; sufficientSkills: number; assessments: number; overall: number | null }

export function pitchFacts(result: ScoreResult, diags: SkillDiagnosis[], assessments: number): PitchFacts {
  const st = strongest(diags, 1)[0]?.label ?? null;
  const wk = weakest(diags, 1)[0]?.label ?? null;
  return { strongest: st, weakest: wk, wrong: result.total - result.correct, assessedSkills: result.skills.length, sufficientSkills: diags.filter((d) => d.band !== null).length, assessments, overall: result.overall };
}

export interface Pitch { key: string; headline: string; body: string }

/** What a locked area gives, in the student's own terms. Only real counts are used; a hidden weakness is never implied. */
export function pitches(f: PitchFacts): Record<"results" | "charts" | "plan" | "explanations" | "progress", Pitch> {
  return {
    results: { key: "results", headline: f.strongest ? "You have found your reading strengths. Now see what to work on." : "You have a first reading score. Now see what is behind it.", body: `Your detailed analysis breaks your result into ${plural(f.assessedSkills, "skill")} with the questions behind each one, so you can see where to practise first${f.wrong ? `, starting with the ${plural(f.wrong, "question")} you missed` : ""}.` },
    charts: { key: "charts", headline: "See your skills side by side", body: `Interactive charts show accuracy by skill, by difficulty and by question for the ${plural(f.assessedSkills, "skill")} you were assessed on. Charts only draw where there is enough data to mean something.` },
    plan: { key: "plan", headline: "A plan built from your answers", body: f.weakest ? `Your lowest assessed skill so far is ${f.weakest.toLowerCase()}. The personalised 7-day plan starts there and ends with a fresh assessment so you can measure the change.` : "A personalised 7-day plan uses your results to choose what to practise each day and ends with a fresh assessment so you can measure the change." },
    explanations: { key: "explanations", headline: f.wrong ? `Understand your ${plural(f.wrong, "missed question")}` : "Full explanations for every question", body: f.wrong ? "Each missed question comes with what you chose, what the passage supports, and why the tempting option falls short." : "Every question comes with a full explanation, including why the other options fail, so even right answers teach you something." },
    progress: { key: "progress", headline: "Keep your history and watch it improve", body: f.assessments >= 2 ? `You have ${f.assessments} assessments on record. Premium keeps the full timeline, compares like with like, and shows which skills have improved.` : "Premium keeps every assessment, compares like with like, and shows which skills improve as you practise. Your first result is the baseline." },
  };
}

export const QTYPE_PRACTICE: Partial<Record<QType, SkillId>> = { locate: "details", infer: "inference", conclude: "conclusion" };
