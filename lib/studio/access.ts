import type { PoolClient } from "../portal/db";
import { one, run, val } from "../portal/db";
import * as templates from "./templates";

/**
 * Who may do what in Resume Studio. All of it is decided on the server, never in the browser (port of Studio\Access).
 *
 *  Free: the 8 free templates, unlimited editing and live scoring, ONE saved update per rolling 24 hours.
 *  Pro:  all 45 templates and unlimited saved updates, for life after one payment (a shorter STUDIO_PERIOD_DAYS is still
 *        honoured for admin grants).
 *
 * Settings come from the environment: STUDIO_PRICE_INR (199), STUDIO_PERIOD_DAYS (36500), STUDIO_COOLDOWN_HOURS (24).
 */
/** Lifetime = a 100-year period, so every "ends_at > now" query keeps working unchanged. */
export const LIFETIME_DAYS = 36500;

const num = (key: string, dflt: number): number => {
  const n = Math.trunc(Number(process.env[key] ?? dflt));
  return Number.isFinite(n) ? n : 0;
};

export const priceInr = (): number => Math.max(1, num("STUDIO_PRICE_INR", 199));
export const periodDays = (): number => Math.max(1, num("STUDIO_PERIOD_DAYS", LIFETIME_DAYS));
export const isLifetimeDays = (days: number): boolean => days >= 3650;
export const isLifetime = (): boolean => isLifetimeDays(periodDays());
export const planLabel = (): string => (isLifetime() ? "one-time payment, lifetime access" : `for ${periodDays()} days`);
export const cooldownHours = (): number => Math.max(1, num("STUDIO_COOLDOWN_HOURS", 24));
export const pricePaise = (): number => priceInr() * 100;

export interface Subscription { id: number; user_id: number; starts_at: string; ends_at: string; source: string; payment_id: string | null; amount_paise: number }

/** The currently active Pro period (latest end date), or null. */
export async function subscription(uid: number): Promise<Subscription | null> {
  return one<Subscription>("SELECT * FROM studio_subscriptions WHERE user_id = $1 AND starts_at <= LOCALTIMESTAMP(0) AND ends_at > LOCALTIMESTAMP(0) ORDER BY ends_at DESC LIMIT 1", [uid]);
}

/** Studio Pro comes from its own purchase, or from holding any paid plan (Pro, Silver or Gold) right now. */
export async function isPro(uid: number): Promise<boolean> {
  if ((await subscription(uid)) !== null) return true;
  const plan = await val("SELECT COUNT(*) FROM pay_entitlements WHERE user_id = $1 AND kind = 'plan' AND status = 'active' AND (expires_at IS NULL OR expires_at > UTC_TIMESTAMP(3))", [uid]);
  return Number(plan) > 0;
}

export async function canUseTemplate(uid: number, templateId: string, pro?: boolean): Promise<boolean> {
  const t = templates.get(templateId);
  return t !== null && (t.free || (pro ?? (await isPro(uid))));
}

/**
 * Seconds until a free user may save another update (0 = allowed now). Pro users are never limited. Counts only 'save'
 * versions: the first 'import' version is the starting point and is free.
 */
export async function secondsUntilNextSave(uid: number, pro?: boolean, q?: Pick<PoolClient, "query">): Promise<number> {
  if (pro ?? (await isPro(uid))) return 0;
  const sql = `SELECT TIMESTAMPDIFF(SECOND, LOCALTIMESTAMP(0), MAX(created_at) + INTERVAL ${Math.trunc(cooldownHours())} HOUR) AS secs_left FROM studio_versions WHERE user_id = $1 AND kind = 'save'`;
  const left = q ? (await q.query(sql, [uid])).rows[0]?.secs_left : await val(sql, [uid]);
  return left === null || left === undefined ? 0 : Math.max(0, Math.ceil(Number(left)));
}

export function countdown(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h} h ${m} min` : `${Math.max(1, m)} min`;
}

const utcNow = (): string => new Date().toISOString().slice(0, 19).replace("T", " ");

/**
 * Give Pro access for a period (default: lifetime). A timed grant extends from the current end date; a lifetime grant starts now.
 * Pass a client to run inside the caller's transaction.
 */
export async function grant(uid: number, source: string, paymentId: string | null = null, amountPaise = 0, days: number | null = null, client?: Pick<PoolClient, "query">): Promise<void> {
  const d = days ?? periodDays();
  const curSql = "SELECT MAX(ends_at) AS cur FROM studio_subscriptions WHERE user_id = $1 AND ends_at > LOCALTIMESTAMP(0)";
  const cur = client ? (await client.query(curSql, [uid])).rows[0]?.cur : await val(curSql, [uid]);
  const start = cur !== null && cur !== undefined && !isLifetimeDays(d) ? String(cur) : utcNow();
  const ins = `INSERT INTO studio_subscriptions (user_id, starts_at, ends_at, source, payment_id, amount_paise) VALUES ($1, LOCALTIMESTAMP(0), CAST($2 AS timestamp) + INTERVAL '${Math.trunc(d)} day', $3, $4, $5)`;
  const params = [uid, start, source, paymentId, amountPaise];
  if (client) await client.query(ins, params);
  else await run(ins, params);
}

/** End Pro access now (admin tool). */
export async function revoke(uid: number): Promise<void> {
  await run("UPDATE studio_subscriptions SET ends_at = LOCALTIMESTAMP(0) WHERE user_id = $1 AND ends_at > LOCALTIMESTAMP(0)", [uid]);
}
