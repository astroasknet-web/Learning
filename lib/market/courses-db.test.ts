import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Courses and learning on a real database: the catalogue search, enrolment, progress,
 * the three completion tiers, certificate links and the signed LMS webhook.
 *
 *   PORTAL_TEST_DATABASE_URL=mysql://root@127.0.0.1:3307/growqr_test npx vitest run lib/market/courses-db.test.ts
 */
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }),
  headers: async () => new Headers({ "x-forwarded-host": "growqr.test", "x-forwarded-proto": "https" }),
}));
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const DB = process.env.PORTAL_TEST_DATABASE_URL;
describe.skipIf(!DB)("courses and learning on a real database", () => {
  const tag = Math.random().toString(16).slice(2, 8);
  const email = `lr-${tag}@portal-test.invalid`;
  let uid = 0;
  let db: typeof import("../portal/db");
  let C: typeof import("./courses");
  let L: typeof import("./learning");
  let course: import("./courses").Course;

  beforeAll(async () => {
    process.env.DATABASE_URL = DB;
    process.env.PORTAL_APP_URL = "https://growqr.test";
    process.env.LMS_CERTIFICATE_HOSTS = "lms.example.org";
    process.env.LMS_WEBHOOK_SECRET = "wh-secret";
    delete process.env.RESEND_API_KEY;
    db = await import("../portal/db");
    C = await import("./courses");
    L = await import("./learning");
    const auth = await import("../portal/auth");
    const r = await auth.register({ role: "student", name: "Learner", email, password: "blue-kettle-orbit-nine", college: "Test College" }, "198.51.100.93");
    if (!r.ok) throw new Error(r.error);
    uid = r.userId;
    // make sure the catalogue is loaded (idempotent: it is the same file the database was built from)
    await C.sync(JSON.parse(readFileSync(path.resolve(__dirname, "data/courses.json"), "utf8")));
    course = (await C.bySlug("python-foundations"))!;
  });

  afterAll(async () => {
    if (!db) return;
    await db.run("DELETE FROM users WHERE email LIKE $1", [`%${tag}@portal-test.invalid`]);
    await db.run("DELETE FROM mail_outbox WHERE to_email LIKE $1", [`%${tag}@portal-test.invalid`]);
    await db.run("DELETE FROM auth_throttle WHERE bucket = 'reg:198.51.100.93' OR bucket LIKE 'whsig:%'");
    await db.closePool();
  });

  it("carries the course fee from the payment catalogue, for any course, on and off sale", async () => {
    const { seedCatalogue } = await import("../pay/catalogue");
    await seedCatalogue();
    const a = await C.bySlug("digital-literacy-master"); // lessons exist here: on sale
    const b = await C.bySlug("advanced-excel"); // no lessons yet: off sale, fee still shown
    expect(a?.fee_minor).toBeGreaterThan(0);
    expect(b?.fee_minor).toBeGreaterThan(0);
    const page = await C.search({});
    expect(page.items.every((c) => c.fee_minor === null || c.fee_minor > 0)).toBe(true);
    expect(page.items.some((c) => c.fee_minor !== null)).toBe(true);
  });

  it("loads the catalogue and answers searches", async () => {
    expect(await C.total()).toBe(JSON.parse(readFileSync(path.resolve(__dirname, "data/courses.json"), "utf8")).courses.length);
    expect(course.learn.length).toBeGreaterThan(0);
    expect(course.cat_name).not.toBe("");
    expect((await C.categories()).reduce((a, c) => a + c.n, 0)).toBe(await C.total());
    const all = await C.search({});
    expect(all.items).toHaveLength(C.PAGE_SIZE);
    expect(all.pages).toBe(Math.ceil(all.total / C.PAGE_SIZE));
    expect((await C.search({ page: 999 })).page).toBe(all.pages);
    const py = await C.search({ q: "python" });
    expect(py.total).toBeGreaterThan(0);
    expect(py.items.every((c) => /python/i.test(c.title + c.brief + c.learn.join(" ") + c.badge + c.best_for))).toBe(true);
    expect(py.items[0].title.toLowerCase()).toContain("python"); // title matches first
    expect((await C.search({ q: "100%_" })).total).toBe(0); // LIKE wildcards are escaped
    const short = await C.search({ len: "short" });
    expect(short.items.every((c) => c.hours_num > 0 && c.hours_num <= 15)).toBe(true);
    const adv = await C.search({ level: "advanced" });
    expect(adv.items.every((c) => ["A", "P", "E"].includes(c.level))).toBe(true);
    const col = await C.search({ aud: "College" });
    expect(col.items.every((c) => c.tag_list.includes("College"))).toBe(true);
    const az = await C.search({ sort: "az" });
    expect(az.items[0].title).toBe(await db.val("SELECT title FROM courses ORDER BY title ASC LIMIT 1"));
    const longFirst = await C.search({ sort: "long" });
    expect(longFirst.items[0].hours_num).toBeGreaterThanOrEqual(longFirst.items[1].hours_num);
    expect((await C.suggest("py")).length).toBeGreaterThan(0);
    expect(await C.suggest("p")).toEqual([]);
    const have = new Set((await C.search({ page: 1 })).items.map((c) => c.slug));
    void have;
    const feat = (await C.featured(8)).map((c) => c.slug);
    expect(feat.length).toBeGreaterThan(3);
    expect(feat).toEqual(C.FEATURED.filter((s) => feat.includes(s)));
    const paths = await C.paths();
    expect(paths.length).toBeGreaterThan(3);
    expect(paths[0].hours).toBe(paths[0].courses.reduce((a, c) => a + c.hours_num, 0));
    expect((await C.related(course, 3)).every((c) => c.category === course.category && c.slug !== course.slug)).toBe(true);
    expect((await C.forSkills(["Python", "Excel"], 3)).length).toBeGreaterThan(0);
  });

  it("enrols, tracks progress and completes", async () => {
    expect(await L.find(uid, course.id)).toBeNull();
    expect(await L.setDone(uid, course, [0])).toBeNull(); // not enrolled yet
    await L.enrol(uid, course.id);
    await L.enrol(uid, course.id); // idempotent
    expect((await L.find(uid, course.id))?.status).toBe("enrolled");
    const total = L.checkpoints(course);
    expect(total).toBe(course.modules + 1);
    const half = await L.setDone(uid, course, [0, 1, 1, -1, 999, "2"]);
    expect(half?.done).toEqual([0, 1, 2]);
    expect(half?.status).toBe("in_progress");
    expect(half?.progress).toBe(Math.round((3 / total) * 100));
    expect(half?.tier).toBeNull();
    const full = await L.setDone(uid, course, Array.from({ length: total }, (_, i) => i));
    expect(full?.status).toBe("completed");
    expect(full?.progress).toBe(100);
    expect(full?.tier).toBe("self");
    expect(await db.val("SELECT COUNT(*) FROM mail_outbox WHERE to_email = $1 AND kind = 'course_completed'", [email])).toBe(1);
    await L.setDone(uid, course, Array.from({ length: total }, (_, i) => i)); // saving again does not email again
    expect(await db.val("SELECT COUNT(*) FROM mail_outbox WHERE to_email = $1 AND kind = 'course_completed'", [email])).toBe(1);
    expect((await L.forUser(uid))[0]).toMatchObject({ slug: course.slug, status: "completed" });
  });

  it("only accepts certificate links on an allowed https host", async () => {
    for (const bad of ["http://lms.example.org/c/1", "https://evil.com/c/1", "https://lms.example.org.evil.com/x", "https://user:pw@lms.example.org/x", "javascript:alert(1)", "not a url", "https://notlms.example.org/x", "https://lms.example.org/" + "a".repeat(300)]) {
      expect(L.validCertificateUrl(bad), bad).toBe(false);
    }
    for (const good of ["https://lms.example.org/cert/1", "https://app.lms.example.org/cert/1", "https://LMS.example.org/x"]) expect(L.validCertificateUrl(good), good).toBe(true);
    expect(await L.attachCertificate(uid, course, "https://evil.com/x", "")).toMatch(/allowed address/);
    expect(await L.attachCertificate(uid, { id: 2147483000 }, "https://lms.example.org/x", "")).toMatch(/Finish every checkpoint/);
    expect(await L.attachCertificate(uid, course, "https://lms.example.org/cert/9", "  VD-9  ")).toBeNull();
    const e = await L.find(uid, course.id);
    expect(e?.tier).toBe("certificate");
    expect(e?.certificate_code).toBe("VD-9");
  });

  it("counts a certificate-backed course as learned, and lets the student leave an unverified one", async () => {
    const passport = await import("../portal/passport/profile");
    expect(await passport.learnedText(uid)).toContain("python");
    await L.unenrol(uid, course.id);
    expect(await L.find(uid, course.id)).toBeNull();
    expect(await passport.learnedText(uid)).toBe("");
  });

  it("accepts a signed LMS completion once and locks the record", async () => {
    const body = JSON.stringify({ email: email.toUpperCase(), course_slug: course.slug, certificate_url: "https://lms.example.org/cert/77", certificate_code: "VD-77" });
    const ts = String(Math.floor(Date.now() / 1000));
    const sig = (b: string, t = ts, secret = "wh-secret") => createHmac("sha256", secret).update(`${t}.${b}`).digest("hex");
    expect((await L.handleWebhook(body, ts, "bad")).status).toBe(401);
    expect((await L.handleWebhook(body, ts, sig(body, ts, "other"))).status).toBe(401);
    expect((await L.handleWebhook(body, "123", sig(body, "123"))).status).toBe(401); // stale
    expect((await L.handleWebhook(body, "", "")).status).toBe(401);
    const ok = await L.handleWebhook(body, ts, sig(body));
    expect(ok).toEqual({ status: 200, body: { ok: true } });
    expect((await L.handleWebhook(body, ts, sig(body))).status).toBe(409); // replay
    const e = await L.find(uid, course.id);
    expect(e).toMatchObject({ status: "completed", verified: true, tier: "verified", certificate_url: "https://lms.example.org/cert/77" });
    expect(await L.setDone(uid, course, [0])).toBeNull(); // verified records are locked
    await L.unenrol(uid, course.id);
    expect(await L.find(uid, course.id)).not.toBeNull(); // and cannot be dropped
    const unknown = JSON.stringify({ email: "nobody@portal-test.invalid", course_slug: course.slug });
    expect((await L.handleWebhook(unknown, ts, sig(unknown))).body).toEqual({ error: "unknown user" });
    const noCourse = JSON.stringify({ email, course_slug: "no-such-course" });
    expect((await L.handleWebhook(noCourse, ts, sig(noCourse))).body).toEqual({ error: "unknown course" });
    const missing = JSON.stringify({ email });
    expect((await L.handleWebhook(missing, ts, sig(missing))).status).toBe(400);
    process.env.LMS_WEBHOOK_SECRET = "";
    expect((await L.handleWebhook(body, ts, sig(body))).status).toBe(404); // disabled without a secret
    process.env.LMS_WEBHOOK_SECRET = "wh-secret";
  });
});
