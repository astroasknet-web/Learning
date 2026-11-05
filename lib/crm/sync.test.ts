import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runSourceSync, runSyncSweep, syncLeadToZoho, type SyncOutcome } from "@/lib/crm/sync";
import { ZohoApiError } from "@/lib/crm/zoho-client";
import { CRM_SOURCES, type CrmSourceDefinition } from "@/lib/crm/sources";
import type { ZohoLeadRecord } from "@/lib/crm/payload";

const upsertLeadMock = vi.hoisted(() => vi.fn());
const createAdminClientMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/crm/zoho-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/crm/zoho-client")>()),
  upsertLead: upsertLeadMock,
}));

vi.mock("@/lib/data/server", () => ({
  createAdminClient: createAdminClientMock,
}));

/**
 * Chainable admin-client stub. The first update() is the atomic claim
 * (update → eq → in → select → maybeSingle); later update().eq() calls are
 * write-backs (awaited directly). Every patch is recorded for assertions.
 */
function stubAdmin(claim: { data?: unknown; error?: unknown }) {
  const updates: Array<Record<string, unknown>> = [];
  const writeBackResult = { error: null };

  createAdminClientMock.mockReturnValue({
    from: () => ({
      update: (patch: Record<string, unknown>) => {
        updates.push(patch);
        return {
          eq: () => ({
            in: () => ({
              select: () => ({
                maybeSingle: () =>
                  Promise.resolve({ data: claim.data ?? null, error: claim.error ?? null }),
              }),
            }),
            // Write-back path awaits `.update().eq()` directly.
            then: (resolve: (v: unknown) => void) => resolve(writeBackResult),
          }),
        };
      },
    }),
  });
  return updates;
}

const record: ZohoLeadRecord = {
  Last_Name: "Test",
  Email: "a@b.co",
  Company: "Acme",
  Lead_Status: "New",
  Lead_Source: "Website",
  Region: "Other",
};

const claimedRow = { id: 7, email: "a@b.co", crm_sync_status: "syncing", crm_sync_attempts: 1 };

const source = (overrides: Partial<CrmSourceDefinition> = {}): CrmSourceDefinition =>
  ({
    table: "b2b_leads",
    enabled: true,
    buildPayload: vi.fn().mockReturnValue(record),
    ...overrides,
  }) as CrmSourceDefinition;

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("syncLeadToZoho gating", () => {
  it("does nothing while the kill switch is off", async () => {
    vi.stubEnv("CRM_SYNC_ENABLED", "false");
    expect(await syncLeadToZoho("b2b_leads", 1)).toEqual({ outcome: "sync_disabled" });
    expect(createAdminClientMock).not.toHaveBeenCalled();
  });

  it("does nothing for a registry-disabled source", async () => {
    vi.stubEnv("CRM_SYNC_ENABLED", "true");
    // Rollout flags flip per phase — force the disabled state for this test.
    const src = CRM_SOURCES.b2b_leads as { enabled: boolean };
    const prev = src.enabled;
    src.enabled = false;
    try {
      expect(await syncLeadToZoho("b2b_leads", 1)).toEqual({ outcome: "source_disabled" });
      expect(createAdminClientMock).not.toHaveBeenCalled();
    } finally {
      src.enabled = prev;
    }
  });
});

describe("runSourceSync", () => {
  it("returns not_claimed (and never calls Zoho) when the claim matches no row", async () => {
    stubAdmin({ data: null });

    const outcome = await runSourceSync(source(), 7);

    expect(outcome).toEqual({ outcome: "not_claimed" });
    expect(upsertLeadMock).not.toHaveBeenCalled();
  });

  it("claims pending/failed rows by flipping them to syncing", async () => {
    const updates = stubAdmin({ data: claimedRow });
    upsertLeadMock.mockResolvedValue({ id: "z-1", action: "insert" });

    await runSourceSync(source(), 7);

    expect(updates[0]).toEqual({ crm_sync_status: "syncing" });
  });

  it("marks rule-excluded rows skipped without calling Zoho", async () => {
    const updates = stubAdmin({ data: claimedRow });
    const src = source({ buildPayload: vi.fn().mockReturnValue(null) });

    const outcome = await runSourceSync(src, 7);

    expect(outcome).toEqual({ outcome: "skipped" });
    expect(upsertLeadMock).not.toHaveBeenCalled();
    expect(updates[1]).toEqual({ crm_sync_status: "skipped" });
  });

  it("writes back synced state with the Zoho id on success", async () => {
    const updates = stubAdmin({ data: claimedRow });
    upsertLeadMock.mockResolvedValue({ id: "9990001", action: "update" });

    const outcome = await runSourceSync(source(), 7);

    expect(outcome).toEqual({ outcome: "synced", zohoLeadId: "9990001", action: "update" });
    expect(updates[1]).toMatchObject({
      crm_sync_status: "synced",
      zoho_lead_id: "9990001",
      crm_sync_attempts: 2,
      crm_sync_error: null,
    });
    expect(typeof updates[1].crm_synced_at).toBe("string");
  });

  it("writes back failed state with the error and bumped attempts", async () => {
    const updates = stubAdmin({ data: claimedRow });
    upsertLeadMock.mockRejectedValue(
      new ZohoApiError("Zoho upsert returned 503", { retryable: true, status: 503 }),
    );

    const outcome = await runSourceSync(source(), 7);

    expect(outcome).toEqual({
      outcome: "failed",
      error: "Zoho upsert returned 503",
      retryable: true,
    });
    expect(updates[1]).toEqual({
      crm_sync_status: "failed",
      crm_sync_attempts: 2,
      crm_sync_error: "Zoho upsert returned 503",
    });
  });

  it("propagates the permanent flag for non-retryable Zoho rejections", async () => {
    stubAdmin({ data: claimedRow });
    upsertLeadMock.mockRejectedValue(
      new ZohoApiError("Zoho rejected the record: invalid picklist", {
        retryable: false,
        code: "INVALID_DATA",
      }),
    );

    const outcome = await runSourceSync(source(), 7);

    expect(outcome).toMatchObject({ outcome: "failed", retryable: false });
  });

  it("reports a claim database error as retryable failure without touching the row", async () => {
    const updates = stubAdmin({ error: { message: "connection refused" } });

    const outcome = await runSourceSync(source(), 7);

    expect(outcome).toEqual({ outcome: "failed", error: "connection refused", retryable: true });
    expect(updates).toHaveLength(1); // only the claim attempt, no write-back
    expect(upsertLeadMock).not.toHaveBeenCalled();
  });
});

describe("runSyncSweep", () => {
  /**
   * Scripted admin stub for the sweep's two chain shapes: the reaper
   * (update…select) and the queue select. Every chain method returns the
   * builder; awaiting it pops the next scripted result.
   */
  function scriptedAdmin(results: Array<{ data?: unknown; error?: unknown }>) {
    const queue = [...results];
    const calls: Array<{ method: string; args: unknown[] }> = [];
    const builder: Record<string, unknown> = {};
    for (const method of ["update", "eq", "in", "lt", "order", "limit", "select"]) {
      builder[method] = (...args: unknown[]) => {
        calls.push({ method, args });
        return builder;
      };
    }
    builder.then = (resolve: (v: unknown) => void) =>
      resolve(queue.shift() ?? { data: null, error: null });
    createAdminClientMock.mockReturnValue({ from: () => builder });
    return calls;
  }

  const outcome = (o: SyncOutcome["outcome"]): SyncOutcome => ({ outcome: o }) as SyncOutcome;

  it("skips disabled sources entirely", async () => {
    scriptedAdmin([]);
    const syncFn = vi.fn();

    const summary = await runSyncSweep(syncFn, [source({ enabled: false })]);

    expect(summary).toEqual({});
    expect(syncFn).not.toHaveBeenCalled();
  });

  it("reaps stale syncing rows back to pending before draining", async () => {
    const calls = scriptedAdmin([
      { data: [{ id: 1 }, { id: 2 }] }, // reaper matched two stranded rows
      { data: [] }, // queue empty
    ]);
    const syncFn = vi.fn();

    const summary = await runSyncSweep(syncFn, [source()]);

    expect(summary.b2b_leads.reaped).toBe(2);
    expect(calls[0]).toEqual({ method: "update", args: [{ crm_sync_status: "pending" }] });
    expect(calls[1]).toEqual({ method: "eq", args: ["crm_sync_status", "syncing"] });
  });

  it("drains the queue oldest-first and tallies outcomes", async () => {
    scriptedAdmin([
      { data: [] }, // reaper: nothing stale
      { data: [{ id: 1 }, { id: 2 }, { id: 3 }] },
      { data: [] }, // drained
    ]);
    const syncFn = vi
      .fn()
      .mockResolvedValueOnce(outcome("synced"))
      .mockResolvedValueOnce(outcome("failed"))
      .mockResolvedValueOnce(outcome("skipped"));

    const summary = await runSyncSweep(syncFn, [source()]);

    expect(syncFn).toHaveBeenCalledTimes(3);
    expect(summary.b2b_leads).toMatchObject({ synced: 1, failed: 1, skipped: 1, capped: false });
  });

  it("attempts each row at most once per run even if it stays failed", async () => {
    scriptedAdmin([
      { data: [] }, // reaper
      { data: [{ id: 1 }] },
      { data: [{ id: 1 }] }, // still failed, reselected — must not re-run
    ]);
    const syncFn = vi.fn().mockResolvedValue(outcome("failed"));

    const summary = await runSyncSweep(syncFn, [source()]);

    expect(syncFn).toHaveBeenCalledTimes(1);
    expect(summary.b2b_leads.failed).toBe(1);
  });

  it("stops on a select error without crashing the run", async () => {
    scriptedAdmin([
      { data: [] }, // reaper
      { error: { message: "boom" } },
    ]);
    const syncFn = vi.fn();

    const summary = await runSyncSweep(syncFn, [source()]);

    expect(syncFn).not.toHaveBeenCalled();
    expect(summary.b2b_leads).toMatchObject({ synced: 0, failed: 0 });
  });
});
