import "server-only";
import { pool, type Db } from "../pay/db";
import { buildCharts, type ChartSet } from "./charts";
import { diagnoseAll, strongest, weakest, type Cause, type SkillDiagnosis } from "./diagnosis";
import { compareToPrevious, readiness, skillProgress, trendOf, type Comparison, type SkillProgress, type Summary, type Trend } from "./progress";
import { pitchFacts, pitches, sevenDayPlan, strengthsOf, weaknessesOf, type ErrorExample, type Pitch, type PlanDay, type Weakness } from "./recommend";
import { BAND_LABEL, type DimensionResult } from "./scoring";
import { SKILLS, type SkillId } from "./taxonomy";
import { feeNow, hasAnalytics, hasPremium, trackAccess, TRACKS, type Track } from "./access";
import { forUser as ieltsAttempts } from "../tests/attempts";
import { ieltsLimit } from "../tests/access";
import { getAssessment, getConfig, getStudyMinutes, getTracks, essayProgress, itemsOf, levelStatesFor, loadHistory, reviewItems, summaries, type AiFeedback, type ReviewItem, type StoredResult } from "./store";

/**
 * The results page as a view model. Access is decided here, on the server: for a student without the package the premium fields are null (they
 * are never computed into the page, so they cannot be read from the page source), and the locked previews contain only counts that are true.
 */
export interface FreeSummary { label: string; pct: number; n: number }

export interface ResultsView {
  id: string;
  kind: string;
  submittedAt: string;
  premium: boolean;
  version: string;
  provisionalNote: string;
  completion: "complete" | "partial";
  partialNote: string | null;
  repeatNote: string | null;
  overall: { score: number | null; classification: string | null; capped: boolean };
  tiles: { wpm: number | null; wpmNote: string; targetWpm: number; comprehensionPct: number | null; qaPct: number | null; durationSecs: number; readingSecs: number | null; correct: number; incorrect: number; skipped: number; total: number };
  comparison: Comparison;
  dimensions: DimensionResult[];
  strongest: FreeSummary[];
  weakest: FreeSummary[];
  whyItMatters: string | null;
  next: { href: string; label: string; reason: string };
  // premium only
  skills: SkillDiagnosis[] | null;
  strengths: string[] | null;
  weaknesses: Weakness[] | null;
  causes: Cause[] | null;
  careful: string | null;
  charts: ChartSet | null;
  plan: { days: PlanDay[]; note: string } | null;
  review: ReviewItem[] | null;
  trend: Trend | null;
  skillProgress: SkillProgress | null;
  ai: AiFeedback | null;
  // free only
  locked: { pitches: Record<string, Pitch>; counts: { skills: number; missed: number; charts: number } } | null;
}

const NOTE = "Provisional score. It comes from published formulas and starting weights that have not yet been validated against real student data, so read it as a guide, not a measurement.";

export async function buildResults(userId: number, publicId: string, db: Db = pool): Promise<ResultsView | null> {
  const a = await getAssessment(userId, publicId, db);
  if (!a || a.status !== "submitted" || !a.result) return null;
  const premium = await hasAnalytics(userId);
  const cfg = await getConfig(db);
  const r: StoredResult = a.result;
  const score = r.score;
  const [history, sums, items] = await Promise.all([loadHistory(userId, db), summaries(userId, db), itemsOf(a, db)]);
  const diags = diagnoseAll(history, cfg);
  const me = sums.find((s) => s.id === a.id) as Summary;
  const comparison = compareToPrevious(me, sums);
  const picks = (xs: Array<{ skill: SkillId; label: string; pct: number | null; n: number }>) => xs.filter((s) => s.pct !== null && s.n >= 2);
  const own = picks(score.skills.map((s) => ({ skill: s.skill, label: s.label, pct: s.pct, n: s.n })));
  const strongestOwn = [...own].filter((s) => (s.pct as number) >= cfg.bands.developing).sort((x, y) => (y.pct as number) - (x.pct as number)).slice(0, 2).map((s) => ({ label: s.label, pct: Math.round(s.pct as number), n: s.n }));
  const weakestOwn = [...own].filter((s) => (s.pct as number) < cfg.bands.progressing).sort((x, y) => (x.pct as number) - (y.pct as number)).slice(0, 2).map((s) => ({ label: s.label, pct: Math.round(s.pct as number), n: s.n }));
  const weakSkill = weakest(diags, 1)[0] ?? null;
  const worstOwn = [...own].sort((x, y) => (x.pct as number) - (y.pct as number))[0];
  const whySkill = (weakSkill?.skill ?? (worstOwn && (worstOwn.pct as number) < cfg.bands.progressing ? worstOwn.skill : null)) as SkillId | null;
  const charts = buildCharts({ diags, result: score, items, history, summaries: sums });
  const chartCount = Object.values(charts).filter(Boolean).length;
  const missed = score.total - score.correct;
  const base = {
    id: publicId, kind: a.kind, submittedAt: a.submittedAt as string, premium, version: `scoring ${score.scoringVersion}${a.contentVersion ? `, content ${a.contentVersion}` : ""}`, provisionalNote: NOTE,
    completion: score.completion,
    partialNote: score.completion === "partial" ? `You answered ${score.answered} of ${score.total} questions, so this is a partial result. It is shown for your information but is not used for your progress trend or for level mastery.` : null,
    repeatNote: a.repeatOf ? "You have read this passage before, so part of the result may come from remembering it. A fresh passage is the better test." : null,
    overall: { score: score.overall, classification: score.classification ? BAND_LABEL[score.classification] : null, capped: score.capped },
    tiles: { wpm: score.efficiency.reliable ? score.efficiency.wpm : null, wpmNote: score.efficiency.note, targetWpm: score.efficiency.target, comprehensionPct: score.comprehensionPct, qaPct: score.qaPct, durationSecs: Math.round(r.timing.totalMs / 1000), readingSecs: r.timing.readingMs === null ? null : Math.round(r.timing.readingMs / 1000), correct: score.correct, incorrect: score.answered - score.correct, skipped: score.skipped, total: score.total },
    comparison, dimensions: score.dimensions, strongest: strongestOwn, weakest: weakestOwn, whyItMatters: whySkill ? SKILLS[whySkill].why : null,
  };
  const studyMinutes = (await getStudyMinutes(userId, db)) ?? cfg.defaultStudyMinutes;
  const weakIds = weakest(diags, 3).map((d) => d.skill);

  if (!premium) {
    const facts = pitchFacts(score, diags, sums.length);
    return {
      ...base,
      next: { href: "/reading-studio/upgrade?from=results", label: "See what the full analysis shows", reason: "You have a first result. The package turns it into a plan." },
      skills: null, strengths: null, weaknesses: null, causes: null, careful: null, charts: null, plan: null, review: null, trend: null, skillProgress: null, ai: null,
      locked: { pitches: pitches(facts), counts: { skills: score.skills.length, missed, charts: chartCount } },
    };
  }
  const review = await reviewItems(a, db);
  const examples = new Map<SkillId, ErrorExample[]>();
  for (const it of review.filter((x) => !x.correct && !x.skipped)) examples.set(it.skill, [...(examples.get(it.skill) ?? []), { stem: it.stem, chosen: it.chosen, correct: it.correctText, explanation: it.explanation }]);
  const trend = trendOf(sums);
  const wk = weakest(diags, 1)[0];
  const next = wk ? { href: `/reading-studio/practice?skill=${wk.skill}`, label: `Practise ${SKILLS[wk.skill].label.toLowerCase()}`, reason: `It is your lowest assessed skill (${Math.round(wk.accuracy as number)}% over ${wk.attempted} questions).` } : { href: "/reading-studio/dashboard", label: "Take your next step on the dashboard", reason: "No skill is confirmed as weak yet." };
  return {
    ...base, next, skills: diags, strengths: strengthsOf(diags, score), weaknesses: weaknessesOf(diags, examples, cfg), causes: r.causes, careful: r.careful, charts,
    plan: sevenDayPlan({ weak: weakIds, causes: r.causes, studyMinutes, assessments: sums.length }), review, trend, skillProgress: skillProgress(diags, cfg), ai: r.ai, locked: null,
  };
}

// ---- dashboard -------------------------------------------------------------------------------------------------------------------

export interface TrackCard {
  id: Track;
  name: string;
  short: string;
  blurb: string;
  href: string;
  /** Held by purchase or plan. */
  owned: boolean;
  priceRupees: number | null;
  buyHref: string;
  /** One line of the student's own progress in this track, built from real numbers. */
  progress: string;
  next: { href: string; label: string } | null;
}

export interface DashboardView {
  /** The tracks the student chose to see (empty until chosen), and the ones their activity or purchases suggest. */
  chosen: Track[];
  suggested: Track[];
  tracks: TrackCard[];
  analytics: boolean;
  premium: boolean;
  assessments: number;
  latest: { id: string; overall: number | null; at: string; kind: string; completion: string } | null;
  levels: Array<{ key: string; name: string; objective: string; unlocked: boolean; mastered: boolean; message: string; practiceDone: boolean; bestMasteryPct: number | null }>;
  current: { key: string; name: string; message: string } | null;
  freeLeft: number;
  strongest: string[];
  weakest: string[];
}

export async function buildDashboard(userId: number, db: Db = pool): Promise<DashboardView> {
  const [premium, cfg, sums, states, history, chosen, acc, essays, ielts, ieltsOpen] = await Promise.all([hasPremium(userId), getConfig(db), summaries(userId, db), levelStatesFor(userId, db), loadHistory(userId, db), getTracks(userId, db), trackAccess(userId), essayProgress(userId, db), ieltsAttempts(userId, "ielts-reading", 500).catch(() => []), ieltsLimit(userId).catch(() => 0)]);
  const diags = diagnoseAll(history, cfg);
  const latest = [...sums].reverse()[0];
  const used = sums.filter((s) => s.kind === "diagnostic" || s.kind === "fresh").length;
  const ready = readiness(states);
  const fees = await Promise.all(TRACKS.map((t) => feeNow(t.id).catch(() => null)));
  const bestBand = ielts.reduce<number | null>((m, a) => (a.band === null ? m : Math.max(m ?? 0, a.band)), null);
  const doneTests = new Set(ielts.map((a) => a.test_no)).size;
  const skillsUsed = sums.some((s) => s.kind !== "essay");
  const suggested = TRACKS.filter((t) => (t.id === "skills" && (skillsUsed || acc.skills)) || (t.id === "indian" && (essays.attempted > 0 || acc.indian)) || (t.id === "international" && (ielts.length > 0 || acc.international))).map((t) => t.id);
  const progressLine: Record<Track, string> = {
    skills: states.length ? `${states.filter((s) => s.mastered).length} of ${states.length} levels mastered${ready.current ? `; working on Level ${ready.current.key}` : ""}.` : "Not started.",
    indian: essays.attempted ? `${essays.attempted} of ${essays.total} essay tests attempted${essays.best !== null ? `; best score ${Math.round(essays.best)}/100` : ""}.` : `${essays.total} essay tests; ${cfg.freeEssays.length} are free to try.`,
    international: ielts.length ? `${doneTests} IELTS Reading test${doneTests === 1 ? "" : "s"} attempted${bestBand !== null ? `; best band ${bestBand}` : ""}.` : `IELTS Reading practice tests; ${ieltsOpen} open to you.`,
  };
  const nextFor: Record<Track, { href: string; label: string } | null> = {
    skills: ready.current ? { href: `/reading-studio/levels/${ready.current.key}`, label: `Continue Level ${ready.current.key}` } : { href: "/reading-studio/levels/A", label: "Open the Level A lesson" },
    indian: essays.next ? { href: `/reading-tests/${essays.next}`, label: `Take test ${String(essays.next).padStart(2, "0")}` } : { href: "/reading-tests", label: "Open the test library" },
    international: { href: "/practice-tests/ielts-reading", label: ielts.length ? "Take another IELTS Reading test" : "Open IELTS Reading tests" },
  };
  return {
    chosen,
    suggested,
    analytics: acc.analytics || premium,
    tracks: TRACKS.map((t, i) => ({ id: t.id, name: t.name, short: t.short, blurb: t.blurb, href: t.href, owned: t.id === "international" ? acc.international : acc[t.id], priceRupees: fees[i] ? Math.round(fees[i]!.amountMinor / 100) : null, buyHref: `/reading-studio/upgrade?from=dashboard&track=${t.id}`, progress: progressLine[t.id], next: nextFor[t.id] })),
    premium, assessments: sums.length,
    latest: latest ? { id: latest.publicId ?? String(latest.id), overall: latest.overall, at: latest.at, kind: latest.kind, completion: latest.completion } : null,
    levels: states.map((s) => ({ key: s.key, name: s.name, objective: s.objective, unlocked: s.unlocked, mastered: s.mastered, message: s.message, practiceDone: s.practiceDone, bestMasteryPct: s.bestMasteryPct })),
    current: ready.current ? { key: ready.current.key, name: states.find((s) => s.key === ready.current?.key)?.name ?? "", message: ready.message } : null,
    freeLeft: Math.max(0, cfg.freeDiagnostics - used),
    strongest: strongest(diags, 2).map((d) => d.label), weakest: weakest(diags, 2).map((d) => d.label),
  };
}

// ---- progress --------------------------------------------------------------------------------------------------------------------

export interface ProgressView {
  premium: boolean;
  timeline: Array<{ id: string; at: string; kind: string; overall: number | null; wpm: number | null; comprehensionPct: number | null; completion: string; difficulty: number | null; correct: number; total: number; note: string }>;
  total: number;
  /** Premium only. */
  trend: Trend | null;
  trendChart: ChartSet["trend"];
  progressChart: ChartSet["progress"];
  skills: SkillDiagnosis[] | null;
  skillProgress: SkillProgress | null;
  readiness: string | null;
  lockedCounts: { assessments: number } | null;
  /** IELTS Reading practice results, shown as band scores. They are not broken down by skill (IELTS question types differ from the Studio's skills). */
  international: { attempts: number; best: number | null; recent: Array<{ at: string; test: number; raw: number; total: number; band: number | null }> };
}

export async function buildProgress(userId: number, db: Db = pool): Promise<ProgressView> {
  const [premium, cfg, sums, history, states] = await Promise.all([hasAnalytics(userId), getConfig(db), summaries(userId, db), loadHistory(userId, db), levelStatesFor(userId, db)]);
  const ielts = await ieltsAttempts(userId, "ielts-reading", 500).catch(() => []);
  const international = { attempts: ielts.length, best: ielts.reduce<number | null>((m, a) => (a.band === null ? m : Math.max(m ?? 0, a.band)), null), recent: ielts.slice(0, 6).map((a) => ({ at: a.created_at, test: a.test_no, raw: a.raw, total: a.total, band: a.band })) };
  const done = [...sums].reverse();
  const timeline = (premium ? done : done.slice(0, 1)).map((s) => ({ id: s.publicId ?? String(s.id), at: s.at, kind: s.kind, overall: s.overall, wpm: s.wpm, comprehensionPct: s.comprehensionPct, completion: s.completion, difficulty: s.avgDifficulty, correct: s.correct, total: s.total, note: compareToPrevious(s, sums).message }));
  if (!premium) return { premium, timeline, total: sums.length, trend: null, trendChart: null, progressChart: null, skills: null, skillProgress: null, readiness: null, lockedCounts: { assessments: sums.length }, international };
  const diags = diagnoseAll(history, cfg);
  const charts = buildCharts({ diags, result: null, items: [], history, summaries: sums });
  return { premium, timeline, total: sums.length, trend: trendOf(sums), trendChart: charts.trend, progressChart: charts.progress, skills: diags, skillProgress: skillProgress(diags, cfg), readiness: readiness(states).message, lockedCounts: null, international };
}
