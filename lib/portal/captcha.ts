import "server-only";
import { createHmac, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { appSecret } from "./crypto";
import { clientIp, fails, recordFail, sha256 } from "./security";
import { verifyTurnstile } from "@/lib/turnstile";

/**
 * The human check on email sign-in, sign-up and password reset.
 *
 *  - turnstile: Cloudflare Turnstile, when both TURNSTILE_SITE_KEY (or NEXT_PUBLIC_TURNSTILE_SITE_KEY) and TURNSTILE_SECRET_KEY are set.
 *  - image: otherwise (the default) a picture of six letters and numbers that the person types in. The code is never sent to the browser as
 *    text: the page gets a signed token, and the picture is drawn from that token. A token expires after 5 minutes and is spent by its first
 *    attempt, right or wrong, so a code cannot be guessed over and over.
 *  - pow: a built-in proof-of-work challenge (PORTAL_CAPTCHA=pow). The browser has to find a number whose SHA-256 (together with a server-signed
 *    challenge) starts with N zero bits. It costs a person under a second and a bot farm real CPU time per attempt. Each challenge is
 *    signed, expires after 10 minutes and works once. N rises for addresses that have recently failed.
 *  - off: only with PORTAL_CAPTCHA=off (development).
 *
 * It never fails open: when the check cannot be verified, the form is refused.
 */
export type CaptchaMode = "off" | "turnstile" | "pow" | "image";

const envKey = (k: string): string => process.env[k] ?? ""; // looked up at run time, not baked in at build

export function turnstileSiteKey(): string {
  return envKey("TURNSTILE_SITE_KEY") || envKey("NEXT_PUBLIC_TURNSTILE_SITE_KEY");
}

export function captchaMode(): CaptchaMode {
  if (envKey("PORTAL_CAPTCHA") === "off") return "off";
  if (turnstileSiteKey() && envKey("TURNSTILE_SECRET_KEY")) return "turnstile";
  return envKey("PORTAL_CAPTCHA") === "pow" ? "pow" : "image";
}

// ---- picture code (letters and numbers) -----------------------------------------------------------------------------------------

const IMG_MAX_AGE_MS = 5 * 60 * 1000;
const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I or O
const DIGITS = "23456789"; // no 0 or 1

const imgSign = (secret: string, body: string): string => createHmac("sha256", secret).update(`imgtok-v1:${body}`).digest("base64url");

/** The six characters for a token: four letters and two numbers, in a shuffled order. Derived from the secret, so it never has to be stored. */
export function imageCodeFor(secret: string, body: string): string {
  const h = createHmac("sha256", secret).update(`imgcode-v1:${body}`).digest();
  const c = [LETTERS[h[0] % 24], LETTERS[h[1] % 24], LETTERS[h[2] % 24], LETTERS[h[3] % 24], DIGITS[h[4] % 8], DIGITS[h[5] % 8]];
  for (let i = 5; i > 0; i--) {
    const j = h[6 + (5 - i)] % (i + 1);
    [c[i], c[j]] = [c[j], c[i]];
  }
  return c.join("");
}

/** A new signed token for the picture. */
export async function imageChallenge(): Promise<string> {
  const body = `${Date.now()}.${randomBytes(12).toString("hex")}`;
  return `${body}.${imgSign(await appSecret(), body)}`;
}

/** Check a token's signature and age. Returns its body, or null. */
async function imageBody(token: string): Promise<string | null> {
  if (typeof token !== "string" || token.length > 120) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [ts, rnd, sig] = parts;
  const body = `${ts}.${rnd}`;
  const good = imgSign(await appSecret(), body);
  if (sig.length !== good.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return null;
  const age = Date.now() - Number(ts);
  return age >= 0 && age <= IMG_MAX_AGE_MS ? body : null;
}

/** The characters to draw for a valid token (used by the picture route), or null. */
export async function imageCode(token: string): Promise<string | null> {
  const body = await imageBody(token);
  return body ? imageCodeFor(await appSecret(), body) : null;
}

/** Check what the person typed. A token is spent by its first attempt. */
export async function verifyImage(token: string, typed: string): Promise<boolean> {
  const body = await imageBody(token);
  if (!body) return false;
  const used = `capused:${sha256(token)}`;
  if ((await fails(used, 10)) > 0) return false;
  await recordFail(used);
  const want = imageCodeFor(await appSecret(), body);
  const got = String(typed ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return got.length === want.length && timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

// ---- proof of work -----------------------------------------------------------------------------------------------------------

const BASE_BITS = 16;
const HARD_BITS = 19;
const MAX_AGE_MS = 10 * 60 * 1000;

export function leadingZeroBits(buf: Buffer): number {
  let n = 0;
  for (const byte of buf) {
    if (byte === 0) { n += 8; continue; }
    n += Math.clz32(byte) - 24;
    break;
  }
  return n;
}

const sign = (secret: string, body: string): string => createHmac("sha256", secret).update(`pow-v1:${body}`).digest("base64url");

/** A new signed challenge for the browser to solve. */
export async function powChallenge(): Promise<{ challenge: string; bits: number }> {
  const ip = await clientIp();
  const bits = (await fails(`loginip:${ip}`)) + (await fails(`pow:${ip}`)) >= 5 ? HARD_BITS : BASE_BITS;
  const body = `${Date.now()}.${randomBytes(12).toString("hex")}.${bits}`;
  return { challenge: `${body}.${sign(await appSecret(), body)}`, bits };
}

/** Check a solution of the form "<challenge>~<nonce>". Single use. */
export async function verifyPow(solution: string): Promise<boolean> {
  if (typeof solution !== "string" || solution.length > 300) return false;
  const [challenge, nonce] = solution.split("~");
  if (!challenge || !nonce || !/^[0-9a-z]{1,16}$/i.test(nonce)) return false;
  const parts = challenge.split(".");
  if (parts.length !== 4) return false;
  const [ts, rnd, bitsStr, sig] = parts;
  const body = `${ts}.${rnd}.${bitsStr}`;
  const good = sign(await appSecret(), body);
  if (sig.length !== good.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return false;
  const bits = Number(bitsStr);
  const age = Date.now() - Number(ts);
  if (!Number.isInteger(bits) || bits < BASE_BITS || bits > 26 || !(age >= 0 && age <= MAX_AGE_MS)) return false;
  if (leadingZeroBits(createHash("sha256").update(`${challenge}:${nonce}`).digest()) < bits) return false;
  const used = `powused:${sha256(challenge)}`;
  if ((await fails(used, 15)) > 0) return false; // already spent
  await recordFail(used);
  return true;
}

// ---- the check used by the form actions ---------------------------------------------------------------------------------------

export async function humanCheck(fd: FormData, label: string): Promise<boolean> {
  const mode = captchaMode();
  if (mode === "off") return true;
  if (mode === "turnstile") return verifyTurnstile(String(fd.get("cf-turnstile-response") ?? ""), `portal-${label}`);
  if (mode === "image") {
    const ip = await clientIp();
    if ((await fails(`capfail:${ip}`)) >= 20) return false; // too many wrong codes from this address
    const ok = await verifyImage(String(fd.get("captchaToken") ?? ""), String(fd.get("captcha") ?? ""));
    if (!ok) await recordFail(`capfail:${ip}`);
    return ok;
  }
  const ok = await verifyPow(String(fd.get("pow") ?? ""));
  if (!ok) await recordFail(`pow:${await clientIp()}`); // a failed or replayed solution makes the next challenge harder
  return ok;
}
