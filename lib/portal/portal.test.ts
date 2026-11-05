import { execFileSync } from "node:child_process";
import { createCipheriv, createHmac, randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Accounts: unit tests that need nothing (password policy, TOTP, encryption, safe redirects), compatibility checks against
 * the original PHP code, and an end-to-end run on a real database: sign-up, verification mail, throttled login, two-step
 * login (with replay protection and recovery codes), password reset, and sessions.
 *
 * The database part runs only when PORTAL_TEST_DATABASE_URL is set (a throwaway database that already holds the portal schema,
 * for example the local PGlite one). Example:
 *   PORTAL_TEST_DATABASE_URL=mysql://root@127.0.0.1:3307/growqr_test npx vitest run lib/portal
 */

// A tiny in-memory stand-in for the request cookie jar and headers.
const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (n: string) => (jar.has(n) ? { name: n, value: jar.get(n)! } : undefined),
    set: (n: string, v: string) => void jar.set(n, v),
    delete: (n: string) => void jar.delete(n),
  }),
  headers: async () => new Headers({ "x-real-ip": "203.0.113.7" }),
}));

import * as crypto from "./crypto";
import * as password from "./password";
import * as totp from "./totp";
import { safeNext, clientIpFrom } from "./security";

const PHP_ENGINE = path.resolve(__dirname, "../../../qrscore");
const havePhp = (() => {
  try {
    execFileSync("php", ["-v"], { stdio: "ignore" });
    return existsSync(path.join(PHP_ENGINE, "autoload.php"));
  } catch {
    return false;
  }
})();
const php = (code: string): string => execFileSync("php", ["-r", `require '${PHP_ENGINE.replace(/\\/g, "/")}/autoload.php'; ${code}`], { encoding: "utf8" }).trim();

describe("password policy and hashes", () => {
  it("rejects weak passwords with the same reasons as the PHP app", () => {
    expect(password.weakPassword("short")).toMatch(/at least 8/);
    expect(password.weakPassword("password123")).toMatch(/too easy/);
    expect(password.weakPassword("aaaaaaaaa")).toMatch(/too easy/);
    expect(password.weakPassword("riyasharma-2026", "riya.sharma@x.com", "Riya Sharma")).toMatch(/name/);
    expect(password.weakPassword("blue-kettle-orbit-nine")).toBeNull();
    expect(password.weakPassword("x".repeat(129))).toMatch(/128/);
  });

  it("hashes in bcrypt format and verifies", async () => {
    const h = await password.hashPassword("blue-kettle-orbit-nine");
    expect(h).toMatch(/^\$2[aby]\$10\$/);
    expect(await password.verifyPassword("blue-kettle-orbit-nine", h)).toBe(true);
    expect(await password.verifyPassword("wrong", h)).toBe(false);
    expect(await password.verifyPassword("anything", undefined)).toBe(false); // unknown email: still does the work, never succeeds
  });

  it.skipIf(!havePhp)("accepts hashes made by PHP and PHP accepts ours", async () => {
    const fromPhp = php(`echo password_hash('Correct-Horse-9', PASSWORD_DEFAULT);`);
    expect(await password.verifyPassword("Correct-Horse-9", fromPhp)).toBe(true);
    const ours = await password.hashPassword("Node-Made-1");
    expect(php(`echo password_verify('Node-Made-1', '${ours}') ? 'yes' : 'no';`)).toBe("yes");
  });
});

describe("two-step codes (TOTP)", () => {
  const secret = "JBSWY3DPEHPK3PXP";
  it("matches RFC 6238 style behaviour", () => {
    const now = 1_700_000_000;
    const step = Math.floor(now / 30);
    expect(totp.verify(secret, totp.code(secret, step), now)).toBe(step);
    expect(totp.verify(secret, totp.code(secret, step + 1), now)).toBe(step + 1); // one step of clock drift is allowed
    expect(totp.verify(secret, totp.code(secret, step + 3), now)).toBeNull();
    expect(totp.verify(secret, "12345", now)).toBeNull();
    expect(totp.verify(secret, totp.code(secret, step).replace(/(\d{3})(\d{3})/, "$1 $2"), now)).toBe(step);
  });
  it("makes valid new secrets and an authenticator link", () => {
    const s = totp.newSecret();
    expect(s).toMatch(/^[A-Z2-7]{32}$/);
    expect(totp.uri(s, "a@b.co")).toContain("otpauth://totp/GrowQR%3Aa%40b.co?secret=" + s);
  });
  it.skipIf(!havePhp)("produces the same codes as the PHP implementation", () => {
    for (const step of [1, 56_666_666, 56_666_667, 99_999_999]) {
      expect(totp.code(secret, step)).toBe(php(`echo QrScore\\Portal\\Totp::code('${secret}', ${step});`));
    }
  });
});

describe("encryption at rest", () => {
  it("round-trips and rejects tampering", () => {
    const blob = crypto.encryptWith("app-secret", "JBSWY3DPEHPK3PXP");
    expect(crypto.decryptWith("app-secret", blob)).toBe("JBSWY3DPEHPK3PXP");
    expect(crypto.decryptWith("other-secret", blob)).toBeNull();
    const raw = Buffer.from(blob, "base64");
    raw[raw.length - 1] ^= 1;
    expect(crypto.decryptWith("app-secret", raw.toString("base64"))).toBeNull();
    expect(crypto.decryptWith("app-secret", "not base64 at all")).toBeNull();
  });
  it.skipIf(!havePhp)("reads values written by the PHP app and the other way round", () => {
    // The PHP class derives its key and layout exactly like this (openssl aes-256-gcm, iv+tag+ct, HMAC key "enc-v1").
    const secret = "0123456789abcdef0123456789abcdef";
    const key = createHmac("sha256", secret).update("enc-v1").digest();
    const iv = randomBytes(12);
    const c = createCipheriv("aes-256-gcm", key, iv);
    const ct = Buffer.concat([c.update("php-wrote-this", "utf8"), c.final()]);
    expect(crypto.decryptWith(secret, Buffer.concat([iv, c.getAuthTag(), ct]).toString("base64"))).toBe("php-wrote-this");
    const ours = crypto.encryptWith(secret, "node-wrote-this");
    const out = php(`
      $raw = base64_decode('${ours}', true);
      $key = hash_hmac('sha256', 'enc-v1', '${secret}', true);
      echo openssl_decrypt(substr($raw, 28), 'aes-256-gcm', $key, OPENSSL_RAW_DATA, substr($raw, 0, 12), substr($raw, 12, 16));`);
    expect(out).toBe("node-wrote-this");
  });
});

describe("redirect safety and client address", () => {
  it("only lets same-site paths through after login", () => {
    expect(safeNext("/account", "/x")).toBe("/account");
    expect(safeNext("/student/dashboard?tab=2", "/x")).toBe("/student/dashboard?tab=2");
    for (const bad of ["//evil.com", "https://evil.com", "/\\evil.com", "javascript:alert(1)", "evil.com", "", "/a/../../b:c", "/%0d%0aSet-Cookie:x"]) {
      expect(safeNext(bad, "/x"), bad).toBe("/x");
    }
  });
  it("reads the client address from the proxy headers", () => {
    const h = (o: Record<string, string>) => ({ get: (k: string) => o[k] ?? null });
    expect(clientIpFrom(h({ "x-real-ip": "1.2.3.4" }))).toBe("1.2.3.4");
    expect(clientIpFrom(h({ "x-forwarded-for": "5.6.7.8, 10.0.0.1" }))).toBe("5.6.7.8");
    expect(clientIpFrom(h({}))).toBe("0.0.0.0");
  });
});

describe("staff rules", () => {
  it("requires two-step login for admins and counsellors only, unless switched off for a developer machine", async () => {
    const { mfaRequiredFor, homeFor } = await import("./auth");
    delete process.env.PORTAL_MFA_REQUIRE_STAFF;
    expect(mfaRequiredFor({ role: "admin" })).toBe(true);
    expect(mfaRequiredFor({ role: "counselor" })).toBe(true);
    expect(mfaRequiredFor({ role: "student" })).toBe(false);
    expect(mfaRequiredFor({ role: "employer" })).toBe(false);
    process.env.PORTAL_MFA_REQUIRE_STAFF = "false";
    expect(mfaRequiredFor({ role: "admin" })).toBe(false);
    delete process.env.PORTAL_MFA_REQUIRE_STAFF;
    expect(homeFor("student")).toBe("/account");
  });
});

// ---------------------------------------------------------------------------------------------------------------------
const DB = process.env.PORTAL_TEST_DATABASE_URL;

describe.skipIf(!DB)("accounts on a real database", () => {
  const tag = randomBytes(3).toString("hex");
  const email = `st-${tag}@portal-test.invalid`;
  const goodPw = "blue-kettle-orbit-nine";
  const ip = "198.51.100." + (1 + (parseInt(tag, 16) % 200));
  let auth: typeof import("./auth");
  let db: typeof import("./db");
  let sec: typeof import("./security");
  let sess: typeof import("./session");
  let uid = 0;

  beforeAll(async () => {
    process.env.DATABASE_URL = DB;
    delete process.env.RESEND_API_KEY; // mail is logged, never sent
    db = await import("./db");
    sec = await import("./security");
    sess = await import("./session");
    auth = await import("./auth");
    const { runPortalMigrations } = await import("./migrate");
    await runPortalMigrations(DB as string);
    crypto.resetSecretCache();
  });

  afterAll(async () => {
    if (!db) return;
    await db.run("DELETE FROM users WHERE email LIKE $1", [`%${tag}@portal-test.invalid`]);
    await db.run("DELETE FROM auth_throttle WHERE bucket LIKE $1 OR bucket LIKE $2 OR bucket LIKE $3", [`%${ip}`, `reg:${ip}`, `login:%`]).catch(() => undefined);
    await db.run("DELETE FROM mail_outbox WHERE to_email LIKE $1", [`%${tag}@portal-test.invalid`]);
    await db.closePool();
  });

  it("registers a student, creates the profile and sends a verification mail", async () => {
    expect((await auth.register({ role: "student", name: "Riya Test", email, password: goodPw, college: "Test College" }, ip)).ok).toBe(true);
    const u = await auth.userByEmail(email);
    expect(u?.role).toBe("student");
    uid = u!.id;
    expect(await db.val("SELECT college FROM student_profiles WHERE user_id = $1", [uid])).toBe("Test College");
    const dup = await auth.register({ role: "student", name: "Riya Test", email: email.toUpperCase(), password: goodPw }, ip);
    expect(dup.ok).toBe(false);
    const mails = await db.all<{ subject: string; status: string; html: string }>("SELECT subject, status, html FROM mail_outbox WHERE to_email = $1", [email]);
    expect(mails.length).toBe(1);
    expect(mails[0].subject).toMatch(/Confirm your email/);
    expect(["logged", "pending"]).toContain(mails[0].status);
    expect(mails[0].html).toMatch(/verify-email\?token=[a-f0-9]{64}/);
  });

  it("registers an employer with a company row", async () => {
    const e2 = `emp-${tag}@portal-test.invalid`;
    const r = await auth.register({ role: "employer", name: "Em Ployer", email: e2, password: goodPw, company: "Acme Pvt Ltd" }, ip);
    expect(r.ok).toBe(true);
    if (r.ok) expect(await db.val("SELECT name FROM companies WHERE owner_user_id = $1", [r.userId])).toBe("Acme Pvt Ltd");
  });

  it("confirms an email once and rejects bad or reused tokens", async () => {
    const token = await auth.issueVerification(uid);
    expect(await auth.userForVerifyToken("zz")).toBeNull();
    expect((await auth.userForVerifyToken(token))?.id).toBe(uid);
    expect((await auth.confirmVerification(token))?.id).toBe(uid);
    expect(await auth.confirmVerification(token)).toBeNull();
    expect(auth.isVerified(await auth.userByEmail(email))).toBe(true);
    // re-sending is capped at three an hour
    const u = { id: uid, email, name: "Riya Test", email_verified_at: null };
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await auth.resendVerification(u));
    expect(results.slice(0, 3).every((r) => r === null)).toBe(true);
    expect(results[3]).toMatch(/several emails/);
  });

  it("logs in with the right password and throttles wrong ones", async () => {
    const bad = await auth.attempt(email, "wrong-password-1", ip);
    expect(bad).toEqual({ ok: false, error: "Incorrect email or password." });
    expect((await auth.attempt("nobody-" + tag + "@portal-test.invalid", "x", ip)).ok).toBe(false); // unknown email: same message
    const good = await auth.attempt(email, goodPw, ip);
    expect(good.ok).toBe(true);
    for (let i = 0; i < 5; i++) await auth.attempt(email, "wrong-again-" + i, ip);
    const locked = await auth.attempt(email, goodPw, ip);
    expect(locked.ok).toBe(false);
    if (!locked.ok) expect(locked.error).toMatch(/Too many failed attempts/);
    await sec.clearFails(`login:${sec.sha256(email)}`);
    expect((await auth.attempt(email, goodPw, ip)).ok).toBe(true);
  });

  it("upgrades a PHP-style hash that is below the current cost", async () => {
    await db.run("UPDATE users SET password_hash = $1 WHERE id = $2", [await (await import("bcryptjs")).default.hash(goodPw, 4), uid]);
    expect((await auth.attempt(email, goodPw, ip)).ok).toBe(true);
    expect(await db.val<string>("SELECT password_hash FROM users WHERE id = $1", [uid])).toMatch(/^\$2[aby]\$10\$/);
  });

  it("runs two-step login: enrol, code once only, recovery code once only, lockout, disable", async () => {
    const secret = totp.newSecret();
    const recovery = await auth.enableMfa(uid, secret);
    expect(recovery).toHaveLength(8);
    expect(recovery[0]).toMatch(/^[0-9a-f]{5}-[0-9a-f]{5}$/);
    const stored = await db.val<string>("SELECT mfa_secret FROM users WHERE id = $1", [uid]);
    expect(stored).not.toContain(secret); // encrypted at rest
    expect(await crypto.decrypt(stored!)).toBe(secret);

    const step = Math.floor(Date.now() / 30000) + 1; // enrol marks the current step as used, so the next one is the first valid code
    expect(await auth.checkMfaCode(uid, totp.code(secret, step))).toBeNull();
    expect(await auth.checkMfaCode(uid, totp.code(secret, step))).toMatch(/not correct/); // replay refused

    expect(await auth.checkMfaCode(uid, recovery[0])).toBeNull();
    expect(await auth.checkMfaCode(uid, recovery[0])).toMatch(/not correct/); // each recovery code works once
    expect(await auth.checkMfaCode(uid, recovery[1].toUpperCase())).toBeNull(); // case and the dash do not matter

    await sec.clearFails(`mfa:${uid}`);
    for (let i = 0; i < 5; i++) await auth.checkMfaCode(uid, "000000");
    expect(await auth.checkMfaCode(uid, recovery[2])).toMatch(/Too many wrong codes/);
    await sec.clearFails(`mfa:${uid}`);

    expect(await auth.pendingMfaUser(uid, Date.now())).not.toBeNull();
    expect(await auth.pendingMfaUser(uid, Date.now() - 6 * 60_000)).toBeNull(); // the parked login expires
    await auth.disableMfa(uid);
    expect(await auth.pendingMfaUser(uid, Date.now())).toBeNull();
  });

  it("reads an authenticator secret that the PHP app encrypted", async () => {
    if (!havePhp) return;
    const secret = "JBSWY3DPEHPK3PXP";
    const key = createHmac("sha256", await crypto.appSecret()).update("enc-v1").digest();
    const iv = randomBytes(12);
    const c = createCipheriv("aes-256-gcm", key, iv);
    const ct = Buffer.concat([c.update(secret, "utf8"), c.final()]);
    await db.run("UPDATE users SET mfa_secret = $1, mfa_enabled_at = NOW(), mfa_last_step = 0 WHERE id = $2", [Buffer.concat([iv, c.getAuthTag(), ct]).toString("base64"), uid]);
    const step = Math.floor(Date.now() / 30000);
    expect(await auth.checkMfaCode(uid, totp.code(secret, step))).toBeNull();
    await auth.disableMfa(uid);
  });

  it("resets a password with a single-use, expiring link", async () => {
    await sec.clearFails(`reset:${sec.sha256(email)}`);
    await auth.requestReset("nobody@portal-test.invalid", ip); // silent for unknown emails
    await auth.requestReset(email, ip);
    const row = await db.one<{ html: string }>("SELECT html FROM mail_outbox WHERE to_email = $1 AND kind = 'reset' ORDER BY id DESC LIMIT 1", [email]);
    const token = /reset-password\?token=([a-f0-9]{64})/.exec(row!.html)![1];
    expect(await auth.userForResetToken(token)).not.toBeNull();
    expect((await auth.completeReset(token, "password123")) as { ok: false; error: string }).toMatchObject({ ok: false });
    const newPw = "green-lantern-river-42";
    expect((await auth.completeReset(token, newPw)).ok).toBe(true);
    expect((await auth.completeReset(token, newPw)).ok).toBe(false); // used
    expect((await auth.attempt(email, goodPw, ip)).ok).toBe(false);
    expect((await auth.attempt(email, newPw, ip)).ok).toBe(true);
    expect(await db.val("SELECT COUNT(*) FROM mail_outbox WHERE to_email = $1 AND kind = 'password_changed'", [email])).toBe(1);
    // an expired link is refused
    await auth.requestReset(email, ip + "x");
    await db.run("UPDATE password_resets SET expires_at = NOW() - INTERVAL '1 minute' WHERE user_id = $1 AND used_at IS NULL", [uid]);
    const row2 = await db.one<{ html: string }>("SELECT html FROM mail_outbox WHERE to_email = $1 AND kind = 'reset' ORDER BY id DESC LIMIT 1", [email]);
    expect(await auth.userForResetToken(/token=([a-f0-9]{64})/.exec(row2!.html)![1])).toBeNull();
  });

  it("issues, reads, rotates and ends sessions", async () => {
    jar.clear();
    expect(await sess.getSession()).toBeNull();
    await sess.startSession(uid);
    const token = jar.get(sess.COOKIE)!;
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    const s1 = await sess.loadSession(sec.sha256(token));
    expect(s1?.user?.email).toBe(email);
    expect(await db.val("SELECT COUNT(*) FROM portal_sessions WHERE id = $1", [token])).toBe(0); // only the hash is stored
    expect(await db.val("SELECT COUNT(*) FROM portal_sessions WHERE id = $1", [sec.sha256(token)])).toBe(1);

    await sess.startSession(uid); // logging in again rotates: the old token stops working
    expect(await sess.loadSession(sec.sha256(token))).toBeNull();
    const t2 = jar.get(sess.COOKIE)!;
    expect(t2).not.toBe(token);

    await sess.putSessionData({ mfa_setup_secret: "ABC" });
    expect((await sess.loadSession(sec.sha256(t2)))?.data).toMatchObject({ mfa_setup_secret: "ABC" });
    await sess.dropSessionData("mfa_setup_secret");
    expect((await sess.loadSession(sec.sha256(t2)))?.data).toEqual({});

    await db.run("UPDATE portal_sessions SET expires_at = NOW() - INTERVAL '1 second' WHERE id = $1", [sec.sha256(t2)]);
    expect(await sess.loadSession(sec.sha256(t2))).toBeNull(); // absolute expiry
    await sess.startSession(uid);
    await db.run("UPDATE portal_sessions SET last_seen_at = NOW() - INTERVAL '8 days' WHERE user_id = $1", [uid]);
    expect(await sess.loadSession(sec.sha256(jar.get(sess.COOKIE)!))).toBeNull(); // idle expiry
    await sess.startSession(uid);
    await sess.endSession();
    expect(jar.has(sess.COOKIE)).toBe(false);
    expect(await db.val("SELECT COUNT(*) FROM portal_sessions WHERE user_id = $1", [uid])).toBe(0);
  });
});
