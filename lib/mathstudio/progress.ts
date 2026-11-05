import type { Config } from "./config";
import { accuracyOf, masteryByTopic, type Item } from "./engine";

/** Performance over time: a snapshot per attempt, and the change across comparable attempts. Only attempts of the same source are compared, because a GRE mock and a mental-arithmetic drill are not the same test. */
export interface AttemptSummary {
  attemptId: number;
  source: string;
  label: string;
  at: string;
  items: number;
  accuracyPct: number | null;
  overall: number | null;
}

export interface TrendPoint { attemptId: number; at: string; label: string; overall: number | null; accuracy: number | null }

/** Overall-score trend across the last `n` complete attempts (any source), with the first-to-last change. A line needs at least three points. */
export function trend(summaries: AttemptSummary[], n = 10): { points: TrendPoint[]; firstToLast: number | null; message: string } {
  const pts = summaries.filter((s) => s.overall !== null).sort((a, b) => a.at.localeCompare(b.at) || a.attemptId - b.attemptId).slice(-n)
    .map((s) => ({ attemptId: s.attemptId, at: s.at, label: s.label, overall: s.overall, accuracy: s.accuracyPct }));
  if (pts.length < 2) return { points: pts, firstToLast: null, message: "A trend needs at least two attempts." };
  const firstToLast = Math.round(((pts[pts.length - 1].overall as number) - (pts[0].overall as number)) * 10) / 10;
  return { points: pts, firstToLast, message: `Across your last ${pts.length} attempts your overall score moved ${firstToLast >= 0 ? "+" : ""}${firstToLast} points.` };
}

export interface TopicMove { topic: string; topicName: string; before: number; after: number; delta: number }
/** Topics whose mastery rose or fell the most between the earlier half and the recent half of the history. */
export function topicMovement(items: Item[], cfg: Config, now: number): { improved: TopicMove[]; slipped: TopicMove[] } {
  const sorted = [...items].sort((a, b) => a.at.localeCompare(b.at));
  if (sorted.length < cfg.evidence.developing * 2) return { improved: [], slipped: [] };
  const mid = Math.floor(sorted.length / 2);
  const before = new Map(masteryByTopic(sorted.slice(0, mid), cfg, now).map((m) => [m.topic, m.score]));
  const after = masteryByTopic(sorted.slice(mid), cfg, now);
  const moves: TopicMove[] = [];
  for (const m of after) { const b = before.get(m.topic); if (b === undefined) continue; moves.push({ topic: m.topic, topicName: m.topicName, before: b, after: m.score, delta: Math.round((m.score - b) * 10) / 10 }); }
  return { improved: moves.filter((x) => x.delta >= 5).sort((a, b) => b.delta - a.delta).slice(0, 4), slipped: moves.filter((x) => x.delta <= -5).sort((a, b) => a.delta - b.delta).slice(0, 4) };
}

/** Accuracy of each attempt, oldest first, for the per-attempt comparison chart. */
export function attemptBars(items: Item[], summaries: AttemptSummary[], cfg: Config): Array<{ attemptId: number; label: string; at: string; accuracy: number | null; items: number }> {
  const by = new Map<number, Item[]>();
  for (const i of items) by.set(i.attemptId, [...(by.get(i.attemptId) ?? []), i]);
  return summaries.sort((a, b) => a.at.localeCompare(b.at)).map((s) => ({ attemptId: s.attemptId, label: s.label, at: s.at, accuracy: by.has(s.attemptId) ? accuracyOf(by.get(s.attemptId) as Item[], cfg).pct : s.accuracyPct, items: (by.get(s.attemptId) ?? []).length }));
}
