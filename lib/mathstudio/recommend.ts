import type { Config } from "./config";
import type { Weakness } from "./diagnosis";
import { topicById } from "./taxonomy";

/**
 * Turns the diagnosis into a prioritised, actionable plan. The Mathematics Studio does not generate its own questions; it sends the student to the
 * practice that already exists on the platform (the Mathematics Speed studio for arithmetic and the GRE Quant mocks for exam-style questions), so
 * every recommendation links to a real place to practise. Nothing is repeated once a skill is shown mastered.
 */
export type PriorityBand = 1 | 2 | 3 | 4;
export const PRIORITY_LABEL: Record<PriorityBand, string> = {
  1: "Foundational gaps", 2: "High-impact weaknesses", 3: "Efficiency improvements", 4: "Advanced development",
};
export const PRIORITY_BLURB: Record<PriorityBand, string> = {
  1: "Prerequisite ideas that are holding back other topics. Fix these first.",
  2: "Recurring weaknesses that cost you the most marks right now.",
  3: "Speed, accuracy and timing, once the methods are secure.",
  4: "Harder problems and new formats, to build on strong foundations.",
};

export interface PlanStep {
  priority: PriorityBand;
  topic: string;
  topicName: string;
  title: string;
  why: string;
  action: string;
  questionCount: number;
  difficulty: number;
  targetMastery: number;
  revisitDays: number;
  masteredWhen: string;
  practice: { kind: "mathspeed" | "gre" | "review"; href: string; label: string };
}

const bandOf = (k: Weakness["kind"]): PriorityBand => (k === "foundational" ? 1 : k === "slow" || k === "hurried" ? 3 : 2);

/** Where to practise a topic. Arithmetic and mental topics go to the Mathematics Speed studio; the rest to the GRE Quant mocks; timing issues to review. */
function practiceFor(topic: string, kind: Weakness["kind"]): PlanStep["practice"] {
  if (kind === "hurried") return { kind: "review", href: "/math-studio/history", label: "Review your missed questions" };
  const area = topicById(topic)?.area;
  if (area === "number" && ["mental-calc", "fractions-decimals", "percentages", "ratio-proportion", "exponents-roots", "number-properties", "divisibility", "primes", "remainders"].includes(topic)) {
    return { kind: "mathspeed", href: "/math-speed/journey", label: "Practise in the Mathematics Speed studio" };
  }
  return { kind: "gre", href: "/practice-tests/gre-quant", label: "Practise with a GRE Quant mock" };
}

export interface Plan { steps: PlanStep[]; note: string; studyMinutes: number }

export function buildPlan(weaknesses: Weakness[], cfg: Config, studyMinutes: number): Plan {
  const steps: PlanStep[] = weaknesses.map((w) => {
    const priority = bandOf(w.kind);
    const count = priority === 1 ? 20 : priority === 3 ? 15 : 12;
    return {
      priority, topic: w.topic, topicName: w.topicName,
      title: `${w.topicName}`,
      why: w.impact,
      action: w.action,
      questionCount: count,
      difficulty: w.practiceDifficulty,
      targetMastery: Math.min(100, Math.round(w.masteryScore) + 15),
      revisitDays: priority === 1 ? 2 : priority === 2 ? 3 : 4,
      masteredWhen: w.measure,
      practice: practiceFor(w.topic, w.kind),
    };
  });
  // promote a single advanced-development step when nothing is weak
  if (!steps.length) {
    return { steps: [], note: "No clear weakness yet. Keep taking tests and the plan will target what it finds; meanwhile, stretch yourself with harder mixed practice.", studyMinutes };
  }
  steps.sort((a, b) => a.priority - b.priority);
  const note = `Built from your results: ${steps.length} step${steps.length === 1 ? "" : "s"}, starting with ${PRIORITY_LABEL[steps[0].priority].toLowerCase()}. Minutes per day set your pace; the plan revisits each topic at widening intervals.`;
  return { steps, note, studyMinutes };
}

export interface Pitch { key: string; headline: string; body: string }
/** Premium conversion lines built only from the student's own numbers; never invents a weakness. */
export function pitches(facts: { topics: number; weakest: string | null; strongest: string | null; attempts: number; weaknesses: number }): Pitch[] {
  return [
    { key: "diagnostics", headline: facts.weakest ? `See exactly why ${facts.weakest.toLowerCase()} is costing you marks` : "See the full breakdown behind your score", body: `Your detailed diagnosis covers every topic you have been tested on, with the evidence behind each finding and what to practise next.` },
    { key: "plan", headline: "A practice plan built from your results", body: facts.weaknesses ? `We found ${facts.weaknesses} area${facts.weaknesses === 1 ? "" : "s"} to work on. Premium turns them into a prioritised plan with targets and revisit dates.` : "Premium turns your results into a prioritised practice plan with targets and revisit dates." },
    { key: "charts", headline: "Charts, trends and question-level analysis", body: `Mastery over time, speed against accuracy, a weakness heatmap and every question you answered, for the ${facts.topics} topic${facts.topics === 1 ? "" : "s"} in your profile.` },
    { key: "history", headline: "Keep your full history and watch it improve", body: facts.attempts >= 2 ? `You have ${facts.attempts} attempts on record. Premium keeps the full timeline and shows which topics are improving.` : "Premium keeps every test and shows which topics improve as you practise." },
  ];
}
