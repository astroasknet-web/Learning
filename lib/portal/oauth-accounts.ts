import { randomBytes } from "node:crypto";
import { one, run, tx } from "./db";
import { hashPassword } from "./password";
import { fails, recordFail, sha256 } from "./security";
import type { OAuthProfile, Provider } from "./oauth";
import type { PortalUser, Role } from "./session";

/**
 * Which portal account a provider sign-in belongs to. Rules, in order:
 *
 *  1. The provider account is already linked: that user signs in.
 *  2. The provider's verified email matches an existing account: link it, but never for staff (admin, counselor), who must use a
 *     password and two-step code. If that account's email was never verified, the password on it is replaced with an unusable
 *     one and every session is ended, so nobody who pre-registered with someone else's email keeps access (account pre-hijacking).
 *  3. Otherwise a new account is created (student, teacher or parent), already verified, with a random password nobody knows.
 *     The person can set a password later with "Forgot password".
 *
 * An email the provider does not mark verified is never used.
 */
export type OAuthResult = { ok: true; user: PortalUser; created: boolean } | { ok: false; code: "oauth_email" | "oauth_staff" | "oauth_limit" | "oauth_failed" };

export const OAUTH_ROLES = ["student", "teacher", "parent"] as const;
export type OAuthRole = (typeof OAUTH_ROLES)[number];
export const asOAuthRole = (s: unknown): OAuthRole => ((OAUTH_ROLES as readonly string[]).includes(String(s)) ? (s as OAuthRole) : "student");

const COLS = "id, role, email, name, email_verified_at, mfa_enabled_at";
const STAFF: Role[] = ["admin", "counselor"];

export async function signInWithProvider(provider: Provider, p: OAuthProfile, role: OAuthRole, ip: string, endAllSessions: (uid: number) => Promise<void>): Promise<OAuthResult> {
  if (!p.emailVerified) return { ok: false, code: "oauth_email" };
  const ipBucket = `oauth:${ip}`;
  if ((await fails(ipBucket)) >= 30) return { ok: false, code: "oauth_limit" };
  await recordFail(ipBucket);

  try {
    // 1. already linked
    const linked = await one<PortalUser>(`SELECT u.id, u.role, u.email, u.name, u.email_verified_at, u.mfa_enabled_at FROM oauth_identities o JOIN users u ON u.id = o.user_id WHERE o.provider = $1 AND o.subject = $2`, [provider, p.sub]);
    if (linked) {
      if (STAFF.includes(linked.role)) return { ok: false, code: "oauth_staff" };
      await run("UPDATE oauth_identities SET last_login_at = NOW(), picture = $3 WHERE provider = $1 AND subject = $2", [provider, p.sub, p.picture]);
      return { ok: true, user: linked, created: false };
    }

    // 2. an account with the same verified email
    const existing = await one<PortalUser>(`SELECT ${COLS} FROM users WHERE email = $1`, [p.email]);
    if (existing) {
      if (STAFF.includes(existing.role)) return { ok: false, code: "oauth_staff" };
      const wasUnverified = !existing.email_verified_at;
      await tx(async (c) => {
        await c.query("INSERT INTO oauth_identities (user_id, provider, subject, email, name, picture, created_at, last_login_at) VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW())", [existing.id, provider, p.sub, p.email, p.name, p.picture]);
        if (wasUnverified) {
          await c.query("UPDATE users SET password_hash = $1, email_verified_at = NOW() WHERE id = $2", [await hashPassword(randomBytes(32).toString("hex")), existing.id]);
        }
      });
      if (wasUnverified) await endAllSessions(existing.id);
      return { ok: true, user: { ...existing, email_verified_at: existing.email_verified_at ?? new Date().toISOString() }, created: false };
    }

    // 3. a new account
    const hash = await hashPassword(randomBytes(32).toString("hex"));
    const id = await tx(async (c) => {
      const r = await c.query<{ id: number }>("INSERT INTO users (role, email, password_hash, name, created_at, email_verified_at) VALUES ($1,$2,$3,$4,NOW(),NOW()) RETURNING id", [role, p.email, hash, p.name]);
      const uid = r.rows[0].id;
      if (role === "student") await c.query("INSERT INTO student_profiles (user_id, college) VALUES ($1,'')", [uid]);
      await c.query("INSERT INTO oauth_identities (user_id, provider, subject, email, name, picture, created_at, last_login_at) VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW())", [uid, provider, p.sub, p.email, p.name, p.picture]);
      return uid;
    });
    const user = await one<PortalUser>(`SELECT ${COLS} FROM users WHERE id = $1`, [id]);
    return user ? { ok: true, user, created: true } : { ok: false, code: "oauth_failed" };
  } catch (e) {
    console.error("[oauth] account resolution failed:", (e as Error).message, "email hash", sha256(p.email).slice(0, 8));
    return { ok: false, code: "oauth_failed" };
  }
}
