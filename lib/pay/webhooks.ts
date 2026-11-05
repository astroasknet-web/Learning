import { audit } from "./audit";
import { cfg } from "./config";
import { exec, first, pool, rows, type Row } from "./db";
import { allow } from "./rate-limit";
import { getProvider } from "./providers";
import { ProviderError, type ProviderEvent } from "./providers/types";
import { applyDispute, applyProviderTruth, findPaymentFor, recordAttemptFailure, settlePayment } from "./settle";
import { applyProviderRefund, syncRefunds } from "./refunds";
import { alertStaff } from "./notify";
import { clientIp } from "@/lib/portal/security";

/**
 * Receiving provider webhooks.
 *   1. The raw body and headers are verified by the provider's adapter (signature over the exact bytes; Stripe's SDK also checks the timestamp).
 *   2. The verified event is stored once, keyed by the provider's event id. A repeat of a processed event is acknowledged and ignored.
 *   3. The event is only a hint: handlers re-read the payment from the provider's API (see settle.ts).
 *   4. A temporary failure answers 500 so the provider retries; the cron job also retries failed events with a growing delay, and gives up
 *      (status "dead", with an alert) after eight attempts.
 * Only the provider-neutral event is stored, not the raw body, so no customer details are kept.
 */
export interface WebhookReply { status: number; body: { ok: boolean; message?: string; duplicate?: boolean } }

const MAX_BODY = 512 * 1024;
const MAX_ATTEMPTS = 8;

export async function receiveWebhook(providerId: string, raw: string, headers: Headers): Promise<WebhookReply> {
  const provider = getProvider(providerId);
  if (!provider) return { status: 404, body: { ok: false, message: "unknown provider" } };
  if (Buffer.byteLength(raw) > MAX_BODY) return { status: 413, body: { ok: false } };
  if (!provider.webhookConfigured()) return { status: 503, body: { ok: false, message: "webhook secret not configured" } }; // the provider will retry

  let ev: ProviderEvent;
  try {
    ev = provider.verifyWebhook(raw, headers);
  } catch (e) {
    const ip = await clientIp().catch(() => "0.0.0.0");
    if (!(await allow(`pay:wh-bad:${ip}`, 60, 15))) return { status: 429, body: { ok: false } };
    if (e instanceof ProviderError && e.code === "not_configured") return { status: 503, body: { ok: false } };
    return { status: 400, body: { ok: false, message: "invalid signature" } };
  }

  const inserted = await exec(pool, "INSERT IGNORE INTO pay_webhook_events (provider, event_id, type, payload, status) VALUES ($1,$2,$3,$4,'received')", [ev.provider, ev.id, ev.type.slice(0, 80), JSON.stringify(ev)]);
  const row = (await first(pool, "SELECT * FROM pay_webhook_events WHERE provider = $1 AND event_id = $2", [ev.provider, ev.id])) as Row;
  if (inserted === 0 && (row.status === "processed" || row.status === "ignored" || row.status === "dead")) return { status: 200, body: { ok: true, duplicate: true } };
  return processStoredEvent(Number(row.id));
}

function revive(payload: string): ProviderEvent {
  const e = JSON.parse(payload) as ProviderEvent & { at: string | null; dispute?: { respondBy?: string | null } };
  return { ...e, at: e.at ? new Date(e.at) : null, dispute: e.dispute ? { ...e.dispute, respondBy: e.dispute.respondBy ? new Date(e.dispute.respondBy) : null } : undefined } as ProviderEvent;
}

type Result = "processed" | "ignored";

async function handle(ev: ProviderEvent): Promise<{ result: Result; note?: string }> {
  const provider = getProvider(ev.provider);
  if (!provider) return { result: "ignored", note: "unknown provider" };
  const ctx = { actor: "provider" as const, actorId: ev.provider, via: "webhook" as const };
  const pay = await findPaymentFor(ev);

  switch (ev.kind) {
    case "payment.succeeded": case "payment.authorized": case "payment.pending": {
      if (!pay) return { result: "ignored", note: "no matching payment (another flow's payment?)" };
      const out = await settlePayment(Number(pay.id), ctx);
      return { result: "processed", note: out.mismatch };
    }
    case "payment.failed": {
      if (!pay) return { result: "ignored", note: "no matching payment" };
      const truth = await provider.retrievePayment({ sessionRef: pay.provider_session_ref, paymentRef: pay.provider_payment_ref });
      if (truth.status === "succeeded" || truth.status === "authorized") await settlePayment(Number(pay.id), ctx);
      else await applyProviderTruth(Number(pay.id), { ...truth, status: "failed", failureCode: ev.failureCode ?? truth.failureCode ?? "payment_failed" }, ctx);
      return { result: "processed" };
    }
    case "payment.attempt_failed": {
      if (!pay) return { result: "ignored", note: "no matching payment" };
      await recordAttemptFailure(Number(pay.id), ev.failureCode, ev.failureMessage);
      return { result: "processed" };
    }
    case "session.expired": {
      if (!pay) return { result: "ignored", note: "no matching payment" };
      await settlePayment(Number(pay.id), ctx); // the provider reports "expired", or "paid" if it was paid in the meantime
      return { result: "processed" };
    }
    case "refund.updated": {
      if (!pay) return { result: "ignored", note: "no matching payment" };
      if (ev.refund) await applyProviderRefund(pay, await provider.retrieveRefund(ev.refund.ref, ev.refund.paymentRef || pay.provider_payment_ref), { type: "provider", id: ev.provider });
      else await syncRefunds(Number(pay.id));
      return { result: "processed" };
    }
    case "dispute.updated": {
      if (!ev.dispute) return { result: "ignored", note: "no dispute in event" };
      const known = await applyDispute(ev.dispute, ev.provider, ctx);
      return known ? { result: "processed" } : { result: "ignored", note: "no matching payment" };
    }
    default:
      return { result: "ignored", note: `event ${ev.type} is not used` };
  }
}

/** Claim and process one stored event. Used by the webhook endpoint, the admin retry button and the cron job. */
export async function processStoredEvent(eventRowId: number): Promise<WebhookReply> {
  const claimed = await exec(pool, "UPDATE pay_webhook_events SET status = 'processing', attempts = attempts + 1 WHERE id = $1 AND (status IN ('received','failed') OR (status = 'processing' AND received_at < (UTC_TIMESTAMP() - INTERVAL 5 MINUTE)))", [eventRowId]);
  if (claimed === 0) return { status: 200, body: { ok: true, duplicate: true } }; // someone else is on it, or it is finished
  const row = (await first(pool, "SELECT * FROM pay_webhook_events WHERE id = $1", [eventRowId])) as Row;
  try {
    const { result, note } = await handle(revive(row.payload));
    await exec(pool, "UPDATE pay_webhook_events SET status = $1, processed_at = UTC_TIMESTAMP(3), last_error = $2 WHERE id = $3", [result, note ? note.slice(0, 480) : null, eventRowId]);
    return { status: 200, body: { ok: true, message: note } };
  } catch (e) {
    const retryable = !(e instanceof ProviderError) || e.retryable;
    const msg = (e as Error).message.slice(0, 480);
    const dead = Number(row.attempts) >= MAX_ATTEMPTS || !retryable;
    await exec(pool, "UPDATE pay_webhook_events SET status = $1, last_error = $2 WHERE id = $3", [dead ? "dead" : "failed", msg, eventRowId]);
    await audit({ actorType: "system", action: dead ? "webhook.dead" : "webhook.failed", entity: "webhook", entityId: eventRowId, detail: { type: row.type, error: msg } });
    if (dead) await alertStaff("A payment webhook could not be processed", [`Event ${row.provider}/${row.event_id} (${row.type}) failed ${row.attempts} times: ${msg}`, "Open Webhooks in the console to retry it after fixing the cause."]);
    return dead && !retryable ? { status: 200, body: { ok: false, message: "rejected" } } : { status: 500, body: { ok: false, message: "retry" } };
  }
}

/** Retry failed events with a growing delay (2, 4, 8 ... minutes). Returns how many were tried. */
export async function retryFailedWebhooks(limit = 25): Promise<number> {
  const list = await rows<{ id: number; attempts: number; received_at: string }>(pool, "SELECT id, attempts FROM pay_webhook_events WHERE status IN ('failed','received') AND received_at < (UTC_TIMESTAMP() - INTERVAL POW(2, LEAST(attempts, 8)) MINUTE) ORDER BY attempts, id LIMIT $1", [limit]);
  let n = 0;
  for (const e of list) {
    if (Number(e.attempts) >= MAX_ATTEMPTS) { await exec(pool, "UPDATE pay_webhook_events SET status = 'dead' WHERE id = $1", [e.id]); continue; }
    await processStoredEvent(Number(e.id));
    n++;
  }
  return n;
}

/** Staff "retry now" button: put a failed or dead event back in the queue and process it. */
export async function forceRetry(eventRowId: number, staffUserId: number): Promise<WebhookReply> {
  await exec(pool, "UPDATE pay_webhook_events SET status = 'failed' WHERE id = $1 AND status IN ('failed','dead','received')", [eventRowId]);
  await audit({ actorType: "staff", actorId: staffUserId, action: "webhook.retry", entity: "webhook", entityId: eventRowId });
  return processStoredEvent(eventRowId);
}

export async function purgeOldWebhooks(): Promise<number> {
  return exec(pool, "DELETE FROM pay_webhook_events WHERE status IN ('processed','ignored') AND received_at < (UTC_TIMESTAMP() - INTERVAL $1 DAY)", [cfg.webhookRetentionDays()]);
}


