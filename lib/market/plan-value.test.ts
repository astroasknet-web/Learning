import { describe, expect, it } from "vitest";
import { PLANS } from "./plans";
import { PLAN_COURSE_QUOTA } from "./plan-quota";
import { bestValue, buildStacks, chargedRupees, perUnit, savingFor, yearlySaving } from "./plan-value";
import { pickableFees, planStacks, valuePrices } from "../pay/plan-value-prices";
import { PLAN_STUDIOS } from "../pay/plans";
import { PLAN_SERVICES } from "./plan-services";
import { COURSE_FEE_RUPEES, RESUME_STUDIO_PRO_RUPEES, STUDIO_COURSES } from "../pay/course-fees";

const P = { pickMin: 300, pickMax: 800, vedicMathematics: 800, resumeStudioPro: 200, mathsSpeedStudio: 700, englishWritingStudio: 500, ieltsPracticeTests: 1500, services: { "career-counselling": 800, "overseas-counselling": 1500, "resume-review": 1000, "mock-visa-interview": 800, "expert-shortlist": 2500 } };
const v = valuePrices;
const plan = (k: string) => PLANS.find((x) => x.key === k)!;
const price = (k: "pro" | "silver" | "gold", yearly: boolean) => chargedRupees(plan(k), yearly);

describe("value stack arithmetic", () => {
  const s = buildStacks(P);
  it("totals are the sum of the priced lines, with picks at the cheapest course", () => {
    expect(s.pro.value).toBe(1 * 300 + 800 + 200);
    expect(s.silver.value).toBe(2 * 300 + 800 + 200 + 700 + 500 + 800); // picks, Vedic, Resume Pro, Maths, 10 of 30 IELTS tests (a third of 1,500), one counselling session
    expect(s.gold.value).toBe(3 * 300 + 800 + 200 + 700 + 1500 + 500 + (800 + 1500 + 1000 + 2 * 800 + 2500));
    for (const k of ["pro", "silver", "gold"] as const) expect(s[k].lines.reduce((t, l) => t + l.rupees, 0)).toBe(s[k].value);
  });
  it("the 'up to' total swaps only the picks to the dearest course", () => {
    expect(s.silver.valueMax).toBe(s.silver.value + 2 * 500);
    expect(buildStacks({ ...P, pickMax: 300 }).silver.valueMax).toBe(buildStacks({ ...P, pickMax: 300 }).silver.value);
  });
  it("counts courses and studios, and every item the plan includes", () => {
    expect([s.pro.units, s.silver.units, s.gold.units]).toEqual([2, 5, 7]);
    expect([s.pro.items, s.silver.items, s.gold.items]).toEqual([5, 11, 21]);
  });
  it("unpriced extras never enter the totals", () => {
    expect(s.gold.extras.length).toBeGreaterThan(0);
    expect(s.gold.value).toBe(buildStacks(P).gold.value);
  });
});

describe("saving", () => {
  it("is the difference and its rounded percentage of the standalone value", () => {
    expect(savingFor(899, 2893)).toEqual({ amount: 1994, percent: 69 });
    expect(savingFor(100, 300)).toEqual({ amount: 200, percent: 67 });
  });
  it("claims nothing when the plan costs the same or more", () => {
    expect(savingFor(500, 500)).toBeNull();
    expect(savingFor(900, 500)).toBeNull();
  });
  it("per-course price only appears alongside a real saving", () => {
    const s = buildStacks(P);
    expect(perUnit(1400, s.silver)).toBe(280);
    expect(perUnit(99999, s.gold)).toBeNull(); // costs more than its priced contents
  });
  it("best value is the biggest saving percentage, or none", () => {
    const s = buildStacks(P);
    expect(bestValue({ pro: 1500, silver: 900, gold: 12000 }, s)).toBe("silver");
    expect(bestValue({ pro: 1500, silver: 4000, gold: 1000 }, s)).toBe("gold");
    expect(bestValue({ pro: 99999, silver: 99999, gold: 99999 }, s)).toBeNull();
  });
  it("a year's saving is twelve months minus the yearly price", () => {
    expect(yearlySaving({ monthly: 599, yearly: 4792 })).toEqual({ amount: 2396, percent: 33 });
    expect(yearlySaving({ monthly: 100, yearly: 1200 })).toBeNull();
  });
});

describe("the new prices and what is charged", () => {
  it("monthly prices are Pro 599, Silver 999, Gold 1,699 and a year costs eight months", () => {
    expect([plan("pro").monthly, plan("silver").monthly, plan("gold").monthly]).toEqual([599, 999, 1699]);
    for (const k of ["pro", "silver", "gold"]) expect(plan(k).yearly).toBe(plan(k).monthly * 8);
  });
  it("every paid plan can be bought monthly, so the monthly view compares the monthly charge", () => {
    for (const k of ["pro", "silver", "gold"] as const) expect(price(k, false)).toBe(plan(k).monthly);
    expect(price("gold", true)).toBe(13592);
  });
});

describe("the real catalogue behind the numbers", () => {
  it("prices come from the lists that seed the shop", () => {
    const v = valuePrices();
    expect(v.resumeStudioPro).toBe(RESUME_STUDIO_PRO_RUPEES);
    for (const [key, slug] of [["mathsSpeedStudio", "mathematics-speed-enhancement"], ["englishWritingStudio", "english-writing-studio"], ["vedicMathematics", "vedic-mathematics"]] as const) {
      expect(v[key]).toBe(STUDIO_COURSES.find((x) => x.slug === slug)!.rupees);
    }
    expect(v.vedicMathematics).toBe(799);
    const fees = pickableFees();
    expect(fees.length).toBeGreaterThan(10);
    expect(v.pickMin).toBe(Math.min(...fees));
    expect(v.pickMax).toBe(Math.max(...fees));
    for (const f of fees) expect(Object.values(COURSE_FEE_RUPEES)).toContain(f);
  });
  it("course picks in the stack match the plans' real quotas, and the maths studio matches what the plan opens", () => {
    const s = planStacks();
    expect(PLAN_COURSE_QUOTA).toEqual({ pro: 1, silver: 2, gold: 3 });
    expect(PLAN_STUDIOS["mathematics-speed-enhancement"]).toBe("silver");
    expect(s.pro.lines.some((l) => /Mathematics Speed/.test(l.label))).toBe(false);
    expect(s.silver.lines.some((l) => /Mathematics Speed/.test(l.label))).toBe(true);
    expect(s.gold.lines.some((l) => /Mathematics Speed/.test(l.label))).toBe(true);
    expect(s.silver.lines[0].label).toBe("2 courses from your recommendations");
    expect(PLAN_SERVICES.gold["expert-shortlist"]).toEqual({ count: 1, per: "year" });
    expect(PLAN_SERVICES.silver["career-counselling"]).toEqual({ count: 1, per: "month" });
    expect(PLAN_SERVICES.pro).toEqual({});
    expect(PLAN_STUDIOS["ielts-practice-tests"]).toBe("gold");
    expect(v().ieltsPracticeTests).toBe(1599);
    expect(v().services).toEqual({ "career-counselling": 799, "overseas-counselling": 1499, "resume-review": 999, "mock-visa-interview": 799, "expert-shortlist": 2499 });
    for (const k of ["pro", "silver", "gold"] as const) expect(s[k].lines.some((l) => /Vedic/.test(l.label))).toBe(true);
  });
  it("a wider plan never shows less than a narrower one", () => {
    const s = planStacks();
    expect(s.silver.value).toBeGreaterThan(s.pro.value);
    expect(s.gold.value).toBeGreaterThan(s.silver.value);
    expect(s.gold.items).toBeGreaterThan(s.silver.items);
  });
  it("with real prices every plan saves in the monthly view, and none claims a saving against its yearly price", () => {
    const s = planStacks();
    for (const k of ["pro", "silver", "gold"] as const) {
      expect(savingFor(price(k, false), s[k].value), k).not.toBeNull();
      expect(savingFor(price(k, true), s[k].value), k).toBeNull();
    }
    expect(bestValue({ pro: price("pro", true), silver: price("silver", true), gold: price("gold", true) }, s)).toBeNull();
    expect(bestValue({ pro: price("pro", false), silver: price("silver", false), gold: price("gold", false) }, s)).not.toBeNull();
  });
});
