import "server-only";
import * as React from "react";
import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { BLOCK_DEMO_HEADER } from "./demo";
import { one, run, tx } from "./db";
import { clientIp, sha256 } from "./security";

/**
 * Server-side sessions for the portal. The browser keeps only a random token in an httpOnly cookie; the database keeps its
 * SHA-256 (portal_sessions), so sessions can be revoked, expire on the server, and a database leak cannot be replayed as a login.
 *
 *  - absolute lifetime 14 days, idle timeout 7 days;
 *  - a new session id is issued at login (prevents session fixation) and the old one is deleted;
 *  - a session may exist without a user: it then carries only the pending two-step login or the authenticator setup secret.
 */
export const COOKIE = "gq_session";
const LIFETIME_DAYS = 14;
const IDLE_DAYS = 7;

export type Role = "student" | "employer" | "admin" | "counselor" | "teacher" | "parent";

export interface PortalUser {
  id: number;
  role: Role;
  email: string;
  name: string;
  email_verified_at: string | null;
  mfa_enabled_at: string | null;
  /** A read-only demo account: it can look, but is treated as signed out on any request that changes or downloads data. */
  is_demo?: boolean;
}

export interface PortalSession {
  id: string; // sha256 of the cookie token
  csrf: string;
  data: Record<string, unknown>;
  user: PortalUser | null;
  /** Set when a demo account tried something that is switched off for it (the user above is then null). */
  demoBlocked?: boolean;
}

const memo = ((React as unknown as { cache?: <T extends (...a: never[]) => unknown>(f: T) => T }).cache ?? (<T,>(f: T) => f)) as <T extends (...a: never[]) => unknown>(f: T) => T;

const tokenId = (token: string) => createHash("sha256").update(token).digest("hex");

/** The current session (and signed-in user), or null. Read-only, so it is safe in any Server Component. */
export const getSession = memo(async (): Promise<PortalSession | null> => {
  let token: string | undefined;
  try {
    token = (await cookies()).get(COOKIE)?.value;
  } catch {
    return null;
  }
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const s = await loadSession(tokenId(token));
  if (s?.user?.is_demo) {
    let blocked = true; // a missing header counts as blocked: never fail open for a demo account
    try { blocked = (await headers()).get(BLOCK_DEMO_HEADER) !== "0"; } catch { /* outside a request */ }
    if (blocked) return { ...s, user: null, demoBlocked: true };
  }
  return s;
});

function parseData(v: unknown): Record<string, unknown> {
  if (v && typeof v === "object") return v as Record<string, unknown>;
  try { const j = JSON.parse(String(v ?? "{}")); return j && typeof j === "object" ? j : {}; } catch { return {}; }
}

export async function loadSession(id: string): Promise<PortalSession | null> {
  const row = await one<{
    id: string; csrf: string; data: Record<string, unknown>; last_seen_stale: boolean;
    uid: number | null; role: Role | null; email: string | null; name: string | null; email_verified_at: string | null; mfa_enabled_at: string | null; is_demo: number | null;
  }>(
    `SELECT s.id, s.csrf, s.data, (s.last_seen_at < NOW() - INTERVAL '5 minutes') AS last_seen_stale,
            u.id AS uid, u.role, u.email, u.name, u.email_verified_at, u.mfa_enabled_at, u.is_demo
       FROM portal_sessions s LEFT JOIN users u ON u.id = s.user_id
      WHERE s.id = $1 AND s.expires_at > NOW() AND s.last_seen_at > NOW() - make_interval(days => $2::int)`,
    [id, IDLE_DAYS],
  );
  if (!row) return null;
  if (row.last_seen_stale) await run("UPDATE portal_sessions SET last_seen_at = NOW() WHERE id = $1", [id]).catch(() => undefined);
  const user: PortalUser | null = row.uid
    ? { id: row.uid, role: row.role as Role, email: row.email as string, name: row.name as string, email_verified_at: row.email_verified_at, mfa_enabled_at: row.mfa_enabled_at, is_demo: Number(row.is_demo) === 1 }
    : null;
  return { id: row.id, csrf: row.csrf, data: parseData(row.data), user };
}

async function setCookie(token: string): Promise<void> {
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: LIFETIME_DAYS * 86400,
  });
}

/** Create a brand-new session (optionally for a user), delete the one the browser had, and set the cookie. Server Actions and route handlers only. */
export async function startSession(userId: number | null, data: Record<string, unknown> = {}): Promise<void> {
  const jar = await cookies();
  const old = jar.get(COOKIE)?.value;
  if (old && /^[a-f0-9]{64}$/.test(old)) await run("DELETE FROM portal_sessions WHERE id = $1", [tokenId(old)]);
  const token = randomBytes(32).toString("hex");
  const ip = sha256(await clientIp()).slice(0, 16);
  await run(
    `INSERT INTO portal_sessions (id, user_id, csrf, data, ip_hash, created_at, last_seen_at, expires_at)
     VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), NOW() + make_interval(days => $6::int))`,
    [tokenId(token), userId, randomBytes(16).toString("hex"), JSON.stringify(data), ip, LIFETIME_DAYS],
  );
  if (userId !== null) await run("UPDATE users SET last_login_at = NOW() WHERE id = $1", [userId]);
  await setCookie(token);
}

/** Read, change and write back a session's data atomically (the row is locked while it is changed). */
async function mergeData(id: string, change: (d: Record<string, unknown>) => Record<string, unknown>): Promise<void> {
  await tx(async (c) => {
    const r = await c.query("SELECT data FROM portal_sessions WHERE id = $1 FOR UPDATE", [id]);
    if (!r.rows[0]) return;
    await c.query("UPDATE portal_sessions SET data = $2 WHERE id = $1", [id, JSON.stringify(change(parseData(r.rows[0].data)))]);
  });
}

/** Merge values into the current session's data (creating an anonymous session when there is none). Server Actions and route handlers only. */
export async function putSessionData(patch: Record<string, unknown>): Promise<void> {
  const s = await getSession();
  if (!s) return startSession(null, patch);
  await mergeData(s.id, (d) => ({ ...d, ...patch }));
}

export async function dropSessionData(...keys: string[]): Promise<void> {
  const s = await getSession();
  if (!s) return;
  await mergeData(s.id, (d) => { const o = { ...d }; for (const k of keys) delete o[k]; return o; });
}

/** Log out: delete the session row and the cookie. */
export async function endSession(): Promise<void> {
  const jar = await cookies();
  const t = jar.get(COOKIE)?.value;
  if (t && /^[a-f0-9]{64}$/.test(t)) await run("DELETE FROM portal_sessions WHERE id = $1", [tokenId(t)]);
  jar.delete(COOKIE);
}

/** Sign out everywhere (after a password change or reset). */
export async function endAllSessions(userId: number): Promise<void> {
  await run("DELETE FROM portal_sessions WHERE user_id = $1", [userId]);
}

/** Housekeeping, safe to call occasionally. */
export async function purgeExpiredSessions(): Promise<number> {
  return run("DELETE FROM portal_sessions WHERE expires_at < NOW() OR last_seen_at < NOW() - make_interval(days => $1::int)", [IDLE_DAYS]);
}
