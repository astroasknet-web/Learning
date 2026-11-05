import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { legacyRedirects } from "../../legacy-redirects";

/**
 * Cut-over pieces: old-URL redirects, the first-party page-view/click recorder, and the student college directory (suggest + submit).
 *
 *   PORTAL_TEST_DATABASE_URL=mysql://root@127.0.0.1:3307/growqr_test npx vitest run lib/portal/cutover-db.test.ts
 */
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }),
  headers: async () => new Headers({ "x-forwarded-host": "growqr.test", "x-forwarded-proto": "https" }),
}));
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });
const DB = process.env.PORTAL_TEST_DATABASE_URL;

describe("legacy redirects", () => {
  const r = legacyRedirects();
  const find = (s: string) => r.filter((x) => x.source === s);
  it("covers every old page once and only with a permanent redirect", () => {
    expect(new Set(r.map((x) => x.source)).size).toBe(r.length);
    expect(r.every((x) => x.permanent && x.destination.startsWith("/"))).toBe(true);
  });
  it("moves ids and slugs from the query into the path", () => {
    const v = find("/v.php")[0];
    expect(v.destination).toBe("/v/:c");
    expect(v.has?.[0]).toEqual({ type: "query", key: "c", value: "(?<c>[A-Za-z0-9]+)" });
    expect(find("/internship.php")[0].destination).toBe("/internships/:s");
    expect(find("/crm-file.php")[0].has?.[0].value).toBe("(?<t>[a-f0-9]{32})");
  });
  it("keeps plain pages plain", () => {
    expect(find("/login.php")[0].destination).toBe("/login");
    expect(find("/admin.php")[0].destination).toBe("/console");
  });
});

describe.skipIf(!DB)("cut-over on a real database", () => {
  const tag = Math.random().toString(16).slice(2, 8);
  let db: typeof import("./db");
  let EV: typeof import("./events");
  let CO: typeof import("./colleges");
  let uid = 0;
  const H = (ua: string, extra: Record<string, string> = {}) => new Headers({ "user-agent": ua, "x-forwarded-for": "203.0.113.9", host: "growqr.test", ...extra });
  const BROWSER = "Mozilla/5.0 (Windows NT 10.0) Chrome/120 Safari/537.36";

  beforeAll(async () => {
    process.env.DATABASE_URL = DB;
    db = await import("./db");
    EV = await import("./events");
    CO = await import("./colleges");
    uid = Number(await db.val("INSERT INTO users (name, email, role, password_hash, email_verified_at, created_at) VALUES ($1, $2, 'student', 'x', NOW(), NOW()) RETURNING id", [`Cut ${tag}`, `cut-${tag}@t.test`]));
  });
  afterAll(async () => {
    await db.run("DELETE FROM analytics_events WHERE path LIKE $1 OR item LIKE $1", [`%${tag}%`]);
    await db.run("DELETE FROM institution_submissions WHERE submitter LIKE 'u%' AND typed_name LIKE $1", [`%${tag}%`]);
    await db.run("DELETE FROM institutions WHERE source = 'student' AND name LIKE $1", [`%${tag}%`]);
    await db.run("DELETE FROM users WHERE id = $1", [uid]);
    await db.closePool();
  });

  it("records a page view with no IP or user agent, and skips bots and private pages", async () => {
    await EV.recordView(H(BROWSER), `/internships/slug-${tag}`, "https://www.google.com/search?q=x", { id: uid, role: "student" });
    await EV.recordView(H("Googlebot/2.1"), `/internships/bot-${tag}`, "", null);
    await EV.recordView(H(BROWSER), `/console/analytics-${tag}`, "", null);
    await EV.recordView(H(BROWSER), `/crm/leads-${tag}`, "", null);
    const rows = await db.all<Record<string, unknown>>("SELECT * FROM analytics_events WHERE path LIKE $1 ORDER BY id", [`%${tag}%`]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "view", path: `/internships/slug-${tag}`, item: `slug-${tag}`, user_id: uid, role: "student", referrer: "google.com", device: "desktop" });
    expect(String(rows[0].visitor)).toMatch(/^[a-f0-9]{20}$/);
    expect(JSON.stringify(rows[0])).not.toContain("203.0.113.9");
  });

  it("records an outbound click", async () => {
    await EV.recordClick(H(BROWSER + " Mobile"), "nav", `/shop?x=${tag}`, null);
    const r = await db.one<Record<string, unknown>>("SELECT * FROM analytics_events WHERE kind = 'click' AND item = $1", [`/shop?x=${tag}`]);
    expect(r).toMatchObject({ campaign: "nav", path: "/go", device: "mobile" });
  });

  it("validates, files, de-duplicates and promotes a student-submitted college", async () => {
    const name = `Zenith Valley Institute ${tag}`;
    expect(await CO.submit(uid, "1.1.1.1", "ab", "Goa", "")).toMatchObject({ status: "invalid" });
    expect(await CO.submit(uid, "1.1.1.1", name, "Atlantis", "")).toMatchObject({ status: "invalid" });
    expect(await CO.submit(uid, "1.1.1.1", name, "Goa", "")).toEqual({ status: "pending", name });
    // the same person again does not count twice
    await CO.submit(uid, "1.1.1.1", name, "Goa", "");
    expect(Number(await db.val("SELECT submit_count FROM institutions WHERE source = 'student' AND name = $1", [name]))).toBe(1);
    // two more different people promote it
    expect(await CO.submit(null, "9.9.9.1", name, "Goa", "")).toMatchObject({ status: "pending" });
    expect(await CO.submit(null, "9.9.9.2", name, "Goa", "")).toEqual({ status: "approved", name });
    expect((await CO.suggest(`zenith valley institute ${tag}`))[0]?.name).toBe(name);
    expect(await CO.submit(null, "9.9.9.3", name, "Goa", "")).toEqual({ status: "exists", name });
    // a near-duplicate asks for confirmation unless forced
    const typo = `Zenith Valley Institut ${tag}`;
    expect(await CO.submit(null, "9.9.9.4", typo, "Goa", "")).toMatchObject({ status: "similar" });
    expect(await CO.submit(null, "9.9.9.4", typo, "Goa", "", true)).toMatchObject({ status: "pending" });
  });

  it("limits how many colleges one person can add in a day", async () => {
    let last: { status: string } = { status: "" };
    for (let i = 0; i < 7; i++) last = await CO.submit(null, "7.7.7.7", `Limit Test College Number ${"abcdefg"[i]}${i} ${tag}`, "Kerala", "");
    expect(last.status).toBe("limit");
  });
});
