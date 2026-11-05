import { describe, expect, it } from "vitest";
import { ACHIEVEMENT_INFO, accuracyMaster, consistency, speedImprovers, streak, xpForAnswers } from "./achievements";
import { LEVELS, MAX_LEVEL, level, moduleByKey, moduleKey, nextModule, skillsOfLevel } from "./curriculum";
import { INTERVAL_DAYS, afterReview, applyOutcome, dueSkills, effectiveMastery, masteryScore, newSkillState, scheduleNow, type SkillState } from "./mastery";
import { itemSeed, markPlan, planBenchmark, planDiagnosticStage, planDrill, planFoundationCheck, planLevelAssessment, planMasteryAssessment, planPractice, planProgressAssessment, planReview, planRevision, questionsOf, type Plan } from "./plan";
import { frontier, levelAssessmentGate, levelStatus, masteryAssessmentGate, moduleOpen, nextProbe, placementSummary, progressAssessmentGate, recordProbe, startDiagnostic, verdict, type Progress } from "./rules";
import { SKILLS, skill } from "./skills";
import { buildJourney } from "./dashboard";
import { coach } from "./feedback";

const NOW = new Date("2026-11-10T09:00:00Z");
const progress = (over: Partial<Progress> = {}): Progress => ({ startLevel: 1, completed: new Set(), doneModules: new Set(), revisionPending: new Set(), ...over });
const answered = (correct: boolean, ms = 3000, allowedMs = 5000, sk = "add-single", d = 4) => ({ skill: sk, d, correct, ms, allowedMs, response: "1", parsed: true });

describe("curriculum", () => {
  it("has 15 levels A to O, each with 8 to 13 modules", () => {
    expect(LEVELS.map((l) => l.letter).join("")).toBe("ABCDEFGHIJKLMNO");
    expect(MAX_LEVEL).toBe(15);
    for (const l of LEVELS) { expect(l.modules.length, l.title).toBeGreaterThanOrEqual(8); expect(l.modules.length, l.title).toBeLessThanOrEqual(13); }
  });
  it("keeps every skill in exactly one module, in the level the skill says it belongs to", () => {
    const seen = new Map<string, string>();
    for (const l of LEVELS) for (const m of l.modules) for (const id of m.skills) {
      const s = skill(id);
      expect(s, `${m.key} lists ${id}`).not.toBeNull();
      expect(s!.level, `${id} is in level ${l.letter}`).toBe(l.n);
      expect(seen.has(id), `${id} is in two modules (${seen.get(id)} and ${m.key})`).toBe(false);
      seen.set(id, m.key);
    }
    expect([...seen.keys()].sort()).toEqual(SKILLS.map((s) => s.id).sort());
  });
  it("uses only the student-facing words and no exam wording anywhere in titles, summaries or lessons", () => {
    const text = JSON.stringify(LEVELS.map((l) => [l.title, l.summary, l.topics, l.modules.map((m) => [m.title, m.lesson])]));
    for (const banned of ["SSC", "SAT ", "Banking", "Competition", "competitive", "CAT ", "GRE", "GMAT", "JEE", "NEET", "Olympiad", "IELTS"]) expect(text, banned).not.toContain(banned);
    expect(text).not.toMatch(/exams?/i);
  });
  it("finds modules by key and walks to the next", () => {
    expect(moduleByKey("a-01")?.title).toBe("Place value");
    expect(moduleKey(3, 7)).toBe("C-07");
    expect(nextModule("A-01")?.key).toBe("A-02");
    expect(nextModule(`A-${String(level(1)!.modules.length).padStart(2, "0")}`)).toBeNull();
    expect(skillsOfLevel(1)).toContain("place-value");
  });
  it("marks a level authored only when all of its modules have lessons", () => {
    for (const l of LEVELS) expect(l.authored).toBe(l.modules.every((m) => m.lesson !== null));
    for (const l of LEVELS.filter((x) => x.authored)) for (const m of l.modules) {
      const ls = m.lesson!;
      expect(ls.learn.join(" ").length, m.key).toBeGreaterThan(80);
      expect(ls.steps.length, m.key).toBeGreaterThanOrEqual(3);
      expect(ls.understand.length, m.key).toBeGreaterThanOrEqual(1);
      expect(ls.mistakes.length, m.key).toBeGreaterThanOrEqual(1);
      expect(ls.tip.length, m.key).toBeGreaterThan(8);
    }
  });
});

describe("skill state, adaptive difficulty and mastery", () => {
  const feed = (s: SkillState, n: number, correct: boolean, ms: number, allowed = 5000, d?: number, target = 8): SkillState => {
    let cur = s;
    for (let i = 0; i < n; i++) cur = applyOutcome(cur, { correct, ms, allowedMs: allowed, d: d ?? cur.d }, target, NOW).state;
    return cur;
  };
  it("starts at difficulty 1 with no mastery", () => {
    const s = newSkillState();
    expect(s.d).toBe(1);
    expect(masteryScore(s, 8)).toBe(0);
  });
  it("raises the difficulty after sustained fast, correct answers", () => {
    const s = feed(newSkillState(), 5, true, 2000);
    expect(s.d).toBe(2);
    const t = feed(s, 5, true, 2000);
    expect(t.d).toBe(3);
  });
  it("does not raise it for correct but slow answers", () => {
    const s = feed(newSkillState(), 12, true, 9000, 5000);
    expect(s.d).toBe(1);
  });
  it("lowers the difficulty after repeated mistakes, but never below 1 or above 10", () => {
    let s = feed(newSkillState(), 25, true, 1000);
    expect(s.d).toBeGreaterThan(3);
    const before = s.d;
    s = feed(s, 4, false, 4000);
    expect(s.d).toBe(before - 1);
    expect(feed(newSkillState(), 30, false, 4000).d).toBe(1);
    expect(feed(newSkillState(), 200, true, 500).d).toBe(10);
  });
  it("ignores questions far from the student's difficulty when adapting", () => {
    const s = feed({ ...newSkillState(), d: 5 }, 20, true, 1000, 5000, 1);
    expect(s.d).toBe(5);
  });
  it("tracks accuracy, speed, time, and the baseline from the first five correct answers", () => {
    let s = newSkillState();
    for (const ms of [4000, 4000, 4000, 4000, 4000]) s = applyOutcome(s, { correct: true, ms, allowedMs: 5000, d: 1 }, 8, NOW).state;
    expect(s.baselineMs).toBe(4000);
    expect(s.baselineN).toBe(5);
    expect(s.acc).toBe(1);
    expect(s.speed).toBe(1);
    s = applyOutcome(s, { correct: true, ms: 1000, allowedMs: 5000, d: 1 }, 8, NOW).state;
    expect(s.baselineMs).toBe(4000); // baseline is fixed once set
    expect(s.ms!).toBeLessThan(4000);
  });
  it("cannot reach mastery on easy questions alone", () => {
    const s = feed(newSkillState(), 200, true, 500, 5000, 1);
    expect(s.d).toBeLessThanOrEqual(3);
    expect(s.mastery).toBeLessThan(80);
    expect(s.masteredAt).toBeNull();
  });
  it("becomes mastered with high accuracy at near-target difficulty, and schedules the first review for tomorrow", () => {
    const s = feed(newSkillState(), 80, true, 1500);
    expect(s.d).toBeGreaterThanOrEqual(6);
    expect(s.mastery).toBeGreaterThanOrEqual(80);
    expect(s.masteredAt).not.toBeNull();
    expect(new Date(s.nextReviewAt!).getTime() - NOW.getTime()).toBe(86_400_000);
  });
  it("reports becameMastered exactly once", () => {
    let s = newSkillState();
    let times = 0;
    for (let i = 0; i < 120; i++) { const r = applyOutcome(s, { correct: true, ms: 1200, allowedMs: 5000, d: s.d }, 8, NOW); s = r.state; if (r.becameMastered) times++; }
    expect(times).toBe(1);
  });
});

describe("spaced review", () => {
  const mastered = (): SkillState => { let s = newSkillState(); for (let i = 0; i < 80; i++) s = applyOutcome(s, { correct: true, ms: 1200, allowedMs: 5000, d: s.d }, 8, NOW).state; return s; };
  it("widens the interval after a good review and caps at the last step", () => {
    let s = mastered();
    for (let k = 1; k <= 10; k++) {
      s = afterReview(s, 4, 4, NOW);
      expect(s.step).toBe(Math.min(k, INTERVAL_DAYS.length - 1));
    }
    expect(new Date(s.nextReviewAt!).getTime() - NOW.getTime()).toBe(INTERVAL_DAYS[INTERVAL_DAYS.length - 1] * 86_400_000);
  });
  it("sends a failed review back to the start and costs some mastery", () => {
    let s = afterReview(afterReview(mastered(), 4, 4, NOW), 4, 4, NOW);
    expect(s.step).toBe(2);
    const m = s.mastery;
    s = afterReview(s, 5, 2, NOW);
    expect(s.step).toBe(0);
    expect(s.mastery).toBeLessThan(m);
    expect(new Date(s.nextReviewAt!).getTime() - NOW.getTime()).toBe(86_400_000);
  });
  it("repeats at half the interval for a so-so review, and ignores a single question", () => {
    const s = afterReview(mastered(), 5, 3, NOW);
    expect(s.step).toBe(0);
    expect(new Date(s.nextReviewAt!).getTime() - NOW.getTime()).toBe(43_200_000);
    expect(afterReview(s, 1, 0, NOW)).toBe(s);
  });
  it("lists due skills, most overdue first, and fades mastery of overdue skills", () => {
    const a = { ...mastered(), nextReviewAt: "2026-11-01T00:00:00.000Z" }, b = { ...mastered(), nextReviewAt: "2026-11-05T00:00:00.000Z" }, c = { ...mastered(), nextReviewAt: "2026-12-01T00:00:00.000Z" };
    const states = new Map<string, SkillState>([["a", a], ["b", b], ["c", c], ["never", newSkillState()]]);
    expect(dueSkills(states, NOW)).toEqual(["a", "b"]);
    expect(effectiveMastery(a, NOW)).toBeLessThan(a.mastery);
    expect(effectiveMastery(a, NOW)).toBeGreaterThanOrEqual(a.mastery * 0.75 - 0.1);
    expect(effectiveMastery(c, NOW)).toBe(c.mastery);
    expect(scheduleNow(newSkillState(), NOW).nextReviewAt).toBe(NOW.toISOString());
  });
});

describe("session plans", () => {
  const states = new Map<string, SkillState>();
  const mod = (key: string) => moduleByKey(key)!;
  const sameQuestions = (p: Plan) => expect(questionsOf(p)).toEqual(questionsOf(JSON.parse(JSON.stringify(p))));

  it("a practice set is 10 questions of the module's skills that get harder as they go", () => {
    const p = planPractice(mod("B-01"), states, 7, "IN", "12-15");
    expect(p.items).toHaveLength(10);
    expect(new Set(p.items.map(([id]) => id))).toEqual(new Set(["add-2digit"]));
    const ds = p.items.map(([, d]) => d);
    expect(ds).toEqual([...ds].sort((a, b) => a - b));
    expect(ds[9]).toBeGreaterThan(ds[0]);
    expect(ds[9]).toBeLessThanOrEqual(7);
    sameQuestions(p);
  });
  it("a practice set starts where the student is, but never so high it skips the ramp", () => {
    const strong = new Map<string, SkillState>([["add-2digit", { ...newSkillState(), d: 9 }]]);
    const p = planPractice(mod("B-01"), strong, 7, "IN", "12-15");
    expect(p.items[0][1]).toBeLessThanOrEqual(5);
  });
  it("a drill is timed and long enough to outlast the clock", () => {
    const p = planDrill(mod("C-01"), states, 3, "IN", "12-15");
    expect(p.seconds).toBe(60);
    expect(p.items.length).toBeGreaterThanOrEqual(40);
  });
  it("a Level Assessment covers every skill of the level at least twice at the level standard", () => {
    for (const lv of [1, 5, 10, 15]) {
      const p = planLevelAssessment(lv, states, 99, "IN", "12-15");
      const ids = skillsOfLevel(lv);
      expect(p.items.length).toBeGreaterThanOrEqual(30);
      for (const id of ids) expect(p.items.filter(([x]) => x === id).length, `${id} in level ${lv}`).toBeGreaterThanOrEqual(2);
      for (const [id, d] of p.items) { const t = skill(id)!.target; expect(d).toBeGreaterThanOrEqual(t - 2); expect(d).toBeLessThanOrEqual(t); }
      sameQuestions(p);
    }
  });
  it("emphasises weak skills in a retake", () => {
    const p = planLevelAssessment(1, states, 5, "IN", "12-15", 30, ["number-bonds"]);
    expect(p.items.filter(([x]) => x === "number-bonds").length).toBeGreaterThan(planLevelAssessment(1, states, 5, "IN", "12-15").items.filter(([x]) => x === "number-bonds").length);
  });
  it("progress, mastery, foundation, revision, review, diagnostic and benchmark plans have the right shape", () => {
    expect(planProgressAssessment(2, ["B-01", "B-02", "B-03"], states, 1, "IN", "12-15").items).toHaveLength(15);
    const m = planMasteryAssessment(5, 1, "IN", "12-15");
    expect(m.items).toHaveLength(40);
    expect(new Set(m.items.map(([id]) => skill(id)!.level))).toEqual(new Set([1, 2, 3, 4, 5]));
    expect(planFoundationCheck([1, 2, 3], 1, "IN", "12-15").items.length).toBeGreaterThanOrEqual(10);
    expect(planRevision(["hcf", "lcm"], states, 1, "IN", "12-15", "5").items).toHaveLength(12);
    const rev = planReview(["hcf", "lcm", "squares"], states, 1, "IN", "12-15");
    expect(rev.items).toHaveLength(10);
    expect(new Set(rev.items.map(([id]) => id))).toEqual(new Set(["hcf", "lcm", "squares"]));
    const dg = planDiagnosticStage(6, 1, "IN", "12-15");
    expect(dg.items).toHaveLength(5);
    expect(new Set(dg.items.map(([id]) => id)).size).toBe(5);
    expect(dg.items.every(([id]) => skill(id)!.level === 6)).toBe(true);
    const b = planBenchmark(1, "IN", "12-15");
    expect(b.items).toHaveLength(20);
    expect(b.items.every(([id, d]) => id === "benchmark" && d === 6)).toBe(true);
    for (const p of [m, rev, dg, b]) sameQuestions(p);
  });
  it("derives each question's seed from the plan seed, so no two items repeat", () => {
    const p = planPractice(mod("A-05"), states, 12345, "IN", "12-15");
    expect(new Set(p.items.map((_, i) => itemSeed(p, i))).size).toBe(10);
  });
});

describe("marking a session on the server", () => {
  const states = new Map<string, SkillState>();
  const plan = planPractice(moduleByKey("C-01")!, states, 21, "IN", "12-15");
  const qs = questionsOf(plan);
  it("counts right answers, wrong answers and blanks", () => {
    const r = qs.map((q, i) => ({ r: i % 3 === 0 ? "" : i % 3 === 1 ? q.answer : "-999999", ms: 2000 }));
    const out = markPlan(plan, r);
    expect(out).toHaveLength(10);
    expect(out.filter((a) => a.correct).length).toBe(qs.filter((_, i) => i % 3 === 1).length);
    expect(out[0].parsed).toBe(false);
  });
  it("treats a missing or malformed response as a blank and clamps silly times", () => {
    const out = markPlan(plan, [{ r: qs[0].answer, ms: -50 }, { r: 12 as unknown as string, ms: 1e12 }]);
    expect(out).toHaveLength(10);
    expect(out[0].correct).toBe(true);
    expect(out[0].ms).toBe(0);
    expect(out[1].correct).toBe(false);
    expect(out[1].ms).toBeLessThanOrEqual(600_000);
    expect(out[9].correct).toBe(false);
  });
  it("ignores extra responses and responses that took longer than a timed drill allows", () => {
    const drill = planDrill(moduleByKey("C-01")!, states, 5, "IN", "12-15");
    const dq = questionsOf(drill);
    const many = dq.map((q) => ({ r: q.answer, ms: 1000 }));
    const out = markPlan(drill, many);
    expect(out.length).toBeLessThanOrEqual(63);
    expect(out.every((a) => a.correct)).toBe(true);
    expect(markPlan(drill, [...many, ...many]).length).toBeLessThanOrEqual(dq.length);
  });
  it("marks the right answer even when typed with extra spaces, commas or a unit", () => {
    const q = qs[0];
    expect(markPlan(plan, [{ r: `  ${q.answer}  `, ms: 1000 }])[0].correct).toBe(true);
  });
});

describe("verdicts and weak skills", () => {
  it("passes at the threshold and reports accuracy, time and in-time share", () => {
    const answers = [...Array(24).fill(0).map(() => answered(true, 3000, 5000)), ...Array(6).fill(0).map(() => answered(false))];
    const v = verdict(answers, 80);
    expect(v.accuracy).toBe(80);
    expect(v.passed).toBe(true);
    expect(v.medianMs).toBe(3000);
    expect(v.inTime).toBe(100);
    expect(verdict(answers, 85).passed).toBe(false);
  });
  it("finds the weak skills: asked at least twice and under 70%", () => {
    const a = [answered(true, 1000, 5000, "x1"), answered(true, 1000, 5000, "x1"), answered(false, 1000, 5000, "x2"), answered(true, 1000, 5000, "x2"), answered(false, 1000, 5000, "x3"), answered(false, 1000, 5000, "x3"), answered(false, 1000, 5000, "x4")];
    const v = verdict(a, 80);
    expect(v.weak).toEqual(["x3", "x2"]);
    expect(v.perSkill[0].skill).toBe("x3");
  });
  it("on a fail with no skill under 70%, still names the three weakest so revision is targeted", () => {
    const a = [...Array(9).fill(0).map(() => answered(true, 1000, 5000, "p")), answered(false, 1000, 5000, "p"), ...Array(8).fill(0).map(() => answered(true, 1000, 5000, "q")), answered(false, 1000, 5000, "q"), answered(false, 1000, 5000, "q")];
    const v = verdict(a, 95);
    expect(v.passed).toBe(false);
    expect(v.weak.length).toBeGreaterThan(0);
  });
  it("an empty session never passes", () => {
    expect(verdict([], 0).passed).toBe(false);
  });
  it("XP is one point per question plus one per correct answer", () => {
    expect(xpForAnswers([answered(true), answered(false), answered(true)])).toBe(5);
  });
});

describe("unlock rules", () => {
  const allModules = (n: number) => new Set(level(n)!.modules.map((m) => m.key));
  it("a new student works on Level A with every other level locked", () => {
    const p = progress();
    expect(frontier(p)).toBe(1);
    expect(levelStatus(1, p)).toBe("in_progress");
    expect(levelStatus(2, p)).toBe("locked");
    expect(levelStatus(15, p)).toBe("locked");
  });
  it("modules open one at a time in the working level", () => {
    const p = progress({ doneModules: new Set(["A-01", "A-02"]) });
    expect(moduleOpen(1, 1, p)).toBe(true);
    expect(moduleOpen(1, 3, p)).toBe(true);
    expect(moduleOpen(1, 4, p)).toBe(false);
    expect(moduleOpen(2, 1, p)).toBe(false);
  });
  it("the Level Assessment needs every module finished, and revision after a fail", () => {
    expect(levelAssessmentGate(1, progress()).ok).toBe(false);
    expect(levelAssessmentGate(1, progress({ doneModules: allModules(1) })).ok).toBe(true);
    const failed = levelAssessmentGate(1, progress({ doneModules: allModules(1), revisionPending: new Set([1]) }));
    expect(failed.ok).toBe(false);
    expect(failed.reason).toMatch(/revision/);
    expect(levelAssessmentGate(2, progress({ doneModules: allModules(2) })).ok).toBe(false); // level 2 is locked
  });
  it("passing a Level Assessment completes the level and opens the next", () => {
    const p = progress({ completed: new Set([1]), doneModules: allModules(1) });
    expect(levelStatus(1, p)).toBe("completed");
    expect(levelStatus(2, p)).toBe("in_progress");
    expect(levelStatus(3, p)).toBe("locked");
    expect(moduleOpen(2, 1, p)).toBe(true);
    expect(moduleOpen(2, 2, p)).toBe(false);
  });
  it("all fifteen completed leaves nothing in progress", () => {
    const p = progress({ completed: new Set(Array.from({ length: 15 }, (_, i) => i + 1)) });
    expect(frontier(p)).toBe(16);
    for (let n = 1; n <= 15; n++) expect(levelStatus(n, p)).toBe("completed");
  });
  it("a Progress Assessment opens after a quarter of the modules, and a Mastery Assessment after E, J and O", () => {
    expect(progressAssessmentGate(1, progress({ doneModules: new Set(["A-01"]) })).ok).toBe(false);
    expect(progressAssessmentGate(1, progress({ doneModules: new Set(["A-01", "A-02", "A-03"]) })).ok).toBe(true);
    expect(masteryAssessmentGate(5, progress()).ok).toBe(false);
    expect(masteryAssessmentGate(5, progress({ completed: new Set([1, 2, 3, 4, 5]) })).ok).toBe(true);
    expect(masteryAssessmentGate(4, progress({ completed: new Set([4]) })).ok).toBe(false);
  });
  it("placement: levels before the start level are open and counted, but can still be formally completed", () => {
    const p = progress({ startLevel: 6 });
    expect(frontier(p)).toBe(6);
    for (let n = 1; n <= 5; n++) { expect(levelStatus(n, p)).toBe("completed"); expect(moduleOpen(n, 4, p)).toBe(true); }
    expect(levelStatus(6, p)).toBe("in_progress");
    expect(levelStatus(7, p)).toBe("locked");
    expect(levelAssessmentGate(3, progress({ startLevel: 6, doneModules: allModules(3) })).ok).toBe(true);
  });
});

describe("placement diagnostic", () => {
  const run = (truth: number, playable = 15) => {
    let s = startDiagnostic(playable);
    const asked: number[] = [];
    while (!s.done) {
      const lv = nextProbe(s)!;
      asked.push(lv);
      s = recordProbe(s, lv, lv <= truth ? 5 : 1, 5);
    }
    return { s, asked };
  };
  it("finds the highest level a student can pass within four probes", () => {
    for (let truth = 0; truth <= 15; truth++) {
      const { s, asked } = run(truth);
      expect(asked.length, `truth ${truth}`).toBeLessThanOrEqual(4);
      expect(s.recommended).toBe(Math.max(1, truth));
    }
  });
  it("never recommends a level that is not playable yet", () => {
    for (let truth = 0; truth <= 15; truth++) expect(run(truth, 6).s.recommended).toBeLessThanOrEqual(6);
  });
  it("needs four of five to pass a probe", () => {
    const a = recordProbe(startDiagnostic(15), 8, 4, 5);
    expect(a.lo).toBe(8);
    const b = recordProbe(startDiagnostic(15), 8, 3, 5);
    expect(b.hi).toBe(7);
  });
  it("starts the search in the middle and stops probing when done", () => {
    expect(nextProbe(startDiagnostic(15))).toBe(8);
    expect(nextProbe(run(7).s)).toBeNull();
  });
  it("words the result without saying anything is skipped for good", () => {
    expect(placementSummary(1)).toMatch(/Level A/);
    const t = placementSummary(6);
    expect(t).toMatch(/Level F/);
    expect(t).toMatch(/open/);
    expect(t).toMatch(/Foundation Check/);
    expect(t.toLowerCase()).not.toContain("skip");
  });
});

describe("achievements", () => {
  it("Accuracy Master needs 20 answers at 95% or better", () => {
    expect(accuracyMaster(Array(19).fill(0).map(() => answered(true)))).toBeNull();
    expect(accuracyMaster([...Array(19).fill(0).map(() => answered(true)), answered(false)])?.code).toBe("accuracy-master");
    expect(accuracyMaster([...Array(18).fill(0).map(() => answered(true)), answered(false), answered(false)])).toBeNull();
  });
  it("Speed Improver needs 25% faster than the first five, over at least 15 attempts", () => {
    let s = newSkillState();
    for (let i = 0; i < 6; i++) s = applyOutcome(s, { correct: true, ms: 8000, allowedMs: 9000, d: 1 }, 8, NOW).state;
    expect(speedImprovers(new Map([["add-single", s]]))).toHaveLength(0);
    for (let i = 0; i < 40; i++) s = applyOutcome(s, { correct: true, ms: 3000, allowedMs: 9000, d: s.d }, 8, NOW).state;
    const got = speedImprovers(new Map([["add-single", s]]));
    expect(got).toHaveLength(1);
    expect(got[0].ref).toBe("add-single");
  });
  it("counts streaks of consecutive days ending today or yesterday", () => {
    expect(streak(["2026-11-08", "2026-11-09", "2026-11-10"], "2026-11-10")).toBe(3);
    expect(streak(["2026-11-08", "2026-11-09"], "2026-11-10")).toBe(2);
    expect(streak(["2026-11-05"], "2026-11-10")).toBe(0);
    expect(streak(["2026-11-06", "2026-11-08", "2026-11-09", "2026-11-10"], "2026-11-10")).toBe(3);
    expect(streak([], "2026-11-10")).toBe(0);
  });
  it("Consistency Champion at 7 days in a row", () => {
    const days = Array.from({ length: 7 }, (_, i) => `2026-11-${String(4 + i).padStart(2, "0")}`);
    expect(consistency(days, "2026-11-10")).toHaveLength(1);
    expect(consistency(days.slice(1), "2026-11-10")).toHaveLength(0);
  });
  it("uses exactly the four named achievements", () => {
    expect(Object.values(ACHIEVEMENT_INFO).map((a) => a.title)).toEqual(["Level Completed", "Accuracy Master", "Speed Improver", "Consistency Champion"]);
  });
});

describe("My Learning Journey view", () => {
  const input = (over: Partial<import("./dashboard").JourneyInput> = {}): import("./dashboard").JourneyInput => ({ enrolled: true, diagnosticDone: true, progress: progress(), bestPct: new Map(), startedAnything: true, ...over });
  it("lists all 15 levels as Completed, In progress or Locked, with the course name and the current level", () => {
    const j = buildJourney(input({ progress: progress({ completed: new Set([1, 2]) }) }));
    expect(j.courseName).toBe("Mathematics Speed Enhancement Studio");
    expect(j.levels).toHaveLength(15);
    expect(j.levels.map((l) => l.status)).toEqual(["completed", "completed", "in_progress", ...Array(12).fill("locked")]);
    expect(j.currentLevel?.letter).toBe("C");
  });
  it("shows module progress for the current level as a percentage", () => {
    const keys = level(1)!.modules.slice(0, 4).map((m) => m.key);
    const j = buildJourney(input({ progress: progress({ doneModules: new Set(keys) }) }));
    expect(j.moduleProgress).toBe(40);
    expect(j.levels[0].modulesDone).toBe(4);
    expect(j.overallProgress).toBe(Math.round((4 / j.modulesTotal) * 100));
  });
  it("points Continue learning at the next unfinished module, then the Level Assessment", () => {
    expect(buildJourney(input()).next).toMatchObject({ label: "Continue learning", href: "/math-speed/module/A-01" });
    const some = new Set(level(1)!.modules.slice(0, 3).map((m) => m.key));
    expect(buildJourney(input({ progress: progress({ doneModules: some }) })).next.href).toBe("/math-speed/module/A-04");
    const all = new Set(level(1)!.modules.map((m) => m.key));
    expect(buildJourney(input({ progress: progress({ doneModules: all }) })).next).toMatchObject({ label: "Take the Level Assessment", href: "/math-speed/level/A#assessment" });
  });
  it("sends a new student to enrol, then to the placement check, and a finished student to results", () => {
    expect(buildJourney(input({ enrolled: false })).next.href).toBe("/math-speed/enrol");
    expect(buildJourney(input({ diagnosticDone: false, startedAnything: false })).next.href).toBe("/math-speed/diagnostic");
    const j = buildJourney(input({ progress: progress({ completed: new Set(Array.from({ length: 15 }, (_, i) => i + 1)) }) }));
    expect(j.currentLevel).toBeNull();
    expect(j.moduleProgress).toBe(100);
    expect(j.next.href).toBe("/math-speed/progress");
  });
  it("marks placed levels and carries the best assessment score", () => {
    const j = buildJourney(input({ progress: progress({ startLevel: 3 }), bestPct: new Map([[1, 92.5]]) }));
    expect(j.levels[0]).toMatchObject({ status: "completed", placed: true, bestPct: 92.5 });
    expect(j.levels[2]).toMatchObject({ status: "in_progress", placed: false });
  });
});

describe("speed and accuracy feedback", () => {
  const r = (accuracy: number, inTime: number) => ({ total: 20, accuracy, inTime, medianMs: 3200, typicalAllowedMs: 5000 });
  it("praises accurate and quick, and asks accurate-but-slow students for speed", () => {
    expect(coach(r(95, 90)).headline).toBe("Accurate and quick");
    expect(coach(r(95, 40)).headline).toBe("Accurate, now build speed");
    expect(coach(r(80, 90)).headline).toBe("Quick, with a few slips");
    expect(coach(r(80, 40)).headline).toBe("Good progress");
    expect(coach(r(50, 90)).headline).toBe("Fast, but accuracy comes first");
    expect(coach(r(50, 30)).headline).toBe("Keep practising");
  });
  it("includes the student's own typical time when known and copes with an empty round", () => {
    expect(coach(r(95, 40)).detail).toMatch(/3\.2 s against about 5\.0 s/);
    expect(coach({ total: 0, accuracy: 0, inTime: 0, medianMs: null, typicalAllowedMs: null }).headline).toBe("No answers yet");
  });
});
