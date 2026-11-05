import { describe, expect, it } from "vitest";
import { FALLBACK_SLUGS, MIN_RECOMMENDED, recommendedCourses } from "./plan-picks";
import { isNative } from "./lessons";
import { PLAN_COURSE_QUOTA } from "./plan-quota";
import catalogue from "./data/courses.json";

const scan = (urls: string[], domain = "software") => ({ domain: { key: domain }, sections: [{ recommendations: urls.map((u) => ({ url: u })) }] });
const native = (set: string[]) => (s: string) => set.includes(s);

describe("plan quotas", () => {
  it("are Pro 1, Silver 2, Gold 3", () => expect(PLAN_COURSE_QUOTA).toEqual({ pro: 1, silver: 2, gold: 3 }));
});

describe("courses a student may choose from their plan", () => {
  it("are the scan's recommendations that can be studied on GrowQR, in the scan's order", () => {
    const r = recommendedCourses(scan(["https://x.test/courses/seo", "https://x.test/courses/not-taught-here", "/courses/spoken-english", "/courses/cybersecurity-essentials"]), native(["seo", "cybersecurity-essentials", "spoken-english"]));
    expect(r.map((x) => x.slug)).toEqual(["seo", "spoken-english", "cybersecurity-essentials"]);
    expect(r.every((x) => x.source === "scan")).toBe(true);
  });
  it("always gives at least three, topping up from the domain, then the general list, then the fixed career-ready list", () => {
    const r = recommendedCourses(scan(["/courses/seo"], "marketing"), isNative);
    expect(r.length).toBeGreaterThanOrEqual(MIN_RECOMMENDED);
    expect(r[0]).toEqual({ slug: "seo", source: "scan" });
    expect(new Set(r.map((x) => x.slug)).size).toBe(r.length);
  });
  it("still gives three when the scan recommended nothing that is taught here (a software resume)", () => {
    const r = recommendedCourses(scan(["/courses/dsa-for-interviews", "/courses/front-end-development"], "software"), isNative);
    expect(r.length).toBe(MIN_RECOMMENDED);
    for (const x of r) expect(isNative(x.slug)).toBe(true);
  });
  it("never offers a course without lessons, and an unreadable scan still gets the fixed list", () => {
    expect(recommendedCourses({} as never, isNative).length).toBe(MIN_RECOMMENDED);
    for (const s of FALLBACK_SLUGS) expect(isNative(s), s).toBe(true);
    for (const s of FALLBACK_SLUGS) expect((catalogue as unknown as { courses: Array<{ slug: string }> }).courses.some((c) => c.slug === s), s).toBe(true); // a course row exists to enrol in
  });
  it("has enough to fill the biggest plan (3 picks)", () => {
    expect(recommendedCourses(scan([]), isNative).length).toBeGreaterThanOrEqual(PLAN_COURSE_QUOTA.gold);
  });
});
