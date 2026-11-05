import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const queries: { sql: string; params: unknown[] }[] = [];
vi.mock("../portal/db", () => ({
  run: vi.fn(async (sql: string, params: unknown[] = []) => {
    queries.push({ sql, params });
    return /INSERT INTO external_internships/.test(sql) ? 1 : 0;
  }),
  all: vi.fn(async () => []),
}));

import { adzunaConfigured, live, safeUrl, stipendText, stripHtml, syncAdzuna, syncIfStale, toCandidate } from "./external";

const now = new Date("2026-10-17T00:00:00Z");

describe("external internship helpers", () => {
  it("allows only http(s) links", () => {
    expect(safeUrl("javascript:alert(1)")).toBeNull();
    expect(safeUrl("data:text/html,x")).toBeNull();
    expect(safeUrl("not a url")).toBeNull();
    expect(safeUrl("https://www.adzuna.in/land/ad/1?x=1")).toBe("https://www.adzuna.in/land/ad/1?x=1");
  });

  it("strips markup and decodes the common entities", () => {
    expect(stripHtml("<b>Learn</b> SEO &amp; ads&nbsp;<script>x</script>")).toBe("Learn SEO & ads x");
  });

  it("shows annual salary as a monthly figure, or nothing", () => {
    expect(stipendText(120000, 120000)).toBe("₹10,000 a month");
    expect(stipendText(120000, 240000)).toBe("₹10,000 to ₹20,000 a month");
    expect(stipendText(0, 0)).toBeNull();
    expect(stipendText(undefined, undefined)).toBeNull();
  });

  it("keeps internship titles with a safe link and drops the rest", () => {
    const ok = toCandidate({ id: 7, title: "Marketing Intern", redirect_url: "https://x.in/a", created: "2026-10-10T00:00:00Z", company: { display_name: "Acme" } }, now);
    expect(ok?.sourceId).toBe("7");
    expect(ok?.company).toBe("Acme");
    expect(ok && ok.expiresAt.getTime() - ok.postedAt.getTime()).toBe(30 * 86_400_000);
    expect(toCandidate({ id: 8, title: "Senior Engineer", redirect_url: "https://x.in/b" }, now)).toBeNull();
    expect(toCandidate({ id: 9, title: "Design Intern", redirect_url: "javascript:alert(1)" }, now)).toBeNull();
    expect(toCandidate({ title: "Intern", redirect_url: "https://x.in/c" }, now)).toBeNull();
  });
});

describe("syncAdzuna", () => {
  const saved = { id: process.env.ADZUNA_APP_ID, key: process.env.ADZUNA_APP_KEY };
  beforeEach(() => {
    queries.length = 0;
  });
  afterEach(() => {
    process.env.ADZUNA_APP_ID = saved.id;
    process.env.ADZUNA_APP_KEY = saved.key;
    if (saved.id === undefined) delete process.env.ADZUNA_APP_ID;
    if (saved.key === undefined) delete process.env.ADZUNA_APP_KEY;
    vi.unstubAllGlobals();
  });

  it("does nothing without keys", async () => {
    delete process.env.ADZUNA_APP_ID;
    delete process.env.ADZUNA_APP_KEY;
    expect(adzunaConfigured()).toBe(false);
    const r = await syncAdzuna();
    expect(r.ok).toBe(false);
    expect(queries).toHaveLength(0);
  });

  it("upserts internship rows once and never puts the key in an error", async () => {
    process.env.ADZUNA_APP_ID = "test-id";
    process.env.ADZUNA_APP_KEY = "test-secret-key";
    const body = { results: [
      { id: "1", title: "Data Intern", redirect_url: "https://www.adzuna.in/land/ad/1", created: new Date().toISOString(), description: "<p>Work with SQL</p>", company: { display_name: "Acme" }, location: { display_name: "Pune" } },
      { id: "2", title: "Site Manager", redirect_url: "https://www.adzuna.in/land/ad/2", created: new Date().toISOString() },
    ] };
    const fetchMock = vi.fn(async (url: string) => {
      expect(url).toContain("/jobs/in/search/");
      return new Response(JSON.stringify(body), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const r = await syncAdzuna(1);
    expect(r.ok).toBe(true);
    expect(r.added).toBe(1); // id 1 inserted once even though both queries return it; the manager role is dropped
    const insert = queries.find((q) => /INSERT INTO external_internships/.test(q.sql));
    expect(insert?.sql).toContain("ON CONFLICT (source, source_id) DO UPDATE");
    expect(insert?.params).toContain("Work with SQL");

    vi.stubGlobal("fetch", vi.fn(async () => new Response("denied", { status: 401 })));
    const bad = await syncAdzuna(1);
    expect(bad.ok).toBe(false);
    expect(JSON.stringify(bad)).not.toContain("test-secret-key");
  });

  it("syncIfStale skips fresh data, reports a missing table, and rate-limits retries", async () => {
    process.env.ADZUNA_APP_ID = "test-id";
    process.env.ADZUNA_APP_KEY = "test-secret-key";
    const db = await import("../portal/db");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ results: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    vi.mocked(db.all).mockRejectedValueOnce(new Error("relation does not exist"));
    const missing = await syncIfStale();
    expect(missing.ok).toBe(false);
    expect(missing.error).toMatch(/migration/);
    expect(fetchMock).not.toHaveBeenCalled();

    vi.mocked(db.all).mockResolvedValueOnce([{ last: new Date(Date.now() - 3_600_000).toISOString().replace("T", " ").slice(0, 19) }]);
    const fresh = await syncIfStale();
    expect(fresh.skipped_reason).toBe("fresh");
    expect(fetchMock).not.toHaveBeenCalled();

    vi.mocked(db.all).mockResolvedValueOnce([{ last: null }]);
    const first = await syncIfStale();
    expect(first.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalled(); // empty table: runs the sync

    const calls = fetchMock.mock.calls.length;
    const again = await syncIfStale();
    expect(again.skipped_reason).toBe("tried within the last hour");
    expect(fetchMock.mock.calls.length).toBe(calls); // an empty feed cannot be re-polled every 10 minutes
  });

  it("live() returns an empty list instead of throwing when the table is missing", async () => {
    const db = await import("../portal/db");
    vi.mocked(db.all).mockRejectedValueOnce(new Error('relation "external_internships" does not exist'));
    expect(await live({ q: "data" })).toEqual([]);
  });
});
