import { createHash } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }),
  headers: async () => new Headers({ "x-forwarded-for": "198.51.100.77", "x-forwarded-host": "growqr.test", "x-forwarded-proto": "https" }),
}));
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

/**
 * Provider sign-in and the built-in human check on a real database.
 *
 *   PORTAL_TEST_DATABASE_URL=mysql://root@127.0.0.1:3307/growqr_test DATABASE_SSL=disable npx vitest run lib/portal/oauth-db.test.ts
 */
const DB = process.env.PORTAL_TEST_DATABASE_URL;
describe.skipIf(!DB)("provider sign-in and the human check on a real database", () => {
  const tag = Math.random().toString(16).slice(2, 8);
  const mail = (n: string) => `${n}-${tag}@portal-test.invalid`;
  let db: typeof import("./db");
  let O: typeof import("./oauth-accounts");
  let auth: typeof import("./auth");
  let captcha: typeof import("./captcha");
  const ended: number[] = [];
  const endAll = async (id: number) => { ended.push(id); };
  const profile = (sub: string, email: string, verified = true) => ({ sub: `${tag}-${sub}`, email, emailVerified: verified, name: "Test Person", picture: null });

  beforeAll(async () => {
    process.env.DATABASE_URL = DB;
    process.env.PORTAL_APP_URL = "https://growqr.test";
    delete process.env.RESEND_API_KEY;
    db = await import("./db");
    O = await import("./oauth-accounts");
    auth = await import("./auth");
    captcha = await import("./captcha");
  });

  afterAll(async () => {
    if (!db) return;
    await db.run("DELETE FROM users WHERE email LIKE $1", [`%-${tag}@portal-test.invalid`]);
    await db.run("DELETE FROM mail_outbox WHERE to_email LIKE $1", [`%-${tag}@portal-test.invalid`]);
    await db.run("DELETE FROM auth_throttle WHERE bucket LIKE 'oauth:198.51.100.%' OR bucket LIKE 'pow%' OR bucket LIKE 'reg:198.51.100.%'");
  });

  it("creates a verified student on first sign-in and recognises the same provider account afterwards", async () => {
    const r = await O.signInWithProvider("google", profile("a", mail("new")), "student", "198.51.100.1", endAll);
    expect(r.ok && r.created).toBe(true);
    if (!r.ok) return;
    expect(r.user.role).toBe("student");
    expect(r.user.email_verified_at).not.toBeNull();
    expect(await db.val("SELECT college FROM student_profiles WHERE user_id = $1", [r.user.id])).toBe("");
    const again = await O.signInWithProvider("google", profile("a", mail("new")), "student", "198.51.100.1", endAll);
    expect(again.ok && !again.created && again.user.id === r.user.id).toBe(true);
  });

  it("never uses an email the provider has not verified", async () => {
    const r = await O.signInWithProvider("linkedin", profile("b", mail("unverified"), false), "student", "198.51.100.2", endAll);
    expect(r).toEqual({ ok: false, code: "oauth_email" });
    expect(await db.val("SELECT id FROM users WHERE email = $1", [mail("unverified")])).toBeNull();
  });

  it("only offers student, teacher and parent for new provider accounts", () => {
    expect(O.asOAuthRole("admin")).toBe("student");
    expect(O.asOAuthRole("employer")).toBe("student");
    expect(O.asOAuthRole("teacher")).toBe("teacher");
  });

  it("links an existing, verified password account without touching its password", async () => {
    const reg = await auth.register({ role: "student", name: "Linked", email: mail("linked"), password: "blue-kettle-orbit-nine", college: "X College" }, "198.51.100.3");
    if (!reg.ok) throw new Error(reg.error);
    await db.run("UPDATE users SET email_verified_at = NOW() WHERE id = $1", [reg.userId]);
    const before = await db.val<string>("SELECT password_hash FROM users WHERE id = $1", [reg.userId]);
    ended.length = 0;
    const r = await O.signInWithProvider("google", profile("c", mail("linked")), "student", "198.51.100.3", endAll);
    expect(r.ok && !r.created && r.user.id === reg.userId).toBe(true);
    expect(await db.val<string>("SELECT password_hash FROM users WHERE id = $1", [reg.userId])).toBe(before);
    expect(ended).toEqual([]);
    expect(Number(await db.val("SELECT COUNT(*) FROM oauth_identities WHERE user_id = $1", [reg.userId]))).toBe(1);
  });

  it("replaces the password and ends every session when it links an account whose email was never verified (pre-hijack defence)", async () => {
    const reg = await auth.register({ role: "student", name: "Squatter", email: mail("squat"), password: "blue-kettle-orbit-nine", college: "X College" }, "198.51.100.4");
    if (!reg.ok) throw new Error(reg.error);
    const before = await db.val<string>("SELECT password_hash FROM users WHERE id = $1", [reg.userId]);
    ended.length = 0;
    const r = await O.signInWithProvider("google", profile("d", mail("squat")), "student", "198.51.100.4", endAll);
    expect(r.ok).toBe(true);
    expect(ended).toEqual([reg.userId]);
    expect(await db.val<string>("SELECT password_hash FROM users WHERE id = $1", [reg.userId])).not.toBe(before);
    const login = await auth.attempt(mail("squat"), "blue-kettle-orbit-nine", "198.51.100.4");
    expect(login.ok).toBe(false); // the squatter's password no longer works
  });

  it("refuses staff accounts, which must use a password and a two-step code", async () => {
    const reg = await auth.register({ role: "student", name: "Staff", email: mail("staff"), password: "blue-kettle-orbit-nine", college: "X" }, "198.51.100.5");
    if (!reg.ok) throw new Error(reg.error);
    await db.run("UPDATE users SET role = 'counselor', email_verified_at = NOW() WHERE id = $1", [reg.userId]);
    expect(await O.signInWithProvider("google", profile("e", mail("staff")), "student", "198.51.100.5", endAll)).toEqual({ ok: false, code: "oauth_staff" });
  });

  it("limits provider sign-ins per network", async () => {
    for (let i = 0; i < 30; i++) await db.run("INSERT INTO auth_throttle (bucket, created_at) VALUES ('oauth:198.51.100.6', NOW())");
    expect(await O.signInWithProvider("google", profile("f", mail("limit")), "student", "198.51.100.6", endAll)).toEqual({ ok: false, code: "oauth_limit" });
  });

  it("accepts a proof-of-work solution once, and rejects tampered, expired or unsolved ones", async () => {
    delete process.env.TURNSTILE_SECRET_KEY;
    delete process.env.PORTAL_CAPTCHA;
    process.env.PORTAL_CAPTCHA = "pow"; // the picture code is the default; this checks the proof-of-work option
    expect(captcha.captchaMode()).toBe("pow");
    const { challenge, bits } = await captcha.powChallenge();
    const solve = (c: string, b: number) => { for (let n = 0; n < 5_000_000; n++) { const nonce = n.toString(36); if (captcha.leadingZeroBits(createHash("sha256").update(`${c}:${nonce}`).digest()) >= b) return nonce; } throw new Error("no nonce"); };
    const nonce = solve(challenge, bits);
    expect(await captcha.verifyPow(`${challenge}~${nonce}`)).toBe(true);
    expect(await captcha.verifyPow(`${challenge}~${nonce}`)).toBe(false); // already spent
    const second = await captcha.powChallenge();
    expect(await captcha.verifyPow(`${second.challenge}~zzzzzzzz`)).toBe(false); // not a solution
    const tampered = second.challenge.replace(/\.(\d+)\.[^.]+$/, ".$1.AAAA");
    expect(await captcha.verifyPow(`${tampered}~${solve(tampered, bits)}`)).toBe(false); // signature does not match
    const old = `${Date.now() - 11 * 60 * 1000}.abcdef0123456789abcdef01.${bits}`;
    expect(await captcha.verifyPow(`${old}.x~1`)).toBe(false);
  });

  it("checks the picture code: letters and numbers, case-insensitive, spent by its first attempt, and not forgeable", async () => {
    delete process.env.TURNSTILE_SECRET_KEY;
    delete process.env.PORTAL_CAPTCHA;
    expect(captcha.captchaMode()).toBe("image"); // the default
    const token = await captcha.imageChallenge();
    const code = (await captcha.imageCode(token)) as string;
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect((code.match(/[A-Z]/g) ?? []).length).toBe(4); // four letters
    expect((code.match(/[2-9]/g) ?? []).length).toBe(2); // two numbers
    expect(await captcha.verifyImage(token, code.toLowerCase().split("").join(" "))).toBe(true);
    expect(await captcha.verifyImage(token, code)).toBe(false); // already spent
    const second = await captcha.imageChallenge();
    expect(await captcha.verifyImage(second, "AAAAAA")).toBe(false); // wrong
    expect(await captcha.verifyImage(second, (await captcha.imageCode(second)) as string)).toBe(false); // and the wrong attempt spent it
    expect(await captcha.imageCode(`${token.slice(0, -2)}xx`)).toBeNull(); // tampered signature
    const body = `${Date.now() - 6 * 60 * 1000}.abcdef0123456789abcdef01`;
    expect(await captcha.imageCode(`${body}.AAAA`)).toBeNull(); // not signed by us, and too old
  });
});
