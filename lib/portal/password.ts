import bcrypt from "bcryptjs";

/**
 * Passwords. Hashes are bcrypt, the same format PHP's password_hash() writes ($2y$10$...), so every existing account keeps
 * working and a hash made here is accepted by the PHP app too. Policy follows NIST SP 800-63B: length plus a blocklist,
 * no composition rules (port of Auth::weakPassword).
 */
const COST = 10;
// A real hash of a throwaway string, compared when the email is unknown so response time does not reveal which emails exist.
const DUMMY_HASH = "$2y$10$hRIUS9Kxkh8ILbz.xcvvEOBJv4F5dVknX3gJ0xYRsh9td/gJOuQva";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, COST);
}

export async function verifyPassword(password: string, hash: string | null | undefined): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hash || DUMMY_HASH).then((ok) => ok && Boolean(hash));
  } catch {
    return false;
  }
}

/** True when a stored hash was made with a lower cost than we use now (re-hash on next successful login). */
export function needsRehash(hash: string): boolean {
  const m = /^\$2[abxy]\$(\d{2})\$/.exec(hash);
  return !m || parseInt(m[1], 10) < COST;
}

const COMMON = new Set([
  "password", "password1", "password12", "password123", "password1234", "passw0rd", "p@ssw0rd", "qwerty", "qwerty123", "qwertyuiop",
  "12345678", "123456789", "1234567890", "11111111", "00000000", "87654321", "abcd1234", "abc12345", "iloveyou", "admin123",
  "welcome1", "welcome123", "letmein1", "monkey123", "dragon123", "football1", "baseball1", "sunshine1", "princess1", "internship",
  "internship1", "growqr123", "student123", "india123", "india@123", "test1234", "changeme", "whatever1", "trustno1", "master123",
]);

const asciiLower = (s: string) => s.replace(/[A-Z]+/g, (m) => m.toLowerCase());
const byteLen = (s: string) => Buffer.byteLength(s, "utf8");

/** A reason the password is unacceptable, or null when it is fine. */
export function weakPassword(pw: string, email = "", name = ""): string | null {
  if (byteLen(pw) < 8) return "Use at least 8 characters.";
  if (byteLen(pw) > 128) return "Use 128 characters or fewer.";
  const l = asciiLower(pw);
  if (COMMON.has(l) || new Set(Buffer.from(l, "utf8")).size < 4) return "That password is too easy to guess. Try a short phrase of unrelated words.";
  const at = email.indexOf("@");
  const local = at > 0 ? asciiLower(email.slice(0, at)) : "";
  if (local !== "" && byteLen(local) >= 4 && l.includes(local)) return "Do not include your email name in your password.";
  for (const part of asciiLower(name.trim()).split(/[ \t\n\x0B\f\r]+/)) {
    if (byteLen(part) >= 4 && l.includes(part)) return "Do not include your name in your password.";
  }
  return null;
}
