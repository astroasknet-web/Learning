import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** Random identifiers. Public ids carry a prefix so a stray value in a log is recognisable; none of them is guessable. */
const b32 = (n: number): string => {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789"; // no look-alikes
  const bytes = randomBytes(n);
  let out = "";
  for (let i = 0; i < n; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
};

export const newOrderId = (): string => `ord_${b32(20)}`;
export const newRefundId = (): string => `ref_${b32(20)}`;
/** The secret a guest buyer holds to read their own order. Only its hash is stored. */
export const newAccessToken = (): string => randomBytes(24).toString("base64url");
export const hashToken = (t: string): string => createHash("sha256").update(t).digest("hex");

export function tokenMatches(token: string, hash: string): boolean {
  const a = Buffer.from(hashToken(token));
  const b = Buffer.from(hash);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const sha256 = (s: string): string => createHash("sha256").update(s).digest("hex");
