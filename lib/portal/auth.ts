import { randomBytes } from "node:crypto";
import { all, one, run, tx, val } from "./db";
import { decrypt, encrypt, recoveryHash } from "./crypto";
import * as mail from "./mail";
import { hashPassword, needsRehash, verifyPassword, weakPassword } from "./password";
import { WINDOW_MIN, clearFails, fails, recordFail, sha256 } from "./security";
import * as totp from "./totp";
import type { PortalUser, Role } from "./session";

/**
 * Account rules: registration, throttled login, two-step login (TOTP and recovery codes), email verification and password
 * reset. A port of Portal\Auth.php that works on the same tables, so existing accounts, password hashes and authenticator
 * enrolments carry over unchanged. Session handling is in ./session; these functions take the client IP as an argument and
 * never touch cookies, so they can be tested without a request.
 */
const MAX_FAILS_PER_ACCOUNT = 5;
const MAX_FAILS_PER_IP = 25;
const MFA_MAX_FAILS = 5;
const VERIFY_HOURS = 24;
const RESET_MINUTES = 60;
export const MFA_PENDING_SECONDS = 300;

/** Where each role lands after login. Their dashboards move into this app in later phases. */
export function homeFor(role: Role): string {
  return role === "teacher" ? "/teacher" : role === "parent" ? "/parent" : "/account";
}

export function mfaRequiredFor(u: { role: Role; is_demo?: boolean }): boolean {
  if (u.is_demo) return false; // a read-only demo login has nothing to protect that a real admin login would
  if (process.env.PORTAL_MFA_REQUIRE_STAFF === "false") return false;
  return u.role === "admin" || u.role === "counselor";
}

// ---- registration -------------------------------------------------------------------------------------------------

export type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

export interface RegisterInput {
  role: "student" | "employer" | "teacher" | "parent";
  name: string;
  email: string;
  password: string;
  college?: string;
  company?: string;
}

const PALETTE = ["#4338ca", "#0f766e", "#be185d", "#b45309", "#1d4ed8", "#7c3aed", "#0369a1", "#c2410c"];

export async function register(input: RegisterInput, ip: string): Promise<Result<{ userId: number }>> {
  const email = input.email.toLowerCase();
  const ipBucket = `reg:${ip}`;
  if ((await fails(ipBucket)) >= 10) return { ok: false, error: "Too many sign-ups from this network. Please try again later." };
  if ((await val("SELECT id FROM users WHERE email = $1", [email])) !== null) {
    await recordFail(ipBucket);
    return { ok: false, error: "An account with this email already exists. Try logging in." };
  }
  let uid: number;
  try {
    const hash = await hashPassword(input.password);
    uid = await tx(async (c) => {
      const r = await c.query<{ id: number }>("INSERT INTO users (role, email, password_hash, name, created_at) VALUES ($1,$2,$3,$4,NOW()) RETURNING id", [input.role, email, hash, input.name]);
      const id = r.rows[0].id;
      if (input.role === "student") {
        await c.query("INSERT INTO student_profiles (user_id, college) VALUES ($1,$2)", [id, input.college ?? ""]);
      } else if (input.role === "employer") {
        await c.query("INSERT INTO companies (owner_user_id, name, domain, verified, color, created_at) VALUES ($1,$2,$3,0,$4,NOW())", [
          id, input.company ?? "", email.slice(email.lastIndexOf("@") + 1), PALETTE[id % PALETTE.length],
        ]);
      }
      return id;
    });
  } catch (e) {
    console.error("[auth] register failed:", (e as Error).message);
    return { ok: false, error: "We could not create your account. Please try again." };
  }
  await recordFail(ipBucket); // counts sign-ups per IP too
  await mail.welcomeEmail({ email, name: input.name }, input.role, await issueVerification(uid));
  return { ok: true, userId: uid };
}

// ---- login --------------------------------------------------------------------------------------------------------

export type LoginUser = PortalUser;

export async function attempt(emailIn: string, password: string, ip: string): Promise<Result<{ user: LoginUser }>> {
  const email = emailIn.toLowerCase();
  const acct = `login:${sha256(email)}`;
  const ipb = `loginip:${ip}`;
  if ((await fails(acct)) >= MAX_FAILS_PER_ACCOUNT || (await fails(ipb)) >= MAX_FAILS_PER_IP) {
    return { ok: false, error: `Too many failed attempts. Please wait ${WINDOW_MIN} minutes and try again.` };
  }
  const u = await one<LoginUser & { password_hash: string }>("SELECT id, role, email, name, email_verified_at, mfa_enabled_at, password_hash FROM users WHERE email = $1", [email]);
  // Always run a hash check so response time does not reveal whether the email exists.
  const ok = await verifyPassword(password, u?.password_hash);
  if (!u || !ok) {
    await recordFail(acct);
    await recordFail(ipb);
    return { ok: false, error: "Incorrect email or password." };
  }
  if (needsRehash(u.password_hash)) await run("UPDATE users SET password_hash = $1 WHERE id = $2", [await hashPassword(password), u.id]);
  await clearFails(acct);
  const { password_hash: _drop, ...user } = u;
  return { ok: true, user };
}

// ---- two-step login -----------------------------------------------------------------------------------------------

/** The user a parked login belongs to, if the 5-minute window is still open. */
export async function pendingMfaUser(uid: number | null, startedAtMs: number | null): Promise<LoginUser | null> {
  if (!uid || !startedAtMs || Date.now() - startedAtMs > MFA_PENDING_SECONDS * 1000) return null;
  return one<LoginUser>("SELECT id, role, email, name, email_verified_at, mfa_enabled_at FROM users WHERE id = $1 AND mfa_enabled_at IS NOT NULL", [uid]);
}

/** Check a 6-digit app code or a one-time recovery code. Returns an error message, or null when the code is good. */
export async function checkMfaCode(uid: number, input: string): Promise<string | null> {
  const bucket = `mfa:${uid}`;
  if ((await fails(bucket)) >= MFA_MAX_FAILS) return `Too many wrong codes. Please wait ${WINDOW_MIN} minutes and try again.`;
  const u = await one<{ mfa_secret: string | null; mfa_recovery: string | null; mfa_last_step: number | null }>("SELECT mfa_secret, mfa_recovery, mfa_last_step FROM users WHERE id = $1", [uid]);
  const secret = u?.mfa_secret ? await decrypt(u.mfa_secret) : null;
  if (secret === null) return "Two-factor authentication is not set up for this account.";
  const clean = input.trim();
  if (/^\d{3}\s?\d{3}$/.test(clean)) {
    const step = totp.verify(secret, clean);
    if (step !== null && (u!.mfa_last_step === null || step > Number(u!.mfa_last_step))) { // a code can only be used once
      await run("UPDATE users SET mfa_last_step = $1 WHERE id = $2", [step, uid]);
      await clearFails(bucket);
      return null;
    }
  } else {
    const codes: string[] = safeJsonArray(u!.mfa_recovery);
    const h = await recoveryHash(clean.replace(/[^a-z0-9]/gi, "").toLowerCase());
    const i = codes.indexOf(h);
    if (i !== -1) {
      codes.splice(i, 1);
      await run("UPDATE users SET mfa_recovery = $1 WHERE id = $2", [JSON.stringify(codes), uid]);
      await clearFails(bucket);
      return null;
    }
  }
  await recordFail(bucket);
  return "That code is not correct. Check your authenticator app, or use a recovery code.";
}

function safeJsonArray(s: string | null): string[] {
  try {
    const v = JSON.parse(s ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** Turn two-step login on once the user has proved they hold the secret. Returns the one-time recovery codes (shown once). */
export async function enableMfa(uid: number, secret: string): Promise<string[]> {
  const plain: string[] = [];
  const hashes: string[] = [];
  for (let i = 0; i < 8; i++) {
    const c = randomBytes(5).toString("hex");
    plain.push(`${c.slice(0, 5)}-${c.slice(5)}`);
    hashes.push(await recoveryHash(c));
  }
  await run("UPDATE users SET mfa_secret = $1, mfa_enabled_at = NOW(), mfa_recovery = $2, mfa_last_step = $3 WHERE id = $4", [await encrypt(secret), JSON.stringify(hashes), Math.floor(Date.now() / 30000), uid]);
  return plain;
}

export async function disableMfa(uid: number): Promise<void> {
  await run("UPDATE users SET mfa_secret = NULL, mfa_enabled_at = NULL, mfa_recovery = NULL, mfa_last_step = NULL WHERE id = $1", [uid]);
}

export async function verifyPasswordFor(uid: number, password: string): Promise<boolean> {
  const h = await val<string>("SELECT password_hash FROM users WHERE id = $1", [uid]);
  return Boolean(h) && (await verifyPassword(password, h));
}

// ---- email verification -------------------------------------------------------------------------------------------

export const isVerified = (u: { email_verified_at?: string | null } | null): boolean => !!u?.email_verified_at;

/** A fresh verification token (older unused ones are voided). Returns the raw token for the email. */
export async function issueVerification(uid: number): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await run("UPDATE email_verifications SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL", [uid]);
  await run("INSERT INTO email_verifications (user_id, token_hash, expires_at, created_at) VALUES ($1,$2, NOW() + make_interval(hours => $3::int), NOW())", [uid, sha256(token), VERIFY_HOURS]);
  return token;
}

/** The user a still-valid token belongs to, or null. Does not consume the token. */
export async function userForVerifyToken(token: string): Promise<{ id: number; email: string; name: string; email_verified_at: string | null } | null> {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  return one("SELECT u.id, u.email, u.name, u.email_verified_at FROM email_verifications v JOIN users u ON u.id = v.user_id WHERE v.token_hash = $1 AND v.used_at IS NULL AND v.expires_at > NOW()", [sha256(token)]);
}

export async function confirmVerification(token: string): Promise<{ id: number; email: string; name: string } | null> {
  const u = await userForVerifyToken(token);
  if (!u) return null;
  await run("UPDATE users SET email_verified_at = COALESCE(email_verified_at, NOW()) WHERE id = $1", [u.id]);
  await run("UPDATE email_verifications SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL", [u.id]);
  return u;
}

/** Re-send the verification email (max 3 per hour per account). Returns an error message, or null. */
export async function resendVerification(u: { id: number; email: string; name: string; email_verified_at?: string | null }): Promise<string | null> {
  if (isVerified(u)) return null;
  const bucket = `verify:${u.id}`;
  if ((await fails(bucket, 60)) >= 3) return "You have requested several emails. Please wait an hour or check your spam folder.";
  await recordFail(bucket);
  await mail.verifyEmail({ email: u.email, name: u.name }, await issueVerification(u.id));
  return null;
}

// ---- password reset -----------------------------------------------------------------------------------------------

/** Start a reset. Always silent for the caller (never reveals whether the email exists); rate-limited per email and per IP. */
export async function requestReset(emailIn: string, ip: string): Promise<void> {
  const email = emailIn.trim().toLowerCase();
  const eb = `reset:${sha256(email)}`;
  const ib = `resetip:${ip}`;
  if ((await fails(eb)) >= 3 || (await fails(ib)) >= 10) return;
  await recordFail(eb);
  await recordFail(ib);
  const u = await one<{ id: number; email: string; name: string }>("SELECT id, email, name FROM users WHERE email = $1", [email]);
  if (!u) return;
  const token = randomBytes(32).toString("hex");
  await run("UPDATE password_resets SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL", [u.id]); // one live link at a time
  await run("INSERT INTO password_resets (user_id, token_hash, expires_at, created_at) VALUES ($1,$2, NOW() + make_interval(mins => $3::int), NOW())", [u.id, sha256(token), RESET_MINUTES]);
  await mail.resetRequested({ email: u.email, name: u.name }, token, RESET_MINUTES);
}

export async function userForResetToken(token: string): Promise<{ id: number; email: string; name: string } | null> {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  return one("SELECT u.id, u.email, u.name FROM password_resets r JOIN users u ON u.id = r.user_id WHERE r.token_hash = $1 AND r.used_at IS NULL AND r.expires_at > NOW()", [sha256(token)]);
}

export async function completeReset(token: string, password: string): Promise<Result<{ userId: number }>> {
  const u = await userForResetToken(token);
  if (!u) return { ok: false, error: "This reset link is invalid or has expired. Request a new one." };
  const why = weakPassword(password, u.email, u.name);
  if (why) return { ok: false, error: why };
  try {
    const hash = await hashPassword(password);
    await tx(async (c) => {
      await c.query("UPDATE users SET password_hash = $1 WHERE id = $2", [hash, u.id]);
      await c.query("UPDATE password_resets SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL", [u.id]);
    });
  } catch {
    return { ok: false, error: "We could not update your password. Please try again." };
  }
  await clearFails(`login:${sha256(u.email.toLowerCase())}`); // unlock the account
  await mail.passwordChanged({ email: u.email, name: u.name });
  return { ok: true, userId: u.id };
}

/** For admin tools and tests. */
export async function userByEmail(email: string): Promise<LoginUser | null> {
  return one<LoginUser>("SELECT id, role, email, name, email_verified_at, mfa_enabled_at FROM users WHERE email = $1", [email.toLowerCase()]);
}

export async function listStaff(): Promise<Array<{ id: number; name: string; email: string; role: Role }>> {
  return all("SELECT id, name, email, role FROM users WHERE role IN ('admin','counselor') ORDER BY name");
}
