import { describe, expect, it, afterEach } from "vitest";
import { generateKeyPairSync, createSign } from "node:crypto";
import { verifySalesIqSignature } from "@/lib/bot/signature";

/**
 * Real RSA keys, real signatures — no mocking of node:crypto. The point of
 * these tests is that a forged or tampered request cannot pass, so faking the
 * crypto would test nothing.
 */

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });

const pemPublic = publicKey.export({ type: "spki", format: "pem" }).toString();
/** SalesIQ hands out the bare base64 SPKI body, not an armoured PEM block. */
const barePublic = pemPublic
  .replace(/-----(BEGIN|END) PUBLIC KEY-----/g, "")
  .replace(/\s+/g, "");

function sign(body: string, algo = "RSA-SHA256", encoding: "base64" | "hex" = "base64") {
  const signer = createSign(algo);
  signer.update(body, "utf8");
  signer.end();
  return signer.sign(privateKey, encoding);
}

const BODY = JSON.stringify({ handler: "message", visitor: { avuid: "abc" } });

afterEach(() => {
  delete process.env.SALESIQ_SIGNATURE_ALGO;
});

describe("verifySalesIqSignature", () => {
  it("accepts a genuine signature and reports which variant matched", () => {
    const result = verifySalesIqSignature(BODY, sign(BODY), barePublic);
    expect(result.ok).toBe(true);
    expect(result.matched).toBe("RSA-SHA256:base64");
  });

  it("accepts a full PEM block as well as the bare base64 SalesIQ returns", () => {
    expect(verifySalesIqSignature(BODY, sign(BODY), pemPublic).ok).toBe(true);
  });

  // The variants exist because Zoho documents the mechanism but never the
  // digest or encoding — see the module comment.
  it.each([
    ["RSA-SHA256", "hex", "RSA-SHA256:hex"],
    ["RSA-SHA1", "base64", "RSA-SHA1:base64"],
    ["RSA-SHA512", "base64", "RSA-SHA512:base64"],
  ] as const)("discovers the %s/%s variant", (algo, encoding, expected) => {
    const result = verifySalesIqSignature(BODY, sign(BODY, algo, encoding), barePublic);
    expect(result.ok).toBe(true);
    expect(result.matched).toBe(expected);
  });

  it("rejects a tampered body", () => {
    const signature = sign(BODY);
    const tampered = JSON.stringify({ handler: "message", visitor: { avuid: "EVIL" } });
    expect(verifySalesIqSignature(tampered, signature, barePublic).ok).toBe(false);
  });

  it("rejects a signature made with a different key", () => {
    const attacker = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const signer = createSign("RSA-SHA256");
    signer.update(BODY, "utf8");
    signer.end();
    const forged = signer.sign(attacker.privateKey, "base64");
    expect(verifySalesIqSignature(BODY, forged, barePublic).ok).toBe(false);
  });

  it("fails closed when the header, key, or key format is unusable", () => {
    expect(verifySalesIqSignature(BODY, null, barePublic)).toMatchObject({
      ok: false,
      reason: "no_signature_header",
    });
    expect(verifySalesIqSignature(BODY, sign(BODY), undefined)).toMatchObject({
      ok: false,
      reason: "no_public_key_configured",
    });
    expect(verifySalesIqSignature(BODY, sign(BODY), "not-a-key")).toMatchObject({
      ok: false,
      reason: "bad_public_key",
    });
  });

  it("honours a pinned variant and does not silently fall back to another", () => {
    process.env.SALESIQ_SIGNATURE_ALGO = "RSA-SHA256:base64";
    expect(verifySalesIqSignature(BODY, sign(BODY), barePublic).ok).toBe(true);

    // A SHA-1 signature must NOT be accepted once SHA-256 is pinned —
    // otherwise pinning would be decorative.
    const sha1 = sign(BODY, "RSA-SHA1", "base64");
    expect(verifySalesIqSignature(BODY, sha1, barePublic)).toMatchObject({
      ok: false,
      reason: "no_variant_matched",
    });
  });

  it("refuses to verify at all if pinned to an unknown variant name", () => {
    process.env.SALESIQ_SIGNATURE_ALGO = "typo-here";
    expect(verifySalesIqSignature(BODY, sign(BODY), barePublic)).toMatchObject({
      ok: false,
      reason: "unknown_pinned_algo",
    });
  });
});
