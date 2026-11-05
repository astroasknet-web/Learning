import fs from "node:fs";
import path from "node:path";

/**
 * Chapter-by-chapter study courses imported from Vidaara (content/lms/study/<course>/): CAT Quant, SAT Math, GRE Quant,
 * the four SSC CGL subjects and CTET. Built by scripts/import-vidaara-study.mjs. Plain text, no database.
 */
export const STUDY_KEYS = ["cat-quant", "sat-math", "gre-quant", "ssc-quant", "ssc-reasoning", "ssc-english", "ssc-gk", "ctet"] as const;
export type StudyKey = (typeof STUDY_KEYS)[number];

export interface StudyChapterRef { number: number; slug: string; title: string; topics: string[] }
export interface StudyModule { number: number; title: string; summary: string; chapters: StudyChapterRef[] }
export interface StudyIndex { key: StudyKey; title: string; kind: string; blurb: string; modules: StudyModule[] }
export interface Solved { problem: string; solution: string }
export interface Unsolved { problem: string; hints?: string[]; answer: string }
export interface StudyTopic { slug: string; name: string; details: string; solved: Solved[]; unsolved: Unsolved[] }
export interface StudyChapter {
  slug: string; title: string; domain: string; difficulty: string; weightage: string; intro: string;
  formulas: { title: string; items: { name: string; formula: string }[] }[];
  topics: StudyTopic[]; shortcuts: string[]; mistakes: string[]; pyq: string; flashcards: { q: string; a: string }[]; summary: string;
}

const ROOT = path.join(process.cwd(), "content", "lms", "study");
const cache = new Map<string, unknown>();
const safe = (s: string) => /^[a-z0-9-]+$/.test(s);

function read<T>(...parts: string[]): T | null {
  if (!parts.every(safe)) return null;
  const file = path.join(ROOT, ...parts.slice(0, -1), `${parts[parts.length - 1]}.json`);
  if (cache.has(file)) return cache.get(file) as T;
  try {
    const j = JSON.parse(fs.readFileSync(file, "utf8")) as T;
    cache.set(file, j);
    return j;
  } catch {
    return null;
  }
}

export const isStudyKey = (s: string): s is StudyKey => (STUDY_KEYS as readonly string[]).includes(s);
export const studyIndex = (key: string): StudyIndex | null => (isStudyKey(key) ? read<StudyIndex>(key, "index") : null);
export const studyChapter = (key: string, slug: string): StudyChapter | null => (isStudyKey(key) ? read<StudyChapter>(key, slug) : null);
export const allStudy = (): StudyIndex[] => STUDY_KEYS.map((k) => studyIndex(k)).filter((x): x is StudyIndex => x !== null);
export const chapterCount = (i: StudyIndex): number => i.modules.reduce((n, m) => n + m.chapters.length, 0);
export const flatChapters = (i: StudyIndex): StudyChapterRef[] => i.modules.flatMap((m) => m.chapters);
