import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getLead, resetZohoTokenCache, upsertLead, ZohoApiError } from "@/lib/crm/zoho-client";

const fetchMock = vi.fn();

const TOKEN_URL = "https://accounts.zoho.test/oauth/v2/token";
const UPSERT_URL = "https://api.zoho.test/crm/v8/Leads/upsert";

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const tokenOk = () => jsonResponse(200, { access_token: "tok-1", expires_in: 3600 });
const upsertOk = (action = "insert") =>
  jsonResponse(200, {
    data: [{ code: "SUCCESS", action, details: { id: "9990001" }, message: "record added" }],
  });

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("ZOHO_CLIENT_ID", "cid");
  vi.stubEnv("ZOHO_CLIENT_SECRET", "secret");
  vi.stubEnv("ZOHO_REFRESH_TOKEN", "refresh");
  vi.stubEnv("ZOHO_ACCOUNTS_BASE", "https://accounts.zoho.test");
  vi.stubEnv("ZOHO_API_BASE", "https://api.zoho.test");
  resetZohoTokenCache();
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

/** Route the fetch mock by URL so tests read as scenario tables. */
function routeFetch(handlers: { token?: Array<() => Response>; upsert?: Array<() => Response> }) {
  const queues = { token: [...(handlers.token ?? [])], upsert: [...(handlers.upsert ?? [])] };
  fetchMock.mockImplementation((url: string) => {
    const queue = url === TOKEN_URL ? queues.token : url === UPSERT_URL ? queues.upsert : null;
    if (!queue?.length) throw new Error(`unexpected fetch: ${url}`);
    return Promise.resolve(queue.shift()!());
  });
}

describe("upsertLead", () => {
  it("refreshes a token, sends the upsert keyed on Email, and returns id + action", async () => {
    routeFetch({ token: [tokenOk], upsert: [() => upsertOk("insert")] });

    const result = await upsertLead({ Email: "a@b.co", Last_Name: "Test" });

    expect(result).toEqual({ id: "9990001", action: "insert" });
    const [, upsertInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(JSON.parse(upsertInit.body as string)).toEqual({
      data: [{ Email: "a@b.co", Last_Name: "Test" }],
      duplicate_check_fields: ["Email"],
    });
    expect((upsertInit.headers as Record<string, string>).Authorization).toBe(
      "Zoho-oauthtoken tok-1",
    );
  });

  it("caches the access token across calls", async () => {
    routeFetch({ token: [tokenOk], upsert: [() => upsertOk(), () => upsertOk("update")] });

    await upsertLead({ Email: "a@b.co" });
    const second = await upsertLead({ Email: "a@b.co" });

    expect(second.action).toBe("update");
    const tokenCalls = fetchMock.mock.calls.filter(([url]) => url === TOKEN_URL);
    expect(tokenCalls).toHaveLength(1);
  });

  it("refreshes once and retries when the API returns 401", async () => {
    routeFetch({
      token: [tokenOk, () => jsonResponse(200, { access_token: "tok-2", expires_in: 3600 })],
      upsert: [() => jsonResponse(401, {}), () => upsertOk()],
    });

    const result = await upsertLead({ Email: "a@b.co" });

    expect(result.id).toBe("9990001");
    const [, retryInit] = fetchMock.mock.calls[3] as [string, RequestInit];
    expect((retryInit.headers as Record<string, string>).Authorization).toBe(
      "Zoho-oauthtoken tok-2",
    );
  });

  it("classifies 429/5xx as retryable and other 4xx as permanent", async () => {
    routeFetch({ token: [tokenOk], upsert: [() => jsonResponse(429, {})] });
    await expect(upsertLead({})).rejects.toMatchObject({ retryable: true, status: 429 });

    resetZohoTokenCache();
    routeFetch({ token: [tokenOk], upsert: [() => jsonResponse(400, {})] });
    await expect(upsertLead({})).rejects.toMatchObject({ retryable: false, status: 400 });
  });

  it("treats a per-record rejection inside HTTP 200 as a permanent error", async () => {
    routeFetch({
      token: [tokenOk],
      upsert: [
        () =>
          jsonResponse(200, {
            data: [{ code: "INVALID_DATA", message: "invalid picklist value", details: {} }],
          }),
      ],
    });

    await expect(upsertLead({})).rejects.toMatchObject({
      retryable: false,
      code: "INVALID_DATA",
    });
  });

  it("treats a rejected refresh token (HTTP 200 + error body) as permanent", async () => {
    routeFetch({ token: [() => jsonResponse(200, { error: "invalid_code" })] });

    await expect(upsertLead({})).rejects.toMatchObject({
      retryable: false,
      code: "invalid_code",
    });
  });

  it("classifies network failures as retryable", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));

    await expect(upsertLead({})).rejects.toMatchObject({ retryable: true });
  });

  it("reads a lead's fields back via getLead", async () => {
    fetchMock.mockImplementationOnce(() => Promise.resolve(tokenOk())); // token refresh
    fetchMock.mockImplementationOnce((url: string) => {
      expect(url).toBe("https://api.zoho.test/crm/v8/Leads/9990001?fields=Email,Region");
      return Promise.resolve(jsonResponse(200, { data: [{ Email: "a@b.co", Region: "India" }] }));
    });

    const record = await getLead("9990001", ["Email", "Region"]);

    expect(record).toEqual({ Email: "a@b.co", Region: "India" });
  });

  it("fails permanently when env vars are missing", async () => {
    vi.stubEnv("ZOHO_CLIENT_ID", "");

    await expect(upsertLead({})).rejects.toSatisfy(
      (e: unknown) => e instanceof ZohoApiError && !e.retryable,
    );
  });
});
