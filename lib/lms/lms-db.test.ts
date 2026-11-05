import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Classes, assignments, gradebook, learner codes and parent links on a real database, including the Phase 1 native-course progress
 * and Phase 3 test attempts that feed the gradebook.
 *
 *   PORTAL_TEST_DATABASE_URL=mysql://root@127.0.0.1:3307/growqr_test npx vitest run lib/lms/lms-db.test.ts
 */
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }),
  headers: async () => new Headers({ "x-forwarded-host": "growqr.test", "x-forwarded-proto": "https" }),
}));
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const DB = process.env.PORTAL_TEST_DATABASE_URL;
describe.skipIf(!DB)("LMS on a real database", () => {
  const tag = Math.random().toString(16).slice(2, 8);
  const ids: Record<string, number> = {};
  let db: typeof import("../portal/db");
  let C: typeof import("./classes");
  let P: typeof import("./parents");
  let L: typeof import("../market/learning");
  let CO: typeof import("../market/courses");
  let A: typeof import("../tests/attempts");
  let classId = 0;
  let code = "";

  const mk = async (key: string, role: "student" | "teacher" | "parent", name: string) => {
    const auth = await import("../portal/auth");
    const r = await auth.register({ role, name, email: `${key}-${tag}@portal-test.invalid`, password: "blue-kettle-orbit-nine", college: "Test College" }, `198.51.100.${100 + Object.keys(ids).length}`);
    if (!r.ok) throw new Error(r.error);
    ids[key] = r.userId;
  };

  beforeAll(async () => {
    process.env.DATABASE_URL = DB;
    process.env.PORTAL_APP_URL = "https://growqr.test";
    delete process.env.RESEND_API_KEY;
    db = await import("../portal/db");
    C = await import("./classes");
    P = await import("./parents");
    L = await import("../market/learning");
    CO = await import("../market/courses");
    A = await import("../tests/attempts");
    if ((await CO.total()) === 0) throw new Error("run scripts/courses-sync.ts first");
    await mk("t1", "teacher", "Teacher One");
    await mk("t2", "teacher", "Teacher Two");
    await mk("s1", "student", "Student One");
    await mk("s2", "student", "=cmd Student Two");
    await mk("p1", "parent", "Parent One");
  });
  afterAll(async () => {
    await db.run("DELETE FROM users WHERE email LIKE $1", [`%-${tag}@portal-test.invalid`]);
    await db.closePool();
  });

  it("registers teachers and parents with the new roles and no student or company profile", async () => {
    expect(await db.val("SELECT role FROM users WHERE id = $1", [ids.t1])).toBe("teacher");
    expect(await db.val("SELECT role FROM users WHERE id = $1", [ids.p1])).toBe("parent");
    expect(await db.val("SELECT COUNT(*) FROM student_profiles WHERE user_id = ANY($1::int[])", [[ids.t1, ids.p1]])).toBe(0);
    expect(await db.val("SELECT COUNT(*) FROM companies WHERE owner_user_id = ANY($1::int[])", [[ids.t1, ids.p1]])).toBe(0);
  });

  it("creates a class with a join code and enforces ownership", async () => {
    expect((await C.createClass(ids.t1, "x")).ok).toBe(false);
    const r = await C.createClass(ids.t1, "  Grade 11 IELTS  ");
    expect(r.ok).toBe(true);
    classId = (r as { id: number }).id;
    const own = await C.ownedClass({ id: ids.t1, role: "teacher" }, classId);
    expect(own?.name).toBe("Grade 11 IELTS");
    code = own!.join_code;
    expect(code).toMatch(/^[A-HJKMNP-Z2-9]{6}$/);
    expect(await C.ownedClass({ id: ids.t2, role: "teacher" }, classId)).toBeNull();
    expect((await C.ownedClass({ id: 1, role: "admin" }, classId))?.id).toBe(classId);
  });

  it("lets students join by code (case and spacing forgiven) and throttles wrong guesses", async () => {
    const ok = await C.join(ids.s1, ` ${code.toLowerCase().slice(0, 3)}-${code.slice(3)} `);
    expect(ok).toEqual({ ok: true, name: "Grade 11 IELTS" });
    expect((await C.join(ids.s1, code)).ok).toBe(true); // joining twice is harmless
    expect((await C.students(classId)).map((s) => s.id)).toEqual([ids.s1]);
    expect((await C.join(ids.s2, code)).ok).toBe(true);
    for (let i = 0; i < 8; i++) expect((await C.join(ids.p1, "WRONG1")).ok).toBe(false);
    const blocked = await C.join(ids.p1, code);
    expect(blocked.ok).toBe(false);
    expect((blocked as { error: string }).error).toMatch(/Too many/);
  });

  it("validates assignments from the real catalogue and the real test ranges", async () => {
    expect(await C.addAssignment(ids.t1, classId, { kind: "course", ref: "no-such-course" })).toMatch(/Choose a course/);
    expect(await C.addAssignment(ids.t1, classId, { kind: "test", ref: "ielts-reading", testNo: 31 })).toMatch(/Choose a test/);
    expect(await C.addAssignment(ids.t1, classId, { kind: "test", ref: "toefl", testNo: 1 })).toMatch(/Choose a test/);
    expect(await C.addAssignment(ids.t2, classId, { kind: "course", ref: "digital-literacy-master" })).toMatch(/not found/); // not their class
    expect(await C.addAssignment(ids.t1, classId, { kind: "course", ref: "digital-literacy-master", due: "2026-12-01", note: "Finish module 1" })).toBeNull();
    expect(await C.addAssignment(ids.t1, classId, { kind: "course", ref: "digital-literacy-master" })).toMatch(/already assigned/);
    expect(await C.addAssignment(ids.t1, classId, { kind: "test", ref: "ielts-reading", testNo: 3 })).toBeNull();
    expect(await C.addAssignment(ids.t1, classId, { kind: "test", ref: "gre-quant", testNo: 2 })).toBeNull();
    const a = await C.assignmentsOf(classId);
    expect(a.map((x) => x.title)).toEqual(["Digital Literacy Master Course", "IELTS Reading Practice Test 3", "GRE Quant Practice Test 2"].sort((x, y) => a.map((z) => z.title).indexOf(x) - a.map((z) => z.title).indexOf(y)));
    expect(a).toHaveLength(3);
  });

  it("builds the gradebook from enrolments and saved test attempts", async () => {
    const course = (await CO.bySlug("digital-literacy-master"))!;
    await L.enrol(ids.s1, course.id);
    await L.setDone(ids.s1, course, [0, 1]); // 2 of 9 checkpoints
    await A.save(ids.s1, { exam: "ielts-reading", testNo: 3, raw: 11, total: 40, band: 4, answers: {}, seconds: 60 });
    await A.save(ids.s1, { exam: "ielts-reading", testNo: 3, raw: 30, total: 40, band: 7, answers: {}, seconds: 60 });
    await A.save(ids.s1, { exam: "gre-quant", testNo: 2, raw: 20, total: 27, score: 160, answers: {}, seconds: 60 });
    const g = await C.gradebook(classId);
    const cell = (title: string, sid: number) => g.cells.get(C.cellKey(g.assignments.find((a) => a.title === title)!.id, sid))!;
    expect(cell("Digital Literacy Master Course", ids.s1)).toMatchObject({ state: "started", pct: 22 });
    expect(cell("IELTS Reading Practice Test 3", ids.s1)).toMatchObject({ state: "done", label: "30/40 · band 7.0" }); // best attempt wins
    expect(cell("GRE Quant Practice Test 2", ids.s1)).toMatchObject({ state: "done", label: "20/27 · about 160" });
    expect(cell("IELTS Reading Practice Test 3", ids.s2)).toMatchObject({ state: "none", label: "Not started" });
  });

  it("verifies a native course completion as GrowQR-verified and keeps hand-ticked progress out of that tier", async () => {
    const course = (await CO.bySlug("html-css-academy"))!;
    await L.enrol(ids.s2, course.id);
    const all = Array.from({ length: L.checkpoints(course) }, (_, i) => i);
    const done = await L.setDone(ids.s2, course, all);
    expect(done).toMatchObject({ status: "completed", tier: "self" });
    await L.verifyNative(ids.s2, course.id);
    expect(await L.find(ids.s2, course.id)).toMatchObject({ status: "completed", verified: true, verified_via: "growqr", tier: "verified" });
    // an unfinished enrolment is never verified
    const other = (await CO.bySlug("data-science-python"))!;
    await L.enrol(ids.s2, other.id);
    await L.verifyNative(ids.s2, other.id);
    expect((await L.find(ids.s2, other.id))?.verified).toBe(false);
  });

  it("exports a CSV that cannot run formulas in a spreadsheet", async () => {
    const csv = C.toCsv(await C.gradebook(classId));
    expect(csv).toContain("\"'=cmd Student Two\"");
    expect(csv.split("\r\n")[0]).toContain("Student");
    expect(csv).toContain("30/40 · band 7.0");
  });

  it("shows a student their classes with status", async () => {
    const mine = await C.classesOfStudent(ids.s1);
    expect(mine).toHaveLength(1);
    expect(mine[0].items.find((i) => i.kind === "test" && i.ref === "ielts-reading")?.cell.state).toBe("done");
    expect(C.hrefFor({ kind: "test", ref: "gre-quant", test_no: 2 })).toBe("/practice-tests/gre-quant/2");
    expect(C.hrefFor({ kind: "course", ref: "html-css-academy", test_no: null })).toBe("/courses/html-css-academy");
  });

  it("stops another teacher removing students or assignments", async () => {
    const a = (await C.assignmentsOf(classId))[0];
    await C.removeAssignment(ids.t2, classId, a.id);
    await C.removeStudent(ids.t2, classId, ids.s2);
    expect(await C.assignmentsOf(classId)).toHaveLength(3);
    expect(await C.students(classId)).toHaveLength(2);
    await C.removeStudent(ids.t1, classId, ids.s2);
    expect(await C.students(classId)).toHaveLength(1);
    await C.leave(ids.s1, classId);
    expect(await C.students(classId)).toHaveLength(0);
    await C.join(ids.s1, code);
  });

  it("archived classes cannot be joined or assigned to", async () => {
    await C.setArchived(ids.t1, classId, true);
    expect((await C.join(ids.s2, code)).ok).toBe(false);
    expect(await C.addAssignment(ids.t1, classId, { kind: "test", ref: "gre-quant", testNo: 9 })).toMatch(/archived/);
    expect(await C.classesOfStudent(ids.s1)).toHaveLength(0);
    await C.setArchived(ids.t1, classId, false);
  });

  it("gives each student one stable private learner code and links parents with it", async () => {
    const c1 = await P.learnerCode(ids.s1);
    expect(c1).toMatch(/^[A-HJKMNP-Z2-9]{8}$/);
    expect(await P.learnerCode(ids.s1)).toBe(c1);
    expect(await P.learnerCode(ids.s2)).not.toBe(c1);
    expect((await P.link(ids.p1, "ABCDEFGH")).ok).toBe(false);
    expect(await P.link(ids.p1, c1.toLowerCase())).toEqual({ ok: true, name: "Student One" });
    expect(await P.isLinked(ids.p1, ids.s1)).toBe(true);
    expect(await P.isLinked(ids.p1, ids.s2)).toBe(false); // linked to one child only
    expect((await P.children(ids.p1)).map((c) => c.id)).toEqual([ids.s1]);
  });

  it("gives a parent the child's study report and nothing else", async () => {
    const r = (await P.report(ids.s1))!;
    expect(r.name).toBe("Student One");
    expect(r.courses.map((c) => c.slug)).toContain("digital-literacy-master");
    expect(r.tests.length).toBe(3);
    expect(r.classes[0].name).toBe("Grade 11 IELTS");
    expect(Object.keys(r).sort()).toEqual(["classes", "courses", "name", "tests"]);
    expect(await P.report(ids.t1)).toBeNull(); // only students have reports
    await P.unlink(ids.p1, ids.s1);
    expect(await P.isLinked(ids.p1, ids.s1)).toBe(false);
  });
});
