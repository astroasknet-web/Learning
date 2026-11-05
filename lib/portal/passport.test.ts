import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Skill Passport: signing keys, credentials, public verification, publishing, withdrawing and view counting, on a real database.
 * Cross-checks against the ORIGINAL PHP code: a credential signed by PHP must verify here and the other way round, and both
 * must derive the same signing key from the same seed.
 *
 *   PORTAL_TEST_DATABASE_URL=mysql://root@127.0.0.1:3307/growqr_test npx vitest run lib/portal/passport.test.ts
 * (PHP needs PHPRC pointing at an ini with pdo_pgsql; without PHP the cross-checks are skipped.)
 */
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }),
  headers: async () => new Headers({ "x-forwarded-host": "growqr.test", "x-forwarded-proto": "https" }),
}));

import { isBot, referrerHost, visitorHash } from "./tracker";

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 }); // PHP is started a few times, and the local database is slow

describe("analytics helpers", () => {
  it("ignores bots and hashes visitors per day without storing IP or agent", () => {
    expect(isBot("")).toBe(true);
    expect(isBot("Mozilla/5.0 (compatible; Googlebot/2.1)")).toBe(true);
    expect(isBot("WhatsApp/2.23")).toBe(true);
    expect(isBot("Mozilla/5.0 (Windows NT 10.0) Chrome/120 Safari/537.36")).toBe(false);
    const a = visitorHash("1.2.3.4", "UA", "2026-10-07");
    expect(a).toMatch(/^[0-9a-f]{20}$/);
    expect(visitorHash("1.2.3.4", "UA", "2026-10-08")).not.toBe(a);
    expect(a).not.toContain("1.2.3.4");
  });
  it("reduces a referrer to its external host", () => {
    expect(referrerHost("https://www.linkedin.com/in/x", "growqr.test")).toBe("linkedin.com");
    expect(referrerHost("https://growqr.test/a", "growqr.test")).toBe("");
    expect(referrerHost("not a url", "growqr.test")).toBe("");
  });
});

const DB = process.env.PORTAL_TEST_DATABASE_URL;
const PHP_ROOT = path.resolve(__dirname, "../../../qrscore");
const phpOk = (() => {
  try {
    return existsSync(path.join(PHP_ROOT, "autoload.php")) && execFileSync("php", ["-r", "echo extension_loaded('pdo_pgsql') && function_exists('sodium_crypto_sign_detached') ? 'y' : 'n';"], { encoding: "utf8" }) === "y";
  } catch {
    return false;
  }
})();
const php = (code: string): string =>
  execFileSync(
    "php",
    ["-r", `require '${PHP_ROOT.replace(/\\/g, "/")}/autoload.php'; QrScore\\Portal\\Db::init((array) require '${PHP_ROOT.replace(/\\/g, "/")}/config.php', '${PHP_ROOT.replace(/\\/g, "/")}'); ${code}`],
    { encoding: "utf8" },
  ).trim();

describe.skipIf(!DB)("passport on a real database", () => {
  const tag = Math.random().toString(16).slice(2, 8);
  const email = `pp-${tag}@portal-test.invalid`;
  let uid = 0;
  let pcm: typeof import("./passport/credential");
  let share: typeof import("./passport/share");
  let prof: typeof import("./passport/profile");
  let resumes: typeof import("./passport/resumes");
  let db: typeof import("./db");
  let engine: typeof import("../qrscore");
  const tmp = mkdtempSync(path.join(os.tmpdir(), "pp-"));

  beforeAll(async () => {
    process.env.DATABASE_URL = DB;
    process.env.PORTAL_APP_URL = "https://growqr.test";
    delete process.env.RESEND_API_KEY;
    // Use the very seed PHP uses, so both engines hold the same signing key.
    if (phpOk) {
      php("QrScore\\Portal\\PassportCredential::key();"); // makes sure the seed file exists
      process.env.PASSPORT_SIGNING_SEED = readFileSync(path.join(PHP_ROOT, "storage/passport-signing.key"), "utf8").trim();
    } else {
      process.env.PASSPORT_SIGNING_SEED = "test-seed-".padEnd(40, "x");
    }
    db = await import("./db");
    pcm = await import("./passport/credential");
    share = await import("./passport/share");
    prof = await import("./passport/profile");
    resumes = await import("./passport/resumes");
    engine = await import("../qrscore");
    const auth = await import("./auth");
    const r = await auth.register({ role: "student", name: "Priya Sharma", email, password: "blue-kettle-orbit-nine", college: "Delhi Test College" }, "198.51.100.77");
    if (!r.ok) throw new Error(r.error);
    uid = r.userId;
    engine.setNowYear(new Date().getFullYear());
  });

  afterAll(async () => {
    if (!db) return;
    await db.run("DELETE FROM users WHERE email LIKE $1", [`%${tag}@portal-test.invalid`]);
    await db.run("DELETE FROM mail_outbox WHERE to_email LIKE $1", [`%${tag}@portal-test.invalid`]);
    await db.run("DELETE FROM auth_throttle WHERE bucket = 'reg:198.51.100.77'");
    rmSync(tmp, { recursive: true, force: true });
    await db.closePool();
  });

  const resumeText = () => readFileSync(path.resolve(__dirname, "../qrscore/__fixtures__/resume--resume-01-rahul-sharma.txt"), "utf8");

  it("derives a stable key and publishes it", async () => {
    const k = pcm.signer();
    expect(k.kid).toMatch(/^[A-Za-z0-9_-]{12}$/);
    expect(k.pub).toHaveLength(32);
    expect(await pcm.ensureKeyPublished()).toBe(k.kid);
    expect((await pcm.publicKeys()).get(k.kid)).toEqual(k.pub);
    const did = await pcm.didDocument();
    expect(did.id).toBe("did:web:growqr.test");
    expect(JSON.stringify(did)).toContain(k.kid);
    expect(((await pcm.jwks()).keys as Array<{ kid: string }>).some((x) => x.kid === k.kid)).toBe(true);
  });

  it.skipIf(!phpOk)("derives the SAME key as the PHP app from the same seed", async () => {
    expect(php("echo QrScore\\Portal\\PassportCredential::key()['kid'];")).toBe(pcm.signer().kid);
  });

  it("scores a resume, saves it, and refuses a non-resume", async () => {
    const r = engine.scoreText(resumeText());
    expect(engine.isScored(r)).toBe(true);
    if (!engine.isScored(r)) return;
    await prof.saveResult(uid, r, "resume.txt", resumeText());
    await resumes.saveAccepted(uid, r, resumeText(), { name: "resume.txt", mime: "text/plain", size: 100 });
    const p = await prof.profile(uid);
    expect(Number(p?.rq_overall)).toBeCloseTo(r.overall.score, 1);
    expect(p?.skills.length).toBeGreaterThan(0);
    expect((await resumes.forUser(uid))[0].is_current).toBe(1);
    const bad = engine.scoreText("Invoice no 123. Bill to: ACME. Amount due: 500. GSTIN 22AAAAA0000A1Z5. Grand total 500. Tax invoice.".repeat(8));
    expect(engine.isScored(bad)).toBe(false);
    if (!engine.isScored(bad)) await resumes.recordRejection(uid, "invoice.pdf", bad.gate, "pdf", "198.51.100.77");
  });

  it("keeps a limited resume history and promotes the previous one on delete", async () => {
    const r = engine.scoreText(resumeText());
    if (!engine.isScored(r)) throw new Error("fixture should be scored");
    const second = await resumes.saveAccepted(uid, r, resumeText(), {});
    const rows = await resumes.forUser(uid);
    expect(rows[0].id).toBe(second);
    expect(rows.filter((x) => x.is_current === 1)).toHaveLength(1);
    expect(await resumes.remove(uid + 999999, second)).toBe(false); // someone else's upload cannot be deleted
    expect(await resumes.remove(uid, second)).toBe(true);
    expect((await resumes.forUser(uid)).filter((x) => x.is_current === 1)).toHaveLength(1);
  });

  it("publishes a signed passport that verifies, with only the chosen details", async () => {
    await expect(share.publish(uid, "Priya Sharma", { show_score: false })).rejects.toThrow(/heart of a passport/);
    const code = await share.publish(uid, "Priya Sharma", { name_style: "first_initial", show_score: true, show_skills: true, show_courses: true, show_college: false });
    expect(share.validCode(code)).toBe(true);
    const p = await share.byCode(code);
    expect(p?.is_public).toBe(1);
    expect(p?.display_name).toBe("Priya S.");
    const v = await pcm.verify(p!.credential!.jwt);
    expect(v.state).toBe("valid");
    expect(v.steps.every((s) => s[2])).toBe(true);
    const claims = (v.payload!.credentialSubject as { passport: Record<string, unknown> }).passport;
    expect(claims.name).toBe("Priya S.");
    expect((claims.rq as { score: number }).score).toBeGreaterThan(0);
    expect(claims.college).toBeUndefined(); // hidden by the student
    expect(claims.skills).toBeDefined();
    expect(JSON.stringify(v.payload)).not.toContain("pp-" + tag); // the email never enters the credential
    expect(((v.payload!["@context"]) as string[])[2]).toBe("https://growqr.test/passport-context.jsonld");
    expect(await share.url(code, true)).toBe(`https://growqr.test/v/${code}?q=1`);
  });

  it("rejects a tampered, truncated, wrongly-signed or unknown credential", async () => {
    const p = await share.byCode((await share.forUser(uid))!.code);
    const jwt = p!.credential!.jwt;
    const [h, body, sig] = jwt.split(".");
    const forged = JSON.parse(Buffer.from(body, "base64url").toString());
    forged.credentialSubject.passport.rq.score = 100;
    const bad = await pcm.verify(`${h}.${Buffer.from(JSON.stringify(forged)).toString("base64url")}.${sig}`);
    expect(bad.state).toBe("invalid");
    expect(bad.reasons[0]).toMatch(/signature does not match/);
    expect((await pcm.verify(jwt.slice(0, jwt.length - 10))).ok).toBe(false);
    expect((await pcm.verify("a.b.c")).ok).toBe(false);
    expect((await pcm.verify("not a jwt")).reasons[0]).toMatch(/three dot-separated parts/);
    const alg = Buffer.from(JSON.stringify({ alg: "none", kid: "x#y" })).toString("base64url");
    expect((await pcm.verify(`${alg}.${body}.${sig}`)).reasons[0]).toMatch(/Unsupported signature algorithm/);
    const unknownKey = Buffer.from(JSON.stringify({ alg: "EdDSA", kid: "did:web:evil#zzzzzzzzzzzz" })).toString("base64url");
    expect((await pcm.verify(`${unknownKey}.${body}.${sig}`)).reasons[0]).toMatch(/not published/);
    expect((await pcm.verify(jwt, Math.floor(Date.now() / 1000) + 400 * 86400)).state).toBe("expired");
    expect((await pcm.verify(jwt, Math.floor(Date.now() / 1000) - 3 * 86400)).ok).toBe(false); // not yet valid
  });

  it("marks the old version superseded when a new one is published, and revokes everything on withdrawal", async () => {
    const code0 = (await share.forUser(uid))!.code;
    const old = (await share.byCode(code0))!.credential!.jwt;
    const code1 = await share.publish(uid, "Priya Sharma", { name_style: "full", show_score: true, show_skills: false, show_courses: false, show_college: true });
    expect(code1).toBe(code0); // the link and QR never change
    expect((await pcm.verify(old)).state).toBe("superseded");
    const cur = (await share.byCode(code1))!.credential!.jwt;
    const v = await pcm.verify(cur);
    expect(v.state).toBe("valid");
    const claims = (v.payload!.credentialSubject as { passport: Record<string, unknown> }).passport;
    expect(claims.name).toBe("Priya Sharma");
    expect(claims.college).toBe("Delhi Test College");
    expect(claims.skills).toBeUndefined();
    await share.withdraw(uid);
    expect((await pcm.verify(cur)).state).toBe("revoked");
    expect((await pcm.verify(old)).state).toBe("revoked");
    expect((await share.byCode(code1))!.is_public).toBe(0);
    await share.publish(uid, "Priya Sharma", { name_style: "initials", show_score: true }); // can be re-published
    expect((await share.byCode(code1))!.is_public).toBe(1);
  });

  it("counts views once per visitor per 10 minutes and ignores bots", async () => {
    const p = (await share.forUser(uid))!;
    const ctx = { ip: "203.0.113.9", ua: "Mozilla/5.0 Chrome/120", referer: "https://www.linkedin.com/feed", host: "growqr.test" };
    await share.recordView(p.id, true, ctx);
    await share.recordView(p.id, true, ctx);
    await share.recordView(p.id, false, { ...ctx, ip: "203.0.113.10" });
    await share.recordView(p.id, false, { ...ctx, ua: "Googlebot/2.1", ip: "203.0.113.11" });
    const s = await share.stats(p.id);
    expect(s).toMatchObject({ total: 2, qr: 1, d7: 2 });
    expect(await db.val("SELECT referrer FROM passport_views WHERE passport_id = $1 ORDER BY id LIMIT 1", [p.id])).toBe("linkedin.com");
  });

  it("formats names and links", async () => {
    expect(share.displayName("  priya   kumari sharma ", "first_initial")).toBe("priya S.");
    expect(share.displayName("priya kumari sharma", "initials")).toBe("P.K.S.");
    expect(share.displayName("   ", "full")).toBe("GrowQR learner");
    expect(share.displayName("Single", "first_initial")).toBe("Single");
    const li = await share.linkedInUrl("ABCDEFGHJKMN", 1_790_000_000, 1_821_536_000);
    expect(li).toContain("startTask=CERTIFICATION_NAME");
    expect(li).toContain("certUrl=https%3A%2F%2Fgrowqr.test%2Fv%2FABCDEFGHJKMN");
    expect(share.validCode("ABCDEFGHJKMN")).toBe(true);
    expect(share.validCode("abcdefghjkmn")).toBe(false);
    expect(share.validCode("0OIL00000000")).toBe(false);
  });

  it("re-issues passports when the site address changes, keeping old copies verifiable", async () => {
    const code = (await share.forUser(uid))!.code;
    const before = (await share.byCode(code))!.credential!.jwt;
    process.env.PORTAL_APP_URL = "https://new-address.test";
    expect(await share.staleIssuerCount()).toBeGreaterThanOrEqual(1);
    expect(await share.reissueAll()).toBeGreaterThanOrEqual(1);
    const after = (await share.byCode(code))!.credential!.jwt;
    expect(after).not.toBe(before);
    expect((await pcm.verify(before)).state).toBe("superseded");
    expect((await pcm.verify(after)).state).toBe("valid");
    const claims = JSON.parse(Buffer.from(after.split(".")[1], "base64url").toString());
    expect(claims.issuer.id).toBe("did:web:new-address.test");
    process.env.PORTAL_APP_URL = "https://growqr.test";
    await share.publish(uid, "Priya Sharma", { show_score: true, show_skills: true }); // a current credential under the test address again
  });

  it.skipIf(!phpOk)("PHP verifies credentials signed here, and this verifies credentials signed by PHP", async () => {
    const code = (await share.forUser(uid))!.code;
    const mine = (await share.byCode(code))!.credential!;
    const jwtFile = path.join(tmp, "mine.jwt").replace(/\\/g, "/");
    writeFileSync(jwtFile, mine.jwt);
    const viaPhp = JSON.parse(php(`$r = QrScore\\Portal\\PassportCredential::verify((string) file_get_contents('${jwtFile}')); echo json_encode(['ok' => $r['ok'], 'state' => $r['state']]);`));
    expect(viaPhp).toEqual({ ok: true, state: expect.stringMatching(/^(valid|superseded)$/) });
    expect((await pcm.verify(mine.jwt)).state).toBe(viaPhp.state);

    // a credential PHP signs (for this passport) and records
    const out = JSON.parse(php(`
      $p = QrScore\\Portal\\PassportShare::forUser(${uid});
      $i = QrScore\\Portal\\PassportCredential::issue($p['code'], ['name' => 'Php P.', 'rq' => ['score' => 71, 'scale' => 100]]);
      QrScore\\Portal\\Db::q("UPDATE passport_credentials SET status = 'superseded' WHERE passport_id = ? AND status = 'active'", [$p['id']]);
      QrScore\\Portal\\Db::q('INSERT INTO passport_credentials (passport_id, jti, kid, jwt, issued_at, expires_at) VALUES (?,?,?,?,?,?)', [$p['id'], $i['jti'], $i['kid'], $i['jwt'], gmdate('Y-m-d H:i:s', $i['issued']), gmdate('Y-m-d H:i:s', $i['expires'])]);
      echo json_encode(['jwt' => $i['jwt'], 'kid' => $i['kid']]);`)) as { jwt: string; kid: string };
    expect(out.kid).toBe(pcm.signer().kid);
    const v = await pcm.verify(out.jwt);
    expect(v.state).toBe("valid");
    expect((v.payload!.credentialSubject as { passport: { name: string } }).passport.name).toBe("Php P.");
    // and a forged copy of the PHP credential fails here
    const [h, b, s] = out.jwt.split(".");
    const tampered = JSON.parse(Buffer.from(b, "base64url").toString());
    tampered.credentialSubject.passport.rq.score = 99;
    expect((await pcm.verify(`${h}.${Buffer.from(JSON.stringify(tampered)).toString("base64url")}.${s}`)).state).toBe("invalid");
  });

  it("matches students to roles with the same formula as PHP", () => {
    const p = { skills: ["Python", "SQL", "Tableau"], learned: "introduction to data analysis with excel", rq_overall: "80.00" };
    const m = prof.match(["Python", "SQL", "Excel", "Power BI"], p);
    expect(m.have).toEqual(["Python", "SQL", "Excel"]);
    expect(m.miss).toEqual(["Power BI"]);
    expect(m.via).toEqual(["Excel"]);
    expect(m.score).toBe(Math.round((0.75 * (3 / 4) + 0.25 * 0.8) * 100));
    expect(prof.match(["Python"], null).score).toBeNull();
    expect(prof.match([], p).score).toBeNull();
    expect(prof.match(["C++", "c#"], { skills: ["C++", "C#"], learned: "", rq_overall: null }).score).toBe(100);
  });
});
