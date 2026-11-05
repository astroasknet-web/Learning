import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { createFormRoute } from "@/lib/forms/handler";
import type { ParseResult } from "@/lib/forms/schemas";

const rateLimitMock = vi.hoisted(() => vi.fn());
const verifyTurnstileMock = vi.hoisted(() => vi.fn());
const syncLeadToZohoMock = vi.hoisted(() => vi.fn());
const afterCallbacks = vi.hoisted(() => [] as Array<() => unknown>);

// next/server's after() needs a request context vitest doesn't have — record
// the callbacks and flush them explicitly so tests control the timing.
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (cb: () => unknown) => {
    afterCallbacks.push(cb);
  },
}));

vi.mock("@/lib/crm/sync", () => ({
  syncLeadToZoho: syncLeadToZohoMock,
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: rateLimitMock,
  rateLimited: (retryAfterSec: number) =>
    NextResponse.json(
      { error: "Too many requests. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(retryAfterSec) } },
    ),
}));

vi.mock("@/lib/turnstile", () => ({
  verifyTurnstile: verifyTurnstileMock,
}));

// These tests validate the fully-configured pipeline (Turnstile, persist,
// CRM). The demo-mode short-circuit (unconfigured the database) is a separate path.
vi.mock("@/lib/data/server", () => ({
  isDatabaseConfigured: () => true,
}));

interface TestData {
  value: string;
  token?: string;
}

function makeRequest(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("http://localhost/api/test", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "Content-Type": "application/json", ...headers },
  });
}

const okParse = (body: unknown): ParseResult<TestData> => {
  const value = (body as { value?: string }).value;
  if (!value) return { ok: false, error: "Value is required", status: 400 };
  return { ok: true, data: { value, token: (body as { token?: string }).token } };
};

function makeRoute(overrides: Partial<Parameters<typeof createFormRoute<TestData>>[0]> = {}) {
  return createFormRoute<TestData>({
    key: "test-form",
    turnstile: { label: "Test", errorMessage: "Security check failed." },
    parse: okParse,
    persist: vi.fn().mockResolvedValue(null),
    successBody: { success: true },
    failureMessage: "Something broke.",
    ...overrides,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  afterCallbacks.length = 0;
  rateLimitMock.mockReturnValue({ ok: true });
  verifyTurnstileMock.mockResolvedValue(true);
  syncLeadToZohoMock.mockResolvedValue({ outcome: "synced" });
});

const flushAfterCallbacks = async () => {
  for (const cb of afterCallbacks.splice(0)) await cb();
};

describe("createFormRoute pipeline", () => {
  it("returns 429 when rate limited, before any parsing", async () => {
    rateLimitMock.mockReturnValue({ ok: false, retryAfterSec: 60 });
    const parse = vi.fn(okParse);
    const route = makeRoute({ parse });

    const res = await route(makeRequest({ value: "x" }));

    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("60");
    expect(parse).not.toHaveBeenCalled();
  });

  it("uses the configured key for the rate-limit bucket", async () => {
    const route = makeRoute();
    await route(makeRequest({ value: "x" }));
    expect(rateLimitMock).toHaveBeenCalledWith(
      expect.anything(),
      { key: "test-form", limit: 5, windowMs: 10 * 60_000 },
    );
  });

  it("returns the parse error verbatim and skips Turnstile", async () => {
    const route = makeRoute();

    const res = await route(makeRequest({}));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Value is required" });
    expect(verifyTurnstileMock).not.toHaveBeenCalled();
  });

  it("treats malformed JSON as an empty body (parse decides the response)", async () => {
    const route = makeRoute();

    const res = await route(makeRequest("{not json"));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Value is required" });
  });

  it("returns 403 with the configured message when Turnstile fails, before persisting", async () => {
    verifyTurnstileMock.mockResolvedValue(false);
    const persist = vi.fn().mockResolvedValue(null);
    const route = makeRoute({ persist });

    const res = await route(makeRequest({ value: "x", token: "tok" }));

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Security check failed." });
    expect(verifyTurnstileMock).toHaveBeenCalledWith("tok", "Test");
    expect(persist).not.toHaveBeenCalled();
  });

  it("short-circuits with the persist response and skips side effects", async () => {
    const sideEffects = vi.fn().mockReturnValue([]);
    const route = makeRoute({
      persist: vi
        .fn()
        .mockResolvedValue(NextResponse.json({ error: "Already exists." }, { status: 409 })),
      sideEffects,
    });

    const res = await route(makeRequest({ value: "x" }));

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "Already exists." });
    expect(sideEffects).not.toHaveBeenCalled();
  });

  it("returns the success body after persistence and side effects", async () => {
    const sideEffects = vi.fn().mockReturnValue([Promise.resolve("sent")]);
    const route = makeRoute({ successBody: { success: true, message: "Saved" }, sideEffects });

    const res = await route(makeRequest({ value: "x" }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, message: "Saved" });
    expect(sideEffects).toHaveBeenCalledWith({ value: "x", token: undefined });
  });

  it("still succeeds when a side-effect promise rejects", async () => {
    const route = makeRoute({
      sideEffects: () => [Promise.reject(new Error("email down"))],
    });

    const res = await route(makeRequest({ value: "x" }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
  });

  it("still succeeds when building the side effects throws", async () => {
    const route = makeRoute({
      sideEffects: () => {
        throw new Error("no api key");
      },
    });

    const res = await route(makeRequest({ value: "x" }));

    expect(res.status).toBe(200);
  });

  it("returns the configured 500 message on unexpected errors", async () => {
    const route = makeRoute({
      persist: vi.fn().mockRejectedValue(new Error("db exploded")),
    });

    const res = await route(makeRequest({ value: "x" }));

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Something broke." });
  });
});

describe("createFormRoute CRM sync hook", () => {
  it("schedules a post-response sync when crmSource is set and persist returns an id", async () => {
    const route = makeRoute({
      crmSource: "b2b_leads",
      persist: vi.fn().mockResolvedValue({ crmRowId: 42 }),
    });

    const res = await route(makeRequest({ value: "x" }));

    expect(res.status).toBe(200);
    expect(syncLeadToZohoMock).not.toHaveBeenCalled(); // strictly post-response
    await flushAfterCallbacks();
    expect(syncLeadToZohoMock).toHaveBeenCalledWith("b2b_leads", 42);
  });

  it("does not schedule a sync without a crmSource (e.g. newsletter)", async () => {
    const route = makeRoute({ persist: vi.fn().mockResolvedValue({ crmRowId: 42 }) });

    await route(makeRequest({ value: "x" }));
    await flushAfterCallbacks();

    expect(syncLeadToZohoMock).not.toHaveBeenCalled();
  });

  it("does not schedule a sync when persist returns no row id", async () => {
    const route = makeRoute({ crmSource: "b2b_leads", persist: vi.fn().mockResolvedValue(null) });

    await route(makeRequest({ value: "x" }));
    await flushAfterCallbacks();

    expect(syncLeadToZohoMock).not.toHaveBeenCalled();
  });

  it("never fails the response when the sync hook throws", async () => {
    syncLeadToZohoMock.mockRejectedValue(new Error("zoho down"));
    const route = makeRoute({
      crmSource: "b2b_leads",
      persist: vi.fn().mockResolvedValue({ crmRowId: 42 }),
    });

    const res = await route(makeRequest({ value: "x" }));

    expect(res.status).toBe(200);
    await expect(flushAfterCallbacks()).resolves.toBeUndefined();
  });
});

describe("createFormRoute submission meta", () => {
  const persistedMeta = async (body: unknown, headers?: Record<string, string>) => {
    const persist = vi.fn().mockResolvedValue(null);
    const route = makeRoute({ persist });
    const res = await route(makeRequest(body, headers));
    expect(res.status).toBe(200);
    return persist.mock.calls[0][1];
  };

  it("reads the country from x-vercel-ip-country", async () => {
    const meta = await persistedMeta({ value: "x" }, { "x-vercel-ip-country": "IN" });
    expect(meta.countryCode).toBe("IN");
  });

  it("falls back to the x-country testing override and normalizes case", async () => {
    const meta = await persistedMeta({ value: "x" }, { "x-country": "ae" });
    expect(meta.countryCode).toBe("AE");
  });

  it("nulls the country when the header is missing or not ISO alpha-2", async () => {
    expect((await persistedMeta({ value: "x" })).countryCode).toBeNull();
    expect(
      (await persistedMeta({ value: "x" }, { "x-vercel-ip-country": "USA" })).countryCode,
    ).toBeNull();
  });

  it("passes sanitized attribution from the body to persist", async () => {
    const meta = await persistedMeta({
      value: "x",
      attribution: { utm_source: " google ", junk: "dropped" },
    });
    expect(meta.attribution.utm_source).toBe("google");
    expect(meta.attribution).not.toHaveProperty("junk");
    expect(meta.attribution.gclid).toBeNull();
  });

  it("provides all-null attribution when the body has none", async () => {
    const meta = await persistedMeta({ value: "x" });
    expect(Object.values(meta.attribution).every((v) => v === null)).toBe(true);
  });
});

describe("sign-in gate and replacement human check", () => {
  it("stops a guest with the gate's response before parsing or saving", async () => {
    const parse = vi.fn(okParse);
    const persist = vi.fn().mockResolvedValue(null);
    const route = makeRoute({ parse, persist, gate: async () => NextResponse.json({ error: "Please log in." }, { status: 401 }) });
    const res = await route(makeRequest({ value: "x" }));
    expect(res.status).toBe(401);
    expect(parse).not.toHaveBeenCalled();
    expect(persist).not.toHaveBeenCalled();
  });

  it("lets the gate replace fields, so the saved message carries the member's own details", async () => {
    const persist = vi.fn().mockResolvedValue(null);
    const route = makeRoute({ persist, gate: async (_r, b) => ({ body: { ...(b as object), value: "member-owned" } }) });
    expect((await route(makeRequest({ value: "spoofed" }))).status).toBe(200);
    expect(persist.mock.calls[0][0].value).toBe("member-owned");
  });

  it("uses the replacement human check instead of Turnstile, and refuses when it fails", async () => {
    const persist = vi.fn().mockResolvedValue(null);
    const check = vi.fn().mockResolvedValue(false);
    const route = makeRoute({ persist, humanCheck: check });
    const res = await route(makeRequest({ value: "x" }));
    expect(res.status).toBe(403);
    expect(check).toHaveBeenCalled();
    expect(verifyTurnstileMock).not.toHaveBeenCalled();
    expect(persist).not.toHaveBeenCalled();
    check.mockResolvedValue(true);
    expect((await route(makeRequest({ value: "x" }))).status).toBe(200);
  });
});
