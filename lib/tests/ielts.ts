import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * IELTS Academic Reading and Listening practice tests (ported from Vidaara). The test files hold the answer keys, so the browser only ever
 * receives publicView(): prompts and options with every answer, accepted spelling, explanation and passage location removed. Grading
 * happens here, on the server, from the stored key. Bands are indicative (raw-score tables vary a little between real test versions).
 */
export type Kind = "reading" | "listening";
export const KINDS: Kind[] = ["reading", "listening"];
export const TOTAL_TESTS = 30;
export const QUESTIONS = 40;
export const MINUTES: Record<Kind, number> = { reading: 60, listening: 40 };

export interface Opt { label: string; text: string }
export interface Q { n: number; prompt: string; answer?: string; accept?: string[]; explain?: string; location?: string; options?: Opt[] }
export interface Group { passage?: number; type: string; range: string; instructions: string; headings?: Opt[]; options?: Opt[]; plan?: string; wordLimit?: string; questions: Q[] }
export interface Speaker { id: string; name: string; gender: string }
export interface Section { n: number; title: string; context: string; speakers: Speaker[]; transcript: Array<{ s: string; text: string }>; questionGroups: Group[] }
export interface Passage { n: number; title: string; difficulty: string; paragraphs: Array<{ label: string; html: string }> }
export interface Test { id: number; slug: string; title: string; level: string; topics: string[]; passages?: Passage[]; questionGroups?: Group[]; sections?: Section[] }

const DIR = path.join(process.cwd(), "lib", "tests", "data");
const cache = new Map<string, Test | null>();

export const isKind = (k: string): k is Kind => k === "reading" || k === "listening";
export const validNumber = (n: number): boolean => Number.isInteger(n) && n >= 1 && n <= TOTAL_TESTS;

export function load(kind: Kind, n: number): Test | null {
  if (!validNumber(n)) return null;
  const key = `${kind}-${n}`;
  if (cache.has(key)) return cache.get(key) ?? null;
  let t: Test | null = null;
  try {
    t = JSON.parse(readFileSync(path.join(DIR, `ielts-${kind}`, `${String(n).padStart(2, "0")}.json`), "utf8")) as Test;
  } catch {
    t = null;
  }
  cache.set(key, t);
  return t;
}

export function groupsOf(t: Test): Array<Group & { section?: number }> {
  if (t.sections) return t.sections.flatMap((s) => s.questionGroups.map((g) => ({ ...g, section: s.n })));
  return t.questionGroups ?? [];
}

interface FlatQ extends Q { type: string; passage?: number; section?: number; headings?: Opt[] }
export function allQuestions(t: Test): FlatQ[] {
  const out: FlatQ[] = [];
  for (const g of groupsOf(t)) for (const q of g.questions) out.push({ ...q, type: g.type, passage: g.passage, section: g.section, options: q.options ?? g.options, headings: g.headings });
  return out.sort((a, b) => a.n - b.n);
}

export function list(kind: Kind): Array<{ n: number; title: string; level: string; topics: string[] }> {
  const out = [];
  for (let n = 1; n <= TOTAL_TESTS; n++) {
    const t = load(kind, n);
    if (t) out.push({ n, title: t.title, level: t.level, topics: t.topics ?? [] });
  }
  return out;
}

const strip = (q: Q): Q => ({ n: q.n, prompt: q.prompt, ...(q.options ? { options: q.options } : {}) });
const stripGroup = (g: Group): Group => ({ ...g, questions: g.questions.map(strip) });

/** Everything the test taker may see before submitting: no answers, accepted spellings, explanations or locations. */
export function publicView(t: Test): Test {
  return {
    ...t,
    questionGroups: t.questionGroups?.map(stripGroup),
    sections: t.sections?.map((s) => ({ ...s, transcript: [], questionGroups: s.questionGroups.map(stripGroup) })),
  };
}

/** The spoken script per section, for the audio player (the answers are in it, so it only ships with the Listening runner). */
export function scriptOf(t: Test): Array<{ n: number; speakers: Speaker[]; lines: Array<{ s: string; text: string }> }> {
  return (t.sections ?? []).map((s) => ({ n: s.n, speakers: s.speakers, lines: s.transcript }));
}

// Indicative raw-score to band tables (40 questions).
const READING: Array<[number, number]> = [[39, 9], [37, 8.5], [35, 8], [33, 7.5], [30, 7], [27, 6.5], [23, 6], [19, 5.5], [15, 5], [13, 4.5], [10, 4], [8, 3.5], [6, 3], [4, 2.5]];
const LISTENING: Array<[number, number]> = [[39, 9], [37, 8.5], [35, 8], [32, 7.5], [30, 7], [26, 6.5], [23, 6], [18, 5.5], [16, 5], [13, 4.5], [10, 4], [8, 3.5], [6, 3], [4, 2.5]];
export function rawToBand(kind: Kind, raw: number): number {
  const r = Math.max(0, Math.min(QUESTIONS, Math.trunc(raw)));
  return (kind === "reading" ? READING : LISTENING).find(([min]) => r >= min)?.[1] ?? 2;
}

export const normText = (s: unknown): string =>
  String(s ?? "").toLowerCase().replace(/[‘’']/g, "'").replace(/[£$€]/g, "").replace(/[.,;:!?"()[\]/]/g, " ").replace(/\s+/g, " ").trim();
export const normLabel = (s: unknown): string => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

export interface Row { n: number; group: number; type: string; right: boolean; your: string | null; correct: string; explain: string; location: string }
export interface Graded { raw: number; total: number; band: number; bySection: Record<number, { correct: number; total: number }>; rows: Row[] }

function correctText(q: FlatQ): string {
  if (q.type === "matching-headings") {
    const h = (q.headings ?? []).find((x) => normLabel(x.label) === normLabel(q.answer));
    return h ? `${h.label}) ${h.text}` : String(q.answer);
  }
  if (q.type === "mcq" || q.type === "matching") {
    const o = (q.options ?? []).find((x) => normLabel(x.label) === normLabel(q.answer));
    return o ? `${o.label}) ${o.text}` : String(q.answer);
  }
  if (q.type === "completion") return (q.accept?.length ? q.accept : [q.answer]).filter(Boolean).join(" / ");
  return String(q.answer);
}

/** Grade a submission. answers maps question number to what the taker typed or picked; anything missing counts as unanswered. */
export function grade(kind: Kind, t: Test, answers: Record<string, string>): Graded {
  const rows: Row[] = allQuestions(t).map((q) => {
    const raw = answers[String(q.n)];
    const your = raw == null || String(raw).trim() === "" ? null : String(raw).trim().slice(0, 120);
    let right = false;
    if (your !== null) {
      if (q.type === "completion") right = (q.accept?.length ? q.accept : [q.answer]).map(normText).filter(Boolean).includes(normText(your));
      else right = normLabel(your) !== "" && normLabel(your) === normLabel(q.answer);
    }
    return { n: q.n, group: q.passage ?? q.section ?? 0, type: q.type, right, your, correct: correctText(q), explain: q.explain ?? "", location: q.location ?? "" };
  });
  const raw = rows.filter((r) => r.right).length;
  const bySection: Graded["bySection"] = {};
  for (const r of rows) {
    const b = (bySection[r.group] ??= { correct: 0, total: 0 });
    b.total++;
    if (r.right) b.correct++;
  }
  return { raw, total: rows.length, band: rawToBand(kind, raw), bySection, rows };
}

/** Answers travel in the result URL as base64url JSON so the result page is stateless and shareable; keep them bounded. */
export function encodeAnswers(a: Record<string, string>): string {
  const slim: Record<string, string> = {};
  for (const [k, v] of Object.entries(a)) if (/^\d{1,2}$/.test(k) && v.trim() !== "") slim[k] = v.trim().slice(0, 80);
  return Buffer.from(JSON.stringify(slim)).toString("base64url");
}
export function decodeAnswers(s: string | undefined): Record<string, string> {
  if (!s || s.length > 6000) return {};
  try {
    const o = JSON.parse(Buffer.from(s, "base64url").toString("utf8"));
    const out: Record<string, string> = {};
    if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) if (/^\d{1,2}$/.test(k) && typeof v === "string") out[k] = v.slice(0, 80);
    return out;
  } catch {
    return {};
  }
}
