import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Interactive-learning progress on a real database: results, XP, badges, the rule that a module needs its quiz AND its required activities,
 * course completion verified by GrowQR, and saved work.
 *
 *   PORTAL_TEST_DATABASE_URL=mysql://root@127.0.0.1:3307/growqr_test npx vitest run lib/learn/results-db.test.ts
 */
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }),
  headers: async () => new Headers({ "x-forwarded-host": "growqr.test", "x-forwarded-proto": "https" }),
}));
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const DB = process.env.PORTAL_TEST_DATABASE_URL;
describe.skipIf(!DB)("interactive learning on a real database", () => {
  const tag = Math.random().toString(16).slice(2, 8);
  let uid = 0;
  let db: typeof import("../portal/db");
  let R: typeof import("./results");
  let A: typeof import("./activities");
  let L: typeof import("../market/learning");
  let C: typeof import("../market/courses");
  const SLUG = "digital-literacy-master";
  const ok = { results: [], passed: 1, total: 1, score: 100, allPassed: true };
  const bad = { results: [], passed: 0, total: 1, score: 40, allPassed: false };

  beforeAll(async () => {
    process.env.DATABASE_URL = DB;
    process.env.PORTAL_APP_URL = "https://growqr.test";
    delete process.env.RESEND_API_KEY;
    db = await import("../portal/db");
    R = await import("./results");
    A = await import("./activities");
    L = await import("../market/learning");
    C = await import("../market/courses");
    const auth = await import("../portal/auth");
    const r = await auth.register({ role: "student", name: "Learner", email: `lr-${tag}@portal-test.invalid`, password: "blue-kettle-orbit-nine", college: "Test College" }, "198.51.100.77");
    if (!r.ok) throw new Error(r.error);
    uid = r.userId;
    if ((await C.total()) === 0) throw new Error("run scripts/courses-sync.ts first");
  });
  afterAll(async () => {
    await db.run("DELETE FROM users WHERE email LIKE $1", [`%-${tag}@portal-test.invalid`]);
    await db.closePool();
  });

  const passAll = async (module: string) => { for (const a of A.requiredFor(SLUG, module)) await R.save(uid, SLUG, a.id, null, a.xp, ok); };

  it("does not tick a module on its quiz alone when it has required practice", async () => {
    await R.recordQuiz(uid, SLUG, "ms-word", 90, true);
    const r = await R.reconcile(uid, SLUG);
    expect(r).toMatchObject({ ticked: [], pending: ["ms-word"], completed: false });
    const e = await L.find(uid, (await C.bySlug(SLUG))!.id);
    expect(e?.done).toEqual([]);
  });
  it("ticks it once every required activity is passed, and not before", async () => {
    const req = A.requiredFor(SLUG, "ms-word").map((a) => a.id);
    expect(req).toEqual(["w1-letter", "w3-resume", "w5-report"]);
    await R.save(uid, SLUG, "w1-letter", null, 40, ok);
    await R.save(uid, SLUG, "w3-resume", null, 50, ok);
    expect(await R.reconcile(uid, SLUG)).toMatchObject({ ticked: [] });
    await R.save(uid, SLUG, "w5-report", null, 60, ok);
    const r = await R.reconcile(uid, SLUG);
    expect(r.ticked).toEqual([1]);
    expect((await L.find(uid, (await C.bySlug(SLUG))!.id))?.done).toEqual([1]);
  });
  it("counts attempts and best score without losing a pass", async () => {
    await R.save(uid, SLUG, "w5-report", null, 60, bad);
    const row = (await R.resultsFor(uid, SLUG)).get("w5-report")!;
    expect(row).toMatchObject({ passed: true, best: 100, xp: 60 });
    expect(row.attempts).toBe(2);
    await R.save(uid, SLUG, "s2-total-average", null, 50, bad);
    expect((await R.resultsFor(uid, SLUG)).get("s2-total-average")).toMatchObject({ passed: false, best: 40, xp: 0, attempts: 1 });
  });
  it("derives XP, level and badges from what was passed", async () => {
    const s = (await R.summary(uid, SLUG))!;
    expect(s.xp).toBe(40 + 50 + 60); // quizzes carry no XP; the failed attempt carries none
    expect(s.level.title).toBe("Explorer");
    expect(s.badges.find((b) => b.id === "document-pro")?.earned).toBe(true);
    expect(s.badges.find((b) => b.id === "first-formula")?.earned).toBe(false);
    expect(s.skills.find((k) => k.id === "word")).toMatchObject({ done: 3 });
  });
  it("saves work without changing the score, and loads it back", async () => {
    const before = (await R.resultsFor(uid, SLUG)).get("w3-resume")!;
    await R.save(uid, SLUG, "w3-resume", { kind: "word", html: "<p>My draft</p>" }, 50, null);
    const after = (await R.resultsFor(uid, SLUG)).get("w3-resume")!;
    expect(after).toMatchObject({ attempts: before.attempts, best: before.best, passed: true });
    expect(await R.savedState(uid, SLUG, "w3-resume")).toEqual({ kind: "word", html: "<p>My draft</p>" });
    expect(await R.savedState(uid, SLUG, "nope")).toBeNull();
    await expect(R.save(uid, SLUG, "w3-resume", { kind: "word", html: "x".repeat(130_000) }, 50, null)).rejects.toThrow(/too large/);
  });
  it("completes and verifies the whole course only when every module and the capstone are done", async () => {
    const nc = (await import("../market/lessons")).nativeCourse(SLUG)!;
    const keys = [...nc.modules.map((m) => m.slug), "capstone"];
    let last = { completed: false } as Awaited<ReturnType<typeof R.reconcile>>;
    for (const k of keys) {
      if (k !== "capstone") expect(last.completed).toBe(false);
      await R.recordQuiz(uid, SLUG, k, 100, true);
      await passAll(k);
      last = await R.reconcile(uid, SLUG);
    }
    expect(last.completed).toBe(true);
    const e = await L.find(uid, (await C.bySlug(SLUG))!.id);
    expect(e).toMatchObject({ status: "completed", verified: true, verified_via: "growqr", tier: "verified" });
    const s = (await R.summary(uid, SLUG))!;
    expect(s.badges.find((b) => b.id === "portfolio")?.earned).toBe(true);
    expect(s.level.title).toBe("Confident"); // required work alone does not reach the top level
    for (const act of A.learnCourse(SLUG)!.activities) await R.save(uid, SLUG, act.id, null, act.xp, ok); // the optional practice does
    expect((await R.summary(uid, SLUG))!.level.title).toBe("Digital Pro");
  });
  it("still ticks a course that has no activities as soon as its quiz is passed", async () => {
    const slug = "data-science-python";
    await R.recordQuiz(uid, slug, "scientific-python", 80, true);
    const r = await R.reconcile(uid, slug);
    expect(r.ticked).toEqual([0]);
    expect((await L.find(uid, (await C.bySlug(slug))!.id))?.done).toEqual([0]);
  });
});
