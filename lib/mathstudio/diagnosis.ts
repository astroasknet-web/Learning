import type { Config } from "./config";
import { accuracyOf, masteryByTopic, median, type Item, type Mastery } from "./engine";
import { COGNITIVE_LABEL, EVIDENCE_LABEL, topicById, type Evidence } from "./taxonomy";

/**
 * Weakness detection. Works on the student's whole item history (not a single score) and says how much evidence stands behind each finding. It never
 * invents a cause: a wrong answer is not called "careless" unless the response pattern supports it, and where the cause is uncertain the language is
 * hedged ("may indicate"). Only patterns with at least preliminary evidence and the configured minimum counts are reported.
 */
export type Kind = "foundational" | "topic" | "difficulty-cliff" | "multistep" | "slow" | "hurried" | "inconsistent";

export interface Weakness {
  kind: Kind;
  topic: string;
  topicName: string;
  /** What was observed, in plain words built from the numbers. */
  observed: string;
  /** The evidence from the student's own tests. */
  evidence: string;
  evidenceLevel: Evidence;
  /** Why it matters for performance. */
  impact: string;
  /** What to do about it. */
  action: string;
  /** The difficulty to practise at next (1..5). */
  practiceDifficulty: number;
  /** How the student will know it improved. */
  measure: string;
  /** For ranking: higher is more important. */
  priority: number;
  masteryScore: number;
}

const pct = (xs: Item[]): number | null => (xs.length ? Math.round((1000 * xs.reduce((a, i) => a + (i.maxMarks > 0 ? Math.min(1, i.credit / i.maxMarks) : i.correct ? 1 : 0), 0)) / xs.length) / 10 : null);
const conf = (e: Evidence): string => EVIDENCE_LABEL[e].toLowerCase();

/** How many other attempted topics list this one as a prerequisite: a weak prerequisite blocks progress elsewhere, so it ranks first. */
function blocks(topic: string, attemptedTopics: Set<string>): number {
  let n = 0;
  for (const other of attemptedTopics) if (topicById(other)?.prereq.includes(topic)) n++;
  return n;
}

export function diagnose(items: Item[], cfg: Config, now: number): Weakness[] {
  const mastery = masteryByTopic(items, cfg, now);
  const byTopic = new Map<string, Item[]>();
  for (const i of items) byTopic.set(i.topic, [...(byTopic.get(i.topic) ?? []), i]);
  const attempted = new Set(byTopic.keys());
  const out: Weakness[] = [];
  const add = (w: Weakness) => out.push(w);

  for (const m of mastery) {
    if (m.evidence === "insufficient") continue;
    const xs = byTopic.get(m.topic) as Item[];
    const name = m.topicName;

    // 1. low mastery on the topic (foundational if it blocks others)
    if (m.band === "support" || m.band === "developing") {
      const blocking = blocks(m.topic, attempted);
      const foundational = blocking > 0 && m.band === "support";
      add({
        kind: foundational ? "foundational" : "topic", topic: m.topic, topicName: name,
        observed: foundational ? `${name} is shaky and several topics you are attempting build on it.` : `Your mastery estimate for ${name.toLowerCase()} is ${Math.round(m.score)} / 100.`,
        evidence: `${m.score}/100 (${m.low}–${m.high}) from ${m.items} question${m.items === 1 ? "" : "s"} across ${m.attempts} attempt${m.attempts === 1 ? "" : "s"}, ${conf(m.evidence)}.`,
        evidenceLevel: m.evidence,
        impact: foundational ? `Weak foundations here hold back ${blocking} later topic${blocking === 1 ? "" : "s"} you have been tested on.` : "This topic costs marks directly whenever it appears.",
        action: `Revise ${name.toLowerCase()} from the method up, then practise at ${labelD(Math.max(1, Math.round(m.avgDifficulty - 1)))} level before building back up.`,
        practiceDifficulty: Math.max(1, Math.round(m.avgDifficulty - 1)),
        measure: `Aim for ${Math.min(100, Math.round(m.score) + 15)}/100 over your next ${cfg.evidence.developing}+ questions on it.`,
        priority: (foundational ? 1000 : 600) + blocking * 40 + (100 - m.score),
        masteryScore: m.score,
      });
    }

    // 2. difficulty cliff: fine on easy/medium, falls on hard
    const em = xs.filter((i) => i.difficulty <= 3), hard = xs.filter((i) => i.difficulty >= 4);
    const emP = pct(em), hardP = pct(hard);
    if (em.length >= 3 && hard.length >= cfg.evidence.preliminary && emP !== null && hardP !== null && emP >= cfg.bands.developing && hardP < cfg.bands.support) {
      add({
        kind: "difficulty-cliff", topic: m.topic, topicName: name,
        observed: `You handle routine ${name.toLowerCase()} questions but the harder ones drop off sharply.`,
        evidence: `${emP}% on easier questions (${em.length}) versus ${hardP}% on harder ones (${hard.length}).`,
        evidenceLevel: hard.length >= cfg.evidence.developing ? "developing" : "preliminary",
        impact: "The marks you are losing are concentrated in the harder questions that separate scores at the top.",
        action: "Practise only the harder variants of this topic, working slowly for method before speed.",
        practiceDifficulty: 4, measure: `Lift the harder-question accuracy from ${hardP}% toward ${cfg.bands.developing}%.`,
        priority: 500 + (cfg.bands.support - hardP), masteryScore: m.score,
      });
    }
  }

  // 3. multi-step gap: multistep/application items much worse than procedure/recall, across topics
  const multi = items.filter((i) => i.cognitive === "multistep" || i.cognitive === "application");
  const routine = items.filter((i) => i.cognitive === "procedure" || i.cognitive === "recall");
  const mP = pct(multi), rP = pct(routine);
  if (multi.length >= cfg.evidence.developing && routine.length >= cfg.evidence.preliminary && mP !== null && rP !== null && rP - mP >= 20 && mP < cfg.bands.developing) {
    add({
      kind: "multistep", topic: "multistep-problems", topicName: "Multi-step problem solving",
      observed: "You are stronger on direct questions than on ones that chain several steps.",
      evidence: `${rP}% on routine questions (${routine.length}) but ${mP}% on multi-step and applied ones (${multi.length}).`,
      evidenceLevel: multi.length >= cfg.evidence.strong ? "strong" : "developing",
      impact: "Multi-step questions carry the most marks in most of these examinations.",
      action: "Practise writing the plan before solving: name the steps, then execute. Review each missed question for the step that broke.",
      practiceDifficulty: 4, measure: `Close the gap between routine and multi-step accuracy to under 15 points.`,
      priority: 550 + (rP - mP), masteryScore: mP,
    });
  }

  // 4 & 5. timing patterns, only where per-question time exists
  const timed = items.filter((i) => i.timeMs !== null && i.expectedSecs);
  if (timed.length >= cfg.evidence.developing) {
    const slow = timed.filter((i) => i.correct && (i.timeMs as number) / 1000 > cfg.slowMultiple * (i.expectedSecs as number));
    if (slow.length >= cfg.slowMin) {
      const topic = commonest(slow);
      add({
        kind: "slow", topic, topicName: topicById(topic)?.name ?? "calculation",
        observed: "You are getting these right, but slowly.",
        evidence: `${slow.length} correct answers took more than ${cfg.slowMultiple}× the expected time.`,
        evidenceLevel: slow.length >= cfg.evidence.strong ? "strong" : "developing",
        impact: "Under timed conditions this pace can cost you later questions you would otherwise get.",
        action: "Drill the same questions for speed once the method is secure; practise mental-calculation shortcuts.",
        practiceDifficulty: 3, measure: "Bring the median time on these toward the expected time while keeping the accuracy.",
        priority: 300 + slow.length, masteryScore: 100,
      });
    }
    const hurried = timed.filter((i) => !i.correct && !i.skipped && (i.timeMs as number) / 1000 < cfg.rushedShare * (i.expectedSecs as number));
    if (hurried.length >= cfg.rushedMin) {
      const topic = commonest(hurried);
      add({
        kind: "hurried", topic, topicName: topicById(topic)?.name ?? "these questions",
        observed: "A number of your wrong answers were given very quickly, which may indicate slips rather than gaps.",
        evidence: `${hurried.length} wrong answers were given in under ${Math.round(cfg.rushedShare * 100)}% of the expected time.`,
        evidenceLevel: hurried.length >= cfg.evidence.developing ? "developing" : "preliminary",
        impact: "Careless losses on questions you can do are the cheapest marks to win back.",
        action: "Give every question a quick check against the question before confirming; re-read what is asked.",
        practiceDifficulty: 3, measure: "Watch the count of fast wrong answers fall in your next few tests.",
        priority: 350 + hurried.length, masteryScore: 50,
      });
    }
  }

  return out.sort((a, b) => b.priority - a.priority).slice(0, cfg.maxWeaknesses);
}

function commonest(items: Item[]): string {
  const c = new Map<string, number>();
  for (const i of items) c.set(i.topic, (c.get(i.topic) ?? 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "multistep-problems";
}
const labelD = (d: number): string => ["", "foundational", "easy", "medium", "hard", "advanced"][Math.min(5, Math.max(1, d))];

export interface Strength { topic: string; topicName: string; score: number; items: number; message: string }
export function strengths(items: Item[], cfg: Config, now: number, max = 3): Strength[] {
  return masteryByTopic(items, cfg, now).filter((m) => m.band === "secure" || (m.band === "progressing" && m.evidence !== "insufficient")).sort((a, b) => b.score - a.score).slice(0, max)
    .map((m) => ({ topic: m.topic, topicName: m.topicName, score: m.score, items: m.items, message: `${m.topicName}: ${Math.round(m.score)}/100 over ${m.items} question${m.items === 1 ? "" : "s"}${m.avgDifficulty >= 3.5 ? ", including harder ones" : ""}.` }));
}

/** A one-line, honest read of whether the data is thin, built from the real counts. */
export function dataNote(items: Item[], attempts: number, cfg: Config): string | null {
  if (items.length >= cfg.evidence.developing && attempts >= cfg.strongAttempts) return null;
  if (!items.length) return "Take a mathematics test on the platform and your Studio fills in automatically.";
  return `This is based on ${items.length} question${items.length === 1 ? "" : "s"} from ${attempts} attempt${attempts === 1 ? "" : "s"}. A few more tests will make the diagnosis more reliable.`;
}

export { COGNITIVE_LABEL };
