import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * GRE Quantitative Reasoning practice tests built from the Vidaara GRE question bank (1,040 questions, 26 topics x 40).
 * Mock n takes one question from every topic plus a rotating extra, so a mock covers the whole syllabus and the 30 mocks never share
 * a question. The answer key stays on the server; the browser receives question text and options only.
 *
 * The scaled score (130-170) is a straight-line ESTIMATE from the percentage correct. ETS does not publish its conversion and the real
 * section is adaptive, so treat it as a rough guide, never a prediction.
 */
export const EXAM = "gre-quant";
export const TOTAL_TESTS = 30;
export const QUESTIONS = 27;
export const MINUTES = 47;
const LABELS = ["A", "B", "C", "D"];

export interface Bank { id: number; topic: string; topicName: string; section: string; difficulty: string; q: string; options: string[]; correct: number; explain: string }
export interface PublicQ { id: number; q: string; options: string[] }

let bank: Bank[] | null = null;
export function loadBank(): Bank[] {
  if (bank) return bank;
  try {
    bank = JSON.parse(readFileSync(path.join(process.cwd(), "lib", "tests", "data", "gre-quant.json"), "utf8")) as Bank[];
  } catch {
    bank = [];
  }
  return bank;
}

export const validNumber = (n: number): boolean => Number.isInteger(n) && n >= 1 && n <= TOTAL_TESTS;

/** Small deterministic PRNG so every visitor sees the same questions in mock n. */
function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}
function shuffle<T>(a: T[], r: () => number): T[] {
  const o = [...a];
  for (let i = o.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [o[i], o[j]] = [o[j], o[i]];
  }
  return o;
}

/** The questions of mock n, in a fixed shuffled order. */
export function mock(n: number): Bank[] {
  if (!validNumber(n)) return [];
  const byTopic = new Map<string, Bank[]>();
  for (const q of loadBank()) byTopic.set(q.topic, [...(byTopic.get(q.topic) ?? []), q]);
  const topics = [...byTopic.keys()].sort();
  const lists = topics.map((t, i) => shuffle(byTopic.get(t)!, rng(1000 + i)));
  const picked: Bank[] = [];
  for (const l of lists) if (l[n - 1]) picked.push(l[n - 1]);
  const extraTopic = (n - 1) % lists.length;
  const extra = lists[extraTopic]?.[30 + Math.floor((n - 1) / lists.length)];
  if (extra) picked.push(extra);
  return shuffle(picked, rng(7000 + n)).slice(0, QUESTIONS);
}

export const publicView = (qs: Bank[]): PublicQ[] => qs.map((q) => ({ id: q.id, q: q.q, options: q.options }));

export interface GreRow { id: number; position: number; q: string; options: string[]; picked: number | null; correct: number; right: boolean; explain: string; topic: string }
export interface GreGraded { raw: number; total: number; percent: number; scaled: number; rows: GreRow[]; byTopic: Array<{ topic: string; correct: number; total: number }> }

export const label = (i: number | null): string => (i === null ? "No answer" : LABELS[i] ?? "?");

/** Grade by question id from the stored key; ids that are not in this mock are ignored, so a tampered form cannot score extra marks. */
export function grade(n: number, answers: Record<string, number>): GreGraded {
  const qs = mock(n);
  const rows: GreRow[] = qs.map((q, i) => {
    const p = answers[String(q.id)];
    const picked = Number.isInteger(p) && p >= 0 && p < 4 ? p : null;
    return { id: q.id, position: i + 1, q: q.q, options: q.options, picked, correct: q.correct, right: picked === q.correct, explain: q.explain, topic: q.topicName };
  });
  const raw = rows.filter((r) => r.right).length;
  const total = rows.length;
  const percent = total ? Math.round((raw / total) * 100) : 0;
  const t = new Map<string, { correct: number; total: number }>();
  for (const r of rows) {
    const b = t.get(r.topic) ?? { correct: 0, total: 0 };
    b.total++;
    if (r.right) b.correct++;
    t.set(r.topic, b);
  }
  return { raw, total, percent, scaled: 130 + Math.round((total ? raw / total : 0) * 40), rows, byTopic: [...t].map(([topic, v]) => ({ topic, ...v })) };
}

export function encodeAnswers(a: Record<string, number>): string {
  const slim: Record<string, number> = {};
  for (const [k, v] of Object.entries(a)) if (/^\d{1,5}$/.test(k) && Number.isInteger(v) && v >= 0 && v < 4) slim[k] = v;
  return Buffer.from(JSON.stringify(slim)).toString("base64url");
}
export function decodeAnswers(s: string | undefined): Record<string, number> {
  if (!s || s.length > 3000) return {};
  try {
    const o = JSON.parse(Buffer.from(s, "base64url").toString("utf8"));
    const out: Record<string, number> = {};
    if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) if (/^\d{1,5}$/.test(k) && typeof v === "number" && Number.isInteger(v) && v >= 0 && v < 4) out[k] = v;
    return out;
  } catch {
    return {};
  }
}
