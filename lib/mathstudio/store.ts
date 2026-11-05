import "server-only";
import { exec, first, insertId, pool, rows, tx, type Db } from "../pay/db";
import { resolveConfig, type Config } from "./config";
import { validateAttempt, type MathAttempt } from "./contract";
import { masteryByTopic, overallScore, type Item } from "./engine";
import { SEED_TOPICS } from "./taxonomy";

/** Everything the Mathematics Studio stores, and the one place that ingests a finished attempt and recomputes the cached analytics. */
const dbTime = (d: Date | number = new Date()): string => new Date(d).toISOString().replace("T", " ").replace("Z", "");
const asIso = (s: string | null | undefined): string => (s ? new Date(String(s).replace(" ", "T") + (/[zZ]|[+-]\d\d:?\d\d$/.test(String(s)) ? "" : "Z")).toISOString() : "");

// ---- configuration & seeding ----------------------------------------------------------------------------------------------------

export async function getConfig(db: Db = pool): Promise<Config> {
  const stored: Record<string, unknown> = {};
  for (const r of await rows(db, "SELECT k, v_json FROM mx_config")) { try { stored[r.k] = JSON.parse(r.v_json); } catch { /* the default applies */ } }
  return resolveConfig(stored);
}

export async function audit(db: Db, actorId: number | null, action: string, entity: string, entityId: string | number, detail: Record<string, unknown> = {}): Promise<void> {
  await exec(db, "INSERT INTO mx_audit (actor_id, action, entity, entity_id, detail_json) VALUES ($1,$2,$3,$4,$5)", [actorId, action, entity, String(entityId).slice(0, 64), JSON.stringify(detail).slice(0, 2900)]);
}

let seeded = false;
/** Seed the taxonomy. Only inserts a topic the database does not have, so an administrator's edits are kept. */
export async function ensureSeed(db: Db = pool, force = false): Promise<number> {
  if (seeded && !force) return 0;
  let n = 0;
  for (let i = 0; i < SEED_TOPICS.length; i++) {
    const t = SEED_TOPICS[i];
    n += (await exec(db, "INSERT IGNORE INTO mx_topics (id, name, area, cognitive, prereq_json, position, active) VALUES ($1,$2,$3,$4,$5,$6,1)", [t.id, t.name, t.area, t.cognitive, JSON.stringify(t.prereq), i])) > 0 ? 1 : 0;
  }
  seeded = true;
  return n;
}

// ---- ingest ---------------------------------------------------------------------------------------------------------------------

export interface IngestResult { ok: boolean; attemptId?: number; created?: boolean; errors?: string[] }

/**
 * Ingest one finished attempt (from an adapter). Validates against the contract, upserts the attempt idempotently on (source, source_ref, user),
 * replaces its items, computes the attempt's own overall score, and refreshes the student's cached per-topic mastery. Never silently drops an
 * invalid attempt: it returns the validation errors.
 */
export async function ingest(raw: MathAttempt, now = Date.now(), db?: Db): Promise<IngestResult> {
  const v = validateAttempt(raw);
  if (!v.ok) return { ok: false, errors: v.errors };
  const a = v.attempt;
  const cfg = await getConfig(db ?? pool);
  const run = async (t: Db): Promise<IngestResult> => {
    const existing = await first(t, "SELECT id FROM mx_attempts WHERE source = $1 AND source_ref = $2 AND user_id = $3 FOR UPDATE", [a.source, a.sourceRef, a.userId]);
    const items: Item[] = a.items.map((it) => ({ attemptId: 0, at: a.finishedAt, topic: it.topic, cognitive: it.cognitive, difficulty: it.difficulty as Item["difficulty"], format: it.format, credit: it.credit, maxMarks: it.maxMarks, correct: it.correct, skipped: it.skipped, timeMs: it.timeMs, expectedSecs: it.expectedSecs }));
    const score = overallScore(items, cfg, now);
    const acc = score.accuracy.pct;
    let attemptId: number;
    if (existing) {
      attemptId = Number(existing.id);
      await exec(t, "UPDATE mx_attempts SET label = $1, engine_version = $2, started_at = $3, finished_at = $4, total_ms = $5, item_count = $6, overall_score = $7, accuracy_pct = $8 WHERE id = $9", [a.label, score.engineVersion, a.startedAt ? dbTime(Date.parse(a.startedAt)) : null, dbTime(Date.parse(a.finishedAt)), a.totalMs, a.items.length, score.score, acc, attemptId]);
      await exec(t, "DELETE FROM mx_items WHERE attempt_id = $1", [attemptId]);
    } else {
      attemptId = await insertId(t, "INSERT INTO mx_attempts (user_id, source, source_ref, label, engine_version, contract_version, started_at, finished_at, total_ms, item_count, overall_score, accuracy_pct) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)", [a.userId, a.source, a.sourceRef, a.label, score.engineVersion, a.v, a.startedAt ? dbTime(Date.parse(a.startedAt)) : null, dbTime(Date.parse(a.finishedAt)), a.totalMs, a.items.length, score.score, acc]);
    }
    for (const it of a.items) {
      await exec(t, "INSERT INTO mx_items (attempt_id, user_id, ref, topic, cognitive, difficulty, format, credit, max_marks, correct, skipped, time_ms, expected_secs, at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)", [attemptId, a.userId, it.ref, it.topic, it.cognitive, it.difficulty, it.format, it.credit, it.maxMarks, it.correct ? 1 : 0, it.skipped ? 1 : 0, it.timeMs, it.expectedSecs, dbTime(Date.parse(a.finishedAt))]);
    }
    await refreshMastery(t, a.userId, cfg, now);
    await audit(t, null, existing ? "attempt.reingested" : "attempt.ingested", "attempt", `${a.source}:${a.sourceRef}`, { userId: a.userId, items: a.items.length, score: score.score });
    return { ok: true, attemptId, created: !existing };
  };
  return db ? run(db) : tx(run);
}

/** Recompute and cache the student's per-topic mastery from all their items. Called after every ingest and by the admin reprocess. */
export async function refreshMastery(db: Db, userId: number, cfg: Config, now = Date.now()): Promise<void> {
  const items = await loadItems(userId, db);
  const mastery = masteryByTopic(items, cfg, now);
  await exec(db, "DELETE FROM mx_mastery WHERE user_id = $1", [userId]);
  for (const m of mastery) {
    await exec(db, "INSERT INTO mx_mastery (user_id, topic, score, p, low, high, items, attempts, evidence, band) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)", [userId, m.topic, m.score, m.p, m.low, m.high, m.items, m.attempts, m.evidence, m.band]);
  }
}

// ---- reads ----------------------------------------------------------------------------------------------------------------------

const itemOf = (r: Record<string, unknown>): Item => ({
  attemptId: Number(r.attempt_id), at: asIso(r.at as string), topic: String(r.topic), cognitive: r.cognitive as Item["cognitive"], difficulty: Number(r.difficulty) as Item["difficulty"],
  format: String(r.format), credit: Number(r.credit), maxMarks: Number(r.max_marks), correct: Number(r.correct) === 1, skipped: Number(r.skipped) === 1,
  timeMs: r.time_ms === null ? null : Number(r.time_ms), expectedSecs: r.expected_secs === null ? null : Number(r.expected_secs),
});

export async function loadItems(userId: number, db: Db = pool): Promise<Item[]> {
  return (await rows(db, "SELECT attempt_id, topic, cognitive, difficulty, format, credit, max_marks, correct, skipped, time_ms, expected_secs, at FROM mx_items WHERE user_id = $1 ORDER BY at ASC, id ASC", [userId])).map(itemOf);
}

export interface AttemptRow { id: number; source: string; sourceRef: string; label: string; finishedAt: string; totalMs: number; itemCount: number; overall: number | null; accuracyPct: number | null; engineVersion: string }
const attemptOf = (r: Record<string, unknown>): AttemptRow => ({ id: Number(r.id), source: String(r.source), sourceRef: String(r.source_ref), label: String(r.label), finishedAt: asIso(r.finished_at as string), totalMs: Number(r.total_ms), itemCount: Number(r.item_count), overall: r.overall_score === null ? null : Number(r.overall_score), accuracyPct: r.accuracy_pct === null ? null : Number(r.accuracy_pct), engineVersion: String(r.engine_version) });

export async function attempts(userId: number, db: Db = pool, limit = 200): Promise<AttemptRow[]> {
  return (await rows(db, `SELECT * FROM mx_attempts WHERE user_id = $1 ORDER BY finished_at ASC, id ASC LIMIT ${Math.max(1, Math.min(500, limit))}`, [userId])).map(attemptOf);
}
export async function getAttempt(userId: number, id: number, db: Db = pool): Promise<AttemptRow | null> {
  const r = await first(db, "SELECT * FROM mx_attempts WHERE id = $1 AND user_id = $2", [id, userId]);
  return r ? attemptOf(r) : null;
}
export async function attemptItems(userId: number, attemptId: number, db: Db = pool): Promise<Item[]> {
  return (await rows(db, "SELECT attempt_id, topic, cognitive, difficulty, format, credit, max_marks, correct, skipped, time_ms, expected_secs, at FROM mx_items WHERE user_id = $1 AND attempt_id = $2 ORDER BY id ASC", [userId, attemptId])).map(itemOf);
}

export interface CachedMastery { topic: string; score: number; low: number; high: number; items: number; attempts: number; evidence: string; band: string }
export async function cachedMastery(userId: number, db: Db = pool): Promise<CachedMastery[]> {
  return (await rows(db, "SELECT topic, score, low, high, items, attempts, evidence, band FROM mx_mastery WHERE user_id = $1 ORDER BY score ASC", [userId])).map((r) => ({ topic: String(r.topic), score: Number(r.score), low: Number(r.low), high: Number(r.high), items: Number(r.items), attempts: Number(r.attempts), evidence: String(r.evidence), band: String(r.band) }));
}

export async function getStudyMinutes(userId: number, db: Db = pool): Promise<number | null> {
  const r = await first(db, "SELECT study_minutes FROM mx_enrolment WHERE user_id = $1", [userId]);
  return r ? Number(r.study_minutes) : null;
}
export async function setStudyMinutes(userId: number, minutes: number, db: Db = pool): Promise<void> {
  const m = Math.max(5, Math.min(180, Math.round(minutes) || 30));
  await exec(db, "INSERT INTO mx_enrolment (user_id, study_minutes) VALUES ($1,$2) ON CONFLICT (user_id) DO UPDATE SET study_minutes = EXCLUDED.study_minutes", [userId, m]);
}

export async function logEvent(userId: number | null, event: string, source: string, db: Db = pool): Promise<void> {
  await exec(db, "INSERT INTO mx_events (user_id, event, source) VALUES ($1,$2,$3)", [userId, event.slice(0, 24), source.slice(0, 40)]);
}

export async function hasAnyData(userId: number, db: Db = pool): Promise<boolean> {
  return (await first(db, "SELECT 1 AS x FROM mx_attempts WHERE user_id = $1 LIMIT 1", [userId])) !== null;
}
