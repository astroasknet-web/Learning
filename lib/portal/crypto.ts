import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";
import { one, run } from "./db";

/**
 * App secret plus authenticated encryption for small secrets at rest (port of Portal\Crypto.php).
 *
 * The secret lives in the database (schema_meta, k = 'app_secret'), exactly where the PHP app keeps it, so two-step-login
 * secrets and recovery codes written by PHP can be read here and the other way round. Format of an encrypted value:
 * base64( iv[12] + gcm-tag[16] + ciphertext ), AES-256-GCM, key = HMAC-SHA256(key = app secret, data = "enc-v1").
 */
let cachedSecret: string | null = null;

export async function appSecret(): Promise<string> {
  if (cachedSecret) return cachedSecret;
  let row = await one<{ v: string }>("SELECT v FROM schema_meta WHERE k = 'app_secret'");
  if (!row) {
    await run("INSERT INTO schema_meta (k, v) VALUES ('app_secret', $1) ON CONFLICT (k) DO NOTHING", [randomBytes(32).toString("hex")]);
    row = await one<{ v: string }>("SELECT v FROM schema_meta WHERE k = 'app_secret'");
  }
  cachedSecret = row!.v;
  return cachedSecret;
}

/** Tests only. */
export function resetSecretCache(): void {
  cachedSecret = null;
}

export function keyFrom(secret: string): Buffer {
  return createHmac("sha256", secret).update("enc-v1").digest();
}

export function encryptWith(secret: string, plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", keyFrom(secret), iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), ct]).toString("base64");
}

export function decryptWith(secret: string, blob: string): string | null {
  const raw = Buffer.from(blob, "base64");
  if (raw.length < 29) return null;
  try {
    const d = createDecipheriv("aes-256-gcm", keyFrom(secret), raw.subarray(0, 12));
    d.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export async function encrypt(plain: string): Promise<string> {
  return encryptWith(await appSecret(), plain);
}

export async function decrypt(blob: string): Promise<string | null> {
  return decryptWith(await appSecret(), blob);
}

/** HMAC used to store one-time recovery codes (never the codes themselves). */
export async function recoveryHash(code: string): Promise<string> {
  return createHmac("sha256", await appSecret()).update(code).digest("hex");
}
