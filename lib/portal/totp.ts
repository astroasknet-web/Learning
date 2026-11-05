import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/** RFC 6238 time-based one-time passwords (SHA-1, 6 digits, 30 s): works with Google/Microsoft Authenticator, Authy, 1Password (port of Portal\Totp.php). */
const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function newSecret(): string {
  return b32(randomBytes(20));
}

function b32(bin: Buffer): string {
  let bits = "";
  for (const b of bin) bits += b.toString(2).padStart(8, "0");
  let out = "";
  for (let i = 0; i < bits.length; i += 5) out += ALPHA[parseInt(bits.slice(i, i + 5).padEnd(5, "0"), 2)];
  return out;
}

function unb32(s: string): Buffer {
  let bits = "";
  for (const c of s.toUpperCase().replace(/[^A-Z2-7]/g, "")) bits += ALPHA.indexOf(c).toString(2).padStart(5, "0");
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

export function code(secret: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const h = createHmac("sha1", unb32(secret)).update(counter).digest();
  const o = h[19] & 15;
  const n = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1_000_000).padStart(6, "0");
}

/** The matched time step (for replay protection), or null when the code is wrong. Accepts one step either side for clock drift. */
export function verify(secret: string, input: string, nowSeconds: number = Math.floor(Date.now() / 1000)): number | null {
  const clean = input.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(clean)) return null;
  const cur = Math.floor(nowSeconds / 30);
  for (let d = -1; d <= 1; d++) {
    const want = Buffer.from(code(secret, cur + d));
    const got = Buffer.from(clean);
    if (want.length === got.length && timingSafeEqual(want, got)) return cur + d;
  }
  return null;
}

export function uri(secret: string, account: string, issuer = "GrowQR"): string {
  return `otpauth://totp/${encodeURIComponent(issuer + ":" + account)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}
