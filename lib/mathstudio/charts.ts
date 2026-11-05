import type { Config } from "./config";
import { accuracyOf, type Item, type Mastery } from "./engine";
import type { AttemptSummary } from "./progress";
import { AREAS, DIFFICULTY_LABEL, topicById, type Difficulty } from "./taxonomy";

/**
 * Chart datasets, built from real data only. A builder returns null when the data would not support the chart, so the UI never draws an empty or
 * misleading graph. Each carries its own title, axis labels, a plain-language reading and a link to act on it; the component also renders a table of
 * the same numbers, so no chart is the only way to read a value.
 */
export interface ChartBase { id: string; title: string; xLabel: string; yLabel: string; interpretation: string; link: { href: string; label: string } }
export interface RadarChart extends ChartBase { kind: "radar"; axes: Array<{ key: string; label: string; value: number | null; items: number }> }
export interface BarChart extends ChartBase { kind: "bar"; rows: Array<{ key: string; label: string; value: number | null; low: number; high: number; items: number; evidence: string }> }
export interface LineChart extends ChartBase { kind: "line"; points: Array<{ x: string; label: string; y: number | null }>; }
export interface ScatterChart extends ChartBase { kind: "scatter"; points: Array<{ label: string; ratio: number; seconds: number; correct: boolean; difficulty: Difficulty }> }
export interface HeatChart extends ChartBase { kind: "heat"; cols: Difficulty[]; rows: Array<{ key: string; label: string; cells: Array<{ difficulty: Difficulty; n: number; pct: number | null }> }> }
export interface StackedChart extends ChartBase { kind: "stacked"; rows: Array<{ key: string; label: string; correct: number; incorrect: number; skipped: number }> }
export type Chart = RadarChart | BarChart | LineChart | ScatterChart | HeatChart | StackedChart;

const r1 = (n: number): number => Math.round(n * 10) / 10;
const credit = (i: Item): number => (i.maxMarks > 0 ? Math.min(1, i.credit / i.maxMarks) : i.correct ? 1 : 0);

/** Radar of mastery by the six areas, so the overall shape of a student's maths is one picture. */
export function radarChart(mastery: Mastery[]): RadarChart | null {
  const byArea = new Map<string, { s: number; n: number; items: number }>();
  for (const m of mastery) { if (m.evidence === "insufficient") continue; const e = byArea.get(m.area) ?? { s: 0, n: 0, items: 0 }; e.s += m.score * m.items; e.n += m.items; e.items += m.items; byArea.set(m.area, e); }
  const axes = AREAS.map((a) => { const e = byArea.get(a.id); return { key: a.id, label: a.name, value: e && e.n ? r1(e.s / e.n) : null, items: e?.items ?? 0 }; });
  if (axes.filter((a) => a.value !== null).length < 3) return null;
  const have = axes.filter((a) => a.value !== null);
  const hi = [...have].sort((a, b) => (b.value as number) - (a.value as number))[0];
  const lo = [...have].sort((a, b) => (a.value as number) - (b.value as number))[0];
  return { id: "radar", kind: "radar", title: "Your mathematics profile", xLabel: "Area (each spoke)", yLabel: "Mastery out of 100 (centre is 0)", axes, interpretation: `Strongest area: ${hi.label.toLowerCase()} (${hi.value}). Weakest: ${lo.label.toLowerCase()} (${lo.value}). Areas with too few questions are left blank.`, link: { href: "/math-studio/topics", label: "See every topic" } };
}

export function masteryBarChart(mastery: Mastery[]): BarChart | null {
  const rows = mastery.filter((m) => m.evidence !== "insufficient").slice(0, 14).map((m) => ({ key: m.topic, label: m.topicName, value: m.score, low: m.low, high: m.high, items: m.items, evidence: m.evidence }));
  if (rows.length < 2) return null;
  const low = rows[0];
  return { id: "mastery", kind: "bar", title: "Mastery by topic", xLabel: "Mastery (0–100, with its confidence band)", yLabel: "Topic", rows, interpretation: `${low.label} has your lowest mastery estimate (${Math.round(low.value)}/100). The band shows how sure the estimate is; it narrows as you answer more questions.`, link: { href: `/math-studio/topics`, label: "Open topic detail" } };
}

export function trendChart(summaries: AttemptSummary[]): LineChart | null {
  const pts = summaries.filter((s) => s.overall !== null).sort((a, b) => a.at.localeCompare(b.at) || a.attemptId - b.attemptId).slice(-10);
  if (pts.length < 3) return null;
  return { id: "trend", kind: "line", title: "Performance over time", xLabel: "Attempt (oldest to newest)", yLabel: "Overall score (0–100, provisional)", points: pts.map((p) => ({ x: String(p.attemptId), label: p.at.slice(0, 10), y: p.overall })), interpretation: `Across ${pts.length} attempts your score moved from ${pts[0].overall} to ${pts[pts.length - 1].overall}. Tests differ in difficulty, so read the direction over several, not one jump.`, link: { href: "/math-studio/history", label: "See the full history" } };
}

export function scatterChart(items: Item[]): ScatterChart | null {
  const timed = items.filter((i) => i.timeMs !== null && i.expectedSecs && !i.skipped);
  if (timed.length < 6) return null;
  const points = timed.map((i) => ({ label: topicById(i.topic)?.name ?? i.topic, ratio: r1((i.timeMs as number) / 1000 / (i.expectedSecs as number)), seconds: r1((i.timeMs as number) / 1000), correct: i.correct, difficulty: i.difficulty }));
  const slowRight = points.filter((p) => p.ratio > 1.3 && p.correct).length;
  const fastWrong = points.filter((p) => p.ratio < 0.5 && !p.correct).length;
  return { id: "scatter", kind: "scatter", title: "Speed against accuracy", xLabel: "Time taken vs the expected time (1.0 = on time)", yLabel: "Result", points, interpretation: `${slowRight} correct answer${slowRight === 1 ? "" : "s"} took well over the expected time; ${fastWrong} wrong answer${fastWrong === 1 ? " was" : "s were"} given very fast. Time alone never counts against you — it is read with accuracy.`, link: { href: "/math-studio/weaknesses", label: "See the timing findings" } };
}

export function heatChart(items: Item[]): HeatChart | null {
  const byArea = new Map<string, Item[]>();
  for (const i of items) { const area = topicById(i.topic)?.area ?? "reasoning"; byArea.set(area, [...(byArea.get(area) ?? []), i]); }
  const rows = AREAS.filter((a) => byArea.has(a.id)).map((a) => ({ key: a.id, label: a.name, cells: ([1, 2, 3, 4, 5] as Difficulty[]).map((d) => { const xs = (byArea.get(a.id) as Item[]).filter((i) => i.difficulty === d); return { difficulty: d, n: xs.length, pct: xs.length ? r1((100 * xs.reduce((s, i) => s + credit(i), 0)) / xs.length) : null }; }) }));
  if (rows.length < 2 || rows.reduce((a, r) => a + r.cells.filter((c) => c.n > 0).length, 0) < 4) return null;
  const flat = rows.flatMap((r) => r.cells.filter((c) => c.n >= 2 && c.pct !== null).map((c) => ({ r, c })));
  const low = flat.sort((a, b) => (a.c.pct as number) - (b.c.pct as number))[0];
  return { id: "heat", kind: "heat", title: "Where the marks are lost: area by difficulty", xLabel: "Difficulty", yLabel: "Area", cols: [1, 2, 3, 4, 5], rows, interpretation: low ? `The weakest cell with enough data is ${low.r.label.toLowerCase()} at ${DIFFICULTY_LABEL[low.c.difficulty].toLowerCase()} level (${Math.round(low.c.pct as number)}%). Blank cells mean no questions there yet.` : "Still filling in; blank cells mean no questions there yet.", link: { href: "/math-studio/weaknesses", label: "Open the weakness analysis" } };
}

export function stackedChart(items: Item[]): StackedChart | null {
  const rows = ([1, 2, 3, 4, 5] as Difficulty[]).map((d) => { const xs = items.filter((i) => i.difficulty === d); return { key: String(d), label: DIFFICULTY_LABEL[d], correct: xs.filter((i) => i.correct).length, incorrect: xs.filter((i) => !i.correct && !i.skipped).length, skipped: xs.filter((i) => i.skipped).length }; }).filter((r) => r.correct + r.incorrect + r.skipped > 0);
  if (rows.length < 2 || items.length < 8) return null;
  const worst = [...rows].sort((a, b) => (b.incorrect + b.skipped) / (b.correct + b.incorrect + b.skipped) - (a.incorrect + a.skipped) / (a.correct + a.incorrect + a.skipped))[0];
  return { id: "distribution", kind: "stacked", title: "Right, wrong and skipped by difficulty", xLabel: "Difficulty", yLabel: "Number of questions", rows, interpretation: `Most lost marks are at ${worst.label.toLowerCase()} level. Skipped questions are shown separately from wrong ones, because leaving a question is a different decision from getting it wrong.`, link: { href: "/math-studio/history", label: "Review your questions" } };
}

export interface ChartSet { radar: RadarChart | null; mastery: BarChart | null; trend: LineChart | null; scatter: ScatterChart | null; heat: HeatChart | null; distribution: StackedChart | null }
export function buildCharts(a: { mastery: Mastery[]; items: Item[]; summaries: AttemptSummary[] }): ChartSet {
  return { radar: radarChart(a.mastery), mastery: masteryBarChart(a.mastery), trend: trendChart(a.summaries), scatter: scatterChart(a.items), heat: heatChart(a.items), distribution: stackedChart(a.items) };
}
export const liveAccuracy = accuracyOf;
