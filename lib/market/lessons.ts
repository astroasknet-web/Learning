import dl from "./data/lessons/digital-literacy.json";
import ds from "./data/lessons/data-science-python.json";
import da from "./data/lessons/data-analytics-python.json";
import hc from "./data/lessons/html-css.json";
import bbaFa from "./data/lessons/bba-financial-accounting.json";
import { NEW_LESSONS } from "./new-lessons";

/**
 * Native lessons: the courses GrowQR teaches itself (ported from Vidaara by scripts/build-lessons.mjs). A catalogue course with an entry
 * here gets a lesson player at /courses/<slug>/learn; every other course shows "Lessons coming soon". Progress reuses the
 * existing checkpoints (one per module + the project), so enrolment, My courses and Skill Passport tiers need no change.
 */
export interface Quiz { pass: number; questions: Array<{ text: string; options: string[]; correct: number; explanation: string }> }
export interface Topic { title: string; slug: string; html: string; keyPoints: string[] }
export interface LessonModule {
  num: number; slug: string; title: string; hours: number; level: string; summary: string; outcome: string; intro: string;
  seoTitle?: string; topics: Topic[]; practical: { title: string; intro: string; steps: string[] } | null; quiz: Quiz | null; track?: string;
}
export interface Capstone { slug: string; title: string; summary: string; intro: string; steps: string[]; projectTitle: string; quiz: Quiz | null }
/** Optional marketing and SEO content for a course landing page (university programmes use it; the older courses do not). */
export interface Landing {
  outcomes: Array<{ id: string; text: string }>;
  audience: string[]; prerequisites: string[];
  alignment: Array<{ university: string; code: string; title: string; semester: number; scheme: string; source: string }>;
  alignmentNote: string;
  faqs: Array<{ q: string; a: string }>;
  glossary: Array<{ term: string; definition: string }>;
  references: Array<{ name: string; url: string; use: string }>; textbooks: string[];
  shortTitle: string; author: { name: string; publisher: string }; updated: string; version: string; status: string;
  seo: { title: string; description: string; keywords: string[]; focus: string };
  stats: { lessons: number; examples: number; quizQuestions: number; numericals: number; glossary: number };
}
export interface NativeCourse { key: string; title: string; tagline: string; level: string; hours: number; summary: string; modules: LessonModule[]; capstone: Capstone; landing?: Landing }

/** Catalogue slug -> lesson file. */
const NATIVE: Record<string, NativeCourse> = {
  "digital-literacy-master": dl as unknown as NativeCourse,
  "data-science-python": ds as unknown as NativeCourse,
  "data-analytics-python": da as unknown as NativeCourse,
  "html-css-academy": hc as unknown as NativeCourse,
  "bba-financial-accounting": bbaFa as unknown as NativeCourse,
};

const has = (o: object, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k);
const loaded = new Map<string, NativeCourse>();

export const isNative = (slug: string): boolean => has(NATIVE, slug) || has(NEW_LESSONS, slug);
export const nativeCourse = (slug: string): NativeCourse | null => {
  if (has(NATIVE, slug)) return NATIVE[slug];
  if (!has(NEW_LESSONS, slug)) return null;
  let c = loaded.get(slug); // the newer courses are read from disk on first use
  if (!c) { c = NEW_LESSONS[slug]() as NativeCourse; loaded.set(slug, c); }
  return c;
};
export const nativeSlugs = (): string[] => [...Object.keys(NATIVE), ...Object.keys(NEW_LESSONS)];

/** A step in the player: checkpoint index i is module i, and the capstone is checkpoint modules.length. */
export function stepFor(c: NativeCourse, key: string): { index: number; module: LessonModule | null; capstone: boolean } | null {
  if (key === "capstone") return { index: c.modules.length, module: null, capstone: true };
  const index = c.modules.findIndex((m) => m.slug === key);
  return index < 0 ? null : { index, module: c.modules[index], capstone: false };
}

/** Strip anything executable from lesson HTML. The source is our own content, this is defence in depth. */
export function cleanHtml(html: string): string {
  return html
    .replace(/<(\/?)h4\b/gi, "<$1h3") // lessons sit under an h2: an h4 would skip a heading level
    .replace(/<\s*(script|iframe|object|embed|style|link|meta|base|form)\b[\s\S]*?(<\s*\/\s*\1\s*>|$)/gi, "")
    .replace(/<\s*(script|iframe|object|embed|style|link|meta|base|form)\b[^>]*>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src|xlink:href)\s*=\s*("|')\s*(javascript|data|vbscript):[^"']*\2/gi, '$1=$2#$2');
}

export interface QuizResult { score: number; total: number; percent: number; passed: boolean; review: Array<{ text: string; picked: number | null; correct: number; right: boolean; explanation: string; options: string[] }> }

/** Grade on the server from the stored answer key; the client never sends or sees a score it could forge. */
export function gradeQuiz(quiz: Quiz, picked: Array<number | null>): QuizResult {
  const review = quiz.questions.map((q, i) => {
    const p = picked[i];
    const pick = typeof p === "number" && Number.isInteger(p) && p >= 0 && p < q.options.length ? p : null;
    return { text: q.text, picked: pick, correct: q.correct, right: pick === q.correct, explanation: q.explanation, options: q.options };
  });
  const score = review.filter((r) => r.right).length;
  const total = review.length;
  const percent = total ? Math.round((score / total) * 100) : 0;
  return { score, total, percent, passed: total > 0 && percent >= quiz.pass, review };
}
