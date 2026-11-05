import { EXAM_PREP } from "@/lib/pay/course-fees";

/**
 * Which paid exam-preparation product a page belongs to. The free pages (the exam overview, the list of chapters) stay public; the notes, chapter tests and
 * mock tests behind them open only for a buyer of that exam (sku `course-exam-<key>`, see lib/pay/course-fees.ts).
 */
export type ExamKey = (typeof EXAM_PREP)[number]["key"];

export const examProduct = (key: string) => EXAM_PREP.find((e) => e.key === key) ?? null;
export const examByHub = (hub: string) => EXAM_PREP.find((e) => e.hub === hub) ?? null;

/** /learn/<exam>: JEE, NEET and AP Calculus AB. */
const LEARN: Record<string, ExamKey> = { jee: "jee", neet: "neet", "ap-calculus-ab": "ap-calculus" };
/** /exam/<slug>: the four full mock-test exams. */
const EXAM_SLUG: Record<string, ExamKey> = { "jee-mains": "jee", "neet-ug": "neet", "upsc-prelims": "upsc", "ssc-cgl": "ssc-cgl" };
/** /study/<course>: CAT, SAT, GRE and the four SSC courses. CTET is not part of the exam-prep range and stays free. */
const STUDY: Record<string, ExamKey> = { "cat-quant": "cat-quant", "sat-math": "sat-math", "gre-quant": "gre", "ssc-quant": "ssc-cgl", "ssc-reasoning": "ssc-cgl", "ssc-english": "ssc-cgl", "ssc-gk": "ssc-cgl" };

export const examForLearn = (slug: string): ExamKey | null => LEARN[slug] ?? null;
export const examForExamSlug = (slug: string): ExamKey | null => EXAM_SLUG[slug] ?? null;
export const examForStudy = (course: string): ExamKey | null => STUDY[course] ?? null;
export const examForIelts = (): ExamKey => "ielts";
