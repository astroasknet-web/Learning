import "server-only";
import { createHash } from "node:crypto";

/**
 * Has this password appeared in a known data breach? Uses the Pwned Passwords range API with k-anonymity: only the first five
 * characters of the password's SHA-1 are sent, never the password or its full hash. Padding is requested so response size does
 * not leak anything. If the service cannot be reached the answer is "unknown" (0), so sign-up is never blocked by an outage.
 */
export function sha1Parts(pw: string): { prefix: string; suffix: string } {
  const h = createHash("sha1").update(pw, "utf8").digest("hex").toUpperCase();
  return { prefix: h.slice(0, 5), suffix: h.slice(5) };
}

/** Count for a suffix in a range response ("SUFFIX:COUNT" per line). Padding rows have a count of 0. */
export function countInRange(body: string, suffix: string): number {
  for (const line of body.split(/\r?\n/)) {
    const [s, c] = line.trim().split(":");
    if (s === suffix) return Number.parseInt(c ?? "0", 10) || 0;
  }
  return 0;
}

export async function pwnedCount(pw: string): Promise<number> {
  if (process.env.PORTAL_PWNED_CHECK === "off") return 0;
  const { prefix, suffix } = sha1Parts(pw);
  try {
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, { headers: { "Add-Padding": "true", "User-Agent": "GrowQR-signup" }, signal: AbortSignal.timeout(2500), cache: "no-store" });
    if (!res.ok) return 0;
    return countInRange(await res.text(), suffix);
  } catch {
    return 0;
  }
}

export const PWNED_MESSAGE = "This password has appeared in a data breach, so it is not safe to use. Choose a different one.";
