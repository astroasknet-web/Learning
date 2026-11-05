import "server-only";
import { first, pool, rows, type Db } from "../pay/db";
import { greAttempt, GRE_SOURCE } from "./adapters/gre";
import { mathSpeedAttempt, MATHSPEED_SOURCE, type MsAttempt } from "./adapters/mathspeed";
import { ingest, type IngestResult } from "./store";

/**
 * The bridge between the existing test modules and the central engine. Every completed attempt flows through here: a thin, NON-THROWING wrapper so an
 * analytics failure can never corrupt or block the original test submission (the specification's separation of authoritative results from derived
 * analytics). It also backfills historical attempts, idempotently, so the Studio is complete the day it ships.
 */
const iso = (s: string | Date | null | undefined): string => {
  if (!s) return new Date().toISOString();
  if (s instanceof Date) return s.toISOString();
  return new Date(s.replace(" ", "T") + (/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? "" : "Z")).toISOString();
};

// ---- GRE Quant -----------------------------------------------------------------------------------------------------------------

/** Decode the stored answers (indices stored as strings) to numbers, re-grade and ingest. Safe to call after `attempts.save`. */
export async function ingestGre(userId: number, testNo: number, answers: Record<string, string | number>, seconds: number, finishedAt: string | Date, db?: Db): Promise<IngestResult> {
  const nums: Record<string, number> = {};
  for (const [k, v] of Object.entries(answers)) { const n = typeof v === "number" ? v : parseInt(String(v), 10); if (Number.isInteger(n)) nums[k] = n; }
  return ingest(greAttempt(userId, testNo, nums, Math.max(0, Math.trunc(seconds)), iso(finishedAt)), Date.now(), db);
}
export async function tryIngestGre(userId: number, testNo: number, answers: Record<string, string | number>, seconds: number, finishedAt: string | Date = new Date()): Promise<void> {
  try { await ingestGre(userId, testNo, answers, seconds, finishedAt); } catch { /* analytics must never break a test submission */ }
}

// ---- Mathematics Speed ----------------------------------------------------------------------------------------------------------

/** Read a submitted Mathematics Speed session and its marked answers, map and ingest. */
export async function ingestMathSpeedSession(userId: number, publicId: string, db: Db = pool): Promise<IngestResult | null> {
  const s = await first(db, "SELECT id, public_id, user_id, kind, ref, status, submitted_at, created_at FROM ms_sessions WHERE public_id = $1 AND user_id = $2", [publicId, userId]);
  if (!s || s.status !== "submitted") return null;
  const ans = await rows(db, "SELECT skill, d, correct, ms, allowed_ms FROM ms_attempts WHERE session_id = $1 ORDER BY idx ASC", [Number(s.id)]);
  if (!ans.length) return null;
  const items: MsAttempt[] = ans.map((a) => ({ skill: String(a.skill), d: Number(a.d), correct: Number(a.correct) === 1, ms: Number(a.ms), allowedMs: Number(a.allowed_ms) }));
  const totalMs = items.reduce((x, a) => x + a.ms, 0);
  const label = `Mathematics Speed: ${labelKind(String(s.kind))}${s.ref ? ` ${s.ref}` : ""}`;
  return ingest(mathSpeedAttempt(userId, publicId, label, iso(s.submitted_at as string), totalMs, items), Date.now(), db);
}
export async function tryIngestMathSpeedSession(userId: number, publicId: string): Promise<void> {
  try { await ingestMathSpeedSession(userId, publicId); } catch { /* never break the studio submission */ }
}
const labelKind = (k: string): string => ({ practice: "practice", drill: "timed drill", level: "level assessment", progress: "progress assessment", mastery: "mastery assessment", foundation: "foundation check", revision: "revision", review: "daily review", diagnostic: "placement check", benchmark: "benchmark" }[k] ?? k);

// ---- mixed-subject mock exams (JEE, IMO, and other LMS mocks) -------------------------------------------------------------------

import { item as contractItem, type MathItem } from "./contract";
import { topicById } from "./taxonomy";

export interface MockItemIn { topic: string; difficulty?: number; correct: boolean; skipped: boolean; maxMarks?: number }
export interface MockSubmission { source: string; sourceRef: string; label: string; finishedAt?: string | Date; totalMs?: number; items: MockItemIn[] }

/**
 * Ingest a finished mock whose questions were already mapped to taxonomy topics by the page (JEE Maths section, an IMO mock). Non-maths questions are
 * dropped before this is called. The answer key of these self-study mocks is shown to the student at the end, so grading on the client is acceptable
 * here, exactly as the platform already treats these mocks; the contract still validates every item and rejects anything malformed.
 */
export async function ingestMock(userId: number, sub: MockSubmission, db?: Db): Promise<IngestResult> {
  const maths = sub.items.filter((i) => topicById(i.topic));
  if (!maths.length) return { ok: false, errors: ["no mathematics questions in this mock"] };
  const items: MathItem[] = maths.map((i, n) => contractItem({ ref: `${sub.sourceRef}:${n}`, topic: i.topic, cognitive: topicById(i.topic)!.cognitive, difficulty: i.difficulty ?? 3, format: "mcq", correct: i.correct, skipped: i.skipped, maxMarks: Math.max(1, i.maxMarks || 1) }));
  const finishedAt = iso(sub.finishedAt);
  return ingest({ v: 1, source: sub.source.slice(0, 40), sourceRef: sub.sourceRef.slice(0, 64), userId, label: sub.label.slice(0, 120), startedAt: new Date(Date.parse(finishedAt) - Math.max(0, sub.totalMs ?? 0)).toISOString(), finishedAt, totalMs: Math.max(0, sub.totalMs ?? 0), items }, Date.now(), db);
}
export async function tryIngestMock(userId: number, sub: MockSubmission): Promise<void> {
  try { await ingestMock(userId, sub); } catch { /* never break a mock submission */ }
}

// ---- backfill ------------------------------------------------------------------------------------------------------------------

export interface Backfill { gre: number; mathspeed: number; errors: number }

/** Ingest every historical attempt (all students, or one). Idempotent: re-running updates in place. Used by scripts/mathstudio-backfill and the admin reprocess. */
export async function backfill(db: Db = pool, userId?: number): Promise<Backfill> {
  const out: Backfill = { gre: 0, mathspeed: 0, errors: 0 };
  const greRows = await rows(db, `SELECT user_id, test_no, answers_json, seconds, created_at FROM test_attempts WHERE exam = $1 ${userId ? "AND user_id = $2" : ""} ORDER BY id ASC`, userId ? [GRE_SOURCE, userId] : [GRE_SOURCE]);
  for (const r of greRows) {
    try { let a: Record<string, string> = {}; try { a = JSON.parse(r.answers_json); } catch { /* skip */ } const res = await ingestGre(Number(r.user_id), Number(r.test_no), a, Number(r.seconds), r.created_at as string, db); if (res.ok) out.gre++; else out.errors++; }
    catch { out.errors++; }
  }
  const msRows = await rows(db, `SELECT public_id, user_id FROM ms_sessions WHERE status = 'submitted' ${userId ? "AND user_id = $1" : ""} ORDER BY id ASC`, userId ? [userId] : []);
  for (const r of msRows) {
    try { const res = await ingestMathSpeedSession(Number(r.user_id), String(r.public_id), db); if (res?.ok) out.mathspeed++; else if (res) out.errors++; }
    catch { out.errors++; }
  }
  return out;
}

export { GRE_SOURCE, MATHSPEED_SOURCE };
