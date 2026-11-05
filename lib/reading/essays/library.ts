import "server-only";
import { first, pool, rows, type Db } from "../../pay/db";
import { hasTrack } from "../access";
import { ensureSeed, getConfig } from "../store";
import { SKILLS, type SkillId } from "../taxonomy";
import { ESSAY_META, THEMES, type Exam } from "./meta";

/** What the Reading Tests pages show: the 30 tests, who they suit, what they train, and how this student has done. */
export interface EssayCard {
  n: number; slug: string; title: string; words: number; questions: number; theme: string; themeName: string; hue: string; exams: Exam[]; difficulty: number; minutes: number;
  free: boolean; locked: boolean; attempts: number; best: number | null; lastId: string | null;
  skills: Array<{ skill: SkillId; label: string; n: number }>;
}

export async function essayCards(userId: number | null, db: Db = pool): Promise<{ cards: EssayCard[]; premium: boolean }> {
  await ensureSeed();
  const [cfg, premium] = await Promise.all([getConfig(db), userId === null ? Promise.resolve(false) : hasTrack(userId, "indian")]);
  const ps = await rows(db, "SELECT id, slug, title, word_count, ext_no FROM rd_passages WHERE collection = 'exam' AND status = 'approved' ORDER BY ext_no");
  const mix = new Map<number, Map<string, number>>();
  for (const r of await rows(db, "SELECT q.passage_id, q.skill, COUNT(*) AS n FROM rd_questions q JOIN rd_passages p ON p.id = q.passage_id WHERE p.collection = 'exam' AND q.status = 'approved' GROUP BY q.passage_id, q.skill")) {
    const m = mix.get(Number(r.passage_id)) ?? new Map<string, number>();
    m.set(r.skill, Number(r.n)); mix.set(Number(r.passage_id), m);
  }
  const qn = new Map((await rows(db, "SELECT q.passage_id, COUNT(*) AS n FROM rd_questions q WHERE q.status = 'approved' GROUP BY q.passage_id")).map((r) => [Number(r.passage_id), Number(r.n)]));
  const done = new Map<number, { attempts: number; best: number | null; lastId: string | null }>();
  if (userId !== null) {
    for (const r of await rows(db, "SELECT public_id, focus_skill, overall_score, completion FROM rd_assessments WHERE user_id = $1 AND kind = 'essay' AND status = 'submitted' ORDER BY submitted_at ASC, id ASC", [userId])) {
      const n = Number(String(r.focus_skill ?? "").replace("essay-", ""));
      if (!Number.isInteger(n)) continue;
      const d = done.get(n) ?? { attempts: 0, best: null, lastId: null };
      d.attempts++; d.lastId = r.public_id;
      if (r.completion === "complete" && r.overall_score !== null) d.best = Math.max(d.best ?? 0, Number(r.overall_score));
      done.set(n, d);
    }
  }
  const cards = ps.map((p) => {
    const n = Number(p.ext_no);
    const meta = ESSAY_META.find((m) => m.n === n);
    const theme = THEMES.find((t) => t.id === meta?.theme) ?? THEMES[0];
    const free = cfg.freeEssays.includes(n);
    const d = done.get(n);
    return {
      n, slug: p.slug, title: p.title, words: Number(p.word_count), questions: qn.get(Number(p.id)) ?? 0, theme: theme.id, themeName: theme.name, hue: theme.hue,
      exams: [...(meta?.exams ?? [])] as Exam[], difficulty: meta?.difficulty ?? 3, minutes: meta?.minutes ?? 25, free, locked: !free && !premium,
      attempts: d?.attempts ?? 0, best: d?.best ?? null, lastId: d?.lastId ?? null,
      skills: [...(mix.get(Number(p.id)) ?? new Map())].map(([skill, count]) => ({ skill: skill as SkillId, label: SKILLS[skill as SkillId]?.label ?? skill, n: count })).sort((a, b) => b.n - a.n),
    } satisfies EssayCard;
  });
  return { cards, premium };
}

export interface EssayDetail { card: EssayCard; preview: string; sample: { stem: string; options: string[] } | null; lastIdea: string }

/** The public face of one test: a short preview of the essay and the first question (without its answer). The full essay is for signed-in students who may take it. */
export async function essayDetail(n: number, userId: number | null, db: Db = pool): Promise<EssayDetail | null> {
  const { cards } = await essayCards(userId, db);
  const card = cards.find((c) => c.n === n);
  if (!card) return null;
  const p = await first(db, "SELECT id, body FROM rd_passages WHERE collection = 'exam' AND ext_no = $1", [n]);
  const q = p ? await first(db, "SELECT stem, options_json FROM rd_questions WHERE passage_id = $1 AND status = 'approved' ORDER BY position, id LIMIT 1", [p.id]) : null;
  const first150 = String(p?.body ?? "").split(/\s+/).slice(0, 110).join(" ");
  return { card, preview: `${first150}…`, sample: q ? { stem: q.stem, options: JSON.parse(q.options_json) } : null, lastIdea: "" };
}

/** One question from a free test, with its key, for the public "try it" demo (a free sample, never from the paid tests). */
export async function sampleQuestion(n: number, which = 0, db: Db = pool): Promise<{ test: number; title: string; stem: string; options: string[]; answer: number; explanation: string } | null> {
  await ensureSeed();
  const p = await first(db, "SELECT id, title FROM rd_passages WHERE collection = 'exam' AND ext_no = $1", [n]);
  if (!p) return null;
  const qs = await rows(db, "SELECT stem, options_json, answer_json, explanation FROM rd_questions WHERE passage_id = $1 AND status = 'approved' ORDER BY position, id", [p.id]);
  const q = qs[which] ?? qs[0];
  return q ? { test: n, title: p.title, stem: q.stem, options: JSON.parse(q.options_json), answer: Number(JSON.parse(q.answer_json)), explanation: q.explanation } : null;
}

export async function essayTotals(db: Db = pool): Promise<{ tests: number; questions: number; words: number }> {
  const r = await first(db, "SELECT COUNT(*) AS t, COALESCE(SUM(word_count),0) AS w FROM rd_passages WHERE collection = 'exam' AND status = 'approved'");
  const q = await first(db, "SELECT COUNT(*) AS n FROM rd_questions q JOIN rd_passages p ON p.id = q.passage_id WHERE p.collection = 'exam' AND q.status = 'approved' AND p.status = 'approved'");
  return { tests: Number(r?.t ?? 0), questions: Number(q?.n ?? 0), words: Number(r?.w ?? 0) };
}
