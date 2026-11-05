import { createAdminClient } from "@/lib/data/server";
import { createLogger } from "@/lib/log";
import { upsertLead, ZohoApiError } from "@/lib/crm/zoho-client";
import {
  CRM_SOURCES,
  isCrmSyncEnabled,
  type CrmSourceDefinition,
  type CrmSourceKey,
  type PersonResolution,
} from "@/lib/crm/sources";

/**
 * The sync engine: one row at a time through the state machine
 *
 *   pending|failed ──claim──▶ syncing ──▶ synced | failed
 *
 * The claim is a conditional UPDATE … RETURNING: whichever caller (inline
 * after() or the Phase 5 cron) flips the row to 'syncing' first owns it,
 * which is what makes running both concurrently safe. A crash after claim
 * strands the row in 'syncing'; the cron's reaper resets stale claims and
 * the Zoho upsert-on-Email makes the resulting retry idempotent.
 */

const log = createLogger("crm-sync");

export type SyncOutcome =
  | { outcome: "sync_disabled" }
  | { outcome: "source_disabled" }
  | { outcome: "not_claimed" }
  | { outcome: "skipped" }
  | { outcome: "synced"; zohoLeadId: string; action: "insert" | "update" }
  | { outcome: "failed"; error: string; retryable: boolean };

/**
 * Sync one row from a registered source. Every path returns an outcome and
 * never throws — callers (after() hook, cron) must not blow up on a sync
 * problem; the row's crm_sync_* columns are the durable record.
 */
export async function syncLeadToZoho(key: CrmSourceKey, rowId: string | number): Promise<SyncOutcome> {
  if (!isCrmSyncEnabled()) return { outcome: "sync_disabled" };
  const source = CRM_SOURCES[key];
  if (!source.enabled) return { outcome: "source_disabled" };
  return runSourceSync(source, rowId);
}

/**
 * The engine core, taking the source definition as input — exported so tests
 * exercise the full state machine without flipping the registry's rollout
 * flags. Assumes enablement checks already happened.
 */
/** Retries stop after this many attempts; the row stays 'failed' for ops. */
export const MAX_ATTEMPTS = 5;
/**
 * Rows younger than this are left to the inline after() hook; the sweep never
 * touches them, which is what makes running both concurrently race-free.
 */
const GRACE_MS = 10 * 60_000;
const SWEEP_BATCH = 25;
/** Per-source per-run ceiling — loudly logged when hit, never silent. */
const SWEEP_MAX_ROWS = 200;

export interface SweepSourceSummary {
  reaped: number;
  synced: number;
  failed: number;
  skipped: number;
  capped: boolean;
  afterSyncRetried: number;
}

/**
 * Reconciliation sweep (the Phase 5b cron body). Per enabled source:
 *
 *  1. Reap stranded claims: 'syncing' rows older than the grace window go
 *     back to 'pending'. Safe because claim holders are single-flight — the
 *     inline hook only ever claims rows younger than the grace window, and
 *     cron runs don't overlap (the schedule is far longer than maxDuration;
 *     see vercel.json, currently daily on the Hobby plan).
 *  2. Drain 'pending'/'failed' rows (attempts < 5) oldest-first until empty
 *     or the run budget is hit. Each row is attempted at most once per run —
 *     the attempts cap spreads across runs, not within one.
 */
export async function runSyncSweep(
  syncFn: (source: CrmSourceDefinition, rowId: string | number) => Promise<SyncOutcome> = runSourceSync,
  sources: readonly CrmSourceDefinition[] = Object.values(CRM_SOURCES),
): Promise<Record<string, SweepSourceSummary>> {
  const admin = createAdminClient();
  const graceCutoff = new Date(Date.now() - GRACE_MS).toISOString();
  const summaries: Record<string, SweepSourceSummary> = {};

  for (const source of sources) {
    if (!source.enabled) continue;
    const summary: SweepSourceSummary = {
      reaped: 0,
      synced: 0,
      failed: 0,
      skipped: 0,
      capped: false,
      afterSyncRetried: 0,
    };
    summaries[source.table] = summary;

    const { data: reaped, error: reapError } = await admin
      .from(source.table)
      .update({ crm_sync_status: "pending" } as never)
      .eq("crm_sync_status", "syncing")
      .lt("created_at", graceCutoff)
      .select("id");
    if (reapError) {
      log.error(`${source.table} reaper failed:`, reapError);
    } else if (reaped?.length) {
      summary.reaped = reaped.length;
      log.warn(`${source.table} reaped ${reaped.length} stale syncing row(s)`);
    }

    const attempted = new Set<string | number>();
    while (attempted.size < SWEEP_MAX_ROWS) {
      const { data: rows, error } = await admin
        .from(source.table)
        .select("id")
        .in("crm_sync_status", ["pending", "failed"])
        .lt("crm_sync_attempts", MAX_ATTEMPTS)
        .lt("created_at", graceCutoff)
        .order("created_at", { ascending: true })
        .limit(SWEEP_BATCH);
      if (error) {
        log.error(`${source.table} sweep select failed:`, error);
        break;
      }

      const fresh = (rows ?? []).map((r) => r.id).filter((id) => !attempted.has(id));
      if (!fresh.length) break;

      for (const id of fresh) {
        attempted.add(id);
        const outcome = await syncFn(source, id);
        if (outcome.outcome === "synced") summary.synced += 1;
        else if (outcome.outcome === "failed") summary.failed += 1;
        else if (outcome.outcome === "skipped") summary.skipped += 1;
        if (attempted.size >= SWEEP_MAX_ROWS) break;
      }
    }

    if (attempted.size >= SWEEP_MAX_ROWS) {
      summary.capped = true;
      log.warn(`${source.table} sweep hit the ${SWEEP_MAX_ROWS}-row budget — backlog remains`);
    }

    // Second, independent lane: rows already 'synced' whose afterSync hook
    // (Task/Note/notification) didn't fully complete. These never re-enter
    // the pending/failed drain above — the Lead sync succeeded, so
    // crm_sync_status stays 'synced' regardless of hook outcome. Without this
    // pass a partial afterSync failure is never retried, ever.
    if (source.afterSync && source.afterSyncFilter) {
      const { data: rows, error: afterSyncError } = await admin
        .from(source.table)
        .select("*")
        .eq("crm_sync_status", "synced")
        .or(source.afterSyncFilter)
        .order("created_at", { ascending: true })
        .limit(SWEEP_BATCH);
      if (afterSyncError) {
        log.error(`${source.table} afterSync reconciliation select failed:`, afterSyncError);
      } else {
        for (const row of (rows ?? []) as Array<{
          id: string | number;
          zoho_lead_id: string | null;
          zoho_contact_id?: string | null;
          crm_record_type?: string | null;
        }>) {
          // A booking that attached to an existing Contact has no zoho_lead_id,
          // so keying this lane on that column alone would strand its Task/Note
          // retries forever.
          const zohoId = row.zoho_lead_id ?? row.zoho_contact_id ?? null;
          if (!zohoId) continue; // a 'synced' row always has one; guard against drift
          try {
            await source.afterSync(row as never, {
              id: zohoId,
              type: row.crm_record_type === "contact" ? "contact" : "lead",
              action: "update",
            });
            summary.afterSyncRetried += 1;
          } catch (hookError) {
            log.error(`${source.table}#${row.id} afterSync reconciliation retry failed:`, hookError);
          }
        }
      }
    }
  }

  return summaries;
}

export async function runSourceSync(
  source: CrmSourceDefinition,
  rowId: string | number,
): Promise<SyncOutcome> {
  const admin = createAdminClient();
  const scope = `${source.table}#${rowId}`;

  // Atomic claim. the query builder cannot express the id/update types across a
  // union of tables, hence the two narrow casts — the shapes are identical
  // in all three tables (Phase 2 migration).
  const { data: row, error: claimError } = await admin
    .from(source.table)
    .update({ crm_sync_status: "syncing" } as never)
    .eq("id", rowId as never)
    .in("crm_sync_status", ["pending", "failed"])
    .select()
    .maybeSingle();

  if (claimError) {
    log.error(`${scope} claim failed:`, claimError);
    return { outcome: "failed", error: claimError.message, retryable: true };
  }
  if (!row) {
    // Already claimed, synced, skipped or legacy — nothing to do.
    return { outcome: "not_claimed" };
  }

  const writeBack = async (patch: Record<string, unknown>) => {
    const { error } = await admin
      .from(source.table)
      .update(patch as never)
      .eq("id", rowId as never);
    if (error) {
      // Row stays 'syncing'; the reaper re-queues it and upsert-on-Email
      // keeps the eventual retry idempotent.
      log.error(`${scope} write-back failed:`, error);
    }
  };

  const payload = source.buildPayload(row as never);
  if (!payload) {
    await writeBack({ crm_sync_status: "skipped" });
    log.info(`${scope} outcome=skipped (excluded by rule)`);
    return { outcome: "skipped" };
  }

  const attempts = (row.crm_sync_attempts ?? 0) + 1;

  try {
    // Default resolution is exactly what every source did before this hook
    // existed: upsert a Lead keyed on Email. Only a source that explicitly
    // declares resolvePerson (today: call_bookings, which must attach to an
    // existing Contact rather than duplicate the person as a Lead) behaves
    // differently, so the four original sources are byte-identical.
    const result: PersonResolution = source.resolvePerson
      ? await source.resolvePerson(payload)
      : { type: "lead", ...(await upsertLead({ ...payload })) };

    await writeBack({
      crm_sync_status: "synced",
      // Only one of the two id columns exists on most tables, so the patch is
      // built from the resolution rather than always naming both.
      ...(result.type === "lead"
        ? { zoho_lead_id: result.id }
        : { zoho_contact_id: result.id }),
      // crm_record_type only exists on sources that can resolve to a Contact.
      ...(source.resolvePerson ? { crm_record_type: result.type } : {}),
      crm_synced_at: new Date().toISOString(),
      crm_sync_attempts: attempts,
      crm_sync_error: null,
    });
    log.info(`${scope} outcome=synced type=${result.type} action=${result.action} zoho_id=${result.id}`);

    if (source.afterSync) {
      try {
        await source.afterSync(row as never, result);
      } catch (hookError) {
        // The Lead is already synced — a Task/Note failure is logged for ops,
        // not a sync failure. The per-row created flags stay false, which is
        // what the sweep's separate afterSyncFilter reconciliation lane
        // (below, keyed off those flags rather than crm_sync_status) picks
        // up and retries on the next run.
        log.error(`${scope} afterSync hook failed:`, hookError);
      }
    }

    return { outcome: "synced", zohoLeadId: result.id, action: result.action };
  } catch (error) {
    const retryable = error instanceof ZohoApiError ? error.retryable : true;
    const message = error instanceof Error ? error.message : String(error);
    await writeBack({
      crm_sync_status: "failed",
      crm_sync_attempts: attempts,
      crm_sync_error: message,
    });
    log.error(`${scope} outcome=failed retryable=${retryable} attempts=${attempts}:`, error);
    return { outcome: "failed", error: message, retryable };
  }
}
