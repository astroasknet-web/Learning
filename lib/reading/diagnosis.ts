import type { Config } from "./config";
import { bandOf, median, type Band, type Item, type ScoreResult } from "./scoring";
import { SKILLS, SKILL_IDS, type Difficulty, type Group, type SkillId } from "./taxonomy";

/**
 * Explainable weakness diagnosis. Works on question-level history (not on a single score) and says how much evidence stands behind each claim.
 * It never treats response time as a weakness on its own, and it separates "this skill is weak" from "this skill was only hard at the hardest level".
 */
export interface HistoryItem extends Item { assessmentId: number; at: string }

export type Confidence = "none" | "low" | "medium" | "high";
export const INSUFFICIENT = "More practice needed to assess this skill reliably.";

export interface DiffStat { n: number; pct: number | null }
export interface SkillDiagnosis {
  skill: SkillId;
  label: string;
  group: Group;
  attempted: number;
  correct: number;
  accuracy: number | null;
  avgMs: number | null;
  byDifficulty: Record<Difficulty, DiffStat>;
  /** Accuracy in each of the most recent assessments that asked this skill, oldest first (up to five). */
  recent: Array<{ assessmentId: number; at: string; n: number; pct: number }>;
  /** Latest recent accuracy minus the one before it; null with fewer than two assessments. */
  change: number | null;
  distinctPassages: number;
  confidence: Confidence;
  /** null while evidence is insufficient. */
  band: Band | null;
  /** The same wrong answer pattern in two or more passages, so not a one-off. */
  repeatedError: boolean;
  /** Accuracy is low only on difficult questions: a stretch area rather than a weakness. */
  stretchOnly: boolean;
  summary: string;
}

const pct = (xs: Item[]): number | null => (xs.length ? Math.round((1000 * xs.reduce((a, x) => a + x.credit, 0)) / xs.length) / 10 : null);

export function diagnoseSkill(skill: SkillId, history: HistoryItem[], cfg: Config): SkillDiagnosis {
  const xs = history.filter((h) => h.skill === skill);
  const info = SKILLS[skill];
  const byDifficulty = {} as Record<Difficulty, DiffStat>;
  for (const d of [1, 2, 3] as Difficulty[]) { const g = xs.filter((x) => x.difficulty === d); byDifficulty[d] = { n: g.length, pct: pct(g) }; }
  const byAssess = new Map<number, HistoryItem[]>();
  for (const x of xs) byAssess.set(x.assessmentId, [...(byAssess.get(x.assessmentId) ?? []), x]);
  const recent = [...byAssess.entries()].map(([assessmentId, g]) => ({ assessmentId, at: g[0].at, n: g.length, pct: pct(g) as number })).sort((a, b) => a.at.localeCompare(b.at) || a.assessmentId - b.assessmentId).slice(-5);
  const change = recent.length >= 2 ? Math.round((recent[recent.length - 1].pct - recent[recent.length - 2].pct) * 10) / 10 : null;
  const passages = new Set(xs.map((x) => x.passageId));
  const accuracy = pct(xs);
  const wrong = xs.filter((x) => !x.correct);
  const wrongPassages = new Set(wrong.map((x) => x.passageId));
  const n = xs.length;
  const confidence: Confidence = n === 0 ? "none" : n < cfg.minSample ? "low" : n >= cfg.highSample && passages.size >= cfg.highPassages ? "high" : "medium";
  const sufficient = n >= cfg.minSample;
  const band = sufficient && accuracy !== null ? bandOf(accuracy, cfg) : null;
  const repeatedError = sufficient && wrongPassages.size >= 2;
  const easyMed = xs.filter((x) => x.difficulty <= 2);
  const hard = byDifficulty[3];
  const stretchOnly = sufficient && accuracy !== null && accuracy < cfg.bands.developing && easyMed.length >= 2 && (pct(easyMed) as number) >= cfg.bands.developing && hard.n >= 2 && (hard.pct as number) < cfg.bands.support;

  let summary: string;
  if (!sufficient) summary = INSUFFICIENT;
  else if (stretchOnly) summary = `${info.label}: ${pct(easyMed)}% on easy and medium questions but ${hard.pct}% on difficult ones. This looks like a stretch area, not a weakness.`;
  else summary = `${info.label}: ${Math.round(accuracy as number)}% across ${n} questions in ${passages.size} passage${passages.size === 1 ? "" : "s"} (${confidence} confidence).`;
  return { skill, label: info.label, group: info.group, attempted: n, correct: Math.round(xs.reduce((a, x) => a + x.credit, 0) * 10) / 10, accuracy, avgMs: xs.filter((x) => x.ms !== null).length ? Math.round((xs.reduce((a, x) => a + (x.ms ?? 0), 0)) / xs.filter((x) => x.ms !== null).length) : null, byDifficulty, recent, change, distinctPassages: passages.size, confidence, band, repeatedError, stretchOnly, summary };
}

export function diagnoseAll(history: HistoryItem[], cfg: Config): SkillDiagnosis[] {
  return SKILL_IDS.map((s) => diagnoseSkill(s, history, cfg)).filter((d) => d.attempted > 0);
}

/** Skills ranked from the most to the least in need of practice: reliable diagnoses first, by accuracy, ignoring stretch-only skills. */
export function weakest(diags: SkillDiagnosis[], count = 3): SkillDiagnosis[] {
  return diags.filter((d) => d.band !== null && !d.stretchOnly && d.band !== "strong").sort((a, b) => (a.accuracy as number) - (b.accuracy as number) || b.attempted - a.attempted).slice(0, count);
}
export function strongest(diags: SkillDiagnosis[], count = 3): SkillDiagnosis[] {
  return diags.filter((d) => d.band === "strong" || d.band === "progressing").sort((a, b) => (b.accuracy as number) - (a.accuracy as number) || b.attempted - a.attempted).slice(0, count);
}

// ---- what kind of difficulty is it? ---------------------------------------------------------------------------------------

export type CauseKind = "pace" | "understanding" | "vocabulary" | "inference" | "memory" | "interpretation" | "hurried";
export interface Cause { kind: CauseKind; label: string; evidence: string; advice: string }

/**
 * Looks across one assessment's result (and the items behind it) for the likeliest source of lost marks, and names the evidence. Only causes with
 * evidence are returned; a student with no pattern gets an empty list rather than an invented one.
 */
export function causesOf(result: ScoreResult, items: Item[], cfg: Config): Cause[] {
  const out: Cause[] = [];
  const dim = (d: string) => result.dimensions.find((x) => x.dimension === d);
  const comp = dim("comprehension")?.score ?? null;
  const inf = dim("inference")?.score ?? null;
  const voc = dim("vocabulary")?.score ?? null;
  const ret = dim("retention")?.score ?? null;
  const ok = cfg.bands.developing;
  const eff = result.efficiency;

  if (eff.reliable && eff.wpm !== null && eff.speedFactor !== null && eff.speedFactor < 0.8 && (comp ?? result.qaPct ?? 0) >= ok) {
    out.push({ kind: "pace", label: "Reading pace", evidence: `You read at about ${Math.round(eff.wpm)} words per minute (an estimate from your recorded reading time) against a comfortable range near ${eff.target}, and your understanding was solid at ${Math.round((comp ?? result.qaPct) as number)}%.`, advice: "Your understanding is ready for more speed. Practise timed reading, one passage at a time, without rereading." });
  }
  if (comp !== null && comp < cfg.bands.developing && (dim("comprehension")?.questions ?? 0) >= cfg.minSample) {
    out.push({ kind: "understanding", label: "Understanding what is stated", evidence: `Comprehension questions were answered correctly ${Math.round(comp)}% of the time (${dim("comprehension")?.questions} questions).`, advice: "Slow down on the first read and put each paragraph into one sentence before you look at the questions." });
  }
  if (voc !== null && voc < cfg.bands.developing && (comp === null || comp >= ok)) {
    out.push({ kind: "vocabulary", label: "Vocabulary in context", evidence: `Word-meaning questions were ${Math.round(voc)}% correct while comprehension of the rest was ${comp === null ? "not assessed" : Math.round(comp) + "%"}, which points at word meaning more than at general understanding.`, advice: "Practise guessing a word's meaning from the sentence around it, then checking." });
  }
  if (inf !== null && inf < cfg.bands.developing && (comp === null || comp >= ok)) {
    out.push({ kind: "inference", label: "Going beyond what is stated", evidence: `You were ${Math.round(inf)}% correct on inference and critical-reading questions but ${comp === null ? "n/a" : Math.round(comp) + "%"} on questions about what is stated directly.`, advice: "Before choosing, find the words in the passage that support your answer. Plausible is not the same as supported." });
  }
  if (ret !== null && ret < cfg.bands.developing) {
    out.push({ kind: "memory", label: "Holding on to what you read", evidence: `Recall questions, answered without the passage, were ${Math.round(ret)}% correct. One session is only a snapshot of recall.`, advice: "Retell what you read in your own words straight after reading, and revisit it a day later." });
  }
  const tricky = items.filter((i) => i.qtype === "negation" || i.qtype === "supported" || i.qtype === "eliminate");
  const direct = items.filter((i) => i.qtype === "locate");
  const share = (xs: Item[]) => (xs.length ? xs.reduce((a, x) => a + x.credit, 0) / xs.length : null);
  if (tricky.length >= 3 && direct.length >= 2 && (share(tricky) as number) * 100 < cfg.bands.support && (share(direct) as number) * 100 >= ok) {
    out.push({ kind: "interpretation", label: "Reading the question carefully", evidence: `Direct fact questions went well (${Math.round((share(direct) as number) * 100)}%) but questions with negative wording or tempting wrong options did not (${Math.round((share(tricky) as number) * 100)}%).`, advice: "Underline words like NOT and EXCEPT, and for each option ask where the passage supports it." });
  }
  const wrong = items.filter((i) => !i.correct && !i.skipped && i.ms !== null);
  const fastWrong = wrong.filter((i) => (i.ms as number) < cfg.rushedShare * i.expectedSecs * 1000);
  if (fastWrong.length >= cfg.rushedErrors && fastWrong.length / Math.max(1, wrong.length) >= 0.5) {
    out.push({ kind: "hurried", label: "Answering before checking", evidence: `${fastWrong.length} of your ${wrong.length} wrong answers were given in under ${Math.round(cfg.rushedShare * 100)}% of the usual time. Quick answers that miss point to hurrying rather than not knowing.`, advice: "Give every question at least one check against the passage before you confirm." });
  }
  return out;
}

/** A wrong answer is never explained by speed alone, but a careful, slow, correct answer on a hard question is worth saying out loud. */
export function carefulNote(items: Item[]): string | null {
  const hardRight = items.filter((i) => i.correct && i.difficulty === 3 && i.ms !== null && (i.ms as number) > i.expectedSecs * 1000 * 1.3);
  if (hardRight.length < 2) return null;
  return `You took longer than the guide time on ${hardRight.length} difficult questions and answered them correctly. That is careful reading, not a weakness.`;
}

export const medianMs = (items: Item[]): number | null => median(items.filter((i) => i.ms !== null).map((i) => i.ms as number));
