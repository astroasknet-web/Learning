import { first, pool, rows } from "./db";
import { allProviders } from "./providers";

/** Operational numbers for health checks, the console and alerting. All counts; no personal data. */
export interface Metrics {
  windowHours: number;
  orders: Record<string, number>;
  payments: { succeeded: number; failed: number; pending: number; successRate: number | null; avgSettleSeconds: number | null };
  refunds: { requested: number; pending: number; succeeded: number; failed: number };
  webhooks: { received: number; processing: number; failed: number; dead: number; oldestUnprocessedMinutes: number | null };
  reconciliation: { lastRunAt: string | null; lastStatus: string | null; openItems: number };
  disputesOpen: number;
}

const n = (v: unknown): number => Number(v ?? 0);

export async function paymentMetrics(hours = 24): Promise<Metrics> {
  const since = `(UTC_TIMESTAMP() - INTERVAL ${Math.max(1, Math.min(24 * 90, Math.trunc(hours)))} HOUR)`;
  const o = await rows<{ status: string; c: number }>(pool, `SELECT status, COUNT(*) AS c FROM pay_orders WHERE created_at > ${since} GROUP BY status`);
  const p = await rows<{ status: string; c: number }>(pool, `SELECT status, COUNT(*) AS c FROM pay_payments WHERE created_at > ${since} AND provider <> 'free' GROUP BY status`);
  const pc = (s: string[]): number => p.filter((x) => s.includes(x.status)).reduce((a, x) => a + n(x.c), 0);
  const succeeded = pc(["succeeded", "partially_refunded", "refunded", "disputed"]);
  const failed = pc(["failed"]);
  const avg = await first<{ s: number | null }>(pool, `SELECT AVG(TIMESTAMPDIFF(SECOND, created_at, settled_at)) AS s FROM pay_payments WHERE settled_at IS NOT NULL AND created_at > ${since}`);
  const r = await rows<{ status: string; c: number }>(pool, "SELECT status, COUNT(*) AS c FROM pay_refunds GROUP BY status");
  const rc = (s: string): number => n(r.find((x) => x.status === s)?.c);
  const w = await rows<{ status: string; c: number }>(pool, "SELECT status, COUNT(*) AS c FROM pay_webhook_events WHERE status IN ('received','processing','failed','dead') GROUP BY status");
  const wc = (s: string): number => n(w.find((x) => x.status === s)?.c);
  const oldest = await first<{ m: number | null }>(pool, "SELECT TIMESTAMPDIFF(MINUTE, MIN(received_at), UTC_TIMESTAMP()) AS m FROM pay_webhook_events WHERE status IN ('received','failed','processing')");
  const last = await first<{ at: string | null; status: string | null }>(pool, "SELECT finished_at AS at, status FROM pay_reconciliation_runs WHERE status <> 'running' ORDER BY id DESC LIMIT 1");
  const open = await first<{ c: number }>(pool, "SELECT COUNT(*) AS c FROM pay_reconciliation_items WHERE resolved = 0");
  const d = await first<{ c: number }>(pool, "SELECT COUNT(*) AS c FROM pay_disputes WHERE status IN ('open','under_review')");
  return {
    windowHours: hours,
    orders: Object.fromEntries(o.map((x) => [x.status, n(x.c)])),
    payments: { succeeded, failed, pending: pc(["created", "pending"]), successRate: succeeded + failed > 0 ? succeeded / (succeeded + failed) : null, avgSettleSeconds: avg?.s === null || avg?.s === undefined ? null : Math.round(Number(avg.s)) },
    refunds: { requested: rc("requested"), pending: rc("pending"), succeeded: rc("succeeded"), failed: rc("failed") },
    webhooks: { received: wc("received"), processing: wc("processing"), failed: wc("failed"), dead: wc("dead"), oldestUnprocessedMinutes: oldest?.m === null || oldest?.m === undefined ? null : n(oldest.m) },
    reconciliation: { lastRunAt: last?.at ?? null, lastStatus: last?.status ?? null, openItems: n(open?.c) },
    disputesOpen: n(d?.c),
  };
}

/** Conditions that should wake someone up. */
export function anomalies(m: Metrics): string[] {
  const out: string[] = [];
  const attempts = m.payments.succeeded + m.payments.failed;
  if (attempts >= 10 && (m.payments.successRate ?? 1) < 0.5) out.push(`Only ${Math.round((m.payments.successRate ?? 0) * 100)}% of ${attempts} recent payments succeeded.`);
  if (m.webhooks.dead > 0) out.push(`${m.webhooks.dead} webhook event(s) could not be processed.`);
  if ((m.webhooks.oldestUnprocessedMinutes ?? 0) > 30) out.push(`A webhook has waited ${m.webhooks.oldestUnprocessedMinutes} minutes without being processed.`);
  if (m.refunds.requested > 0 && m.refunds.requested + m.refunds.pending > 5) out.push(`${m.refunds.requested + m.refunds.pending} refunds are waiting on the provider.`);
  if (m.reconciliation.openItems > 0) out.push(`${m.reconciliation.openItems} reconciliation difference(s) are still open.`);
  if (m.disputesOpen > 0) out.push(`${m.disputesOpen} dispute(s) are open.`);
  return out;
}

export interface Health { ok: boolean; database: boolean; providers: Array<{ id: string; configured: boolean; webhook: boolean; currencies: string[] }> }

/** Readiness: can we reach the database, and which providers are set up. Reveals no keys. */
export async function paymentHealth(): Promise<Health> {
  let database = false;
  try { database = (await first(pool, "SELECT 1 AS ok")) !== null; } catch { database = false; }
  const providers = allProviders().map((p) => ({ id: p.id as string, configured: p.configured(), webhook: p.webhookConfigured(), currencies: p.currencies() }));
  return { ok: database && providers.some((p) => p.configured), database, providers };
}
