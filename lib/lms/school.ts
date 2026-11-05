import fs from "node:fs";
import path from "node:path";

/**
 * School courses (Class 1 to 12) and Maths Olympiad (IMO) imported from Vidaara: content/lms/school/class-N/<subject>/.
 * Built by scripts/import-vidaara-school.mjs. No database; test scores stay in the browser.
 */
export interface SQ { q: string; options: string[]; correct: number; explanation: string; section?: string; difficulty?: string; diagram?: string }
export interface STest { title: string; minutes: number; questions: SQ[] }
export interface SExample { number: number; problem: string; solution: string; answer?: string }
export interface SSection { type: string; heading: string; content: string; items?: string[]; points?: string[] }
export interface STopic { title: string; concept: string; visual: string | null; examples: SExample[]; recap: string[]; quiz: SQ[]; sections?: SSection[]; wonder?: { text: string; qa: { q: string; a: string }[] } }
export interface SChapter { number: number; title: string; slug: string; color: string; level: string; estTime: string; description: string; topics: STopic[]; tests: { online?: STest; imo?: STest }; english?: Record<string, unknown> }
export interface SChapterRef { number: number; title: string; slug: string; color: string; topics: string[]; online: number; imo: number }
export interface FullTest { time_limit_minutes?: number; blueprint?: Record<string, number>; marks?: Record<string, number> }
export interface SSubject { class: string; subject: string; label: string; description: string; chapters: SChapterRef[]; fullTest?: FullTest }

const ROOT = path.join(process.cwd(), "content", "lms", "school");
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

export const CLASSES = Array.from({ length: 12 }, (_, i) => `class-${i + 1}`);
export const isClass = (c: string): boolean => CLASSES.includes(c);
export const classNumber = (c: string): number => Number(c.replace("class-", ""));

const ORDER = ["mathematics", "science", "physics", "chemistry", "biology", "english", "accountancy", "economics", "imo"];
export function subjectsOfClass(cls: string): SSubject[] {
  if (!isClass(cls)) return [];
  let dirs: string[] = [];
  try { dirs = fs.readdirSync(path.join(ROOT, cls)).filter(safe); } catch { return []; }
  return dirs.sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b)).map((s) => subject(cls, s)).filter((x): x is SSubject => x !== null);
}
export const subject = (cls: string, sub: string): SSubject | null => (isClass(cls) ? read<SSubject>(cls, sub, "index") : null);
export const chapter = (cls: string, sub: string, slug: string): SChapter | null => {
  const s = subject(cls, sub);
  return s && s.chapters.some((c) => c.slug === slug) ? read<SChapter>(cls, sub, slug) : null;
};

/* ---------- Olympiad ---------- */
export const IMO_SECTIONS: { key: string; label: string }[] = [
  { key: "logical-reasoning", label: "Logical Reasoning" },
  { key: "mathematical-reasoning", label: "Mathematical Reasoning" },
  { key: "everyday-math", label: "Everyday Mathematics" },
  { key: "achievers", label: "Achievers Section" },
];
export const sectionLabel = (k: string): string => IMO_SECTIONS.find((s) => s.key === k)?.label ?? k;

function shuffle<T>(a: T[]): T[] {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
}

/** A fresh full-syllabus Olympiad mock: every chapter's questions pooled by section, then sampled to the class blueprint. */
export function assembleImoMock(cls: string): { minutes: number; marks: Record<string, number>; questions: SQ[] } | null {
  const sub = subject(cls, "imo");
  if (!sub) return null;
  const ft = sub.fullTest ?? {};
  const blueprint = ft.blueprint ?? { "logical-reasoning": 10, "mathematical-reasoning": 10, "everyday-math": 10, achievers: 5 };
  const pool: Record<string, SQ[]> = {};
  for (const ref of sub.chapters) {
    const c = chapter(cls, "imo", ref.slug);
    if (!c) continue;
    const add = (q: SQ) => { const s = q.section || "mathematical-reasoning"; (pool[s] ??= []).push(q); };
    c.tests.online?.questions.forEach(add);
    c.tests.imo?.questions.forEach(add);
    c.topics.forEach((t) => t.quiz.forEach(add));
  }
  const out: SQ[] = [];
  for (const [section, want] of Object.entries(blueprint)) {
    let bucket = (pool[section] ?? []).slice();
    if (section === "achievers" && bucket.length < want) bucket = bucket.concat(Object.values(pool).flat().filter((q) => q.difficulty === "hard" && q.section !== "achievers"));
    shuffle(bucket).slice(0, want).forEach((q) => out.push({ ...q, section }));
  }
  return { minutes: ft.time_limit_minutes ?? 40, marks: ft.marks ?? { default: 1, achievers: 3 }, questions: out };
}
