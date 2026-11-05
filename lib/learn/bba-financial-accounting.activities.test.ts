import { describe, expect, it } from "vitest";
import { activitiesFor, badgeEarned, findActivity, initialState, learnCourse, levelFor, xpFor } from "./activities";
import { runChecks } from "./checks";
import type { Activity, ActivityState } from "./types";
import type { SheetState } from "./sheet/engine";
import nc from "@/lib/market/data/lessons/bba-financial-accounting.json";

const SLUG = "bba-financial-accounting";
const course = learnCourse(SLUG)!;
const withCells = (a: Activity, extra: Record<string, string>): ActivityState => {
  const s = (initialState(a) as { sheet: SheetState }).sheet;
  return { kind: "sheet", sheet: { ...s, cells: { ...s.cells, ...extra } } };
};

/** A model answer for every activity. If an authored check is wrong, impossible or too easy, one of these tests fails. */
const SOLUTIONS: Record<string, Record<string, string>> = {
  "t1-trial-balance": { B9: "=SUM(B2:B8)", C9: "=SUM(C2:C8)", B10: "=B9-C9" },
  "d1-depreciation": { B7: "=(B1-B2)/B3", B8: "=(B1-B2)/B3", B9: "=(B1-B2)/B3", C7: "=B1-B7", C8: "=C7-B8", C9: "=C8-B9", D7: "=B1*B4", E7: "=B1-D7", D8: "=E7*B4", E8: "=E7-D8", D9: "=E8*B4", E9: "=E8-D9" },
  "d2-stock-valuation": { D2: "=B2*C2", D3: "=B3*C3", D4: "=B4*C4", B5: "=SUM(B2:B4)", D5: "=SUM(D2:D4)", B8: "=B5-B7", B9: "=D5/B5", B10: "=B8*B9", B11: "=100*C4+50*C3", B12: "=D5-B11" },
  "f1-final-accounts": { B20: "=B2-B3", B21: "=B4-B5", B22: "=B6+B21+B8+B9-B7", B23: "=B20-B22", B24: "=SUM(B10:B17)", B25: "=B23+B18-B24" },
  "a1-ratios": { B13: "=B6/B8", B14: "=(B6-B7)/B8", B15: "=(B2-B3)/B2", B16: "=B4/B2", B17: "=365/(B2/B11)", B18: "=B10/B9", B19: "=(B4+B5)/B5", B20: "=B4/B9" },
  "g1-gst": { B5: "=B1*B3", B6: "=B2*B3", B7: "=B6-B5", B8: "=B7/2", B9: "=B2+B6" },
  "cap-brs": { B7: "=B1-B2+B3", B8: "=B7+B4-B5" },
};
const solve = (a: Activity): ActivityState => (a.kind === "classify" ? { kind: "classify", answers: Object.fromEntries(a.classify!.items.map((i) => [i.id, i.answer])) } : withCells(a, SOLUTIONS[a.id]));

describe("BBA Financial Accounting activities", () => {
  it("are well formed and registered", () => {
    expect(course.activities.length).toBeGreaterThanOrEqual(9);
    const ids = new Set<string>();
    for (const a of course.activities) {
      expect(ids.has(a.id), `duplicate ${a.id}`).toBe(false);
      ids.add(a.id);
      expect(a.checks.length, a.id).toBeGreaterThan(0);
      expect(new Set(a.checks.map((c) => c.id)).size, `${a.id} check ids`).toBe(a.checks.length);
      expect([a.objective, a.scenario, a.title].every((s) => s.length > 8), a.id).toBe(true);
      expect(a.steps.length, a.id).toBeGreaterThan(0);
      for (const c of a.checks) { expect(c.hint.length, `${a.id}/${c.id} hint`).toBeGreaterThan(5); expect(c.explain.length, `${a.id}/${c.id} explain`).toBeGreaterThan(5); }
      const prefix = { word: "doc.", sheet: "sheet.", slides: "slides.", classify: "classify.", sql: "sql.", dax: "dax.", viz: "viz." }[a.kind];
      for (const c of a.checks) expect(c.spec.k.startsWith(prefix), `${a.id}/${c.id} uses ${c.spec.k}`).toBe(true);
      expect(course.skills.some((s) => a.skills.includes(s.id)), a.id).toBe(true);
    }
  });

  it("point at real modules of the course", () => {
    const mods = new Set<string>([...nc.modules.map((m) => m.slug), "capstone"]);
    for (const a of course.activities) expect(mods.has(a.module), `${a.id} -> ${a.module}`).toBe(true);
    expect(activitiesFor(SLUG, "depreciation-inventory-adjustments").length).toBe(3);
    expect(activitiesFor(SLUG, "capstone").length).toBe(1);
  });

  it("every activity can be completed by its model answer", () => {
    const problems: string[] = [];
    for (const a of course.activities) {
      const r = runChecks(a, solve(a));
      for (const x of r.results) if (!x.passed) problems.push(`${a.id}/${x.id}: ${x.message}`);
    }
    expect(problems).toEqual([]);
  });

  it("no activity is already passed (or half passed) before the student does anything", () => {
    for (const a of course.activities) {
      const r = runChecks(a, initialState(a));
      expect(r.allPassed, a.id).toBe(false);
      expect(r.passed / r.total, `${a.id} starts ${r.passed}/${r.total}`).toBeLessThanOrEqual(0.5);
    }
  });

  it("typing the answer instead of a formula earns nothing", () => {
    const a = findActivity(SLUG, "t1-trial-balance")!;
    const typed = runChecks(a, withCells(a, { B9: "420000", C9: "420000", B10: "0" }));
    expect(typed.allPassed).toBe(false);
    expect(typed.results.find((x) => x.id === "dr")!.message).toMatch(/formula starts with an equals/);
  });

  it("a plausible mistake is caught with a useful message", () => {
    const a = findActivity(SLUG, "d1-depreciation")!;
    // Applying the WDV rate to the original cost every year (a classic error)
    const wrong = runChecks(a, withCells(a, { ...SOLUTIONS["d1-depreciation"], D8: "=B1*B4" }));
    expect(wrong.results.find((x) => x.id === "d8")!.passed).toBe(false);
    const gst = findActivity(SLUG, "g1-gst")!;
    const added = runChecks(gst, withCells(gst, { ...SOLUTIONS["g1-gst"], B7: "=B6+B5" }));
    expect(added.results.find((x) => x.id === "net")!.passed).toBe(false);
  });

  it("derives XP, level and badges only from what was passed", () => {
    expect(xpFor(course, new Set())).toBe(0);
    const all = new Set(course.activities.map((a) => a.id));
    expect(xpFor(course, all)).toBe(course.activities.reduce((n, a) => n + a.xp, 0));
    expect(levelFor(course, 0).title).toBe("Beginner");
    expect(levelFor(course, 100000).next).toBeNull();
    expect(course.badges.every((b) => badgeEarned(b, all))).toBe(true);
    expect(course.badges.some((b) => badgeEarned(b, new Set()))).toBe(false);
    for (const b of course.badges) for (const id of b.when.all ?? []) expect(all.has(id), `${b.id} needs ${id}`).toBe(true);
  });
});
