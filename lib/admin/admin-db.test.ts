import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Administrator tools: college matching (equal to PHP similar_text / levenshtein), the college review queue, and the Resume Studio plan grants.
 *
 *   PORTAL_TEST_DATABASE_URL=mysql://root@127.0.0.1:3307/growqr_test npx vitest run lib/admin/admin-db.test.ts
 */
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }),
  headers: async () => new Headers({ "x-forwarded-host": "growqr.test", "x-forwarded-proto": "https" }),
}));
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const DB = process.env.PORTAL_TEST_DATABASE_URL;

describe("college matching equals PHP", async () => {
  const IN = await import("./institutions");
  // values printed by PHP 8: similar_text() percent, levenshtein()
  const cases: Array<[string, string, number, number]> = [
    ["sri venkateswara college of engineering", "sri venkateshwara college of engineering", 98.734177, 1],
    ["abc", "xyz", 0, 3],
    ["the delhi college", "delhi college", 86.666667, 4],
    ["iit bombay", "iit bombai", 90, 1],
    ["world", "word", 88.888889, 1],
    ["", "a", 0, 1],
  ];
  it.each(cases)("%s vs %s", (a, b, pct, lev) => {
    expect(IN.similarPct(a, b)).toBeCloseTo(pct, 5);
    expect(IN.levenshtein(a, b)).toBe(lev);
  });
  it("normalises like PHP", () => {
    expect(IN.norm("  The  St. Xavier's   College!! ")).toBe("st xavier s college");
  });
});

describe.skipIf(!DB)("admin tools on a real database", () => {
  const tag = Math.random().toString(16).slice(2, 8);
  let admin = 0;
  let student = 0;
  let db: typeof import("../portal/db");
  let IN: typeof import("./institutions");
  let SA: typeof import("../studio/access");

  beforeAll(async () => {
    process.env.DATABASE_URL = DB;
    db = await import("../portal/db");
    IN = await import("./institutions");
    SA = await import("../studio/access");
    const mk = async (role: string, label: string) => Number(await db.val("INSERT INTO users (name, email, role, password_hash, email_verified_at, created_at) VALUES ($1, $2, $3, 'x', NOW(), NOW()) RETURNING id", [`Adm ${label}`, `adm-${label}-${tag}@t.test`, role]));
    admin = await mk("admin", "a");
    student = await mk("student", "s");
  });
  afterAll(async () => {
    await db.run("DELETE FROM institutions WHERE source = 'student' AND source_id LIKE $1", [`admtest-${tag}%`]);
    await db.run("DELETE FROM studio_subscriptions WHERE user_id = $1", [student]);
    await db.run("DELETE FROM users WHERE id IN ($1, $2)", [admin, student]);
    await db.closePool();
  });

  const add = async (name: string, state: string, status: string, n: number) =>
    Number(await db.val("INSERT INTO institutions (source, source_id, name, name_norm, kind, state, status, submit_count) VALUES ('student', $1, $2, $3, 'college', $4, $5, $6) RETURNING id", [`admtest-${tag}-${name.length}-${status}`, name, IN.norm(name), state, status, n]));

  it("lists pending colleges with likely matches, then approves, rejects and merges", async () => {
    const real = await add(`Zephyr Institute of Technology ${tag}`, "Goa", "approved", 0);
    const typo = await add(`Zephyr Institute of Technologi ${tag}`, "Goa", "pending", 2);
    const other = await add(`Unrelated Mountain College ${tag}`, "Goa", "pending", 1);

    const q = (await IN.pending()).filter((p) => [typo, other].includes(p.id));
    expect(q.map((p) => p.id)).toEqual([typo, other]); // most submissions first
    expect(q[0].matches.map((m) => m.id)).toContain(real);
    expect(q[1].matches).toEqual([]);

    await db.run("INSERT INTO student_profiles (user_id, college) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET college = EXCLUDED.college", [student, `Zephyr Institute of Technologi ${tag}`]);
    expect(await IN.mergeInto(typo, real, admin)).toBe(true);
    expect(await db.val("SELECT college FROM student_profiles WHERE user_id = $1", [student])).toBe(`Zephyr Institute of Technology ${tag}`);
    expect(await db.val("SELECT status FROM institutions WHERE id = $1", [typo])).toBe("rejected");
    expect(await IN.mergeInto(other, typo, admin)).toBe(false); // target must be approved

    await IN.approve(other, admin);
    expect(await db.val("SELECT status FROM institutions WHERE id = $1", [other])).toBe("approved");
    await IN.reject(other, admin); // only pending rows can be rejected
    expect(await db.val("SELECT status FROM institutions WHERE id = $1", [other])).toBe("approved");
    await db.run("DELETE FROM student_profiles WHERE user_id = $1", [student]);
  });

  it("grants and ends Studio Pro", async () => {
    expect(await SA.isPro(student)).toBe(false);
    await SA.grant(student, "admin", null, 0, 30);
    expect(await SA.isPro(student)).toBe(true);
    await SA.revoke(student);
    expect(await SA.isPro(student)).toBe(false);
  });
});
