import { describe, expect, it } from "vitest";
import { attemptSchema, item, validateAttempt, CONTRACT_VERSION } from "./contract";
import { configSchema, DEFAULT_CONFIG, resolveConfig } from "./config";
import { accuracyOf, consistencyOf, efficiencyOf, evidenceLevel, masteryByTopic, masteryOfTopic, overallScore, speedOf, type Item } from "./engine";
import { diagnose, strengths } from "./diagnosis";
import { buildPlan } from "./recommend";
import { topicMovement, trend, type AttemptSummary } from "./progress";
import { SEED_TOPICS, SEED_TOPIC_IDS } from "./taxonomy";

const cfg = DEFAULT_CONFIG;
const NOW = Date.parse("2026-02-01T00:00:00Z");
const mk = (topic: string, correct: boolean, o: Partial<Item> = {}): Item => ({
  attemptId: o.attemptId ?? 1, at: o.at ?? "2026-02-01T00:00:00Z", topic, cognitive: o.cognitive ?? "procedure", difficulty: o.difficulty ?? 3,
  format: "mcq", credit: o.credit ?? (correct ? (o.maxMarks ?? 1) : 0), maxMarks: o.maxMarks ?? 1, correct, skipped: o.skipped ?? false,
  timeMs: o.timeMs ?? null, expectedSecs: o.expectedSecs ?? null, ...o,
});
const many = (topic: string, n: number, right: number, o: Partial<Item> = {}): Item[] => Array.from({ length: n }, (_, i) => mk(topic, i < right, { attemptId: o.attemptId ?? 1, ...o }));

describe("integration contract", () => {
  it("validates a well-formed attempt and rejects unknown topics, bad version and credit over max", () => {
    const good = { v: CONTRACT_VERSION, source: "gre-quant", sourceRef: "4", userId: 7, label: "GRE mock 4", startedAt: "2026-01-01T00:00:00Z", finishedAt: "2026-01-01T00:40:00Z", totalMs: 2_400_000, items: [item({ ref: "1", topic: "triangles", cognitive: "concept", difficulty: 3, correct: true })] };
    expect(validateAttempt(good).ok).toBe(true);
    expect(validateAttempt({ ...good, items: [item({ ref: "1", topic: "not-a-topic", cognitive: "concept", difficulty: 3, correct: true })] }).ok).toBe(false);
    expect(attemptSchema.safeParse({ ...good, v: 99 }).success).toBe(false);
    expect(attemptSchema.safeParse({ ...good, items: [{ ...good.items[0], credit: 5, maxMarks: 1 }] }).success).toBe(false);
  });
  it("the item helper fills marks and clamps difficulty", () => {
    expect(item({ ref: "x", topic: "circles", cognitive: "concept", difficulty: 9, correct: false, skipped: true })).toMatchObject({ difficulty: 5, credit: 0, maxMarks: 1, skipped: true });
    expect(item({ ref: "y", topic: "circles", cognitive: "concept", difficulty: 2, correct: true, maxMarks: 4 }).credit).toBe(4);
  });
});

describe("accuracy", () => {
  it("counts attempted, correct, skipped and weights by difficulty and marks", () => {
    const items = [mk("triangles", true, { difficulty: 1 }), mk("triangles", false, { difficulty: 5 }), mk("triangles", true, { skipped: false, correct: true, difficulty: 3, maxMarks: 2, credit: 1 })];
    const a = accuracyOf(items, cfg);
    expect(a.attempted).toBe(3); expect(a.correct).toBe(2); expect(a.skipped).toBe(0);
    expect(a.marks).toBe(2); expect(a.maxMarks).toBe(4);
    // weighted: (1*0.8 + 0*2.2 + 0.5*1.3) / (0.8+2.2+1.3)
    expect(a.weightedPct).toBeCloseTo((100 * (0.8 + 0.65)) / 4.3, 1);
  });
  it("does not count a skipped question as attempted", () => {
    const a = accuracyOf([mk("circles", false, { skipped: true }), mk("circles", true)], cfg);
    expect(a.attempted).toBe(1); expect(a.skipped).toBe(1); expect(a.pct).toBe(100);
  });
});

describe("speed is robust and only where time exists", () => {
  it("says not measured when a source carries no per-question time", () => {
    expect(speedOf(many("triangles", 5, 3))).toMatchObject({ measurable: false, medianSecs: null });
  });
  it("uses the median so one long question does not distort it", () => {
    const items = [mk("t", true, { timeMs: 10_000, expectedSecs: 20 }), mk("t", true, { timeMs: 12_000, expectedSecs: 20 }), mk("t", true, { timeMs: 200_000, expectedSecs: 20 })];
    expect(speedOf(items).medianSecs).toBe(12);
  });
});

describe("Bayesian topic mastery", () => {
  it("sits near the prior with no evidence and moves toward the data with it", () => {
    const empty = masteryOfTopic("triangles", [], cfg, NOW);
    expect(empty.score).toBeCloseTo(100 * cfg.priorMean, 0);
    expect(empty.evidence).toBe("insufficient");
    const strong = masteryOfTopic("triangles", many("triangles", 30, 30, { at: "2026-02-01T00:00:00Z", attemptId: 1 }).map((x, i) => ({ ...x, attemptId: (i % 3) + 1 })), cfg, NOW);
    expect(strong.score).toBeGreaterThan(85);
    expect(strong.evidence).toBe("strong");
  });
  it("weights harder questions more, so mastery shown on hard items beats the same count on easy ones", () => {
    const easy = masteryOfTopic("t", many("t", 10, 7, { difficulty: 1 }), cfg, NOW).score;
    const hard = masteryOfTopic("t", many("t", 10, 7, { difficulty: 5 }), cfg, NOW).score;
    expect(hard).toBeGreaterThan(easy);
  });
  it("discounts old evidence by recency", () => {
    const fresh = masteryOfTopic("t", many("t", 10, 10, { at: "2026-02-01T00:00:00Z" }), cfg, NOW).score;
    const stale = masteryOfTopic("t", many("t", 10, 10, { at: "2025-06-01T00:00:00Z" }), cfg, NOW).score;
    expect(stale).toBeLessThan(fresh); // old perfect record is pulled back toward the prior
  });
  it("gives a wider credible interval when evidence is thin", () => {
    const thin = masteryOfTopic("t", many("t", 3, 3), cfg, NOW);
    const thick = masteryOfTopic("t", many("t", 40, 40), cfg, NOW);
    expect(thin.high - thin.low).toBeGreaterThan(thick.high - thick.low);
  });
  it("evidence levels follow the configured thresholds and distinct attempts", () => {
    expect(evidenceLevel(2, 1, cfg)).toBe("insufficient");
    expect(evidenceLevel(4, 1, cfg)).toBe("preliminary");
    expect(evidenceLevel(10, 1, cfg)).toBe("developing");
    expect(evidenceLevel(20, 1, cfg)).toBe("developing"); // enough items but one attempt
    expect(evidenceLevel(20, 2, cfg)).toBe("strong");
  });
});

describe("consistency and efficiency", () => {
  it("is high when a topic is steady and lower when it swings", () => {
    const steady = [...many("t", 4, 3, { attemptId: 1 }), ...many("t", 4, 3, { attemptId: 2 })];
    const swingy = [...many("t", 4, 4, { attemptId: 1 }), ...many("t", 4, 0, { attemptId: 2 })];
    expect((consistencyOf(steady, cfg).index as number)).toBeGreaterThan(consistencyOf(swingy, cfg).index as number);
    expect(consistencyOf(many("t", 4, 2), cfg).index).toBeNull(); // one attempt: nothing to compare
  });
  it("efficiency is speed x accuracy and needs timed items", () => {
    expect(efficiencyOf(many("t", 3, 3), cfg).score).toBeNull();
    const fastRight = many("t", 6, 6, { timeMs: 10_000, expectedSecs: 20 });
    const slowRight = many("t", 6, 6, { timeMs: 40_000, expectedSecs: 20 });
    expect((efficiencyOf(fastRight, cfg).score as number)).toBeGreaterThan(efficiencyOf(slowRight, cfg).score as number);
    for (const i of [...fastRight, ...slowRight]) expect(efficiencyOf([i, ...many("t", 4, 2, { timeMs: 30_000, expectedSecs: 20 })], cfg).score ?? 0).toBeLessThanOrEqual(100);
  });
});

describe("overall performance score", () => {
  it("rescales the weights over the components that have data and shows the breakdown", () => {
    const items = [...many("t1", 10, 8, { attemptId: 1 }), ...many("t1", 6, 5, { attemptId: 2 }), ...many("t2", 8, 4, { timeMs: 30_000, expectedSecs: 20, attemptId: 1 })];
    const r = overallScore(items, cfg, NOW);
    expect(r.score).not.toBeNull();
    expect(r.provisional).toBe(true);
    expect(r.engineVersion).toBe("mx-1.0");
    const present = r.components.filter((c) => c.score !== null);
    expect(present.reduce((a, c) => a + c.effectiveWeight, 0)).toBeCloseTo(100, 0);
    expect(present.reduce((a, c) => a + c.contribution, 0)).toBeCloseTo(r.score as number, 0);
  });
  it("leaves efficiency out of the denominator when no question is timed", () => {
    const r = overallScore(many("t", 12, 9), cfg, NOW);
    expect(r.components.find((c) => c.key === "efficiency")!.score).toBeNull();
    expect(r.components.find((c) => c.key === "efficiency")!.effectiveWeight).toBe(0);
  });
});

describe("weakness diagnosis never invents and is evidence-ranked", () => {
  const hist = (xs: Item[]): Item[] => xs;
  it("flags a low-mastery topic, and ranks a blocking prerequisite first", () => {
    const items = [...many("linear-equations", 12, 3, { difficulty: 3 }), ...many("quadratics", 6, 2, { difficulty: 3 })];
    // linear-equations is a prereq of quadratics (both attempted), so it should be foundational / first
    const w = diagnose(items, cfg, NOW);
    expect(w[0].topic).toBe("linear-equations");
    expect(w[0].kind).toBe("foundational");
    expect(w[0].evidence).toMatch(/\d+\/100/);
  });
  it("detects a difficulty cliff", () => {
    const items = [...many("circles", 6, 6, { difficulty: 2 }), ...many("circles", 6, 1, { difficulty: 5 })];
    const cliff = diagnose(items, cfg, NOW).find((w) => w.kind === "difficulty-cliff");
    expect(cliff).toBeTruthy();
    expect(cliff!.practiceDifficulty).toBe(4);
  });
  it("detects a multi-step gap across topics", () => {
    const items = [...many("t", 10, 9, { cognitive: "procedure" }), ...many("word-problems", 10, 3, { cognitive: "multistep" })];
    expect(diagnose(items, cfg, NOW).some((w) => w.kind === "multistep")).toBe(true);
  });
  it("detects slow-but-right and fast-but-wrong only with timing data, and never from time alone", () => {
    const slow = many("t", 8, 8, { timeMs: 60_000, expectedSecs: 20 });
    expect(diagnose(slow, cfg, NOW).some((w) => w.kind === "slow")).toBe(true);
    const hurried = [...many("t", 6, 0, { timeMs: 3_000, expectedSecs: 30 }), ...many("t", 6, 6, { timeMs: 25_000, expectedSecs: 30 })];
    expect(diagnose(hurried, cfg, NOW).some((w) => w.kind === "hurried")).toBe(true);
    // the same wrong answers with no timing do not produce a hurried finding
    const noTime = many("t", 6, 0);
    expect(diagnose(noTime, cfg, NOW).some((w) => w.kind === "hurried")).toBe(false);
  });
  it("says nothing with insufficient evidence", () => {
    expect(diagnose(many("t", 2, 0), cfg, NOW)).toEqual([]);
  });
  it("reports strengths from secure topics only", () => {
    const items = [...many("triangles", 20, 20), ...many("circles", 20, 4)];
    const s = strengths(items, cfg, NOW);
    expect(s.map((x) => x.topic)).toContain("triangles");
    expect(s.map((x) => x.topic)).not.toContain("circles");
  });
});

describe("the plan is built from the weaknesses", () => {
  it("orders steps by priority and links each to a real practice place", () => {
    const items = [...many("linear-equations", 12, 3), ...many("quadratics", 8, 3), ...many("mental-calc", 10, 3)];
    const plan = buildPlan(diagnose(items, cfg, NOW), cfg, 30);
    expect(plan.steps.length).toBeGreaterThan(0);
    expect(plan.steps[0].priority).toBeLessThanOrEqual(plan.steps[plan.steps.length - 1].priority);
    for (const s of plan.steps) expect(s.practice.href).toMatch(/^\/(math-speed|practice-tests|math-studio)/);
    const mentalStep = plan.steps.find((s) => s.topic === "mental-calc");
    if (mentalStep) expect(mentalStep.practice.kind).toBe("mathspeed");
  });
  it("gives a positive note when nothing is weak", () => {
    expect(buildPlan([], cfg, 30).note).toMatch(/No clear weakness/);
  });
});

describe("progress over time", () => {
  const sum = (attemptId: number, day: number, overall: number): AttemptSummary => ({ attemptId, source: "gre-quant", label: `Mock ${attemptId}`, at: `2026-01-${String(day).padStart(2, "0")}T00:00:00Z`, items: 20, accuracyPct: overall, overall });
  it("trends over comparable attempts and needs three points for a line", () => {
    expect(trend([sum(1, 1, 50), sum(2, 2, 60)]).points.length).toBe(2);
    const t = trend([sum(1, 1, 50), sum(2, 2, 60), sum(3, 3, 70)]);
    expect(t.firstToLast).toBe(20);
  });
  it("finds topics that improved and slipped across the history", () => {
    const early = many("t", 10, 3, { at: "2026-01-01T00:00:00Z", attemptId: 1 });
    const late = many("t", 10, 9, { at: "2026-01-20T00:00:00Z", attemptId: 2 });
    const mv = topicMovement([...early, ...late], cfg, NOW);
    expect(mv.improved.some((m) => m.topic === "t")).toBe(true);
  });
});

describe("configuration", () => {
  it("validates weights adding to 100 and increasing thresholds", () => {
    expect(configSchema.safeParse(cfg).success).toBe(true);
    expect(configSchema.safeParse({ ...cfg, weights: { mastery: 50, accuracy: 25, efficiency: 15, consistency: 15 } }).success).toBe(false);
    expect(configSchema.safeParse({ ...cfg, bands: { support: 70, developing: 60, secure: 80 } }).success).toBe(false);
  });
  it("ignores a bad stored value so scoring never breaks", () => {
    const c = resolveConfig({ priorMean: "nonsense", freeTopics: 5, weights: { mastery: 1 } });
    expect(c.priorMean).toBe(cfg.priorMean);
    expect(c.freeTopics).toBe(5);
    expect(c.weights).toEqual(cfg.weights);
  });
});

describe("taxonomy", () => {
  it("has unique topic ids and valid prerequisites", () => {
    expect(new Set(SEED_TOPIC_IDS).size).toBe(SEED_TOPIC_IDS.length);
    for (const t of SEED_TOPICS) for (const p of t.prereq) expect(SEED_TOPIC_IDS).toContain(p);
  });
});
