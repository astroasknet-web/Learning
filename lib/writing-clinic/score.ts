import { evaluate as ielts } from "@/lib/lms/ielts-feedback";
import type { Exam, Task } from "./exams";

/**
 * A rule-based writing estimator. It measures what software can measure reliably (length, paragraphs, linking words, vocabulary
 * variety, sentence structure, and signals such as evidence, flaw-spotting or analysis language) and turns them into an approximate
 * score on each criterion of the chosen exam. It cannot judge whether ideas are right or relevant, and says so in its note.
 */
export interface Result {
  overall: number;
  criteria: number[];
  max: number;
  wordCount: number;
  paragraphs: number;
  minWords: number;
  working: string[];
  improve: string[];
  note: string;
}

const NOTE = "Estimated from measurable features (length, paragraphing, linking words, vocabulary variety, sentence structure and the language of evidence or analysis). A real examiner also judges your ideas, relevance and accuracy. Use this to build habits, not as a guaranteed score.";

const LINKERS = ["however", "moreover", "furthermore", "in addition", "additionally", "therefore", "consequently", "as a result", "for instance", "for example", "such as", "in contrast", "on the other hand", "nevertheless", "nonetheless", "whereas", "while", "although", "despite", "because", "since", "thus", "hence", "firstly", "secondly", "finally", "in conclusion", "to conclude", "overall", "similarly", "likewise", "meanwhile", "in other words"];
const OVERSIMPLE = ["good", "bad", "big", "small", "nice", "thing", "things", "a lot", "lots", "very", "really", "get", "got"];
const COMPLEX = ["which", "who", "whom", "whose", "that", "because", "although", "though", "while", "whereas", "if", "unless", "since", "when", "where", "so that", "in order to", "despite", "having"];
const EVIDENCE = ["for example", "for instance", "such as", "according to", "studies", "research", "evidence", "data", "statistics", "survey", "per cent", "percent", "this shows", "this suggests", "illustrates", "demonstrates", "in fact"];
const STANCE = ["i agree", "i disagree", "i believe", "in my view", "in my opinion", "i think", "i would argue", "this essay", "i contend", "i maintain", "to a large extent", "to some extent"];
const FLAWS = ["assume", "assumes", "assumption", "assumptions", "unstated", "flaw", "flawed", "fails to", "overlooks", "does not consider", "alternative", "alternatively", "correlation", "causation", "cause", "sample", "representative", "weaken", "strengthen", "insufficient", "may not", "might not", "not necessarily", "no evidence", "ignores", "could be due"];
const TESTS = ["would need", "would help", "would strengthen", "would weaken", "evidence that", "data on", "compare", "comparison", "control group", "further information", "we would need"];
const ANALYSIS = ["the author", "the writer", "the speaker", "the passage", "the text", "argues", "claims", "appeals", "emphasises", "emphasizes", "builds", "tone", "reasoning", "rhetorical", "persuade", "persuades", "contrast", "repetition", "creates", "suggests", "reinforces", "highlights", "evokes"];
const REFLECT = ["learned", "learnt", "realised", "realized", "felt", "decided", "changed", "understood", "discovered", "taught me", "i wanted", "i hoped"];

const toks = (s: string): string[] => s.toLowerCase().match(/[a-z']+/g) ?? [];
const sents = (s: string): string[] => s.split(/[.!?]+/).map((x) => x.trim()).filter(Boolean);
const paras = (s: string): string[] => s.split(/\n\s*\n+/).map((x) => x.trim()).filter(Boolean);
function hits(text: string, list: string[]): string[] {
  const t = " " + text.toLowerCase().replace(/[^a-z' ]+/g, " ").replace(/\s+/g, " ") + " ";
  return list.filter((p) => t.includes(" " + p + " "));
}
const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));
const toScale = (raw: number, max: number, step: number): number => {
  const lo = 1;
  const v = lo + clamp01(raw) * (max - lo);
  return Math.round(v / step) * step;
};

export function evaluateWriting(exam: Exam, task: Task, text: string): Result {
  const t = text.trim();
  const wc = toks(t).length;
  const empty: Result = { overall: 0, criteria: [0, 0, 0, 0], max: exam.max, wordCount: wc, paragraphs: 0, minWords: task.minWords, working: [], improve: ["Write your response first, then check it."], note: NOTE };
  if (!t) return empty;

  if (task.kind === "ielts-task1" || task.kind === "ielts-task2") {
    const r = ielts({ text: t, task: task.kind === "ielts-task1" ? "task1" : "task2" }) as {
      band: number; criteria: { ta: number; cc: number; lr: number; gra: number }; paragraphs: number; strengths: string[]; improvements: string[];
    };
    return { overall: r.band, criteria: [r.criteria.ta, r.criteria.cc, r.criteria.lr, r.criteria.gra], max: 9, wordCount: wc, paragraphs: r.paragraphs, minWords: task.minWords, working: r.strengths, improve: r.improvements, note: NOTE };
  }

  const ps = paras(t);
  const ss = sents(t);
  const avg = ss.length ? wc / ss.length : wc;
  const uniq = new Set(toks(t)).size;
  const ttr = wc ? uniq / wc : 0;
  const linkers = hits(t, LINKERS);
  const simple = hits(t, OVERSIMPLE);
  const complex = hits(t, COMPLEX);
  const evidence = hits(t, EVIDENCE);
  const stance = hits(t, STANCE);
  const flaws = hits(t, FLAWS);
  const tests = hits(t, TESTS);
  const analysis = hits(t, ANALYSIS);
  const reflect = hits(t, REFLECT);
  const quotes = (t.match(/["“”]/g) ?? []).length / 2;
  const length = clamp01(wc / task.minWords);
  const wantParas = task.kind === "argument" || task.kind === "analysis" ? 3 : 4;
  const structure = clamp01(ps.length / wantParas);
  const digits = (t.match(/\b\d[\d,.]*\b/g) ?? []).length;
  const names = (t.match(/(?<=[a-z,] )[A-Z][a-z]{2,}/g) ?? []).length;
  const first = toks(t).filter((w) => w === "i" || w === "my" || w === "me").length / Math.max(1, wc);

  let c0: number; let c1: number;
  if (task.kind === "issue") {
    c0 = 0.35 * length + 0.4 * (stance.length ? 1 : 0) + 0.25 * structure;
    c1 = 0.6 * clamp01(evidence.length / 4) + 0.4 * length;
  } else if (task.kind === "argument") {
    c0 = 0.7 * clamp01(flaws.length / 6) + 0.3 * length;
    c1 = 0.55 * clamp01((tests.length + evidence.length) / 4) + 0.2 * clamp01(flaws.length / 8) + 0.25 * length;
  } else if (task.kind === "analysis") {
    c0 = 0.45 * clamp01((analysis.length + quotes) / 5) + 0.3 * length + 0.25 * structure;
    c1 = 0.6 * clamp01(analysis.length / 7) + 0.25 * clamp01(evidence.length / 3) + 0.15 * clamp01(quotes / 2);
  } else {
    c0 = 0.5 * clamp01(first / 0.04) + 0.3 * clamp01(reflect.length / 3) + 0.2 * length;
    c1 = 0.4 * clamp01((digits + names) / 4) + 0.4 * clamp01(reflect.length / 3) + 0.2 * length;
  }
  const c2 = 0.5 * structure + 0.35 * clamp01(linkers.length / 6) + 0.15 * length;
  const c3 = 0.35 * clamp01((ttr - 0.35) / 0.25) + 0.25 * clamp01(complex.length / 5) + 0.2 * (avg >= 12 && avg <= 26 ? 1 : 0.4) + 0.2 * (simple.length >= 4 ? 0 : 1);

  // A response far under the length cannot score well, whatever else it does.
  const cap = length < 0.5 ? 0.45 : length < 0.8 ? 0.8 : 1;
  const raw = [c0, c1, c2, c3].map((v) => v * cap);
  const criteria = raw.map((v) => toScale(v, exam.max, exam.step));
  const overall = Math.round((criteria.reduce((a, b) => a + b, 0) / 4) / exam.step) * exam.step;

  const working: string[] = [];
  const improve: string[] = [];
  if (length >= 1) working.push(`You met the length target (${wc} words; aim for ${task.minWords}+).`);
  else improve.push(`You are ${task.minWords - wc} words under the ${task.minWords}-word target. A fuller answer scores higher.`);
  if (ps.length >= wantParas) working.push(`Clear paragraphing (${ps.length} paragraphs).`);
  else improve.push("Use clear paragraphs separated by a blank line: an introduction, developed body paragraphs, and a conclusion.");
  if (linkers.length >= 6) working.push(`A good range of linking words (for example ${linkers.slice(0, 3).join(", ")}).`);
  else improve.push("Connect your ideas with linking words such as however, therefore, for example, in contrast.");

  if (task.kind === "issue") {
    if (stance.length) working.push("You state a clear position."); else improve.push("State your position clearly in the first paragraph (for example: 'I agree, to a large extent, because ...').");
    if (evidence.length >= 3) working.push("You support points with examples and evidence."); else improve.push("Back each point with a specific example, fact or situation, not a general claim.");
  } else if (task.kind === "argument") {
    if (flaws.length >= 5) working.push("You look for flaws and unstated assumptions."); else improve.push("Name the assumptions behind the argument and say why each may be false (cause and effect, sample, missing comparison).");
    if (tests.length + evidence.length >= 3) working.push("You say what evidence would settle the question."); else improve.push("For each flaw, say what information you would need to test it.");
  } else if (task.kind === "analysis") {
    if (analysis.length >= 6) working.push("You use the language of analysis (how the author builds the argument)."); else improve.push("Explain how each technique works on the reader, using verbs such as emphasises, builds, contrasts, appeals to.");
    if (quotes >= 2) working.push("You refer to exact words from the text."); else improve.push("Quote or point to specific parts of the text to support your analysis.");
  } else {
    if (first >= 0.03) working.push("Your own voice comes through."); else improve.push("Write in the first person and let the reader hear you: what you thought, felt and decided.");
    if (digits + names >= 3 || reflect.length >= 3) working.push("You use concrete detail and reflection."); else improve.push("Replace general statements with one specific moment: names, numbers, places, what you learned.");
  }
  if (ttr < 0.42 && wc > 120) improve.push("You repeat words a lot. Vary your vocabulary and paraphrase.");
  if (simple.length >= 4) improve.push(`Replace vague words (${simple.slice(0, 3).join(", ")}) with precise ones.`);
  if (complex.length >= 5) working.push("Good sentence variety, with complex structures.");
  if (avg > 30) improve.push("Some sentences are very long. Split them to keep them clear and accurate.");
  if (!working.length) working.push("You have a full draft to work from. Improve it one criterion at a time.");

  return { overall, criteria, max: exam.max, wordCount: wc, paragraphs: ps.length, minWords: task.minWords, working, improve, note: NOTE };
}
