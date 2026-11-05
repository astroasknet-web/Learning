import { createPublicKey, createVerify } from "node:crypto";
import { createLogger } from "@/lib/log";

/**
 * Verification of SalesIQ's `x-siqsignature` webhook signature.
 *
 * WHY THIS EXISTS: the live bot (227090000000062015) has `webhook.secured =
 * true` with an RSA public key and NO custom headers — verified against the
 * SalesIQ API on 2026-08-01. The shared-secret `x-growqr-bot` scheme the route
 * originally shipped with therefore can never pass on real traffic, because
 * SalesIQ never sends that header. RSA signature verification is the only
 * authentication SalesIQ actually offers here.
 *
 * WHY IT PROBES ALGORITHMS: Zoho documents the *mechanism* ("we create a
 * signature for the payload data with the private key … verify it with the
 * payload data and the public key using the same RSA Cryptosystem") but never
 * the digest or the signature encoding. Both help pages were re-checked on
 * 2026-08-01 and neither specifies SHA-256 vs SHA-1, nor base64 vs hex:
 *   https://www.zoho.com/salesiq/help/developer-section/zobot-webhook-authentication-2.0.html
 *   https://www.zoho.com/salesiq/help/developer-section/widgets-webhook-authentication.html
 *
 * Guessing one combination and shipping it would fail closed on every real
 * request with no way to tell a wrong guess from an attack. So we try the
 * plausible set, and log which one matched. Once a real request has been
 * verified, pin SALESIQ_SIGNATURE_ALGO to the logged variant and this becomes
 * a single deterministic check.
 *
 * Probing costs nothing security-wise: every variant verifies against the same
 * public key, so a forger must still hold Zoho's private key to satisfy any of
 * them.
 */

const log = createLogger("salesiq-signature");

/** Ordered most- to least-likely. Every entry needs Zoho's private key to satisfy. */
const VARIANTS = [
  { name: "RSA-SHA256:base64", algo: "RSA-SHA256", encoding: "base64" },
  { name: "RSA-SHA256:hex", algo: "RSA-SHA256", encoding: "hex" },
  { name: "RSA-SHA1:base64", algo: "RSA-SHA1", encoding: "base64" },
  { name: "RSA-SHA1:hex", algo: "RSA-SHA1", encoding: "hex" },
  { name: "RSA-SHA512:base64", algo: "RSA-SHA512", encoding: "base64" },
] as const;

/**
 * SalesIQ hands out the bare base64 SPKI body (no PEM armour). Accept either
 * that or a full PEM block, so the env var can be pasted from the console or
 * from the API response without reformatting.
 */
function toPem(key: string): string {
  const trimmed = key.trim();
  if (trimmed.includes("BEGIN PUBLIC KEY")) return trimmed;
  const body = trimmed.replace(/\s+/g, "").match(/.{1,64}/g)?.join("\n") ?? "";
  return `-----BEGIN PUBLIC KEY-----\n${body}\n-----END PUBLIC KEY-----`;
}

export interface SignatureResult {
  ok: boolean;
  /** Which variant matched — log this, then pin SALESIQ_SIGNATURE_ALGO to it. */
  matched?: string;
  /** Why verification could not be attempted (missing key/header/bad PEM). */
  reason?: string;
}

/**
 * @param rawBody the request body EXACTLY as received — re-serialising parsed
 *   JSON changes key order and whitespace and would break every signature.
 */
export function verifySalesIqSignature(
  rawBody: string,
  signature: string | null,
  publicKey: string | undefined,
): SignatureResult {
  if (!publicKey) return { ok: false, reason: "no_public_key_configured" };
  if (!signature) return { ok: false, reason: "no_signature_header" };

  let key;
  try {
    key = createPublicKey(toPem(publicKey));
  } catch (error) {
    log.error("SALESIQ_PUBLIC_KEY is not a usable RSA public key:", error);
    return { ok: false, reason: "bad_public_key" };
  }

  const pinned = process.env.SALESIQ_SIGNATURE_ALGO;
  const candidates = pinned ? VARIANTS.filter((v) => v.name === pinned) : VARIANTS;
  if (pinned && !candidates.length) {
    log.error(`SALESIQ_SIGNATURE_ALGO="${pinned}" is not a known variant — refusing to fall back`);
    return { ok: false, reason: "unknown_pinned_algo" };
  }

  for (const variant of candidates) {
    try {
      const verifier = createVerify(variant.algo);
      verifier.update(rawBody, "utf8");
      verifier.end();
      if (verifier.verify(key, signature, variant.encoding)) {
        return { ok: true, matched: variant.name };
      }
    } catch {
      // Wrong encoding for this signature string throws rather than returning
      // false — that is a failed candidate, not a failed request.
    }
  }

  return { ok: false, reason: "no_variant_matched" };
}
