import "server-only";
import { createHash, randomInt } from "node:crypto";
import { headers } from "next/headers";
import { run, val, one } from "./db";

/** Failed-attempt throttling (auth_throttle), audit trail (sa_audit) and request helpers. */

export const WINDOW_MIN = 15;

export function clientIpFrom(h: { get(name: string): string | null }): string {
  const real = h.get("x-real-ip");
  if (real) return real.trim();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return "0.0.0.0";
}

export async function clientIp(): Promise<string> {
  try {
    return clientIpFrom(await headers());
  } catch {
    return "0.0.0.0"; // outside a request (scripts, tests)
  }
}

export const sha256 = (s: string): string => createHash("sha256").update(s).digest("hex");

/** Number of recent failures in a bucket. */
export async function fails(bucket: string, minutes = WINDOW_MIN): Promise<number> {
  return (await val<number>("SELECT COUNT(*) FROM auth_throttle WHERE bucket = $1 AND created_at > (NOW() - make_interval(mins => $2::int))", [bucket, minutes])) ?? 0;
}

export async function recordFail(bucket: string): Promise<void> {
  await run("INSERT INTO auth_throttle (bucket, created_at) VALUES ($1, NOW())", [bucket]);
  if (randomInt(1, 51) === 1) await run("DELETE FROM auth_throttle WHERE created_at < (NOW() - INTERVAL '1 day')"); // opportunistic cleanup
}

export async function clearFails(bucket: string): Promise<void> {
  await run("DELETE FROM auth_throttle WHERE bucket = $1", [bucket]);
}

/** Append to the audit trail (same table the PHP app writes). The IP is stored only as a short hash. */
export async function audit(actor: number | null, subject: number | null, action: string, detail = ""): Promise<void> {
  try {
    const ip = await clientIp();
    await run("INSERT INTO sa_audit (actor_user_id, subject_user_id, action, detail, ip_hash, created_at) VALUES ($1,$2,$3,$4,$5,NOW())", [actor, subject, action, detail.slice(0, 255), sha256(ip).slice(0, 16)]);
  } catch (e) {
    console.error("[audit] failed:", (e as Error).message);
  }
}

export async function userExists(email: string): Promise<boolean> {
  return (await one("SELECT id FROM users WHERE email = $1", [email])) !== null;
}

/** Only same-site relative paths are allowed after login (no scheme, no host, no protocol-relative "//"). */
export function safeNext(next: string | null | undefined, fallback: string): string {
  const n = (next ?? "").trim();
  if (n.length > 0 && n.length < 300 && /^\/(?!\/)[A-Za-z0-9_\-/]*(\?[A-Za-z0-9_=&%.\-]*)?$/.test(n)) return n;
  return fallback;
}
