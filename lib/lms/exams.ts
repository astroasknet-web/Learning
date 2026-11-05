import fs from "node:fs";
import path from "node:path";
import { render } from "./content";

/**
 * Full-length mock exams imported from Vidaara (content/lms/exams/<slug>.json): JEE Main, NEET UG, UPSC Prelims and SSC CGL.
 * Each file has the exam pattern, papers, strategy, syllabus and a question bank. No database is involved.
 */
export const EXAM_SLUGS = ["jee-mains", "neet-ug", "upsc-prelims", "ssc-cgl"] as const;
export type ExamSlug = (typeof EXAM_SLUGS)[number];

interface RawQ { paper?: string; section: string; type: string; topic?: string; q: string; options?: string[]; correct?: number; answer?: string | number; explanation?: string }
interface RawPaper { key: string; name: string; role: string; durationMin: number; totalQuestions: number; totalMarks: number; perQuestionMarks: number; perQuestionNeg: number; marking: string; sections: { name: string; questions: number }[] }
interface Raw {
  meta: { slug: string; name: string; fullName: string; category: string; level: string; authority: string; authorityUrl: string; tagline: string; blurb?: string };
  pattern: { durationMin: number; totalQuestions: number; totalMarks: number; negative: boolean; marking: string; perQuestionMarks?: number; perQuestionNeg?: number; sections: { name: string; questions: number; marks: number; note: string }[]; facts: { k: string; v: string }[] };
  papers?: RawPaper[];
  briefing: string;
  strategy: string[];
  subjects: { name: string; chapters: string[] }[];
  test: { title: string; questions: RawQ[] };
}

export interface ExamTest { key: string; name: string; role: string; minutes: number; questions: number; marks: number; perQ: number; neg: number; marking: string; note?: string }
export interface ExamDoc { slug: ExamSlug; raw: Raw; tests: ExamTest[] }

const ROOT = path.join(process.cwd(), "content", "lms", "exams");
const cache = new Map<string, ExamDoc>();

export const isExam = (s: string): s is ExamSlug => (EXAM_SLUGS as readonly string[]).includes(s);

export function loadExam(slug: string): ExamDoc | null {
  if (!isExam(slug)) return null;
  const hit = cache.get(slug);
  if (hit) return hit;
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(ROOT, `${slug}.json`), "utf8")) as Raw;
    const tests: ExamTest[] = raw.papers?.length
      ? raw.papers.map((p) => ({ key: p.key, name: p.name, role: p.role, minutes: p.durationMin, questions: p.totalQuestions, marks: p.totalMarks, perQ: p.perQuestionMarks, neg: p.perQuestionNeg, marking: p.marking, note: /qualifying/i.test(p.role) ? "This paper is qualifying: you need at least 33% to pass." : undefined }))
      : [{ key: "full", name: raw.test.title, role: "Full-length mock", minutes: raw.pattern.durationMin, questions: raw.pattern.totalQuestions, marks: raw.pattern.totalMarks, perQ: raw.pattern.perQuestionMarks ?? 1, neg: raw.pattern.perQuestionNeg ?? 0, marking: raw.pattern.marking }];
    const doc = { slug, raw, tests };
    cache.set(slug, doc);
    return doc;
  } catch {
    return null;
  }
}

export interface RenderedQ { q: string; options?: string[]; correct?: number; answer?: string; explanation: string; marks: number; neg: number; topic?: string; section?: string }
export interface RenderedSection { type: string; title: string; questions: RenderedQ[] }

/** The questions of one paper (or the whole mock), grouped by section and rendered to HTML. */
export function testSections(doc: ExamDoc, key: string): { test: ExamTest; sections: RenderedSection[] } | null {
  const test = doc.tests.find((t) => t.key === key);
  if (!test) return null;
  const qs = doc.raw.test.questions.filter((q) => (doc.raw.papers?.length ? q.paper === key : true));
  const order: string[] = [];
  const by = new Map<string, RenderedQ[]>();
  for (const q of qs) {
    if (!by.has(q.section)) { by.set(q.section, []); order.push(q.section); }
    by.get(q.section)!.push({ q: render(q.q), options: q.options?.map((o) => render(o)), correct: q.correct, answer: q.answer === undefined ? undefined : String(q.answer), explanation: render(q.explanation), marks: test.perQ, neg: test.neg, topic: q.topic, section: q.section });
  }
  return { test, sections: order.map((s) => ({ type: "mcq", title: s, questions: by.get(s)! })) };
}
