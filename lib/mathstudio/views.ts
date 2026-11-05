import "server-only";
import { pool, type Db } from "../pay/db";
import { hasPremium } from "./access";
import { buildCharts, type ChartSet } from "./charts";
import { getConfig } from "./store";
import { attempts, cachedMastery, getStudyMinutes, loadItems, type AttemptRow } from "./store";
import { BAND_LABEL, masteryByTopic, overallScore, type Mastery, type Overall } from "./engine";
import { diagnose, strengths, dataNote, type Strength, type Weakness } from "./diagnosis";
import { buildPlan, pitches, type Pitch, type Plan } from "./recommend";
import { topicMovement, trend, type AttemptSummary } from "./progress";
import { EVIDENCE_LABEL, topicById } from "./taxonomy";

/** Turns the stored items into the view models the pages render. Access is decided here, on the server: for a free student the premium fields are null and never reach the page. */
const asSummaries = (rows: AttemptRow[]): AttemptSummary[] => rows.map((a) => ({ attemptId: a.id, source: a.source, label: a.label, at: a.finishedAt, items: a.itemCount, accuracyPct: a.accuracyPct, overall: a.overall }));

export interface StudioView {
  hasData: boolean;
  premium: boolean;
  engineNote: string;
  overall: Overall;
  tiles: { overall: number | null; band: string | null; accuracyPct: number | null; attempted: number; correct: number; incorrect: number; skipped: number; masteryAvg: number | null; speed: string; consistency: number | null; tests: number; topicsAssessed: number; needAttention: number; improvement: number | null };
  dataNote: string | null;
  strengths: Strength[];
  weakest: Array<{ topic: string; topicName: string; score: number; items: number; evidence: string }>;
  // premium
  mastery: Mastery[] | null;
  weaknesses: Weakness[] | null;
  charts: ChartSet | null;
  planPreview: Plan | null;
  trendMsg: string | null;
  // free
  locked: { pitches: Pitch[]; counts: { topics: number; weaknesses: number; charts: number } } | null;
}

export async function buildStudio(userId: number, db: Db = pool): Promise<StudioView> {
  const now = Date.now();
  const [premium, cfg, items, rows, minutes] = await Promise.all([hasPremium(userId), getConfig(db), loadItems(userId, db), attempts(userId, db), getStudyMinutes(userId, db)]);
  const summaries = asSummaries(rows);
  const overall = overallScore(items, cfg, now);
  const mastery = masteryByTopic(items, cfg, now);
  const assessed = mastery.filter((m) => m.evidence !== "insufficient");
  const weaknesses = diagnose(items, cfg, now);
  const str = strengths(items, cfg, now);
  const mv = topicMovement(items, cfg, now);
  const improvement = mv.improved.length || mv.slipped.length ? mv.improved.reduce((a, m) => a + m.delta, 0) + mv.slipped.reduce((a, m) => a + m.delta, 0) : null;
  const masteryAvg = assessed.length ? Math.round((assessed.reduce((a, m) => a + m.score * m.items, 0) / assessed.reduce((a, m) => a + m.items, 0)) * 10) / 10 : null;
  const t = trend(summaries);
  const tiles = {
    overall: overall.score, band: overall.band ? BAND_LABEL[overall.band] : null, accuracyPct: overall.accuracy.pct, attempted: overall.accuracy.attempted, correct: overall.accuracy.correct, incorrect: overall.accuracy.incorrect, skipped: overall.accuracy.skipped,
    masteryAvg, speed: overall.speed.measurable ? `${overall.speed.medianSecs}s median` : "Not timed", consistency: overall.consistency.index, tests: rows.length, topicsAssessed: assessed.length,
    needAttention: mastery.filter((m) => m.evidence !== "insufficient" && (m.band === "support" || m.band === "developing")).length, improvement,
  };
  const base = {
    hasData: items.length > 0, premium, engineNote: `Engine ${overall.engineVersion}. Provisional: the weights are starting values and not yet validated against real outcomes.`,
    overall, tiles, dataNote: dataNote(items, rows.length, cfg),
    strengths: str, weakest: mastery.filter((m) => m.evidence !== "insufficient").slice(0, premium ? 0 : cfg.freeTopics).map((m) => ({ topic: m.topic, topicName: m.topicName, score: m.score, items: m.items, evidence: EVIDENCE_LABEL[m.evidence] })),
  };
  if (!premium) {
    return { ...base, mastery: null, weaknesses: null, charts: null, planPreview: null, trendMsg: items.length ? t.message : null,
      locked: { pitches: pitches({ topics: assessed.length, weakest: mastery.find((m) => m.evidence !== "insufficient")?.topicName ?? null, strongest: str[0]?.topicName ?? null, attempts: rows.length, weaknesses: weaknesses.length }), counts: { topics: assessed.length, weaknesses: weaknesses.length, charts: Object.values(buildCharts({ mastery, items, summaries })).filter(Boolean).length } } };
  }
  return { ...base, mastery, weaknesses, charts: buildCharts({ mastery, items, summaries }), planPreview: buildPlan(weaknesses, cfg, minutes ?? cfg.defaultStudyMinutes), trendMsg: t.message, locked: null };
}

// ---- weaknesses page ------------------------------------------------------------------------------------------------------------
export interface WeaknessView { premium: boolean; weaknesses: Weakness[]; dataNote: string | null; mastery: Mastery[] }
export async function buildWeaknesses(userId: number, db: Db = pool): Promise<WeaknessView | null> {
  const now = Date.now();
  const [premium, cfg, items, rows] = await Promise.all([hasPremium(userId), getConfig(db), loadItems(userId, db), attempts(userId, db)]);
  if (!premium) return null;
  return { premium, weaknesses: diagnose(items, cfg, now), dataNote: dataNote(items, rows.length, cfg), mastery: masteryByTopic(items, cfg, now) };
}

// ---- topics page ----------------------------------------------------------------------------------------------------------------
export async function buildTopics(userId: number, db: Db = pool): Promise<{ premium: boolean; mastery: Mastery[] } | null> {
  const [premium, cfg, items] = await Promise.all([hasPremium(userId), getConfig(db), loadItems(userId, db)]);
  if (!premium) return null;
  return { premium, mastery: masteryByTopic(items, cfg, Date.now()) };
}

// ---- plan page ------------------------------------------------------------------------------------------------------------------
export async function buildPlanView(userId: number, db: Db = pool): Promise<{ premium: boolean; plan: Plan } | null> {
  const [premium, cfg, items, minutes] = await Promise.all([hasPremium(userId), getConfig(db), loadItems(userId, db), getStudyMinutes(userId, db)]);
  if (!premium) return null;
  return { premium, plan: buildPlan(diagnose(items, cfg, Date.now()), cfg, minutes ?? cfg.defaultStudyMinutes) };
}

// ---- history & attempt detail ---------------------------------------------------------------------------------------------------
export interface HistoryRow { id: number; label: string; source: string; at: string; items: number; overall: number | null; accuracy: number | null }
export async function buildHistory(userId: number, db: Db = pool): Promise<{ premium: boolean; rows: HistoryRow[]; trendMsg: string; movement: ReturnType<typeof topicMovement> }> {
  const [premium, cfg, items, rows] = await Promise.all([hasPremium(userId), getConfig(db), loadItems(userId, db), attempts(userId, db)]);
  const sums = asSummaries(rows);
  const list = (premium ? rows : rows.slice(-1)).slice().reverse().map((a) => ({ id: a.id, label: a.label, source: a.source, at: a.finishedAt, items: a.itemCount, overall: a.overall, accuracy: a.accuracyPct }));
  return { premium, rows: list, trendMsg: trend(sums).message, movement: topicMovement(items, cfg, Date.now()) };
}

export interface QuestionRow { topic: string; topicName: string; difficulty: number; correct: boolean; skipped: boolean; seconds: number | null; expectedSecs: number | null; cognitive: string }
export async function buildAttempt(userId: number, attemptId: number, db: Db = pool): Promise<{ premium: boolean; attempt: AttemptRow; overall: Overall; questions: QuestionRow[] } | null> {
  const { getAttempt, attemptItems } = await import("./store");
  const [premium, cfg, a] = await Promise.all([hasPremium(userId), getConfig(db), getAttempt(userId, attemptId, db)]);
  if (!a || !premium) return a ? ({ premium, attempt: a, overall: overallScore(await attemptItems(userId, attemptId, db), cfg, Date.now()), questions: [] }) : null;
  const items = await attemptItems(userId, attemptId, db);
  return { premium, attempt: a, overall: overallScore(items, cfg, Date.now()), questions: items.map((i) => ({ topic: i.topic, topicName: topicById(i.topic)?.name ?? i.topic, difficulty: i.difficulty, correct: i.correct, skipped: i.skipped, seconds: i.timeMs === null ? null : Math.round(i.timeMs / 1000), expectedSecs: i.expectedSecs, cognitive: i.cognitive })) };
}
