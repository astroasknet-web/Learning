import "server-only";
import { randomBytes } from "node:crypto";
import { exec, first, pool, rows, tx, type Db } from "../pay/db";
import { resolveConfig, SCORING_VERSION, type Config } from "./config";
import { SEED_LEVELS, SEED_PASSAGES } from "./content/levels";
import essayData from "./essays/essays.json";
import { classifyQuestion, essaySlug, ESSAY_META } from "./essays/meta";
import { wordsIn } from "./content-model";
import { causesOf, carefulNote, type Cause, type HistoryItem } from "./diagnosis";
import { hasPremium, hasTrack, isTrack, type Track } from "./access";
import { levelStates, type LevelAttempt, type LevelRule, type LevelState, type Summary } from "./progress";
import { markResponse, scoreAssessment, checkedMs, type Item, type Response, type ScoreResult, type Timing } from "./scoring";
import { isSkill, type Difficulty, type Format, type Kind, type Mode, type QType, type SkillId } from "./taxonomy";

/** Everything the studio stores and the one place that marks answers, scores an assessment and applies its effects. */
const dbTime = (d: Date | number = new Date()): string => new Date(d).toISOString().replace("T", " ").replace("Z", "");
const asDate = (s: string | null | undefined): number => {
  if (!s) return 0;
  const t = String(s);
  return Date.parse(/[zZ]$|[+-]\d\d:?\d\d$/.test(t) ? t.replace(" ", "T") : t.replace(" ", "T") + "Z");
};
const iso = (s: string | null | undefined): string => (s ? new Date(asDate(s)).toISOString() : "");

// ---- configuration -------------------------------------------------------------------------------------------------------------

export async function getConfig(db: Db = pool): Promise<Config> {
  const stored: Record<string, unknown> = {};
  for (const r of await rows(db, "SELECT k, v_json FROM rd_config")) { try { stored[r.k] = JSON.parse(r.v_json); } catch { /* ignore an unreadable value: the default applies */ } }
  return resolveConfig(stored);
}

export async function audit(db: Db, actorId: number | null, action: string, entity: string, entityId: string | number, detail: Record<string, unknown> = {}): Promise<void> {
  await exec(db, "INSERT INTO rd_audit (actor_id, action, entity, entity_id, detail_json) VALUES ($1,$2,$3,$4,$5)", [actorId, action, entity, String(entityId).slice(0, 40), JSON.stringify(detail).slice(0, 2900)]);
}

// ---- seeding ----------------------------------------------------------------------------------------------------------------------

let seeded = false;

/** Adds any seed level, passage or question the database does not have yet. It never changes a row that exists, so an administrator's edits are kept. */
export async function ensureSeed(db: Db = pool, force = false): Promise<{ levels: number; passages: number; questions: number }> {
  if (seeded && !force) return { levels: 0, passages: 0, questions: 0 };
  let levels = 0, passages = 0, questions = 0;
  for (const l of SEED_LEVELS) {
    const n = await exec(db, "INSERT IGNORE INTO rd_levels (level_key, position, name, objective, lesson_json, pass_pct, min_questions, mastery_size, timed) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)", [l.key, l.position, l.name, l.objective, JSON.stringify(l.lesson), l.passPct, l.minQuestions, l.masterySize, l.timed ? 1 : 0]);
    levels += n > 0 ? 1 : 0;
  }
  for (const p of SEED_PASSAGES) {
    const n = await exec(db, "INSERT IGNORE INTO rd_passages (slug, title, body, topic, difficulty, vocab_level, word_count, level_key, is_diagnostic, status, source, review_state) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'approved','authored','unreviewed')", [p.slug, p.title, p.body, p.topic, p.difficulty, p.vocabLevel, wordsIn(p.body), p.levelKey, p.isDiagnostic ? 1 : 0]);
    passages += n > 0 ? 1 : 0;
    const row = await first(db, "SELECT id FROM rd_passages WHERE slug = $1", [p.slug]);
    if (!row) continue;
    let pos = 0;
    for (const q of p.questions) {
      const k = await exec(db, "INSERT IGNORE INTO rd_questions (passage_id, ref, mode, format, stem, options_json, answer_json, explanation, skill, qtype, difficulty, expected_secs, position, status, source, review_state) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'approved','authored','unreviewed')", [row.id, q.ref, q.mode, q.format, q.stem, JSON.stringify(q.options), JSON.stringify(q.answer), q.explanation, q.skill, q.qtype, q.difficulty, q.expectedSecs, pos++]);
      questions += k > 0 ? 1 : 0;
    }
  }
  const e = await ensureEssays(db);
  passages += e.passages; questions += e.questions;
  seeded = true;
  return { levels, passages, questions };
}

interface EssayFile { n: number; title: string; body: string; words: number; questions: Array<{ n: number; question: string; options: string[] | null; answer: string | null; explanation: string }> }

/**
 * Adds the 30 essay reading tests (one passage and ten questions each) to the same bank the Reading Studio uses, flagged collection = 'exam' so they stay
 * out of the level pathway. Like the rest of the seed it only inserts what is missing and never overwrites an administrator's edit.
 */
export async function ensureEssays(db: Db = pool): Promise<{ passages: number; questions: number }> {
  let passages = 0, questions = 0;
  for (const e of essayData as unknown as EssayFile[]) {
    const meta = ESSAY_META.find((m) => m.n === e.n);
    if (!meta) continue;
    const slug = essaySlug(e.n, e.title);
    const k = await exec(db, "INSERT IGNORE INTO rd_passages (slug, title, body, topic, difficulty, vocab_level, word_count, level_key, is_diagnostic, status, source, review_state, collection, ext_no, theme, exams) VALUES ($1,$2,$3,$4,$5,$6,$7,NULL,0,'approved','authored','unreviewed','exam',$8,$9,$10)", [slug, e.title, e.body, meta.theme, meta.difficulty, Math.min(5, meta.difficulty), e.words, e.n, meta.theme, meta.exams.join(",")]);
    passages += k > 0 ? 1 : 0;
    const row = await first(db, "SELECT id FROM rd_passages WHERE slug = $1", [slug]);
    if (!row) continue;
    let pos = 0;
    for (const q of e.questions) {
      if (!q.options || !q.answer) continue;
      const c = classifyQuestion(q.question, q.options);
      const n = await exec(db, "INSERT IGNORE INTO rd_questions (passage_id, ref, mode, format, stem, options_json, answer_json, explanation, skill, qtype, difficulty, expected_secs, position, status, source, review_state) VALUES ($1,$2,'practice','mcq',$3,$4,$5,$6,$7,$8,$9,$10,$11,'approved','authored','unreviewed')", [row.id, `ES${String(e.n).padStart(2, "0")}-${q.n}`, q.question, JSON.stringify(q.options), JSON.stringify("ABCD".indexOf(q.answer)), q.explanation, c.skill, c.qtype, c.difficulty, c.expectedSecs, pos++]);
      questions += n > 0 ? 1 : 0;
    }
  }
  return { passages, questions };
}

// ---- content ---------------------------------------------------------------------------------------------------------------------

export interface Passage { id: number; slug: string; title: string; body: string; topic: string; difficulty: number; wordCount: number; levelKey: string | null; isDiagnostic: boolean }
export interface Question { id: number; passageId: number; ref: string; mode: Mode; format: Format; stem: string; options: unknown; answer: unknown; explanation: string; skill: SkillId; qtype: QType; difficulty: Difficulty; expectedSecs: number; position: number }

const passageOf = (r: Record<string, any>): Passage => ({ id: Number(r.id), slug: r.slug, title: r.title, body: r.body, topic: r.topic, difficulty: Number(r.difficulty), wordCount: Number(r.word_count), levelKey: r.level_key ?? null, isDiagnostic: Number(r.is_diagnostic) === 1 }); // eslint-disable-line @typescript-eslint/no-explicit-any
const questionOf = (r: Record<string, any>): Question => ({ id: Number(r.id), passageId: Number(r.passage_id), ref: r.ref, mode: r.mode, format: r.format, stem: r.stem, options: JSON.parse(r.options_json), answer: JSON.parse(r.answer_json), explanation: r.explanation, skill: r.skill, qtype: r.qtype, difficulty: Number(r.difficulty) as Difficulty, expectedSecs: Number(r.expected_secs), position: Number(r.position) }); // eslint-disable-line @typescript-eslint/no-explicit-any

export async function passagesByIds(ids: number[], db: Db = pool): Promise<Map<number, Passage>> {
  const out = new Map<number, Passage>();
  if (!ids.length) return out;
  for (const r of await rows(db, `SELECT * FROM rd_passages WHERE id IN (${ids.map((_, i) => `$${i + 1}`).join(",")})`, ids)) out.set(Number(r.id), passageOf(r));
  return out;
}
export async function questionsByIds(ids: number[], db: Db = pool): Promise<Map<number, Question>> {
  const out = new Map<number, Question>();
  if (!ids.length) return out;
  for (const r of await rows(db, `SELECT * FROM rd_questions WHERE id IN (${ids.map((_, i) => `$${i + 1}`).join(",")})`, ids)) out.set(Number(r.id), questionOf(r));
  return out;
}

export interface LevelRow extends LevelRule { name: string; objective: string; lesson: { objectives: string[]; lesson: string[]; tips: string[]; completion: string }; masterySize: number; timed: boolean; active: boolean }

export async function loadLevels(db: Db = pool, includeInactive = false): Promise<LevelRow[]> {
  return (await rows(db, `SELECT * FROM rd_levels ${includeInactive ? "" : "WHERE active = 1"} ORDER BY position ASC, level_key ASC`)).map((r) => {
    let lesson = { objectives: [] as string[], lesson: [] as string[], tips: [] as string[], completion: "" };
    try { lesson = { ...lesson, ...JSON.parse(r.lesson_json) }; } catch { /* an unreadable lesson shows empty */ }
    return { key: r.level_key, position: Number(r.position), name: r.name, objective: r.objective, lesson, passPct: Number(r.pass_pct), minQuestions: Number(r.min_questions), masterySize: Number(r.mastery_size), timed: Number(r.timed) === 1, active: Number(r.active) === 1 };
  });
}

// ---- enrolment and level progress ---------------------------------------------------------------------------------------------

/** The tracks a student has chosen to see, in a fixed order. Empty until they choose (or until they use one). */
export async function getTracks(userId: number, db: Db = pool): Promise<Track[]> {
  const r = await first(db, "SELECT tracks FROM rd_enrolments WHERE user_id = $1", [userId]);
  const have = String(r?.tracks ?? "").split(",").filter(isTrack);
  return (["skills", "indian", "international"] as Track[]).filter((t) => have.includes(t));
}
export async function setTracks(userId: number, tracks: string[], db: Db = pool): Promise<Track[]> {
  const clean = (["skills", "indian", "international"] as Track[]).filter((t) => tracks.includes(t));
  await exec(db, "INSERT INTO rd_enrolments (user_id, tracks) VALUES ($1,$2) ON CONFLICT (user_id) DO UPDATE SET tracks = EXCLUDED.tracks", [userId, clean.join(",")]);
  await audit(db, userId, "tracks.chosen", "student", userId, { tracks: clean });
  return clean;
}

/** How far the student is through the essay reading tests: attempted, best score, and the next one they can take. */
export async function essayProgress(userId: number, db: Db = pool): Promise<{ total: number; attempted: number; best: number | null; next: number | null }> {
  const total = Number((await first(db, "SELECT COUNT(*) AS n FROM rd_passages WHERE collection = 'exam' AND status = 'approved'"))?.n ?? 0);
  const done = new Map<number, number | null>();
  for (const r of await rows(db, "SELECT focus_skill, overall_score, completion FROM rd_assessments WHERE user_id = $1 AND kind = 'essay' AND status = 'submitted'", [userId])) {
    const n = Number(String(r.focus_skill ?? "").replace("essay-", ""));
    if (Number.isInteger(n)) done.set(n, r.completion === "complete" && r.overall_score !== null ? Math.max(done.get(n) ?? 0, Number(r.overall_score)) : done.get(n) ?? null);
  }
  const cfg = await getConfig(db);
  const owned = await hasTrack(userId, "indian");
  const open = (n: number) => owned || cfg.freeEssays.includes(n);
  let next: number | null = null;
  for (let n = 1; n <= total && next === null; n++) if (!done.has(n) && open(n)) next = n;
  const scores = [...done.values()].filter((x): x is number => x !== null);
  return { total, attempted: done.size, best: scores.length ? Math.max(...scores) : null, next };
}

export async function getStudyMinutes(userId: number, db: Db = pool): Promise<number | null> {
  const r = await first(db, "SELECT study_minutes FROM rd_enrolments WHERE user_id = $1", [userId]);
  return r ? Number(r.study_minutes) : null;
}
export async function setStudyMinutes(userId: number, minutes: number, db: Db = pool): Promise<void> {
  const m = Math.max(5, Math.min(120, Math.round(minutes) || 20));
  await exec(db, "INSERT INTO rd_enrolments (user_id, study_minutes) VALUES ($1,$2) ON CONFLICT (user_id) DO UPDATE SET study_minutes = EXCLUDED.study_minutes", [userId, m]);
}

async function levelAttempts(userId: number, db: Db): Promise<LevelAttempt[]> {
  return (await rows(db, "SELECT kind, level_key, completion, correct_n, total_n, result_json FROM rd_assessments WHERE user_id = $1 AND status = 'submitted' AND level_key IS NOT NULL AND kind IN ('practice','mastery')", [userId])).map((r) => {
    let credit = Number(r.correct_n);
    try { const s = JSON.parse(r.result_json).score as ScoreResult; credit = s.skills.reduce((a, k) => a + (k.pct ?? 0) * k.n / 100, 0); } catch { /* use the count */ }
    return { kind: r.kind, levelKey: r.level_key, completion: r.completion, correct: Number(r.correct_n), total: Number(r.total_n), credit };
  });
}

export async function levelStatesFor(userId: number, db: Db = pool): Promise<Array<LevelRow & LevelState>> {
  const [lv, att] = await Promise.all([loadLevels(db), levelAttempts(userId, db)]);
  const st = levelStates(lv, att);
  return lv.map((l) => ({ ...l, ...(st.find((s) => s.key === l.key) as LevelState) }));
}

async function refreshLevelProgress(db: Db, userId: number): Promise<void> {
  const states = await levelStatesFor(userId, db);
  for (const s of states) {
    if (s.practiceDone || s.bestMasteryPct !== null) await exec(db, "INSERT INTO rd_level_progress (user_id, level_key, best_pct, attempts) VALUES ($1,$2,$3,1) ON CONFLICT (user_id, level_key) DO UPDATE SET best_pct = EXCLUDED.best_pct, attempts = attempts + 1", [userId, s.key, s.bestMasteryPct ?? 0]);
    if (s.mastered) await exec(db, "UPDATE rd_level_progress SET mastered_at = COALESCE(mastered_at, UTC_TIMESTAMP(3)) WHERE user_id = $1 AND level_key = $2", [userId, s.key]);
  }
}

export async function markLessonRead(userId: number, levelKey: string, db: Db = pool): Promise<void> {
  await exec(db, "INSERT INTO rd_level_progress (user_id, level_key, lesson_read_at) VALUES ($1,$2,UTC_TIMESTAMP(3)) ON CONFLICT (user_id, level_key) DO UPDATE SET lesson_read_at = COALESCE(lesson_read_at, UTC_TIMESTAMP(3))", [userId, levelKey]);
}

// ---- history ---------------------------------------------------------------------------------------------------------------------

export async function loadHistory(userId: number, db: Db = pool): Promise<HistoryItem[]> {
  return (await rows(db, "SELECT a.assessment_id, a.question_id, a.passage_id, a.skill, a.qtype, a.difficulty, a.credit, a.correct, a.response_ms, a.expected_secs, s.submitted_at FROM rd_answers a JOIN rd_assessments s ON s.id = a.assessment_id WHERE a.user_id = $1 AND s.status = 'submitted' AND a.skipped = 0 ORDER BY s.submitted_at ASC, a.id ASC", [userId]))
    .filter((r) => isSkill(r.skill))
    .map((r) => ({ questionId: Number(r.question_id), passageId: Number(r.passage_id), skill: r.skill as SkillId, qtype: r.qtype as QType, difficulty: Number(r.difficulty) as Difficulty, credit: Number(r.credit), correct: Number(r.correct) === 1, skipped: false, ms: r.response_ms === null ? null : Number(r.response_ms), expectedSecs: Number(r.expected_secs), assessmentId: Number(r.assessment_id), at: iso(r.submitted_at) }));
}

export interface AssessmentRow { id: number; publicId: string; userId: number; kind: Kind; levelKey: string | null; focusSkill: string | null; status: "open" | "submitted"; completion: "complete" | "partial" | null; createdAt: string; submittedAt: string | null; overall: number | null; wpm: number | null; comprehensionPct: number | null; qaPct: number | null; correct: number; total: number; avgDifficulty: number | null; scoringVersion: string | null; contentVersion: string | null; repeatOf: number | null; plan: Plan; result: StoredResult | null }

export interface StoredResult { score: ScoreResult; causes: Cause[]; careful: string | null; timing: Timing; ai: AiFeedback | null }
export interface AiFeedback { summary: string; focus: string; tips: string[] }

export interface Plan {
  v: 1;
  kind: Kind;
  levelKey: string | null;
  focus: SkillId | null;
  units: Array<{ passageId: number; questionIds: number[] }>;
  feedback: boolean;
  hidePassage: boolean;
  timedSecs: number | null;
  reads: Record<string, { start: number; done?: number }>;
  lastEventAt: number;
}

function rowToAssessment(r: Record<string, any>): AssessmentRow { // eslint-disable-line @typescript-eslint/no-explicit-any
  return {
    id: Number(r.id), publicId: r.public_id, userId: Number(r.user_id), kind: r.kind, levelKey: r.level_key ?? null, focusSkill: r.focus_skill ?? null, status: r.status, completion: r.completion ?? null,
    createdAt: iso(r.created_at), submittedAt: r.submitted_at ? iso(r.submitted_at) : null, overall: r.overall_score === null ? null : Number(r.overall_score), wpm: r.wpm === null ? null : Number(r.wpm),
    comprehensionPct: r.comprehension_pct === null ? null : Number(r.comprehension_pct), qaPct: r.qa_pct === null ? null : Number(r.qa_pct), correct: Number(r.correct_n), total: Number(r.total_n),
    avgDifficulty: r.avg_difficulty === null ? null : Number(r.avg_difficulty), scoringVersion: r.scoring_version ?? null, contentVersion: r.content_version ?? null, repeatOf: r.repeat_of === null ? null : Number(r.repeat_of),
    plan: JSON.parse(r.plan_json), result: r.result_json ? JSON.parse(r.result_json) : null,
  };
}

export async function getAssessment(userId: number, publicId: string, db: Db = pool): Promise<AssessmentRow | null> {
  const r = await first(db, "SELECT * FROM rd_assessments WHERE public_id = $1 AND user_id = $2", [publicId, userId]);
  return r ? rowToAssessment(r) : null;
}

export async function recentAssessments(userId: number, limit = 12, db: Db = pool): Promise<AssessmentRow[]> {
  return (await rows(db, `SELECT * FROM rd_assessments WHERE user_id = $1 AND status = 'submitted' ORDER BY submitted_at DESC, id DESC LIMIT ${Math.max(1, Math.min(100, limit))}`, [userId])).map(rowToAssessment);
}

export async function openAssessment(userId: number, db: Db = pool): Promise<AssessmentRow | null> {
  const r = await first(db, "SELECT * FROM rd_assessments WHERE user_id = $1 AND status = 'open' AND created_at > $2 ORDER BY id DESC LIMIT 1", [userId, dbTime(Date.now() - 24 * 3600_000)]);
  return r ? rowToAssessment(r) : null;
}

export async function summaries(userId: number, db: Db = pool): Promise<Summary[]> {
  const out: Summary[] = [];
  for (const r of await rows(db, "SELECT id, public_id, kind, level_key, submitted_at, overall_score, wpm, comprehension_pct, qa_pct, avg_difficulty, completion, scoring_version, correct_n, total_n, plan_json FROM rd_assessments WHERE user_id = $1 AND status = 'submitted' ORDER BY submitted_at ASC, id ASC", [userId])) {
    let passageIds: number[] = [];
    try { passageIds = (JSON.parse(r.plan_json) as Plan).units.map((u) => u.passageId); } catch { /* none */ }
    out.push({ id: Number(r.id), publicId: r.public_id, at: iso(r.submitted_at), kind: r.kind, levelKey: r.level_key ?? null, overall: r.overall_score === null ? null : Number(r.overall_score), wpm: r.wpm === null ? null : Number(r.wpm), comprehensionPct: r.comprehension_pct === null ? null : Number(r.comprehension_pct), qaPct: r.qa_pct === null ? null : Number(r.qa_pct), avgDifficulty: r.avg_difficulty === null ? null : Number(r.avg_difficulty), completion: r.completion ?? "partial", passageIds, scoringVersion: r.scoring_version ?? "", correct: Number(r.correct_n), total: Number(r.total_n) });
  }
  return out;
}

// ---- starting an assessment ----------------------------------------------------------------------------------------------------

export type StartResult = { ok: true; id: string; resumed: boolean } | { ok: false; code: "locked" | "limit" | "level" | "none" | "delay" | "practice"; error: string };

export interface StartOptions { levelKey?: string; skill?: string }

const PER_PASSAGE_CAP = 8;

async function seenQuestions(userId: number, db: Db): Promise<Map<number, number>> {
  const m = new Map<number, number>();
  for (const r of await rows(db, "SELECT a.question_id, COUNT(*) AS n FROM rd_answers a JOIN rd_assessments s ON s.id = a.assessment_id WHERE a.user_id = $1 AND s.status = 'submitted' AND a.skipped = 0 GROUP BY a.question_id", [userId])) m.set(Number(r.question_id), Number(r.n));
  return m;
}
async function seenPassages(userId: number, db: Db): Promise<Map<number, number>> {
  const m = new Map<number, number>();
  for (const r of await rows(db, "SELECT plan_json FROM rd_assessments WHERE user_id = $1 AND status = 'submitted' AND kind <> 'recall'", [userId])) {
    try { for (const u of (JSON.parse(r.plan_json) as Plan).units) m.set(u.passageId, (m.get(u.passageId) ?? 0) + 1); } catch { /* ignore */ }
  }
  return m;
}

interface Pool { p: Passage; qs: Question[] }

async function approvedPool(db: Db, where: string, params: unknown[], collections: Array<"studio" | "exam"> = ["studio"]): Promise<Pool[]> {
  const ps = (await rows(db, `SELECT * FROM rd_passages WHERE status = 'approved' AND collection IN (${collections.map((c) => `'${c}'`).join(",")}) ${where} ORDER BY id ASC`, params)).map(passageOf);
  const out: Pool[] = [];
  for (const p of ps) {
    const qs = (await rows(db, "SELECT * FROM rd_questions WHERE passage_id = $1 AND status = 'approved' ORDER BY position ASC, id ASC", [p.id])).map(questionOf);
    out.push({ p, qs });
  }
  return out;
}

const shuffleSeeded = <T,>(xs: T[], seed: string): T[] => {
  // deterministic per assessment so a reload shows the same order; the plan is stored, so this is only used while planning
  let h = 2166136261;
  for (const ch of seed) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) { h = Math.imul(h ^ (h >>> 15), 2246822507); const j = Math.abs(h) % (i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

export async function startAssessment(userId: number, kind: Kind, opts: StartOptions = {}, now = new Date()): Promise<StartResult> {
  await ensureSeed();
  const db = pool;
  const cfg = await getConfig(db);
  const premium = await hasPremium(userId);
  const open = await openAssessment(userId, db);
  if (open && open.kind === kind && open.levelKey === (opts.levelKey ?? null) && (open.focusSkill ?? null) === (opts.skill ?? null)) return { ok: true, id: open.publicId, resumed: true };

  const locked = (what: string): StartResult => ({ ok: false, code: "locked", error: `${what} is part of the Reading Skills Pathway package.` });
  if (kind !== "diagnostic" && kind !== "essay" && !premium) return locked(kind === "practice" && opts.skill ? "Targeted skill practice" : kind === "mastery" ? "Mastery checks" : kind === "recall" ? "Delayed recall" : kind === "timed" ? "Timed reading" : kind === "fresh" ? "Fresh assessments" : "Level practice");

  const seenQ = await seenQuestions(userId, db);
  const seenP = await seenPassages(userId, db);
  let units: Plan["units"] = [];
  let feedback = false, hide = false, timedSecs: number | null = null, levelKey: string | null = null, focus: SkillId | null = null, tag: string | null = null;

  if (kind === "diagnostic") {
    if (!premium) {
      const used = Number((await first(db, "SELECT COUNT(*) AS n FROM rd_assessments WHERE user_id = $1 AND kind IN ('diagnostic','fresh')", [userId]))?.n ?? 0);
      if (used >= cfg.freeDiagnostics) return { ok: false, code: "limit", error: `The free plan includes ${cfg.freeDiagnostics} starting assessment${cfg.freeDiagnostics === 1 ? "" : "s"}. More assessments are part of the Reading Studio package.` };
    }
    const pool_ = await approvedPool(db, "AND is_diagnostic = 1", []);
    units = pool_.map(({ p, qs }) => ({ passageId: p.id, questionIds: qs.filter((q) => q.mode === "diagnostic").map((q) => q.id) })).filter((u) => u.questionIds.length);
  } else if (kind === "essay") {
    // an essay reading test: one passage, its ten questions, answers kept back until the test is handed in. focus_skill holds "essay-N" so a second test never resumes the first.
    const num = Number(String(opts.skill ?? "").replace(/^essay-/, ""));
    const row = Number.isInteger(num) ? await first(db, "SELECT * FROM rd_passages WHERE collection = 'exam' AND ext_no = $1 AND status = 'approved'", [num]) : null;
    if (!row) return { ok: false, code: "none", error: "That test does not exist." };
    if (!cfg.freeEssays.includes(num) && !(await hasTrack(userId, "indian"))) return { ok: false, code: "locked", error: "This essay test is part of the Indian Competitive Exams package. Three tests are free." };
    const qs = (await rows(db, "SELECT * FROM rd_questions WHERE passage_id = $1 AND status = 'approved' ORDER BY position, id", [row.id])).map(questionOf);
    if (!qs.length) return { ok: false, code: "none", error: "That test has no questions yet." };
    units = [{ passageId: Number(row.id), questionIds: qs.map((q) => q.id) }];
    tag = `essay-${num}`;
  } else if (kind === "practice" && opts.skill) {
    if (!isSkill(opts.skill)) return { ok: false, code: "none", error: "That skill is not recognised." };
    focus = opts.skill;
    const pool_ = await approvedPool(db, "", [], ["studio", "exam"]);
    const cands = pool_.flatMap(({ p, qs }) => qs.filter((q) => q.skill === focus && q.mode !== "recall").map((q) => ({ p, q })));
    const sorted = shuffleSeeded(cands, `${userId}:${focus}:${seenQ.size}`).sort((a, b) => (seenQ.get(a.q.id) ?? 0) - (seenQ.get(b.q.id) ?? 0));
    const pick = sorted.slice(0, PER_PASSAGE_CAP);
    const by = new Map<number, number[]>();
    for (const { q } of pick) by.set(q.passageId, [...(by.get(q.passageId) ?? []), q.id]);
    units = [...by.entries()].map(([passageId, questionIds]) => ({ passageId, questionIds }));
    feedback = true;
  } else if (kind === "practice" || kind === "mastery") {
    levelKey = (opts.levelKey ?? "").toUpperCase().slice(0, 2);
    const states = await levelStatesFor(userId, db);
    const lv = states.find((s) => s.key === levelKey);
    if (!lv) return { ok: false, code: "none", error: "That level does not exist." };
    if (!lv.unlocked) return { ok: false, code: "level", error: "That level opens when the level before it is mastered." };
    if (kind === "mastery" && !lv.practiceDone) return { ok: false, code: "practice", error: "Complete the practice for this level before the mastery check." };
    const pool_ = await approvedPool(db, "AND level_key = $1", [levelKey]);
    const mode: Mode = kind;
    const cands = pool_.flatMap(({ p, qs }) => qs.filter((q) => q.mode === mode).map((q) => ({ p, q }))).sort((a, b) => (seenQ.get(a.q.id) ?? 0) - (seenQ.get(b.q.id) ?? 0) || a.q.position - b.q.position);
    const size = kind === "mastery" ? lv.masterySize : PER_PASSAGE_CAP;
    const pick = cands.slice(0, size);
    const by = new Map<number, Question[]>();
    for (const { q } of pick) by.set(q.passageId, [...(by.get(q.passageId) ?? []), q]);
    units = [...by.entries()].map(([passageId, qs]) => ({ passageId, questionIds: qs.sort((a, b) => a.position - b.position).map((q) => q.id) }));
    feedback = kind === "practice";
    if (lv.timed) timedSecs = null;
  } else if (kind === "recall") {
    const cutoff = dbTime(now.getTime() - cfg.recallDelayHours * 3600_000);
    const last = await rows(db, "SELECT id, plan_json, submitted_at FROM rd_assessments WHERE user_id = $1 AND status = 'submitted' AND kind <> 'recall' AND submitted_at <= $2 ORDER BY submitted_at DESC", [userId, cutoff]);
    const done = new Set<number>();
    for (const r of await rows(db, "SELECT plan_json, submitted_at FROM rd_assessments WHERE user_id = $1 AND kind = 'recall' AND status = 'submitted'", [userId])) { try { for (const u of (JSON.parse(r.plan_json) as Plan).units) done.add(u.passageId); } catch { /* ignore */ } }
    let chosen: number | null = null;
    const withRecall = new Set((await rows(db, "SELECT DISTINCT passage_id FROM rd_questions WHERE mode = 'recall' AND status = 'approved'")).map((r) => Number(r.passage_id)));
    for (const r of last) { try { const ps = (JSON.parse(r.plan_json) as Plan).units.map((u) => u.passageId); const p = ps.find((x) => !done.has(x) && withRecall.has(x)); if (p) { chosen = p; break; } } catch { /* ignore */ } }
    if (chosen === null) {
      const any = await first(db, "SELECT 1 AS x FROM rd_assessments WHERE user_id = $1 AND status = 'submitted' AND kind <> 'recall' LIMIT 1", [userId]);
      return { ok: false, code: "delay", error: any ? `Delayed recall opens ${cfg.recallDelayHours} hours after you read a passage, so it tests what you kept rather than what you just saw. Come back later.` : "Take an assessment first; recall questions come later about a passage you have read." };
    }
    const qs = (await rows(db, "SELECT * FROM rd_questions WHERE passage_id = $1 AND mode = 'recall' AND status = 'approved' ORDER BY position, id", [chosen])).map(questionOf);
    if (!qs.length) return { ok: false, code: "none", error: "There are no recall questions for that passage yet." };
    units = [{ passageId: chosen, questionIds: qs.map((q) => q.id) }];
    hide = true;
  } else {
    // timed and fresh: a passage the student has seen least, near their working level
    const states = await levelStatesFor(userId, db);
    const cur = states.find((s) => s.unlocked && !s.mastered) ?? states[states.length - 1];
    const pool_ = await approvedPool(db, "", []);
    const usable = pool_.map(({ p, qs }) => ({ p, qs: qs.filter((q) => (p.isDiagnostic ? q.mode === "diagnostic" : kind === "timed" ? q.mode === "practice" || q.mode === "mastery" : q.mode === "practice" || q.mode === "mastery")) })).filter((x) => x.qs.length >= 4);
    const target = kind === "timed" ? cur?.key : null;
    const ranked = usable.sort((a, b) => (seenP.get(a.p.id) ?? 0) - (seenP.get(b.p.id) ?? 0) || Number(b.p.levelKey === target) - Number(a.p.levelKey === target) || a.p.difficulty - b.p.difficulty);
    const pick = ranked[0];
    if (!pick) return { ok: false, code: "none", error: "No passage is available yet." };
    units = [{ passageId: pick.p.id, questionIds: pick.qs.slice(0, PER_PASSAGE_CAP).map((q) => q.id) }];
    if (kind === "timed") {
      const base = Math.ceil((pick.p.wordCount / cfg.targetWpm[Math.min(5, Math.max(1, pick.p.difficulty)) as 1 | 2 | 3 | 4 | 5]) * 60);
      timedSecs = base + pick.qs.slice(0, PER_PASSAGE_CAP).reduce((a, q) => a + q.expectedSecs, 0);
      levelKey = pick.p.levelKey;
    }
  }
  if (!units.length || !units.every((u) => u.questionIds.length)) return { ok: false, code: "none", error: "There are not enough approved questions for that yet." };

  const plan: Plan = { v: 1, kind, levelKey, focus, units, feedback, hidePassage: hide, timedSecs, reads: {}, lastEventAt: now.getTime() };
  const publicId = randomBytes(12).toString("hex");
  const key = JSON.stringify(units.map((u) => u.passageId).sort());
  const prior = (kind === "diagnostic" || kind === "fresh") ? (await rows(db, "SELECT id, plan_json FROM rd_assessments WHERE user_id = $1 AND status = 'submitted' AND kind IN ('diagnostic','fresh') ORDER BY id DESC", [userId])).find((r) => { try { return JSON.stringify((JSON.parse(r.plan_json) as Plan).units.map((u) => u.passageId).sort()) === key; } catch { return false; } }) : null;
  const contentVersion = `c${(await first(db, "SELECT COALESCE(MAX(version),1) AS v, COUNT(*) AS n FROM rd_passages WHERE status = 'approved'"))?.n ?? 0}`;
  await exec(db, "INSERT INTO rd_assessments (public_id, user_id, kind, level_key, focus_skill, plan_json, status, created_at, scoring_version, content_version, repeat_of) VALUES ($1,$2,$3,$4,$5,$6,'open',$7,$8,$9,$10)", [publicId, userId, kind, levelKey, tag ?? focus, JSON.stringify(plan), dbTime(now), SCORING_VERSION, contentVersion, prior ? Number(prior.id) : null]);
  return { ok: true, id: publicId, resumed: false };
}

// ---- delivery: what the browser may see -------------------------------------------------------------------------------------------

export interface ClientQuestion { id: number; format: Format; stem: string; options: string[] | { left: string[]; right: string[] }; skillLabelHidden?: never; difficulty: Difficulty; expectedSecs: number }
export interface ClientUnit { passageId: number; title: string; body: string | null; wordCount: number; questions: ClientQuestion[] }
export interface Saved { questionId: number; selected: Response; correct?: boolean; explanation?: string; reveal?: unknown }

export interface RunnerState {
  publicId: string; kind: Kind; feedback: boolean; hidePassage: boolean; timedSecs: number | null; units: ClientUnit[];
  saved: Saved[]; reads: Record<string, { start: number; done?: number }>; startedAt: number; serverNow: number;
}

/** The assessment as the browser receives it: passages and questions, never keys or explanations (except for an answer the student has already committed in a practice round). */
export async function runnerState(userId: number, publicId: string, db: Db = pool): Promise<RunnerState | null> {
  const a = await getAssessment(userId, publicId, db);
  if (!a || a.status !== "open") return null;
  const ids = a.plan.units.flatMap((u) => u.questionIds);
  const [ps, qs] = await Promise.all([passagesByIds(a.plan.units.map((u) => u.passageId), db), questionsByIds(ids, db)]);
  const answers = await rows(db, "SELECT question_id, selected_json FROM rd_answers WHERE assessment_id = $1 AND skipped = 0", [a.id]);
  const saved: Saved[] = answers.map((r) => {
    const q = qs.get(Number(r.question_id));
    const selected = r.selected_json ? (JSON.parse(r.selected_json) as Response) : null;
    const base: Saved = { questionId: Number(r.question_id), selected };
    if (a.plan.feedback && q) { const m = markResponse(q, selected); return { ...base, correct: m.correct, explanation: q.explanation, reveal: revealOf(q) }; }
    return base;
  });
  const units: ClientUnit[] = a.plan.units.map((u) => {
    const p = ps.get(u.passageId) as Passage;
    return { passageId: p.id, title: p.title, body: a.plan.hidePassage ? null : p.body, wordCount: p.wordCount, questions: u.questionIds.map((id) => qs.get(id)).filter((q): q is Question => !!q).map((q) => ({ id: q.id, format: q.format, stem: q.stem, options: q.options as ClientQuestion["options"], difficulty: q.difficulty, expectedSecs: q.expectedSecs })) };
  });
  return { publicId, kind: a.kind, feedback: a.plan.feedback, hidePassage: a.plan.hidePassage, timedSecs: a.plan.timedSecs, units, saved, reads: a.plan.reads, startedAt: asDate(a.createdAt), serverNow: Date.now() };
}

/** What a practice round reveals after an answer is committed: the key. */
const revealOf = (q: Question): unknown => (q.format === "short" ? (q.answer as string[])[0] : q.answer);

async function loadForUpdate(db: Db, userId: number, publicId: string): Promise<{ id: number; plan: Plan; status: string; created: string } | null> {
  const r = await first(db, "SELECT id, plan_json, status, created_at FROM rd_assessments WHERE public_id = $1 AND user_id = $2 FOR UPDATE", [publicId, userId]);
  return r ? { id: Number(r.id), plan: JSON.parse(r.plan_json) as Plan, status: r.status, created: r.created_at } : null;
}

/** Record the start or end of reading a passage, on the server clock. The reading time is an estimate from these two moments. */
export async function markPhase(userId: number, publicId: string, unit: number, phase: "read_start" | "read_done", now = Date.now()): Promise<{ ok: boolean; at: number }> {
  return tx(async (db) => {
    const a = await loadForUpdate(db, userId, publicId);
    if (!a || a.status !== "open" || unit < 0 || unit >= a.plan.units.length) return { ok: false, at: now };
    const r = a.plan.reads[String(unit)] ?? { start: now };
    if (phase === "read_start" && !a.plan.reads[String(unit)]) a.plan.reads[String(unit)] = { start: now };
    if (phase === "read_done") { if (!a.plan.reads[String(unit)]) a.plan.reads[String(unit)] = { start: r.start }; if (a.plan.reads[String(unit)].done === undefined) a.plan.reads[String(unit)].done = now; }
    a.plan.lastEventAt = now;
    await exec(db, "UPDATE rd_assessments SET plan_json = $1 WHERE id = $2", [JSON.stringify(a.plan), a.id]);
    return { ok: true, at: now };
  });
}

export type AnswerResult = { ok: true; locked: boolean; correct?: boolean; credit?: number; explanation?: string; reveal?: unknown } | { ok: false; error: string };

/**
 * Store one answer. The browser sends only which question, what was chosen and how long it says it took; the server checks the question is in this
 * assessment, limits the time to what the server clock allows, and marks it. In a practice round the first committed answer is final and the result
 * (with the explanation) is returned; in an assessment answers can be changed until it is handed in, and nothing is revealed.
 */
export async function submitAnswer(userId: number, publicId: string, questionId: number, response: Response, clientMs: number, now = Date.now()): Promise<AnswerResult> {
  return tx(async (db) => {
    const a = await loadForUpdate(db, userId, publicId);
    if (!a || a.status !== "open") return { ok: false, error: "That assessment is not open." } as AnswerResult;
    if (!a.plan.units.some((u) => u.questionIds.includes(questionId))) return { ok: false, error: "That question is not part of this assessment." } as AnswerResult;
    const q = (await questionsByIds([questionId], db)).get(questionId);
    if (!q) return { ok: false, error: "That question is not available." } as AnswerResult;
    const existing = await first(db, "SELECT id, selected_json FROM rd_answers WHERE assessment_id = $1 AND question_id = $2", [a.id, questionId]);
    if (existing && a.plan.feedback) {
      const sel = existing.selected_json ? (JSON.parse(existing.selected_json) as Response) : null;
      const m = markResponse(q, sel);
      return { ok: true, locked: true, correct: m.correct, credit: m.credit, explanation: q.explanation, reveal: revealOf(q) } as AnswerResult;
    }
    const clean = sanitise(q, response);
    const m = markResponse(q, clean);
    const ms = checkedMs(clientMs, now - a.plan.lastEventAt);
    a.plan.lastEventAt = now;
    await exec(db, "UPDATE rd_assessments SET plan_json = $1 WHERE id = $2", [JSON.stringify(a.plan), a.id]);
    await exec(db, "INSERT INTO rd_answers (assessment_id, user_id, question_id, passage_id, selected_json, correct, credit, response_ms, skill, qtype, difficulty, expected_secs, skipped, answered_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) ON CONFLICT (assessment_id, question_id) DO UPDATE SET selected_json = EXCLUDED.selected_json, correct = EXCLUDED.correct, credit = EXCLUDED.credit, response_ms = response_ms + EXCLUDED.response_ms, skipped = EXCLUDED.skipped, answered_at = EXCLUDED.answered_at", [a.id, userId, questionId, q.passageId, m.answered ? JSON.stringify(clean) : null, m.correct ? 1 : 0, m.credit, ms, q.skill, q.qtype, q.difficulty, q.expectedSecs, m.answered ? 0 : 1, dbTime(now)]);
    return a.plan.feedback && m.answered ? ({ ok: true, locked: true, correct: m.correct, credit: m.credit, explanation: q.explanation, reveal: revealOf(q) } as AnswerResult) : ({ ok: true, locked: false } as AnswerResult);
  });
}

/** Whatever the browser sends is cut down to the shape the question accepts, so nothing odd is stored. */
export function sanitise(q: Pick<Question, "format" | "options">, r: Response): Response {
  if (q.format === "short") return typeof r === "string" ? r.trim().slice(0, 80) : null;
  if (q.format === "match") {
    const n = (q.options as { left: string[] }).left.length;
    return Array.isArray(r) && r.length === n && r.every((x) => Number.isInteger(x) && x >= -1 && x < n) ? (r as number[]).map((x) => (x < 0 ? -1 : x)) : null;
  }
  const n = (q.options as string[]).length;
  return typeof r === "number" && Number.isInteger(r) && r >= 0 && r < n ? r : null;
}

// ---- finishing -----------------------------------------------------------------------------------------------------------------

export interface FinishInput { ai?: (facts: AiFacts) => Promise<AiFeedback | null> }
export interface AiFacts { overall: number | null; strongest: string[]; weakest: string[]; wpm: number | null; causes: string[] }

/**
 * Hand in an assessment: unanswered questions count as skipped, the server computes timing from its own clock, scores it with the deterministic
 * engine and stores the result. Handing in twice returns the stored result. Nothing the browser sends can change a score.
 */
export async function finishAssessment(userId: number, publicId: string, now = Date.now(), input: FinishInput = {}): Promise<{ id: string } | null> {
  const cfg = await getConfig();
  const done = await tx(async (db) => {
    const a = await loadForUpdate(db, userId, publicId);
    if (!a) return null;
    if (a.status === "submitted") return { id: publicId, fresh: false, facts: null as AiFacts | null, rowId: a.id };
    const ids = a.plan.units.flatMap((u) => u.questionIds);
    const [qs, ps] = await Promise.all([questionsByIds(ids, db), passagesByIds(a.plan.units.map((u) => u.passageId), db)]);
    const ansRows = new Map((await rows(db, "SELECT * FROM rd_answers WHERE assessment_id = $1", [a.id])).map((r) => [Number(r.question_id), r]));
    const items: Item[] = [];
    for (const id of ids) {
      const q = qs.get(id);
      if (!q) continue;
      const r = ansRows.get(id);
      if (!r || Number(r.skipped) === 1) {
        if (!r) await exec(db, "INSERT INTO rd_answers (assessment_id, user_id, question_id, passage_id, selected_json, correct, credit, response_ms, skill, qtype, difficulty, expected_secs, skipped) VALUES ($1,$2,$3,$4,NULL,0,0,NULL,$5,$6,$7,$8,1)", [a.id, userId, id, q.passageId, q.skill, q.qtype, q.difficulty, q.expectedSecs]);
        items.push({ questionId: id, passageId: q.passageId, skill: q.skill, qtype: q.qtype, difficulty: q.difficulty, credit: 0, correct: false, skipped: true, ms: null, expectedSecs: q.expectedSecs });
      } else items.push({ questionId: id, passageId: q.passageId, skill: q.skill, qtype: q.qtype, difficulty: q.difficulty, credit: Number(r.credit), correct: Number(r.correct) === 1, skipped: false, ms: r.response_ms === null ? null : Number(r.response_ms), expectedSecs: q.expectedSecs });
    }
    let readingMs = 0, words = 0, dsum = 0, wsum = 0;
    a.plan.units.forEach((u, i) => {
      const p = ps.get(u.passageId);
      if (!p) return;
      wsum += p.wordCount; dsum += p.wordCount * p.difficulty;
      const rd = a.plan.reads[String(i)];
      if (!a.plan.hidePassage && rd?.done !== undefined) { readingMs += Math.max(0, rd.done - rd.start); words += p.wordCount; }
    });
    const answeringMs = items.reduce((x, i) => x + (i.ms ?? 0), 0);
    const timing: Timing = { wordCount: words, readingMs: !a.plan.hidePassage && words > 0 ? readingMs : null, answeringMs, totalMs: Math.max(0, now - asDate(a.created)), passageDifficulty: wsum ? dsum / wsum : 3 };
    const score = scoreAssessment(items, timing, cfg);
    const causes = causesOf(score, items, cfg);
    const result: StoredResult = { score, causes, careful: carefulNote(items), timing, ai: null };
    const avgDiff = wsum ? Math.round((dsum / wsum) * 10) / 10 : null;
    await exec(db, "UPDATE rd_assessments SET status = 'submitted', submitted_at = $1, completion = $2, reading_ms = $3, answering_ms = $4, total_ms = $5, word_count = $6, wpm = $7, overall_score = $8, comprehension_pct = $9, qa_pct = $10, correct_n = $11, total_n = $12, avg_difficulty = $13, scoring_version = $14, provisional = 1, result_json = $15 WHERE id = $16", [dbTime(now), score.completion, timing.readingMs, answeringMs, timing.totalMs, words, score.efficiency.reliable ? score.efficiency.wpm : null, score.overall, score.comprehensionPct, score.qaPct, score.correct, score.total, avgDiff, score.scoringVersion, JSON.stringify(result), a.id]);
    if (a.plan.levelKey && (a.plan.kind === "practice" || a.plan.kind === "mastery")) await refreshLevelProgress(db, userId);
    return { id: publicId, fresh: true, rowId: a.id, facts: { overall: score.overall, strongest: score.skills.filter((s) => (s.pct ?? 0) >= 85 && s.n >= 2).map((s) => s.label), weakest: score.skills.filter((s) => (s.pct ?? 100) < 70 && s.n >= 2).map((s) => s.label), wpm: score.efficiency.reliable ? score.efficiency.wpm : null, causes: causes.map((c) => c.label) } as AiFacts | null };
  });
  if (!done) return null;
  if (done.fresh && done.facts && input.ai) {
    try {
      const fb = await input.ai(done.facts);
      if (fb) {
        const row = await first(pool, "SELECT result_json FROM rd_assessments WHERE id = $1", [done.rowId]);
        const stored = JSON.parse(row?.result_json ?? "{}") as StoredResult;
        await exec(pool, "UPDATE rd_assessments SET result_json = $1 WHERE id = $2", [JSON.stringify({ ...stored, ai: fb }), done.rowId]);
      }
    } catch { /* AI feedback is optional; the deterministic result stands */ }
  }
  return { id: done.id };
}

/** Questions of an assessment with what the student chose and the key: only for a submitted assessment, and only called for entitled students. */
export interface ReviewItem { questionId: number; skill: SkillId; stem: string; options: string[]; chosen: string; correctText: string; correct: boolean; skipped: boolean; explanation: string; difficulty: Difficulty; ms: number | null; expectedSecs: number; passageTitle: string; format: Format }

const textOf = (q: Question, r: unknown): string => {
  if (r === null || r === undefined || r === "") return "No answer";
  if (q.format === "short") return String(r);
  if (q.format === "match") { const o = q.options as { left: string[]; right: string[] }; return Array.isArray(r) ? o.left.map((l, i) => `${l} → ${(r as number[])[i] >= 0 ? o.right[(r as number[])[i]] : "(none)"}`).join("; ") : "No answer"; }
  return (q.options as string[])[r as number] ?? "No answer";
};

export async function reviewItems(a: AssessmentRow, db: Db = pool): Promise<ReviewItem[]> {
  const ids = a.plan.units.flatMap((u) => u.questionIds);
  const [qs, ps] = await Promise.all([questionsByIds(ids, db), passagesByIds(a.plan.units.map((u) => u.passageId), db)]);
  const ans = new Map((await rows(db, "SELECT * FROM rd_answers WHERE assessment_id = $1", [a.id])).map((r) => [Number(r.question_id), r]));
  return ids.map((id) => {
    const q = qs.get(id);
    if (!q) return null;
    const r = ans.get(id);
    const sel = r?.selected_json ? JSON.parse(r.selected_json) : null;
    return { questionId: id, skill: q.skill, stem: q.stem, options: Array.isArray(q.options) ? (q.options as string[]) : [], chosen: textOf(q, sel), correctText: textOf(q, q.answer), correct: !!r && Number(r.correct) === 1, skipped: !r || Number(r.skipped) === 1, explanation: q.explanation, difficulty: q.difficulty, ms: r?.response_ms === null || r === undefined ? null : Number(r.response_ms), expectedSecs: q.expectedSecs, passageTitle: ps.get(q.passageId)?.title ?? "", format: q.format } as ReviewItem;
  }).filter((x): x is ReviewItem => x !== null);
}

export async function itemsOf(a: AssessmentRow, db: Db = pool): Promise<Item[]> {
  return (await rows(db, "SELECT * FROM rd_answers WHERE assessment_id = $1 ORDER BY id", [a.id])).filter((r) => isSkill(r.skill)).map((r) => ({ questionId: Number(r.question_id), passageId: Number(r.passage_id), skill: r.skill as SkillId, qtype: r.qtype as QType, difficulty: Number(r.difficulty) as Difficulty, credit: Number(r.credit), correct: Number(r.correct) === 1, skipped: Number(r.skipped) === 1, ms: r.response_ms === null ? null : Number(r.response_ms), expectedSecs: Number(r.expected_secs) }));
}

export async function logEvent(userId: number | null, event: string, source: string, db: Db = pool): Promise<void> {
  await exec(db, "INSERT INTO rd_events (user_id, event, source) VALUES ($1,$2,$3)", [userId, event.slice(0, 24), source.slice(0, 40)]);
}

