import type { SkillDiagnosis, HistoryItem } from "./diagnosis";
import type { Item, ScoreResult } from "./scoring";
import type { Summary } from "./progress";
import { SKILLS, DIFFICULTY_LABEL, type Difficulty, type SkillId } from "./taxonomy";

/**
 * Chart datasets, built from real results only. A builder returns null when the data would not support the chart (no empty charts, no trend line
 * through two points, no comparison with other students). Each chart carries its title, axis labels, a plain-language reading of the data and
 * the place to practise, and the page also renders it as a table, so no chart is the only way to get a number.
 */
export interface ChartBase { id: string; title: string; xLabel: string; yLabel: string; interpretation: string; practice: { href: string; label: string } }

export interface RadarChart extends ChartBase { kind: "radar"; axes: Array<{ key: string; label: string; value: number | null; n: number }> }
export interface BarChart extends ChartBase { kind: "bar"; rows: Array<{ key: string; label: string; value: number | null; n: number }> }
export interface LineChart extends ChartBase { kind: "line"; series: Array<{ name: string; points: Array<{ x: string; label: string; y: number | null }>; unit: string }>; dualAxis: boolean }
export interface StackedChart extends ChartBase { kind: "stacked"; rows: Array<{ key: string; label: string; correct: number; incorrect: number }> }
export interface ScatterChart extends ChartBase { kind: "scatter"; points: Array<{ id: number; label: string; ratio: number; seconds: number; correct: boolean; difficulty: Difficulty }> }
export interface HeatChart extends ChartBase { kind: "heat"; cols: Difficulty[]; rows: Array<{ key: string; label: string; cells: Array<{ difficulty: Difficulty; n: number; pct: number | null }> }> }
export type Chart = RadarChart | BarChart | LineChart | StackedChart | ScatterChart | HeatChart;

/** Radar axes, each made of named skills (the studio's six dimensions on one picture). */
const AXES: Array<{ key: string; label: string; skills: SkillId[] }> = [
  { key: "comprehension", label: "Comprehension", skills: ["main_idea", "details", "fact_opinion", "relationships", "purpose_tone", "data"] },
  { key: "inference", label: "Inference", skills: ["inference", "conclusion"] },
  { key: "vocabulary", label: "Vocabulary", skills: ["vocab_context", "figurative"] },
  { key: "critical", label: "Critical reading", skills: ["assumptions", "arguments", "contradiction"] },
  { key: "memory", label: "Memory", skills: ["recall_details", "recall_links"] },
];

const r1 = (n: number): number => Math.round(n * 10) / 10;
const MIN_AXIS_Q = 2;

export function radarChart(diags: SkillDiagnosis[], result: ScoreResult | null): RadarChart | null {
  const axes = AXES.map((a) => {
    const ds = diags.filter((d) => a.skills.includes(d.skill));
    const n = ds.reduce((x, d) => x + d.attempted, 0);
    const credit = ds.reduce((x, d) => x + d.correct, 0);
    return { key: a.key, label: a.label, value: n >= MIN_AXIS_Q ? r1((100 * credit) / n) : null, n };
  });
  const eff = result?.dimensions.find((d) => d.dimension === "efficiency");
  axes.push({ key: "efficiency", label: "Efficiency", value: eff?.score ?? null, n: eff?.score === null || eff === undefined ? 0 : result?.total ?? 0 });
  const have = axes.filter((a) => a.value !== null);
  if (have.length < 3) return null; // a radar with fewer than three spokes is not a shape
  const hi = [...have].sort((a, b) => (b.value as number) - (a.value as number))[0];
  const lo = [...have].sort((a, b) => (a.value as number) - (b.value as number))[0];
  return { id: "radar", kind: "radar", title: "Your reading profile", xLabel: "Skill area (each spoke)", yLabel: "Score out of 100 (centre is 0)", axes, interpretation: hi.key === lo.key ? "Your areas are level." : `Your strongest area here is ${hi.label.toLowerCase()} (${hi.value}) and your lowest is ${lo.label.toLowerCase()} (${lo.value}). Areas left out were not assessed with enough questions.`, practice: { href: "/reading-studio/levels", label: "Practise by level" } };
}

export function skillBarChart(diags: SkillDiagnosis[]): BarChart | null {
  const rows = diags.map((d) => ({ key: d.skill, label: d.label, value: d.accuracy, n: d.attempted })).sort((a, b) => (a.value ?? 0) - (b.value ?? 0));
  if (rows.length < 2) return null;
  const lowest = rows.find((r) => r.n >= 2) ?? rows[0];
  return { id: "skills", kind: "bar", title: "Accuracy by skill", xLabel: "Accuracy (% of questions correct)", yLabel: "Skill", rows, interpretation: `${lowest.label} has the lowest accuracy (${Math.round(lowest.value ?? 0)}% over ${lowest.n} question${lowest.n === 1 ? "" : "s"}). Skills with only one or two questions are marked as early signals.`, practice: { href: `/reading-studio/practice?skill=${lowest.key}`, label: `Practise ${lowest.label.toLowerCase()}` } };
}

export function trendChart(summaries: Summary[]): LineChart | null {
  const pts = summaries.filter((s) => s.completion === "complete" && s.overall !== null).sort((a, b) => a.at.localeCompare(b.at) || a.id - b.id).slice(-8);
  if (pts.length < 3) return null; // two points do not make a trend
  const first = pts[0].overall as number, last = pts[pts.length - 1].overall as number;
  return { id: "trend", kind: "line", title: "Overall score over time", xLabel: "Assessment (oldest to newest)", yLabel: "Overall score (out of 100, provisional)", dualAxis: false, series: [{ name: "Overall score", unit: "points", points: pts.map((p) => ({ x: String(p.id), label: p.at.slice(0, 10), y: p.overall })) }], interpretation: `Over ${pts.length} assessments your score moved from ${first} to ${last}. Passages differ in difficulty, so compare points on the same kind of assessment before reading much into a small change.`, practice: { href: "/reading-studio/progress", label: "See the full timeline" } };
}

export function stackedChart(items: Item[]): StackedChart | null {
  if (items.length < 6) return null;
  const rows = ([1, 2, 3] as Difficulty[]).map((d) => { const xs = items.filter((i) => i.difficulty === d); return { key: String(d), label: DIFFICULTY_LABEL[d], correct: xs.filter((x) => x.correct).length, incorrect: xs.filter((x) => !x.correct).length }; }).filter((r) => r.correct + r.incorrect > 0);
  if (rows.length < 2) return null;
  const worst = [...rows].sort((a, b) => b.incorrect / (b.correct + b.incorrect) - a.incorrect / (a.correct + a.incorrect))[0];
  return { id: "difficulty", kind: "stacked", title: "Correct and incorrect by difficulty", xLabel: "Question difficulty", yLabel: "Number of questions", rows, interpretation: `Most misses came on ${worst.label.toLowerCase()} questions (${worst.incorrect} of ${worst.correct + worst.incorrect}). A drop on harder questions is expected; what matters is whether it narrows over time.`, practice: { href: "/reading-studio/levels", label: "Practise at your level" } };
}

export function scatterChart(items: Item[]): ScatterChart | null {
  const timed = items.filter((i) => i.ms !== null && !i.skipped);
  if (timed.length < 6) return null;
  const points = timed.map((i) => ({ id: i.questionId, label: SKILLS[i.skill].label, ratio: r1((i.ms as number) / (i.expectedSecs * 1000)), seconds: r1((i.ms as number) / 1000), correct: i.correct, difficulty: i.difficulty }));
  const slowRight = points.filter((p) => p.ratio > 1.3 && p.correct).length;
  const fastWrong = points.filter((p) => p.ratio < 0.5 && !p.correct).length;
  return { id: "scatter", kind: "scatter", title: "Response time and accuracy, question by question", xLabel: "Time taken compared with the guide time (1.0 = guide time)", yLabel: "Result (correct or incorrect)", points, interpretation: `${slowRight} question${slowRight === 1 ? "" : "s"} took longer than the guide time and were answered correctly: careful reading. ${fastWrong} wrong answer${fastWrong === 1 ? " was" : "s were"} given in under half the guide time. Time on its own never counts against you; it is read together with accuracy.`, practice: { href: "/reading-studio/levels", label: "Practise careful answering" } };
}

export function progressChart(summaries: Summary[]): LineChart | null {
  const pts = summaries.filter((s) => s.completion === "complete" && s.wpm !== null && s.comprehensionPct !== null).sort((a, b) => a.at.localeCompare(b.at) || a.id - b.id).slice(-8);
  if (pts.length < 3) return null;
  const w0 = pts[0].wpm as number, w1 = pts[pts.length - 1].wpm as number, c0 = pts[0].comprehensionPct as number, c1 = pts[pts.length - 1].comprehensionPct as number;
  return { id: "speed-comprehension", kind: "line", title: "Reading speed alongside comprehension", xLabel: "Assessment (oldest to newest)", yLabel: "Words per minute (estimate) and comprehension %", dualAxis: true, series: [{ name: "Reading speed (words per minute, estimated)", unit: "wpm", points: pts.map((p) => ({ x: String(p.id), label: p.at.slice(0, 10), y: p.wpm })) }, { name: "Comprehension (%)", unit: "%", points: pts.map((p) => ({ x: String(p.id), label: p.at.slice(0, 10), y: p.comprehensionPct })) }], interpretation: `Speed went from ${Math.round(w0)} to ${Math.round(w1)} words per minute while comprehension went from ${Math.round(c0)}% to ${Math.round(c1)}%. Faster is only better when comprehension holds.`, practice: { href: "/reading-studio/practice?kind=timed", label: "Practise timed reading" } };
}

export function heatChart(history: HistoryItem[] | Item[]): HeatChart | null {
  const skills = [...new Set(history.map((h) => h.skill))];
  const rows = skills.map((s) => ({ key: s, label: SKILLS[s].label, cells: ([1, 2, 3] as Difficulty[]).map((d) => { const xs = history.filter((h) => h.skill === s && h.difficulty === d); return { difficulty: d, n: xs.length, pct: xs.length ? r1((100 * xs.reduce((a, x) => a + x.credit, 0)) / xs.length) : null }; }) }));
  if (rows.length < 2 || rows.reduce((a, r) => a + r.cells.filter((c) => c.n > 0).length, 0) < 4) return null;
  const flat = rows.flatMap((r) => r.cells.filter((c) => c.n >= 2 && c.pct !== null).map((c) => ({ r, c })));
  const low = flat.sort((a, b) => (a.c.pct as number) - (b.c.pct as number))[0];
  return { id: "heat", kind: "heat", title: "Skill by difficulty", xLabel: "Question difficulty", yLabel: "Skill", cols: [1, 2, 3], rows, interpretation: low ? `The weakest cell with at least two questions is ${low.r.label.toLowerCase()} at ${DIFFICULTY_LABEL[low.c.difficulty].toLowerCase()} level (${Math.round(low.c.pct as number)}%). Blank cells mean no questions yet, not a score of zero.` : "Most cells have a single question so far, so read this as a first sketch. Blank cells mean no questions yet.", practice: { href: "/reading-studio/levels", label: "Fill in the gaps with practice" } };
}

export interface ChartSet { radar: RadarChart | null; skills: BarChart | null; trend: LineChart | null; difficulty: StackedChart | null; scatter: ScatterChart | null; progress: LineChart | null; heat: HeatChart | null }

export function buildCharts(a: { diags: SkillDiagnosis[]; result: ScoreResult | null; items: Item[]; history: HistoryItem[]; summaries: Summary[] }): ChartSet {
  return { radar: radarChart(a.diags, a.result), skills: skillBarChart(a.diags), trend: trendChart(a.summaries), difficulty: stackedChart(a.items), scatter: scatterChart(a.items), progress: progressChart(a.summaries), heat: heatChart(a.history) };
}
