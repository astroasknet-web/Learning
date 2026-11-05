import "server-only";
import { exec, first, pool, rows, tx, type Db } from "../pay/db";
import { configSchema, DEFAULT_CONFIG, type Config } from "./config";
import { validatePassage, validateQuestion, wordsIn, type Issue, type PassageDraft, type QuestionDraft } from "./content-model";
import { audit, getConfig } from "./store";
import { isQType, isSkill, QTYPES, SKILLS, type Difficulty, type Format, type Mode } from "./taxonomy";
import { READING_SLUG } from "./access";

/**
 * Administrator operations for the Reading Studio: content approval, scoring configuration, levels, aggregate reports. Every change is written to
 * rd_audit with who did it. Aggregate figures describe groups only: a figure about fewer students than the configured minimum is withheld, so no
 * individual can be read from a report.
 */
export type Result<T = unknown> = { ok: true; value?: T; message: string } | { ok: false; message: string };
const fail = (message: string): { ok: false; message: string } => ({ ok: false, message });

// ---- content ---------------------------------------------------------------------------------------------------------------------

export interface PassageRow { id: number; slug: string; title: string; topic: string; difficulty: number; levelKey: string | null; isDiagnostic: boolean; status: string; source: string; reviewState: string; wordCount: number; questions: number; approvedQuestions: number; unreviewedQuestions: number; errors: number; warnings: number }

function draftOf(p: Record<string, any>, qs: Array<Record<string, any>>): PassageDraft { // eslint-disable-line @typescript-eslint/no-explicit-any
  return { slug: p.slug, title: p.title, body: p.body, topic: p.topic, difficulty: Number(p.difficulty), vocabLevel: Number(p.vocab_level), levelKey: p.level_key ?? null, isDiagnostic: Number(p.is_diagnostic) === 1, questions: qs.map(draftQ) };
}
function draftQ(q: Record<string, any>): QuestionDraft { // eslint-disable-line @typescript-eslint/no-explicit-any
  return { ref: q.ref, mode: q.mode as Mode, format: q.format as Format, stem: q.stem, options: JSON.parse(q.options_json), answer: JSON.parse(q.answer_json), explanation: q.explanation, skill: q.skill, qtype: q.qtype, difficulty: Number(q.difficulty) as Difficulty, expectedSecs: Number(q.expected_secs) };
}

export async function listPassages(db: Db = pool): Promise<PassageRow[]> {
  const out: PassageRow[] = [];
  for (const p of await rows(db, "SELECT * FROM rd_passages ORDER BY COALESCE(level_key, 'Z') ASC, id ASC")) {
    const qs = await rows(db, "SELECT * FROM rd_questions WHERE passage_id = $1 ORDER BY position, id", [p.id]);
    const issues = validatePassage(draftOf(p, qs));
    out.push({ id: Number(p.id), slug: p.slug, title: p.title, topic: p.topic, difficulty: Number(p.difficulty), levelKey: p.level_key ?? null, isDiagnostic: Number(p.is_diagnostic) === 1, status: p.status, source: p.source, reviewState: p.review_state, wordCount: Number(p.word_count), questions: qs.length, approvedQuestions: qs.filter((q) => q.status === "approved").length, unreviewedQuestions: qs.filter((q) => q.review_state !== "reviewed").length, errors: issues.filter((i) => i.level === "error").length, warnings: issues.filter((i) => i.level === "warning").length });
  }
  return out;
}

export interface PassageDetail { passage: Record<string, any>; questions: Array<Record<string, any> & { issues: Issue[] }>; issues: Issue[] } // eslint-disable-line @typescript-eslint/no-explicit-any

export async function passageDetail(id: number, db: Db = pool): Promise<PassageDetail | null> {
  const p = await first(db, "SELECT * FROM rd_passages WHERE id = $1", [id]);
  if (!p) return null;
  const qs = await rows(db, "SELECT * FROM rd_questions WHERE passage_id = $1 ORDER BY position, id", [id]);
  const issues = validatePassage(draftOf(p, qs));
  return { passage: p, questions: qs.map((q) => ({ ...q, issues: validateQuestion(draftQ(q), p.body) })), issues };
}

/** Approve, archive or return a passage to draft. A passage with validation errors cannot be approved, and AI-drafted content needs a human review first. */
export async function setPassageStatus(actor: number, id: number, status: "approved" | "archived" | "draft", db: Db = pool): Promise<Result> {
  const d = await passageDetail(id, db);
  if (!d) return fail("That passage does not exist.");
  if (status === "approved") {
    if (d.issues.some((i) => i.level === "error")) return fail(`It cannot be approved yet: ${d.issues.filter((i) => i.level === "error")[0].message}`);
    if (d.passage.source === "ai" && d.passage.review_state !== "reviewed") return fail("AI-drafted content must be reviewed by a person before it can be approved. Review it, then mark it reviewed.");
    if (d.questions.length && d.questions.some((q) => q.source === "ai" && q.review_state !== "reviewed")) return fail("Some AI-drafted questions have not been reviewed yet.");
  }
  await exec(db, "UPDATE rd_passages SET status = $1, version = version + 1 WHERE id = $2", [status, id]);
  if (status === "approved") await exec(db, "UPDATE rd_questions SET status = 'approved' WHERE passage_id = $1 AND status = 'draft'", [id]);
  await audit(db, actor, `passage.${status}`, "passage", id, { slug: d.passage.slug, from: d.passage.status });
  return { ok: true, message: `Passage ${status === "draft" ? "returned to draft" : status}.` };
}

export async function markReviewed(actor: number, entity: "passage" | "question", id: number, db: Db = pool): Promise<Result> {
  const table = entity === "passage" ? "rd_passages" : "rd_questions";
  const n = await exec(db, `UPDATE ${table} SET review_state = 'reviewed', reviewed_by = $1, reviewed_at = UTC_TIMESTAMP() WHERE id = $2`, [actor, id]);
  if (!n) return fail("Not found.");
  if (entity === "passage") await exec(db, "UPDATE rd_questions SET review_state = 'reviewed', reviewed_by = $1, reviewed_at = UTC_TIMESTAMP() WHERE passage_id = $2", [actor, id]);
  await audit(db, actor, "content.reviewed", entity, id);
  return { ok: true, message: "Marked as reviewed by you." };
}

export interface QuestionEdit { id: number; stem: string; optionsText: string; keyText: string; explanation: string; skill: string; qtype: string; difficulty: number; expectedSecs: number; status: string }

/** Edit a single-answer or short-answer question. The edit is validated as a whole, and an edit to an approved question returns it to unreviewed. */
export async function updateQuestion(actor: number, e: QuestionEdit, db: Db = pool): Promise<Result> {
  const row = await first(db, "SELECT q.*, p.body FROM rd_questions q JOIN rd_passages p ON p.id = q.passage_id WHERE q.id = $1", [e.id]);
  if (!row) return fail("That question does not exist.");
  if (row.format === "match") return fail("Match questions are edited by re-importing them (the pairing is not edited as text).");
  const lines = e.optionsText.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  const draft: QuestionDraft = { ...draftQ(row), stem: e.stem.trim(), explanation: e.explanation.trim(), skill: e.skill as QuestionDraft["skill"], qtype: e.qtype as QuestionDraft["qtype"], difficulty: e.difficulty as Difficulty, expectedSecs: e.expectedSecs };
  if (row.format === "short") draft.answer = e.keyText.split("|").map((s) => s.trim()).filter(Boolean);
  else { draft.options = lines; draft.answer = Number(e.keyText); }
  if (!isSkill(e.skill) || !isQType(e.qtype)) return fail("Unknown skill or question type.");
  const errs = validateQuestion(draft, row.body).filter((i) => i.level === "error");
  if (errs.length) return fail(errs[0].message);
  const status = ["draft", "approved", "archived"].includes(e.status) ? e.status : row.status;
  if (status === "approved" && row.source === "ai" && row.review_state !== "reviewed") return fail("AI-drafted questions must be reviewed before they are approved.");
  await exec(db, "UPDATE rd_questions SET stem = $1, options_json = $2, answer_json = $3, explanation = $4, skill = $5, qtype = $6, difficulty = $7, expected_secs = $8, status = $9, review_state = 'unreviewed' WHERE id = $10", [draft.stem, JSON.stringify(draft.options), JSON.stringify(draft.answer), draft.explanation, draft.skill, draft.qtype, draft.difficulty, draft.expectedSecs, status, e.id]);
  await audit(db, actor, "question.updated", "question", e.id, { ref: row.ref, status });
  return { ok: true, message: `Question ${row.ref} saved. It needs review again because it changed.` };
}

/**
 * Import passages with their questions from JSON (hand-authored or drafted by an AI). Everything arrives as a DRAFT with the source recorded; it
 * is validated, and it can be approved only through the same checks as any other content. AI-sourced content additionally needs a human review.
 */
export async function importDrafts(actor: number, json: string, source: "authored" | "ai", db: Db = pool): Promise<Result<number>> {
  let data: unknown;
  try { data = JSON.parse(json); } catch { return fail("That is not valid JSON."); }
  const list = (Array.isArray(data) ? data : [data]) as PassageDraft[];
  if (!list.length || list.length > 20) return fail("Import between 1 and 20 passages at a time.");
  const problems: string[] = [];
  for (const p of list) {
    if (!p || typeof p !== "object" || typeof p.body !== "string" || !Array.isArray(p.questions)) { problems.push("A passage is missing its text or its questions."); continue; }
    problems.push(...validatePassage(p).filter((i) => i.level === "error").map((i) => i.message));
  }
  if (problems.length) return fail(`Not imported. ${problems.slice(0, 6).join(" ")}`);
  let n = 0;
  try {
   await tx(async (t) => {
    for (const p of list) {
      const exists = await first(t, "SELECT id FROM rd_passages WHERE slug = $1", [p.slug]);
      if (exists) throw new Error(`A passage with the slug ${p.slug} already exists.`);
      await exec(t, "INSERT INTO rd_passages (slug, title, body, topic, difficulty, vocab_level, word_count, level_key, is_diagnostic, status, source, review_state) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'draft',$10,'unreviewed')", [p.slug, p.title, p.body, p.topic || "general", p.difficulty, p.vocabLevel || 2, wordsIn(p.body), p.levelKey || null, p.isDiagnostic ? 1 : 0, source]);
      const row = await first(t, "SELECT id FROM rd_passages WHERE slug = $1", [p.slug]);
      let pos = 0;
      for (const q of p.questions) await exec(t, "INSERT INTO rd_questions (passage_id, ref, mode, format, stem, options_json, answer_json, explanation, skill, qtype, difficulty, expected_secs, position, status, source, review_state) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'draft',$14,'unreviewed')", [row!.id, q.ref, q.mode, q.format, q.stem, JSON.stringify(q.options), JSON.stringify(q.answer), q.explanation, q.skill, q.qtype, q.difficulty, q.expectedSecs, pos++, source]);
      await audit(t, actor, "content.imported", "passage", row!.id, { slug: p.slug, source, questions: p.questions.length });
      n++;
    }
  });
  } catch (e) { return fail(e instanceof Error ? e.message : "The import failed and nothing was saved."); }
  return { ok: true, value: n, message: `${n} passage${n === 1 ? "" : "s"} imported as drafts. Review and approve them to publish.` };
}

// ---- configuration ----------------------------------------------------------------------------------------------------------------

export async function saveConfig(actor: number, patch: Partial<Record<keyof Config, unknown>>, db: Db = pool): Promise<Result> {
  const before = await getConfig(db);
  const next: Record<string, unknown> = { ...before };
  for (const [k, v] of Object.entries(patch)) if (k in DEFAULT_CONFIG) next[k] = v;
  const parsed = configSchema.safeParse(next);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Those settings are not valid.");
  const changed = Object.keys(patch).filter((k) => JSON.stringify((before as Record<string, unknown>)[k]) !== JSON.stringify((parsed.data as Record<string, unknown>)[k]));
  for (const k of changed) await exec(db, "INSERT INTO rd_config (k, v_json, updated_by) VALUES ($1,$2,$3) ON DUPLICATE KEY UPDATE v_json = VALUES(v_json), updated_by = VALUES(updated_by)", [k, JSON.stringify((parsed.data as Record<string, unknown>)[k]), actor]);
  if (changed.length) await audit(db, actor, "config.changed", "config", changed.join(",").slice(0, 40), { before: Object.fromEntries(changed.map((k) => [k, (before as Record<string, unknown>)[k]])), after: Object.fromEntries(changed.map((k) => [k, (parsed.data as Record<string, unknown>)[k]])) });
  return { ok: true, message: changed.length ? `Saved: ${changed.join(", ")}. New assessments use the new settings; finished ones keep their score and its version.` : "Nothing changed." };
}

export async function resetConfig(actor: number, db: Db = pool): Promise<Result> {
  await exec(db, "DELETE FROM rd_config");
  await audit(db, actor, "config.reset", "config", "all");
  return { ok: true, message: "Settings are back to the starting values." };
}

// ---- levels -----------------------------------------------------------------------------------------------------------------------

export interface LevelEdit { key: string; name: string; objective: string; position: number; passPct: number; minQuestions: number; masterySize: number; active: boolean; timed: boolean; objectivesText?: string; lessonText?: string; tipsText?: string }

export async function saveLevel(actor: number, e: LevelEdit, create: boolean, db: Db = pool): Promise<Result> {
  const key = e.key.trim().toUpperCase();
  if (!/^[A-Z0-9]{1,2}$/.test(key)) return fail("A level key is one or two letters or digits, for example K.");
  if (e.name.trim().length < 3 || e.name.length > 80) return fail("Give the level a name of 3 to 80 characters.");
  if (!(e.passPct >= 50 && e.passPct <= 100) || !(e.minQuestions >= 2 && e.minQuestions <= 20) || !(e.masterySize >= e.minQuestions && e.masterySize <= 20)) return fail("The pass mark must be 50 to 100, and the mastery size at least the minimum number of questions.");
  const exists = await first(db, "SELECT level_key, lesson_json FROM rd_levels WHERE level_key = $1", [key]);
  if (create && exists) return fail(`Level ${key} already exists.`);
  if (!create && !exists) return fail("That level does not exist.");
  let lesson: Record<string, unknown> = { objectives: [], lesson: [], tips: [], completion: `Reach ${e.passPct}% on the mastery check.` };
  try { lesson = { ...lesson, ...(exists ? JSON.parse(exists.lesson_json) : {}) }; } catch { /* keep default */ }
  const lines = (s?: string) => (s ?? "").split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  if (e.objectivesText !== undefined) lesson.objectives = lines(e.objectivesText);
  if (e.tipsText !== undefined) lesson.tips = lines(e.tipsText);
  if (e.lessonText !== undefined) lesson.lesson = (e.lessonText ?? "").split(/\r?\n\s*\r?\n/).map((x) => x.trim()).filter(Boolean);
  lesson.completion = `Complete the practice, then reach ${e.passPct}% on the mastery check.`;
  await exec(db, "INSERT INTO rd_levels (level_key, position, name, objective, lesson_json, pass_pct, min_questions, mastery_size, timed, active) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON DUPLICATE KEY UPDATE position = VALUES(position), name = VALUES(name), objective = VALUES(objective), lesson_json = VALUES(lesson_json), pass_pct = VALUES(pass_pct), min_questions = VALUES(min_questions), mastery_size = VALUES(mastery_size), timed = VALUES(timed), active = VALUES(active)", [key, e.position, e.name.trim(), e.objective.trim().slice(0, 500), JSON.stringify(lesson), e.passPct, e.minQuestions, e.masterySize, e.timed ? 1 : 0, e.active ? 1 : 0]);
  await audit(db, actor, create ? "level.created" : "level.changed", "level", key, { name: e.name, position: e.position, passPct: e.passPct, active: e.active });
  return { ok: true, message: create ? `Level ${key} added.` : `Level ${key} saved.` };
}

// ---- reports ----------------------------------------------------------------------------------------------------------------------

export interface AdminStats {
  minCohort: number;
  students: number;
  started: number;
  completed: number;
  partial: number;
  abandoned: number;
  byKind: Array<{ kind: string; n: number }>;
  premium: number;
  withResult: number;
  ctaClicks: number;
  bySource: Array<{ source: string; n: number }>;
  conversion: number | null;
  avgOverall: number | null;
  hardTypes: Array<{ qtype: string; label: string; answers: number; accuracy: number }> | null;
  hardSkills: Array<{ skill: string; label: string; answers: number; accuracy: number }> | null;
  reviewBacklog: { passages: number; questions: number };
  suppressed: boolean;
}

export async function adminStats(db: Db = pool): Promise<AdminStats> {
  const cfg = await getConfig(db);
  const num = async (sql: string, params: unknown[] = []) => Number((await first(db, sql, params))?.n ?? 0);
  const students = await num("SELECT COUNT(DISTINCT user_id) AS n FROM rd_assessments");
  const started = await num("SELECT COUNT(*) AS n FROM rd_assessments");
  const completed = await num("SELECT COUNT(*) AS n FROM rd_assessments WHERE status = 'submitted' AND completion = 'complete'");
  const partial = await num("SELECT COUNT(*) AS n FROM rd_assessments WHERE status = 'submitted' AND completion = 'partial'");
  const abandoned = await num("SELECT COUNT(*) AS n FROM rd_assessments WHERE status = 'open' AND created_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 24 HOUR)");
  const withResult = await num("SELECT COUNT(DISTINCT user_id) AS n FROM rd_assessments WHERE status = 'submitted'");
  const premium = await num("SELECT COUNT(DISTINCT user_id) AS n FROM pay_entitlements WHERE kind = 'course' AND ref = $1 AND status = 'active'", [READING_SLUG]);
  const ctaClicks = await num("SELECT COUNT(*) AS n FROM rd_events WHERE event = 'cta_click'");
  const small = students < cfg.minCohort;
  const avg = small ? null : Number((await first(db, "SELECT AVG(overall_score) AS a FROM rd_assessments WHERE status = 'submitted' AND completion = 'complete' AND overall_score IS NOT NULL"))?.a ?? 0) || null;
  let hardTypes: AdminStats["hardTypes"] = null, hardSkills: AdminStats["hardSkills"] = null;
  if (!small) {
    hardTypes = (await rows(db, "SELECT qtype, COUNT(*) AS n, AVG(credit) AS a FROM rd_answers WHERE skipped = 0 GROUP BY qtype HAVING COUNT(DISTINCT user_id) >= $1 ORDER BY AVG(credit) ASC LIMIT 5", [cfg.minCohort])).map((r) => ({ qtype: r.qtype, label: isQType(r.qtype) ? QTYPES[r.qtype] : r.qtype, answers: Number(r.n), accuracy: Math.round(Number(r.a) * 1000) / 10 }));
    hardSkills = (await rows(db, "SELECT skill, COUNT(*) AS n, AVG(credit) AS a FROM rd_answers WHERE skipped = 0 GROUP BY skill HAVING COUNT(DISTINCT user_id) >= $1 ORDER BY AVG(credit) ASC LIMIT 5", [cfg.minCohort])).map((r) => ({ skill: r.skill, label: isSkill(r.skill) ? SKILLS[r.skill].label : r.skill, answers: Number(r.n), accuracy: Math.round(Number(r.a) * 1000) / 10 }));
  }
  return {
    minCohort: cfg.minCohort, students, started, completed, partial, abandoned,
    byKind: (await rows(db, "SELECT kind, COUNT(*) AS n FROM rd_assessments GROUP BY kind ORDER BY n DESC")).map((r) => ({ kind: r.kind, n: Number(r.n) })),
    premium, withResult, ctaClicks, bySource: (await rows(db, "SELECT source, COUNT(*) AS n FROM rd_events WHERE event = 'cta_click' GROUP BY source ORDER BY n DESC LIMIT 8")).map((r) => ({ source: r.source, n: Number(r.n) })),
    conversion: small || !withResult ? null : Math.round((1000 * premium) / withResult) / 10, avgOverall: avg === null ? null : Math.round(avg * 10) / 10, hardTypes, hardSkills,
    reviewBacklog: { passages: await num("SELECT COUNT(*) AS n FROM rd_passages WHERE review_state <> 'reviewed' AND status <> 'archived'"), questions: await num("SELECT COUNT(*) AS n FROM rd_questions WHERE review_state <> 'reviewed' AND status <> 'archived'") },
    suppressed: small,
  };
}

export async function recentAudit(limit = 40, db: Db = pool): Promise<Array<{ id: number; at: string; actor: string; action: string; entity: string; entityId: string; detail: string }>> {
  return (await rows(db, `SELECT a.id, a.created_at, a.action, a.entity, a.entity_id, a.detail_json, COALESCE(u.name, 'system') AS actor FROM rd_audit a LEFT JOIN users u ON u.id = a.actor_id ORDER BY a.id DESC LIMIT ${Math.max(1, Math.min(200, limit))}`)).map((r) => ({ id: Number(r.id), at: String(r.created_at), actor: r.actor, action: r.action, entity: r.entity, entityId: r.entity_id, detail: String(r.detail_json) }));
}

/** An aggregate CSV for authorised staff: per skill, number of answers, accuracy, only where at least the minimum number of students stand behind the row. */
export async function aggregateCsv(db: Db = pool): Promise<string> {
  const cfg = await getConfig(db);
  const out = ["skill,question_type,difficulty,answers,students,accuracy_percent"];
  for (const r of await rows(db, "SELECT skill, qtype, difficulty, COUNT(*) AS n, COUNT(DISTINCT user_id) AS u, AVG(credit) AS a FROM rd_answers WHERE skipped = 0 GROUP BY skill, qtype, difficulty HAVING COUNT(DISTINCT user_id) >= $1 ORDER BY skill, qtype, difficulty", [cfg.minCohort])) out.push([r.skill, r.qtype, r.difficulty, r.n, r.u, Math.round(Number(r.a) * 1000) / 10].join(","));
  if (out.length === 1) out.push(`# no row has at least ${cfg.minCohort} students behind it yet, so none is shown`);
  return out.join("\r\n");
}

export interface ContentQuality { mcq: number; keyIsLongest: number; keyIsLongestPct: number; keyOverDouble: number; byPosition: number[]; note: string }

/**
 * Answer-pattern checks on the approved single-answer questions. If students could do well by always choosing the longest option, the score would
 * partly measure that habit rather than reading, so the share is measured and shown to the people who edit content.
 */
export async function contentQuality(db: Db = pool): Promise<ContentQuality> {
  let mcq = 0, longest = 0, over = 0;
  const byPosition = [0, 0, 0, 0, 0];
  for (const r of await rows(db, "SELECT options_json, answer_json FROM rd_questions WHERE status = 'approved' AND format IN ('mcq','conclusion')")) {
    const o = JSON.parse(r.options_json) as string[], k = JSON.parse(r.answer_json) as number;
    if (!Array.isArray(o) || typeof k !== "number" || !o[k]) continue;
    mcq++;
    byPosition[k] = (byPosition[k] ?? 0) + 1;
    const L = o.map((x) => x.length);
    if (L[k] === Math.max(...L)) longest++;
    if (L[k] > 1.8 * (L.reduce((a, b) => a + b, 0) / L.length)) over++;
  }
  const pct = mcq ? Math.round((1000 * longest) / mcq) / 10 : 0;
  return { mcq, keyIsLongest: longest, keyIsLongestPct: pct, keyOverDouble: over, byPosition, note: pct > 45 ? "In many questions the correct option is also the longest. A test-wise student can score above chance without reading. Rebalance option lengths during editorial review before relying on scores." : "Option lengths do not give the answer away." };
}
