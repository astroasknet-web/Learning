import { describe, expect, it } from "vitest";
import { aiFeedback, validateFeedback } from "./ai";
import { buildCharts, heatChart, progressChart, radarChart, scatterChart, skillBarChart, stackedChart, trendChart } from "./charts";
import { configSchema, DEFAULT_CONFIG, resolveConfig } from "./config";
import { carefulNote, causesOf, diagnoseAll, diagnoseSkill, INSUFFICIENT, strongest, weakest, type HistoryItem } from "./diagnosis";
import { compareToPrevious, levelStates, readiness, trendOf, type LevelAttempt, type Summary } from "./progress";
import { pitchFacts, pitches, sevenDayPlan, strengthsOf, targetFor, weaknessesOf } from "./recommend";
import { bandOf, checkedMs, efficiencyOf, markResponse, normaliseShort, scoreAssessment, tally, type Item, type Timing } from "./scoring";
import { SKILLS, type Difficulty, type QType, type SkillId } from "./taxonomy";

const cfg = DEFAULT_CONFIG;
let qid = 1;
const item = (skill: SkillId, correct: boolean, o: Partial<Item> & { d?: Difficulty } = {}): Item => ({ questionId: qid++, passageId: o.passageId ?? 1, skill, qtype: (o.qtype ?? "interpret") as QType, difficulty: o.d ?? o.difficulty ?? 2, credit: correct ? 1 : 0, correct, skipped: o.skipped ?? false, ms: o.ms === undefined ? 30_000 : o.ms, expectedSecs: o.expectedSecs ?? 40 });
const timing = (wpm: number | null, words = 300, diff = 3): Timing => ({ wordCount: words, readingMs: wpm === null ? null : Math.round((words / wpm) * 60_000), answeringMs: 200_000, totalMs: 400_000, passageDifficulty: diff });
/** n items of a skill with `right` of them correct. */
const many = (skill: SkillId, n: number, right: number, o: Partial<Item> & { d?: Difficulty } = {}): Item[] => Array.from({ length: n }, (_, i) => item(skill, i < right, o));

describe("marking", () => {
  it("marks choices, true/false, short answers and matches", () => {
    expect(markResponse({ format: "mcq", options: ["a", "b"], answer: 1 }, 1)).toEqual({ answered: true, credit: 1, correct: true });
    expect(markResponse({ format: "mcq", options: ["a", "b"], answer: 1 }, 0)).toEqual({ answered: true, credit: 0, correct: false });
    expect(markResponse({ format: "tf", options: [], answer: 2 }, 2).correct).toBe(true);
    expect(markResponse({ format: "mcq", options: ["a", "b"], answer: 1 }, null).answered).toBe(false);
    expect(markResponse({ format: "short", options: [], answer: ["oranges", "orange"] }, "  The ORANGES! ").correct).toBe(true);
    expect(markResponse({ format: "short", options: [], answer: ["oranges"] }, "mangoes").correct).toBe(false);
    const m = { format: "match" as const, options: { left: ["a", "b", "c", "d"], right: ["w", "x", "y", "z"] }, answer: [1, 3, 0, 2] };
    expect(markResponse(m, [1, 3, 0, 2])).toMatchObject({ credit: 1, correct: true });
    expect(markResponse(m, [1, 3, 2, 0])).toMatchObject({ credit: 0.5, correct: false });
    expect(markResponse(m, [])).toMatchObject({ answered: false });
    expect(normaliseShort("An Apple, please!")).toBe("apple please");
  });
});

describe("accuracy bands", () => {
  it("uses the configured thresholds at their boundaries", () => {
    expect(bandOf(49.9, cfg)).toBe("support");
    expect(bandOf(50, cfg)).toBe("developing");
    expect(bandOf(69.9, cfg)).toBe("developing");
    expect(bandOf(70, cfg)).toBe("progressing");
    expect(bandOf(84.9, cfg)).toBe("progressing");
    expect(bandOf(85, cfg)).toBe("strong");
    expect(bandOf(100, cfg)).toBe("strong");
  });
});

describe("scoring formulas", () => {
  it("weights add up to 100 and the difficulty weights are applied", () => {
    expect(Object.values(cfg.weights).reduce((a, b) => a + b, 0)).toBe(100);
    const t = tally([item("details", true, { d: 1 }), item("details", false, { d: 3 })], cfg);
    expect(t.weighted).toBe(1);
    expect(t.weight).toBe(2.5);
  });

  it("computes the overall score as a weighted average and shows each dimension's contribution", () => {
    const items = [...many("main_idea", 4, 3), ...many("inference", 4, 2), ...many("vocab_context", 2, 2)];
    const r = scoreAssessment(items, timing(180, 300, 3), cfg);
    const comp = r.dimensions.find((d) => d.dimension === "comprehension")!;
    expect(comp.score).toBe(75); // 3 of 4, all medium
    expect(r.dimensions.find((d) => d.dimension === "inference")!.score).toBe(50);
    expect(r.dimensions.find((d) => d.dimension === "vocabulary")!.score).toBe(100);
    const qa = r.dimensions.find((d) => d.dimension === "qa")!.score!; // 7 of 10
    expect(qa).toBe(70);
    const eff = r.dimensions.find((d) => d.dimension === "efficiency")!.score!; // wpm 180 on target 180, accuracy 75
    expect(eff).toBe(75);
    // retention was not asked: its 5% is removed and the rest rescaled
    expect(r.dimensions.find((d) => d.dimension === "retention")!.score).toBeNull();
    const expected = (75 * 30 + 70 * 25 + 50 * 15 + 75 * 15 + 100 * 10) / 95;
    expect(r.overall).toBeCloseTo(Math.round(expected * 10) / 10, 5);
    expect(r.dimensions.reduce((a, d) => a + d.contribution, 0)).toBeCloseTo(r.overall as number, 0);
    expect(r.dimensions.filter((d) => d.score !== null).reduce((a, d) => a + d.effectiveWeight, 0)).toBeCloseTo(100, 0);
    expect(r.provisional).toBe(true);
    expect(r.scoringVersion).toBe("rs-1.0");
  });

  it("leaves out a dimension with too few questions instead of scoring it", () => {
    const r = scoreAssessment([...many("main_idea", 4, 4), item("vocab_context", false)], timing(null), cfg);
    expect(r.dimensions.find((d) => d.dimension === "vocabulary")!.score).toBeNull();
  });

  it("efficiency: no bonus for speed above the target, a floor, and accuracy is the ceiling", () => {
    expect(efficiencyOf(timing(180), 80, cfg).score).toBe(80);
    expect(efficiencyOf(timing(360), 80, cfg).score).toBe(80);
    expect(efficiencyOf(timing(90), 80, cfg).score).toBe(40);
    expect(efficiencyOf(timing(30), 80, cfg).speedFactor).toBe(0.25 > 30 / 180 ? 0.25 : 30 / 180);
    for (const wpm of [60, 120, 180, 400]) for (const acc of [20, 55, 90]) expect(efficiencyOf(timing(wpm), acc, cfg).score ?? 0).toBeLessThanOrEqual(acc);
  });

  it("does not use a reading time that implies skimming or an interrupted session", () => {
    const skim = efficiencyOf({ ...timing(null), wordCount: 300, readingMs: 5_000 }, 80, cfg);
    expect(skim).toMatchObject({ score: null, reliable: false });
    expect(skim.note).toMatch(/skimmed/);
    const stop = efficiencyOf({ ...timing(null), wordCount: 300, readingMs: 40 * 60_000 }, 80, cfg);
    expect(stop).toMatchObject({ score: null, reliable: false });
    expect(efficiencyOf(timing(null), 80, cfg).note).toMatch(/not recorded/);
  });

  it("safeguard: a very fast reader with mostly wrong answers cannot score high", () => {
    const mostlyWrong = [...many("main_idea", 6, 1), ...many("inference", 4, 1), ...many("vocab_context", 2, 2)];
    const fast = scoreAssessment(mostlyWrong, timing(450, 300, 3), cfg);
    expect(fast.efficiency.score).toBeLessThanOrEqual(fast.comprehensionPct as number);
    expect(fast.overall).toBeLessThan(45);
    // poor comprehension propped up by other areas: the overall score is capped
    const propped = [...many("main_idea", 5, 2), ...many("inference", 6, 6), ...many("vocab_context", 6, 6)];
    const r = scoreAssessment(propped, timing(450, 300, 3), cfg);
    expect(r.comprehensionPct).toBe(40);
    expect(r.capped).toBe(true);
    expect(r.overall).toBe(cfg.safeguardCap);
  });

  it("clamps a claimed response time to the server's clock", () => {
    expect(checkedMs(900_000, 4_000)).toBe(5_500);
    expect(checkedMs(2_000, 40_000)).toBe(2_000);
    expect(checkedMs(-5, 1_000)).toBe(0);
    expect(checkedMs(Number.NaN, 1_000)).toBe(0);
    expect(checkedMs(10 * 3_600_000, null)).toBe(30 * 60_000);
  });

  it("a partial completion is marked partial and unanswered questions count as missed", () => {
    const items = [...many("main_idea", 4, 4), ...Array.from({ length: 6 }, () => item("details", false, { skipped: true, ms: null }))];
    const r = scoreAssessment(items, timing(180), cfg);
    expect(r.completion).toBe("partial");
    expect(r.skipped).toBe(6);
    expect(r.correct).toBe(4);
  });
});

describe("weakness diagnosis", () => {
  const hist = (xs: Item[], assessmentId = 1, at = "2026-10-01T00:00:00.000Z"): HistoryItem[] => xs.map((x) => ({ ...x, assessmentId, at }));

  it("says more practice is needed before the minimum sample, and gives no band", () => {
    const d = diagnoseSkill("inference", hist(many("inference", 3, 0)), cfg);
    expect(d.band).toBeNull();
    expect(d.confidence).toBe("low");
    expect(d.summary).toBe(INSUFFICIENT);
    expect(weakest([d])).toEqual([]);
  });

  it("builds per-skill statistics, difficulty breakdown and confidence from the evidence", () => {
    const xs = [...many("inference", 4, 1, { d: 1, passageId: 1 }), ...many("inference", 5, 2, { d: 2, passageId: 2 })];
    const d = diagnoseSkill("inference", hist(xs), cfg);
    expect(d.attempted).toBe(9);
    expect(d.correct).toBe(3);
    expect(d.accuracy).toBeCloseTo(33.3, 1);
    expect(d.byDifficulty[1]).toEqual({ n: 4, pct: 25 });
    expect(d.byDifficulty[3].n).toBe(0);
    expect(d.confidence).toBe("high");
    expect(d.band).toBe("support");
    expect(d.repeatedError).toBe(true);
  });

  it("does not call a skill that is only hard at the hardest level a weakness", () => {
    const xs = [...many("inference", 4, 4, { d: 1 }), ...many("inference", 3, 3, { d: 2 }), ...many("inference", 3, 0, { d: 3 })];
    const d = diagnoseSkill("inference", hist(xs), cfg);
    expect(d.accuracy).toBe(70);
    const lowish = diagnoseSkill("inference", hist([...many("inference", 3, 3, { d: 1 }), ...many("inference", 2, 2, { d: 2 }), ...many("inference", 4, 0, { d: 3 })]), cfg);
    expect(lowish.stretchOnly).toBe(true);
    expect(weakest([lowish])).toEqual([]);
    expect(lowish.summary).toMatch(/stretch area/);
  });

  it("good on easy passages, struggling on difficult ones: the breakdown shows it", () => {
    const xs = [...many("main_idea", 5, 5, { d: 1 }), ...many("main_idea", 5, 1, { d: 3 })];
    const d = diagnoseSkill("main_idea", hist(xs), cfg);
    expect(d.byDifficulty[1].pct).toBe(100);
    expect(d.byDifficulty[3].pct).toBe(20);
  });

  it("tracks change across assessments and keeps at most the last five", () => {
    let hx: HistoryItem[] = [];
    for (let i = 0; i < 7; i++) hx = [...hx, ...hist(many("details", 4, Math.min(4, i)), i + 1, `2026-10-0${i + 1}T00:00:00.000Z`)];
    const d = diagnoseSkill("details", hx, cfg);
    expect(d.recent).toHaveLength(5);
    expect(d.recent[0].pct).toBe(50);
    expect(d.recent[4].pct).toBe(100);
    expect(d.change).toBe(0);
    const rising = diagnoseSkill("details", hist(many("details", 4, 1), 1, "2026-10-01T00:00:00.000Z").concat(hist(many("details", 4, 3), 2, "2026-10-02T00:00:00.000Z")), cfg);
    expect(rising.change).toBe(50);
  });

  it("strong vocabulary with weak inference points at inference, not vocabulary", () => {
    const items = [...many("main_idea", 4, 4), ...many("details", 3, 3), ...many("vocab_context", 3, 3), ...many("inference", 4, 1), ...many("conclusion", 2, 1)];
    const r = scoreAssessment(items, timing(190, 300, 3), cfg);
    const kinds = causesOf(r, items, cfg).map((c) => c.kind);
    expect(kinds).toContain("inference");
    expect(kinds).not.toContain("vocabulary");
  });

  it("weak vocabulary with sound comprehension points at vocabulary", () => {
    const items = [...many("main_idea", 4, 4), ...many("details", 3, 3), ...many("vocab_context", 3, 0), ...many("inference", 3, 3)];
    expect(causesOf(scoreAssessment(items, timing(190, 300, 3), cfg), items, cfg).map((c) => c.kind)).toContain("vocabulary");
  });

  it("a slow reader with excellent comprehension is told it is pace, and is not marked weak", () => {
    const items = [...many("main_idea", 5, 5), ...many("details", 4, 4), ...many("inference", 3, 3)];
    const r = scoreAssessment(items, timing(90, 300, 3), cfg);
    expect(r.comprehensionPct).toBe(100);
    expect(r.overall).toBeGreaterThan(80);
    const c = causesOf(r, items, cfg);
    expect(c.map((x) => x.kind)).toEqual(["pace"]);
    expect(weakest(diagnoseAll(items.map((x) => ({ ...x, assessmentId: 1, at: "2026-10-01T00:00:00.000Z" })), cfg))).toEqual([]);
  });

  it("a fast reader with many wrong answers is told to check, only when wrong answers were also quick", () => {
    const fastWrong = [...many("main_idea", 5, 1, { ms: 6_000 }), ...many("details", 4, 1, { ms: 5_000 })];
    const r = scoreAssessment(fastWrong, timing(400, 300, 3), cfg);
    expect(causesOf(r, fastWrong, cfg).map((c) => c.kind)).toContain("hurried");
    const slowWrong = [...many("main_idea", 5, 1, { ms: 60_000 }), ...many("details", 4, 1, { ms: 50_000 })];
    expect(causesOf(scoreAssessment(slowWrong, timing(150, 300, 3), cfg), slowWrong, cfg).map((c) => c.kind)).not.toContain("hurried");
  });

  it("correct answers that took long on difficult questions are praised, never counted against the student", () => {
    const items = [...many("arguments", 4, 4, { d: 3, ms: 90_000, expectedSecs: 50 }), ...many("details", 4, 4)];
    expect(carefulNote(items)).toMatch(/careful reading/);
    const r = scoreAssessment(items, timing(190), cfg);
    expect(r.qaPct).toBe(100);
  });

  it("a response time on its own never lowers an accuracy figure", () => {
    const quick = scoreAssessment(many("details", 6, 4, { ms: 4_000 }), timing(null), cfg);
    const slow = scoreAssessment(many("details", 6, 4, { ms: 120_000 }), timing(null), cfg);
    expect(slow.qaPct).toBe(quick.qaPct);
  });

  it("ranks the weakest and strongest from reliable diagnoses only", () => {
    const xs: HistoryItem[] = [...many("main_idea", 5, 5), ...many("details", 5, 2), ...many("inference", 5, 3), ...many("vocab_context", 2, 0)].map((x) => ({ ...x, assessmentId: 1, at: "2026-10-01T00:00:00.000Z" }));
    const ds = diagnoseAll(xs, cfg);
    expect(weakest(ds).map((d) => d.skill)).toEqual(["details", "inference"]);
    expect(strongest(ds)[0].skill).toBe("main_idea");
    expect(ds.find((d) => d.skill === "vocab_context")!.band).toBeNull();
  });
});

describe("progress and comparison", () => {
  const S = (id: number, day: number, overall: number, o: Partial<Summary> = {}): Summary => ({ id, at: `2026-10-${String(day).padStart(2, "0")}T00:00:00.000Z`, kind: "fresh", levelKey: null, overall, wpm: 180, comprehensionPct: overall, qaPct: overall, avgDifficulty: 3, completion: "complete", passageIds: [id], scoringVersion: "rs-1.0", correct: 8, total: 12, ...o });

  it("the first assessment has nothing to be compared with", () => expect(compareToPrevious(S(1, 1, 60), [S(1, 1, 60)]).verdict).toBe("first"));
  it("reports improvement, a steady result and a decline against the previous comparable assessment", () => {
    expect(compareToPrevious(S(2, 2, 70), [S(1, 1, 60), S(2, 2, 70)]).verdict).toBe("improved");
    expect(compareToPrevious(S(2, 2, 61), [S(1, 1, 60), S(2, 2, 61)]).verdict).toBe("steady");
    expect(compareToPrevious(S(2, 2, 50), [S(1, 1, 60), S(2, 2, 50)]).verdict).toBe("declined");
  });
  it("a harder passage is not counted as a decline", () => {
    const c = compareToPrevious(S(2, 2, 58, { avgDifficulty: 4 }), [S(1, 1, 60), S(2, 2, 58, { avgDifficulty: 4 })]);
    expect(c.verdict).toBe("harder-steady");
    const lower = compareToPrevious(S(2, 2, 48, { avgDifficulty: 4 }), [S(1, 1, 60), S(2, 2, 48, { avgDifficulty: 4 })]);
    expect(lower.verdict).toBe("harder-lower");
    expect(lower.message).toMatch(/harder/);
  });
  it("repeating the same passage is called a repeat", () => {
    const a = S(1, 1, 60, { passageIds: [7, 8] }), b = S(2, 2, 72, { passageIds: [7, 8] });
    expect(compareToPrevious(b, [a, b]).verdict).toBe("repeat");
  });
  it("does not compare with a partial result, another kind, or a very different difficulty", () => {
    const latest = S(5, 5, 70);
    expect(compareToPrevious(latest, [S(1, 1, 50, { completion: "partial" }), S(2, 2, 40, { kind: "practice" }), S(3, 3, 30, { avgDifficulty: 5 }), latest]).verdict).toBe("first");
  });
  it("a trend uses the last five comparable assessments and draws no line through two points", () => {
    expect(trendOf([S(1, 1, 50), S(2, 2, 60)])!.slope).toBeNull();
    const t = trendOf([1, 2, 3, 4, 5, 6, 7].map((i) => S(i, i, 50 + i * 4)))!;
    expect(t.window).toHaveLength(5);
    expect(t.slope).toBe(4);
    expect(t.firstToLast).toBe(16);
    expect(trendOf([])).toBeNull();
  });
  it("level mastery needs practice, a passing check with enough questions, and a consistent record; the next level opens only then", () => {
    const rules = [{ key: "A", position: 1, passPct: 75, minQuestions: 4 }, { key: "B", position: 2, passPct: 75, minQuestions: 4 }, { key: "C", position: 3, passPct: 75, minQuestions: 4 }];
    const at = (kind: "practice" | "mastery", levelKey: string, credit: number, total: number): LevelAttempt => ({ kind, levelKey, completion: "complete", correct: credit, total, credit });
    expect(levelStates(rules, []).map((s) => [s.unlocked, s.mastered])).toEqual([[true, false], [false, false], [false, false]]);
    expect(levelStates(rules, [at("mastery", "A", 4, 4)])[0].mastered).toBe(false); // no practice yet
    expect(levelStates(rules, [at("practice", "A", 3, 4), at("mastery", "A", 3, 4)])[0].mastered).toBe(true);
    expect(levelStates(rules, [at("practice", "A", 4, 4), at("mastery", "A", 2, 4)])[0].mastered).toBe(false);
    expect(levelStates(rules, [at("practice", "A", 1, 4), at("mastery", "A", 3, 4)])[0].mastered).toBe(false); // a lucky check on a poor record
    expect(levelStates(rules, [at("practice", "A", 4, 4), at("mastery", "A", 3, 3)])[0].mastered).toBe(false); // too few questions
    const s = levelStates(rules, [at("practice", "A", 4, 4), at("mastery", "A", 4, 4), at("practice", "B", 4, 4)]);
    expect(s.map((x) => x.unlocked)).toEqual([true, true, false]);
    expect(readiness(s).current!.key).toBe("B");
    const partial: LevelAttempt = { ...at("mastery", "A", 4, 4), completion: "partial" };
    expect(levelStates(rules, [at("practice", "A", 4, 4), partial])[0].mastered).toBe(false);
  });
});

describe("recommendations are generated from the numbers", () => {
  const H = (xs: Item[]): HistoryItem[] => xs.map((x) => ({ ...x, assessmentId: 1, at: "2026-10-01T00:00:00.000Z" }));
  it("target is the next band edge", () => {
    expect(targetFor(45, cfg)).toBe(50);
    expect(targetFor(55, cfg)).toBe(70);
    expect(targetFor(72, cfg)).toBe(85);
    expect(targetFor(90, cfg)).toBe(95);
  });
  it("strength text quotes the real counts, and weakness text names the questions behind it", () => {
    const ds = diagnoseAll(H([...many("main_idea", 10, 9), ...many("inference", 11, 5, { passageId: 2 })]), cfg);
    expect(strengthsOf(ds, null)[0]).toMatch(/9 of 10 questions on main idea and theme correctly \(90%\)/);
    const w = weaknessesOf(ds, new Map(), cfg)[0];
    expect(w.message).toMatch(/46%/);
    expect(w.message).toMatch(/11 questions/);
    expect(w.target).toBe(50);
    expect(w.why).toBe(SKILLS.inference.why);
  });
  it("the 7-day plan is adapted to the weak skills, the pace finding and the study time", () => {
    const p = sevenDayPlan({ weak: ["inference", "vocab_context"], causes: [{ kind: "pace", label: "p", evidence: "", advice: "" }], studyMinutes: 40, assessments: 2 });
    expect(p.days).toHaveLength(7);
    expect(p.days[0].action).toMatchObject({ kind: "practice", skill: "inference" });
    expect(p.days[1].action.skill).toBe("vocab_context");
    expect(p.days[5].title).toMatch(/Review/);
    expect(p.days[6].action.kind).toBe("fresh");
    expect(p.days[4].minutes).toBe(50);
    expect(p.days[0].minutes).toBe(40);
    const general = sevenDayPlan({ weak: [], causes: [], studyMinutes: 20, assessments: 1 });
    expect(general.note).toMatch(/No skill was confirmed/);
  });
  it("the upgrade messages use real counts and never imply a weakness that was not assessed", () => {
    const items = [...many("main_idea", 4, 4), ...many("details", 3, 3)];
    const r = scoreAssessment(items, timing(180), cfg);
    const facts = pitchFacts(r, diagnoseAll(H(items), cfg), 1);
    expect(facts.weakest).toBeNull();
    const p = pitches(facts);
    expect(p.plan.body).not.toMatch(/lowest assessed skill/);
    expect(p.results.body).toMatch(/2 skills/);
    expect(p.explanations.headline).toBe("Full explanations for every question");
    const weak = pitchFacts(scoreAssessment([...many("details", 5, 1)], timing(180), cfg), diagnoseAll(H(many("details", 5, 1)), cfg), 1);
    expect(pitches(weak).explanations.headline).toBe("Understand your 4 missed questions");
  });
});

describe("chart datasets only exist when the data supports them", () => {
  const H = (xs: Item[]): HistoryItem[] => xs.map((x) => ({ ...x, assessmentId: 1, at: "2026-10-01T00:00:00.000Z" }));
  const S = (id: number, overall: number, wpm: number | null = 180): Summary => ({ id, at: `2026-10-${String(id).padStart(2, "0")}T00:00:00.000Z`, kind: "fresh", levelKey: null, overall, wpm, comprehensionPct: overall, qaPct: overall, avgDifficulty: 3, completion: "complete", passageIds: [id], scoringVersion: "rs-1.0", correct: 8, total: 12 });
  it("radar needs three areas with at least two questions each", () => {
    const few = diagnoseAll(H(many("main_idea", 4, 3)), cfg);
    expect(radarChart(few, null)).toBeNull();
    const items = [...many("main_idea", 4, 3), ...many("inference", 3, 2), ...many("vocab_context", 2, 2)];
    const r = radarChart(diagnoseAll(H(items), cfg), scoreAssessment(items, timing(180), cfg))!;
    expect(r.axes.find((a) => a.key === "memory")!.value).toBeNull();
    expect(r.axes.find((a) => a.key === "comprehension")!.value).toBe(75);
    expect(r.title).toBeTruthy(); expect(r.xLabel).toBeTruthy(); expect(r.yLabel).toBeTruthy(); expect(r.interpretation).toBeTruthy(); expect(r.practice.href).toMatch(/^\/reading-studio/);
  });
  it("bar chart sorts by accuracy and needs two skills", () => {
    expect(skillBarChart(diagnoseAll(H(many("main_idea", 4, 3)), cfg))).toBeNull();
    const b = skillBarChart(diagnoseAll(H([...many("main_idea", 4, 4), ...many("details", 4, 1)]), cfg))!;
    expect(b.rows.map((r) => r.key)).toEqual(["details", "main_idea"]);
    expect(b.practice.href).toBe("/reading-studio/practice?skill=details");
  });
  it("trend and speed charts need three comparable assessments", () => {
    expect(trendChart([S(1, 50), S(2, 60)])).toBeNull();
    expect(progressChart([S(1, 50), S(2, 60)])).toBeNull();
    const t = trendChart([S(1, 50), S(2, 60), S(3, 65)])!;
    expect(t.series[0].points.map((p) => p.y)).toEqual([50, 60, 65]);
    expect(progressChart([S(1, 50, 150), S(2, 60, 170), S(3, 65, 190)])!.dualAxis).toBe(true);
    expect(trendChart([S(1, 50), S(2, 60), { ...S(3, 65), completion: "partial" }])).toBeNull();
  });
  it("difficulty, scatter and heat charts are withheld when thin", () => {
    expect(stackedChart(many("details", 5, 3))).toBeNull();
    expect(stackedChart(many("details", 8, 4, { d: 2 }))).toBeNull(); // one difficulty only
    const mixed = [...many("details", 4, 3, { d: 1 }), ...many("details", 4, 1, { d: 3 })];
    const s = stackedChart(mixed)!;
    expect(s.rows.map((r) => [r.label, r.correct, r.incorrect])).toEqual([["Easy", 3, 1], ["Difficult", 1, 3]]);
    expect(scatterChart(many("details", 5, 3))).toBeNull();
    expect(scatterChart(many("details", 6, 3))!.points).toHaveLength(6);
    expect(heatChart(many("details", 6, 3))).toBeNull(); // one skill
    expect(heatChart([...mixed, ...many("inference", 2, 1, { d: 1 }), ...many("inference", 2, 2, { d: 3 })])!.rows).toHaveLength(2);
  });
  it("builds the whole set from real history", () => {
    const items = [...many("main_idea", 4, 3), ...many("inference", 4, 2, { d: 3 }), ...many("vocab_context", 2, 1, { d: 1 })];
    const set = buildCharts({ diags: diagnoseAll(H(items), cfg), result: scoreAssessment(items, timing(180), cfg), items, history: H(items), summaries: [S(1, 60)] });
    expect(set.trend).toBeNull();
    expect(set.progress).toBeNull();
    expect(set.radar).not.toBeNull();
    expect(set.skills).not.toBeNull();
  });
});

describe("configuration", () => {
  it("rejects weights that do not add up and unordered bands", () => {
    expect(configSchema.safeParse({ ...cfg, weights: { ...cfg.weights, qa: 30 } }).success).toBe(false);
    expect(configSchema.safeParse({ ...cfg, bands: { support: 70, developing: 60, progressing: 85 } }).success).toBe(false);
    expect(configSchema.safeParse(cfg).success).toBe(true);
  });
  it("ignores a stored value that does not validate, so bad data can never break scoring", () => {
    const c = resolveConfig({ weights: { comprehension: 1 }, minSample: "lots", freeDiagnostics: 5, unknown: 3 });
    expect(c.weights).toEqual(cfg.weights);
    expect(c.minSample).toBe(cfg.minSample);
    expect(c.freeDiagnostics).toBe(5);
  });
  it("changed weights change the score by the stated formula", () => {
    const items = [...many("main_idea", 4, 4), ...many("inference", 4, 0)];
    const base = scoreAssessment(items, timing(null), cfg).overall as number;
    const heavy = scoreAssessment(items, timing(null), { ...cfg, weights: { ...cfg.weights, inference: 45, comprehension: 0 } }).overall as number;
    expect(heavy).toBeLessThan(base);
  });
});

describe("AI feedback is optional, structured and cannot invent scores", () => {
  const facts = { overall: 62, strongest: ["Main idea and theme"], weakest: ["Drawing inferences"], wpm: 191.4, causes: [] };
  const good = { summary: "You scored 62 and read at about 191 words per minute, a steady start.", focus: "Inference is the best place to put your next practice.", tips: ["Point to the words that support each answer."] };
  it("accepts a reply that only uses the supplied numbers", () => expect(validateFeedback(good, facts)).toEqual(good));
  it("rejects an invented score, extra fields, a wrong shape, bad JSON and exam names", () => {
    expect(validateFeedback({ ...good, summary: "You scored 88 which is excellent." }, facts)).toBeNull();
    expect(validateFeedback({ ...good, extra: "x" }, facts)).toBeNull();
    expect(validateFeedback({ summary: "short" }, facts)).toBeNull();
    expect(validateFeedback("not json", facts)).toBeNull();
    expect(validateFeedback({ ...good, focus: "This helps for the IELTS reading test." }, facts)).toBeNull();
    expect(validateFeedback(JSON.stringify(good), facts)).toEqual(good);
  });
  it("returns nothing when no key is configured, and nothing when the service fails or answers badly", async () => {
    const boom = (async () => { throw new Error("down"); }) as unknown as typeof fetch;
    expect(await aiFeedback(facts, {}, boom)).toBeNull();
    const env = { READING_AI_ENABLED: "true", OPENAI_API_KEY: "k".repeat(30) };
    expect(await aiFeedback(facts, env, boom)).toBeNull();
    const bad = (async () => new Response(JSON.stringify({ choices: [{ message: { content: "{\"summary\":\"You scored 99 points overall!\",\"focus\":\"Keep going with practice.\",\"tips\":[\"Read daily.\"]}" } }] }), { status: 200 })) as unknown as typeof fetch;
    expect(await aiFeedback(facts, env, bad)).toBeNull();
    const down = (async () => new Response("no", { status: 500 })) as unknown as typeof fetch;
    expect(await aiFeedback(facts, env, down)).toBeNull();
    const ok = (async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(good) } }] }), { status: 200 })) as unknown as typeof fetch;
    expect(await aiFeedback(facts, env, ok)).toEqual(good);
    expect(await aiFeedback(facts, { READING_AI_ENABLED: "false", OPENAI_API_KEY: "k".repeat(30) }, ok)).toBeNull();
  });
});
