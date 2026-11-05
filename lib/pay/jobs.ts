import { cfg } from "./config";
import { exec, first, pool, rows, tx } from "./db";
import { alertStaff } from "./notify";
import { anomalies, paymentMetrics } from "./metrics";
import { closeUnpaid } from "./orders";
import { getProvider } from "./providers";
import { ProviderError } from "./providers/types";
import { reconcileAll } from "./reconcile";
import { resolveStuckRefunds } from "./refunds";
import { settlePayment } from "./settle";
import { purgeOldWebhooks, retryFailedWebhooks } from "./webhooks";

/**
 * Background work, run by GET /api/cron/payments every few minutes. Every step is safe to repeat and bounded in size.
 *   - expire unpaid orders whose time ran out (after asking the provider whether they were paid after all);
 *   - retry failed webhook events;
 *   - resolve refunds that were recorded but never confirmed;
 *   - reconcile with the providers about every six hours;
 *   - raise an alert when the numbers look wrong (at most once every six hours for the same condition).
 */
async function metaGet(k: string): Promise<string | null> {
  return (await first<{ v: string }>(pool, "SELECT v FROM schema_meta WHERE k = $1", [k]))?.v ?? null;
}
async function metaSet(k: string, v: string): Promise<void> {
  await exec(pool, "INSERT INTO schema_meta (k, v) VALUES ($1, $2) ON DUPLICATE KEY UPDATE v = VALUES(v)", [k, v]);
}

export async function expireStaleOrders(limit = 100): Promise<number> {
  const due = await rows(pool, "SELECT * FROM pay_orders WHERE status = 'pending' AND expires_at < UTC_TIMESTAMP() ORDER BY id LIMIT $1", [limit]);
  let n = 0;
  for (const o of due) {
    const attempts = await rows(pool, "SELECT * FROM pay_payments WHERE order_id = $1 AND provider <> 'free'", [o.id]);
    let paid = false;
    let unsure = false;
    for (const a of attempts.filter((x) => x.status === "created" || x.status === "pending")) {
      if (String(a.provider_session_ref).startsWith("pending_")) continue;
      try {
        const out = await settlePayment(Number(a.id), { actor: "system", via: "cron" });
        if (out.paymentStatus === "succeeded") paid = true;
        else { const pr = getProvider(a.provider); if (pr) await pr.cancelPayment(a.provider_session_ref).catch(() => undefined); }
      } catch (e) {
        if (e instanceof ProviderError && e.status === 404) continue; // the provider has no such payment: it was never paid
        // Any other failure (the provider is down, our keys are wrong ...) means we cannot tell whether it was paid: leave this order alone for now.
        unsure = true;
        console.error(`[pay] could not check order ${o.public_id} before expiring it:`, (e as Error).message);
      }
    }
    if (paid || unsure) continue;
    const allFailed = attempts.length > 0 && attempts.every((x) => x.status === "failed");
    if (await tx((db) => closeUnpaid(db, o, allFailed ? "failed" : "expired", { type: "system" }, "time ran out"))) n++;
  }
  return n;
}

export async function runPaymentJobs(): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  const step = async (name: string, f: () => Promise<unknown>) => {
    try { out[name] = await f(); } catch (e) { out[name] = { error: (e as Error).message.slice(0, 200) }; }
  };
  await step("expiredOrders", () => expireStaleOrders());
  await step("webhooksRetried", () => retryFailedWebhooks());
  await step("refunds", () => resolveStuckRefunds());
  await step("webhooksPurged", async () => ((await metaGet("pay_purge_at")) && Date.now() - Number(await metaGet("pay_purge_at")) < 24 * 3_600_000 ? 0 : (await metaSet("pay_purge_at", String(Date.now())), await purgeOldWebhooks())));
  await step("reconciliation", async () => {
    const last = Number((await metaGet("pay_recon_at")) ?? 0);
    if (Date.now() - last < 6 * 3_600_000) return "skipped";
    await metaSet("pay_recon_at", String(Date.now()));
    return reconcileAll(cfg.reconcileHours());
  });
  await step("alerts", async () => {
    const found = anomalies(await paymentMetrics(1));
    if (!found.length) return 0;
    const key = "pay_alert_" + found.join("|").slice(0, 150);
    const last = Number((await metaGet("pay_alert_at")) ?? 0);
    if ((await metaGet("pay_alert_key")) === key && Date.now() - last < 6 * 3_600_000) return 0;
    await metaSet("pay_alert_key", key);
    await metaSet("pay_alert_at", String(Date.now()));
    await alertStaff("Payment health needs attention", found);
    return found.length;
  });
  return out;
}
