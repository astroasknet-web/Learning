import { isQType, isSkill, type Difficulty, type Format, type Mode, FORMATS, MODES, type QType, type SkillId } from "./taxonomy";

/** Authoring shape of a passage and its questions (what the seed files, the admin form and AI-assisted drafts all produce), and the validator all of them must pass. */
export interface QuestionDraft {
  ref: string;
  mode: Mode;
  format: Format;
  stem: string;
  /** mcq, tf, conclusion: the choices. match: { left, right }. short: unused. */
  options: string[] | { left: string[]; right: string[] };
  /** mcq/tf/conclusion: index of the correct option. match: for each left item, the index of its partner in right. short: accepted answers. */
  answer: number | number[] | string[];
  explanation: string;
  skill: SkillId;
  qtype: QType;
  difficulty: Difficulty;
  expectedSecs: number;
}

export interface PassageDraft {
  slug: string;
  title: string;
  body: string;
  topic: string;
  /** 1 (easy) to 5 (very demanding) */
  difficulty: number;
  /** 1 to 5: how specialised the vocabulary is */
  vocabLevel: number;
  levelKey: string | null;
  isDiagnostic: boolean;
  questions: QuestionDraft[];
}

export const wordsIn = (text: string): number => (text.trim().match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []).length;

/** Words that name a particular examination. They must never appear in anything a student reads as a learning category. */
const EXAM_LOWER = /\b(ielts|toefl|upsc|neet|jee|cbse|icse|cuet|clat|lsat|mcat|gmat|duolingo|cambridge english)\b/i;
/** Short names that are also ordinary words (sat, act, cat, gate) only count when written in capitals. */
const EXAM_UPPER = /\b(SAT|ACT|CAT|GATE|GRE|PTE)\b/;
export const EXAM_WORDS = { test: (s: string): boolean => EXAM_LOWER.test(s) || EXAM_UPPER.test(s) };

export interface Issue { level: "error" | "warning"; message: string }

/**
 * Structural checks a human reviewer should not have to do by hand. They cannot decide that a key is right (only a person can), so a passing
 * question still needs review before AI-drafted content is published; they do catch ambiguity that is visible without understanding the passage:
 * a key outside the options, duplicate options, an option repeated in the stem, a missing explanation, or a key that always sits in one place.
 */
export function validateQuestion(q: QuestionDraft, passageBody: string): Issue[] {
  const out: Issue[] = [];
  const err = (message: string) => out.push({ level: "error", message: `${q.ref}: ${message}` });
  const warn = (message: string) => out.push({ level: "warning", message: `${q.ref}: ${message}` });
  if (!FORMATS.includes(q.format)) err(`unknown format ${q.format}`);
  if (!MODES.includes(q.mode)) err(`unknown mode ${q.mode}`);
  if (!isSkill(q.skill)) err(`unknown skill ${q.skill}`);
  if (!isQType(q.qtype)) err(`unknown question type ${q.qtype}`);
  if (![1, 2, 3].includes(q.difficulty)) err("difficulty must be 1, 2 or 3");
  if (q.stem.trim().length < 12) err("the question text is too short");
  if (q.stem.length > 1100) err("the question text is too long");
  if (q.explanation.trim().length < 30) err("the explanation is missing or too short: it must say why the key is right and why a tempting option is not");
  if (!(q.expectedSecs >= 10 && q.expectedSecs <= 300)) err("expected time must be between 10 and 300 seconds");
  const texts = Array.isArray(q.options) ? q.options : [...q.options.left, ...q.options.right];
  if (EXAM_WORDS.test([q.stem, q.explanation, ...texts].join(" "))) err("mentions an examination by name");
  if (q.format === "mcq" || q.format === "conclusion" || q.format === "tf") {
    const o = q.options;
    if (!Array.isArray(o)) { err("options must be a list"); return out; }
    if (q.format === "tf" && o.length !== 3) err("a true/false question needs exactly three options (true, false, cannot be told from the passage)");
    if (q.format !== "tf" && (o.length < 3 || o.length > 5)) err("a multiple-choice question needs three to five options");
    if (typeof q.answer !== "number" || q.answer < 0 || q.answer >= o.length) err("the key is not one of the options");
    const norm = o.map((x) => x.trim().toLowerCase());
    if (new Set(norm).size !== norm.length) err("two options are identical");
    if (o.some((x) => !x.trim())) err("an option is empty");
    const lens = o.map((x) => x.length);
    if (typeof q.answer === "number" && q.format !== "tf" && lens[q.answer] > 1.8 * (lens.reduce((a, b) => a + b, 0) / lens.length) && lens.length > 1) warn("the key is much longer than the other options, which can give it away");
  } else if (q.format === "match") {
    const o = q.options;
    if (Array.isArray(o)) { err("a match question needs left and right lists"); return out; }
    if (o.left.length < 3 || o.left.length !== o.right.length) err("a match question needs equal lists of at least three items");
    const a = q.answer;
    if (!Array.isArray(a) || a.length !== o.left.length || a.some((x) => typeof x !== "number" || x < 0 || x >= o.right.length) || new Set(a as number[]).size !== a.length) err("the match key must pair every left item with a different right item");
  } else if (q.format === "short") {
    const a = q.answer;
    if (!Array.isArray(a) || !a.length || a.some((x) => typeof x !== "string" || !x.trim())) err("a short-answer question needs at least one accepted answer");
    else if (a.length > 6) warn("many accepted answers: check the question is not ambiguous");
    else if ((a as string[]).some((x) => !passageBody.toLowerCase().includes(String(x).toLowerCase().replace(/^(the|a|an) /, ""))) && q.mode !== "recall") warn("an accepted answer does not appear in the passage: confirm it is answerable from the text");
  }
  return out;
}

export function validatePassage(p: PassageDraft): Issue[] {
  const out: Issue[] = [];
  const err = (message: string) => out.push({ level: "error", message: `${p.slug}: ${message}` });
  const n = wordsIn(p.body);
  if (!/^[a-z0-9-]{3,60}$/.test(p.slug)) err("slug must be lower-case letters, digits and hyphens");
  if (p.title.trim().length < 3) err("title is missing");
  if (n < 60) err(`passage has only ${n} words`);
  if (n > 1200) err(`passage has ${n} words, which is more than the reading screen is designed for`);
  if (!(p.difficulty >= 1 && p.difficulty <= 5)) err("difficulty must be 1 to 5");
  if (EXAM_WORDS.test(`${p.title} ${p.body}`)) err("mentions an examination by name");
  const refs = new Set<string>();
  for (const q of p.questions) { if (refs.has(q.ref)) err(`duplicate question reference ${q.ref}`); refs.add(q.ref); out.push(...validateQuestion(q, p.body)); }
  if (!p.questions.length) err("no questions");
  return out;
}

/** The share of single-answer questions whose key is each position: a bank where every key is "B" is a bank that can be gamed. */
export function keyDistribution(qs: QuestionDraft[]): number[] {
  const counts = [0, 0, 0, 0, 0];
  for (const q of qs) if ((q.format === "mcq" || q.format === "conclusion") && typeof q.answer === "number") counts[q.answer]++;
  return counts;
}
