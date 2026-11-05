import fs from "node:fs";
import path from "node:path";
import katex from "katex";
import { cleanHtml } from "@/lib/market/lessons";

/**
 * Free exam-prep courses imported from Vidaara (content/lms/<exam>/<subject>/*.json).
 * Chapters hold modules > topics (concept, worked examples, quick quiz) and timed mock tests.
 * Everything is read from the files, so no database is needed. Math written as $...$ is rendered with KaTeX on the server.
 */

export type ExamKey = "jee" | "neet" | "ap-calculus-ab";
export interface ExamDef { slug: ExamKey; dir: string; title: string; kind: string; subjects: string[] }

export const EXAMS: ExamDef[] = [
  { slug: "jee", dir: "jee", title: "JEE Main & Advanced", kind: "Engineering entrance", subjects: ["mathematics", "physics", "chemistry"] },
  { slug: "neet", dir: "neet", title: "NEET UG", kind: "Medical entrance", subjects: ["physics", "chemistry", "biology"] },
  { slug: "ap-calculus-ab", dir: "ap", title: "AP Calculus AB", kind: "Advanced Placement", subjects: ["calculus-ab"] },
];

export const exam = (slug: string): ExamDef | null => EXAMS.find((e) => e.slug === slug) ?? null;

const ROOT = path.join(process.cwd(), "content", "lms");
const safe = (s: string) => /^[a-z0-9-]+$/.test(s);
const cache = new Map<string, unknown>();

function readJson<T>(...parts: string[]): T | null {
  if (!parts.every((p) => safe(p.replace(/\.json$/, "")))) return null;
  const file = path.join(ROOT, ...parts);
  if (cache.has(file)) return cache.get(file) as T;
  try {
    const j = JSON.parse(fs.readFileSync(file, "utf8")) as T;
    cache.set(file, j);
    return j;
  } catch {
    return null;
  }
}

export interface ChapterRef { number: number; title: string; slug: string; color: string; tagline: string; modules: number; topics_count: number; examples_count: number; quiz_count: number; mock_tests: number; file: string }
export interface SubjectIndex { exam: string; subject: string; subject_label: string; exam_label: string; blurb?: string; chapters: ChapterRef[] }

export interface QuizQ { q: string; options: string[]; correct: number; explanation: string }
export interface Example { number: number; problem: string; solution: string }
export interface Topic { number: number; title: string; concept: string; visual: string | null; examples: Example[]; quiz: QuizQ[]; note: string | null }
export interface Module { number: number; title: string; topics: Topic[] }
export interface MockQuestion { q: string; options?: string[]; correct?: number; answer?: string; explanation: string }
export interface MockSection { type: "mcq" | "integer" | "assertion" | "assertion-reason"; title: string; questions: MockQuestion[] }
export interface MockTest { id: string; title: string; level: string; time_limit_minutes: number; total: number; sections: MockSection[]; note?: string | { [k: string]: unknown } | null }
export interface Chapter { exam: string; subject: string; chapter: number; title: string; slug: string; subtitle: string; level: string; color: string; modules: Module[]; mock_tests: MockTest[]; seo?: { meta_description?: string } }

export function subjectIndex(ex: ExamDef, subject: string): SubjectIndex | null {
  if (!ex.subjects.includes(subject)) return null;
  return readJson<SubjectIndex>(ex.dir, subject, "index.json");
}

export function chapter(ex: ExamDef, subject: string, slug: string): Chapter | null {
  const idx = subjectIndex(ex, subject);
  const ref = idx?.chapters.find((c) => c.slug === slug);
  if (!ref) return null;
  return readJson<Chapter>(ex.dir, subject, ref.file);
}

export const subjectsOf = (ex: ExamDef): SubjectIndex[] => ex.subjects.map((s) => subjectIndex(ex, s)).filter((x): x is SubjectIndex => x !== null);
export const totalChapters = (ex: ExamDef): number => subjectsOf(ex).reduce((n, s) => n + s.chapters.length, 0);

/* ---------- rendering ---------- */
const decode = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'");

function tex(src: string, display: boolean): string {
  try {
    return katex.renderToString(decode(src).trim(), { displayMode: display, throwOnError: false, strict: "ignore", trust: false });
  } catch {
    return src;
  }
}

/** Sanitise the HTML first, then turn $...$ and $$...$$ into KaTeX markup. */
export function render(html: string | null | undefined): string {
  if (!html) return "";
  return cleanHtml(html).replace(/\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|\$([^$\n]+?)\$/g, (_m, d: string | undefined, b: string | undefined, p: string | undefined, i: string | undefined) => (d !== undefined ? tex(d, true) : b !== undefined ? tex(b, true) : tex(p ?? i ?? "", false)));
}

/** Plain-text version of a short HTML string, for titles and descriptions. */
export const plain = (html: string): string => decode(html.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
