import { createHash, createPrivateKey, createPublicKey, randomUUID, sign as edSign, verify as edVerify, type KeyObject } from "node:crypto";
import { all, one, run } from "../db";
import { appUrl } from "../mail";

/**
 * Signed, verifiable credentials for the Skill Passport (port of Portal\PassportCredential.php).
 *
 * Format: a W3C Verifiable Credential (Data Model 2.0) shaped as an Open Badges 3.0 "OpenBadgeCredential", secured as a
 * compact JWS ("vc+jwt", VC-JOSE) with Ed25519 (alg EdDSA). The issuer is a did:web identifier on this site; its public keys
 * are published at /.well-known/did.json and /.well-known/jwks.json, so anyone can verify a passport with standard tools
 * without trusting this server's pages.
 *
 * Honest scope: this is the OB3 data model, signed with a standard JOSE signature. It is not (yet) certified by 1EdTech and
 * does not use the JSON-LD "Data Integrity" proof suite.
 *
 * The private key is derived from PASSPORT_SIGNING_SEED (32+ characters). Use the SAME seed the PHP app uses (passport.signing_seed
 * in config.php, or the contents of storage/passport-signing.key) and both apps sign with the same key, so every credential
 * already issued keeps verifying. Public keys live in passport_keys for ever, so old credentials stay verifiable after a rotation.
 */
export const TTL_DAYS = 365;
export const CONTEXT_OB3 = "https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json";
export const CONTEXT_VC = "https://www.w3.org/ns/credentials/v2";
const PKCS8_ED25519_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");

export interface Signer {
  priv: KeyObject;
  pub: Buffer; // raw 32-byte public key
  kid: string;
}

export const b64u = (b: Buffer | Uint8Array): string => Buffer.from(b).toString("base64url");

export function unb64u(s: string): Buffer | null {
  if (s === "" || !/^[A-Za-z0-9_-]+$/.test(s)) return null;
  const b = Buffer.from(s, "base64url");
  return b.length > 0 ? b : null;
}

export function available(): boolean {
  return (process.env.PASSPORT_SIGNING_SEED ?? "").length >= 32;
}

let cached: { seed: string; signer: Signer } | null = null;

/** The signing key. Throws when no seed is configured. */
export function signer(): Signer {
  const seed = process.env.PASSPORT_SIGNING_SEED ?? "";
  if (seed.length < 32) throw new Error("PASSPORT_SIGNING_SEED is not set (32+ characters). Use the same seed as the PHP app so existing passports keep verifying.");
  if (cached && cached.seed === seed) return cached.signer;
  const raw = createHash("sha256").update(seed).digest(); // libsodium: sodium_crypto_sign_seed_keypair(hash('sha256', $seed, true))
  const priv = createPrivateKey({ key: Buffer.concat([PKCS8_ED25519_PREFIX, raw]), format: "der", type: "pkcs8" });
  const jwk = createPublicKey(priv).export({ format: "jwk" }) as { x: string };
  const pub = Buffer.from(jwk.x, "base64url");
  const kid = b64u(createHash("sha256").update(pub).digest()).slice(0, 12);
  cached = { seed, signer: { priv, pub, kid } };
  return cached.signer;
}

// ------------------------------------------------------------------ identity

/** Public base URL with a trailing slash. */
export async function base(): Promise<string> {
  return appUrl("");
}

export function didFor(baseUrl: string): string {
  const u = new URL(baseUrl);
  return "did:web:" + u.hostname + (u.port ? "%3A" + u.port : "");
}

export async function did(): Promise<string> {
  return didFor(await base());
}

// ------------------------------------------------------------------ keys

/** Make sure the current public key is published (idempotent). Returns its kid. */
export async function ensureKeyPublished(): Promise<string> {
  const k = signer();
  await run("INSERT INTO passport_keys (kid, public_key) VALUES ($1, $2) ON CONFLICT (kid) DO NOTHING", [k.kid, b64u(k.pub)]);
  return k.kid;
}

/** kid -> raw public key, for every key ever published. */
export async function publicKeys(): Promise<Map<string, Buffer>> {
  const out = new Map<string, Buffer>();
  for (const r of await all<{ kid: string; public_key: string }>("SELECT kid, public_key FROM passport_keys ORDER BY created_at")) {
    const raw = unb64u(r.public_key);
    if (raw && raw.length === 32) out.set(r.kid, raw);
  }
  return out;
}

const publicKeyObject = (raw: Buffer): KeyObject => createPublicKey({ key: { kty: "OKP", crv: "Ed25519", x: b64u(raw) }, format: "jwk" });

// ------------------------------------------------------------------ issue

export interface Issued {
  jwt: string;
  jti: string;
  kid: string;
  issued: number;
  expires: number;
  credential: Record<string, unknown>;
}

const isoZ = (t: number) => new Date(t * 1000).toISOString().slice(0, 19) + "Z";

/** Build and sign a credential. `passport` holds the claims shown on the public page (see share.snapshot). */
export async function issue(code: string, passport: Record<string, unknown>, now: number = Math.floor(Date.now() / 1000)): Promise<Issued> {
  const kid = await ensureKeyPublished();
  const jti = randomUUID();
  const b = await base();
  const issuerDid = didFor(b);
  const exp = now + TTL_DAYS * 86400;
  const credential = {
    "@context": [CONTEXT_VC, CONTEXT_OB3, b + "passport-context.jsonld"],
    id: "urn:uuid:" + jti,
    type: ["VerifiableCredential", "OpenBadgeCredential"],
    name: "GrowQR Verified Skill Passport",
    issuer: { id: issuerDid, type: ["Profile"], name: "GrowQR", url: b },
    validFrom: isoZ(now),
    validUntil: isoZ(exp),
    credentialSubject: {
      id: "urn:growqr:passport:" + code,
      type: ["AchievementSubject"],
      achievement: {
        id: b + "v/" + code,
        type: ["Achievement"],
        achievementType: "Assessment",
        name: "GrowQR Skill Passport",
        description: "A snapshot of a learner's resume quality score, skills and completed courses, chosen and published by the learner.",
        criteria: {
          narrative:
            "The RQ Score is computed by GrowQR's deterministic, rule-based resume scoring engine from a resume submitted by the holder. GrowQR has not verified identity, employment or education history. Course evidence is labelled LMS-verified, certificate link or self-reported.",
        },
      },
      passport,
    },
  };
  const header = { alg: "EdDSA", typ: "vc+jwt", cty: "vc", kid: issuerDid + "#" + kid };
  const signing = b64u(Buffer.from(JSON.stringify(header))) + "." + b64u(Buffer.from(JSON.stringify(credential)));
  const sig = edSign(null, Buffer.from(signing), signer().priv);
  return { jwt: signing + "." + b64u(sig), jti, kid, issued: now, expires: exp, credential };
}

// ------------------------------------------------------------------ verify

export type VerifyState = "valid" | "superseded" | "expired" | "revoked" | "invalid";
export type Step = [title: string, message: string, ok: boolean];

export interface VerifyResult {
  ok: boolean;
  state: VerifyState;
  reasons: string[];
  steps: Step[];
  payload: Record<string, unknown> | null;
  kid: string | null;
}

const dmy = (t: number) => {
  const d = new Date(t * 1000);
  return `${d.getUTCDate()} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};

const parseJson = (b: Buffer | null): Record<string, unknown> | null => {
  if (!b) return null;
  try {
    const v = JSON.parse(b.toString("utf8"));
    return v && typeof v === "object" && !Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
};

/**
 * Check a compact JWS credential. state: valid | superseded (authentic, a newer version exists) | expired | revoked | invalid.
 * The step list is what the public verifier shows, in plain language.
 */
export async function verify(input: string, now: number = Math.floor(Date.now() / 1000)): Promise<VerifyResult> {
  const res: VerifyResult = { ok: false, state: "invalid", reasons: [], steps: [], payload: null, kid: null };
  const jwt = input.trim();
  if (jwt.length > 200000) {
    res.reasons.push("The credential is too large.");
    return res;
  }
  const parts = jwt.split(".");
  if (parts.length !== 3) {
    res.reasons.push("This is not a signed credential (expected three dot-separated parts).");
    return res;
  }
  const header = parseJson(unb64u(parts[0]));
  const payload = parseJson(unb64u(parts[1]));
  const sigBytes = unb64u(parts[2]);
  if (!header || !payload || !sigBytes) {
    res.reasons.push("The credential could not be read. It may have been altered or cut short.");
    return res;
  }
  res.steps.push(["Structure", "Header, content and signature are present and readable.", true]);

  if (header.alg !== "EdDSA") {
    res.reasons.push("Unsupported signature algorithm. Only EdDSA (Ed25519) is accepted.");
    res.steps.push(["Algorithm", "Must be EdDSA (Ed25519).", false]);
    return res;
  }
  res.steps.push(["Algorithm", "EdDSA (Ed25519).", true]);

  const kidStr = String(header.kid ?? "");
  const kid = kidStr.includes("#") ? kidStr.slice(kidStr.lastIndexOf("#") + 1) : "";
  res.kid = kid !== "" ? kid : null;
  const keys = await publicKeys();
  const issuerDid = await did();
  if (kid === "" || !keys.has(kid)) {
    res.reasons.push("Signed with a key that GrowQR has not published. This credential did not come from GrowQR.");
    res.steps.push(["Issuer key", "The signing key must be one of the keys published by GrowQR.", false]);
    return res;
  }
  res.steps.push(["Issuer key", `Key ${kid} is published by GrowQR (${issuerDid}).`, true]);

  let good = false;
  try {
    good = sigBytes.length === 64 && edVerify(null, Buffer.from(parts[0] + "." + parts[1]), publicKeyObject(keys.get(kid)!), sigBytes);
  } catch {
    good = false;
  }
  if (!good) {
    res.reasons.push("The signature does not match. The content was changed after GrowQR signed it.");
    res.steps.push(["Signature", "The signature must match the exact content.", false]);
    return res;
  }
  res.steps.push(["Signature", "The signature matches the exact content: nothing has been changed since GrowQR signed it.", true]);
  res.payload = payload;

  const from = Date.parse(String(payload.validFrom ?? "")) / 1000;
  const until = Date.parse(String(payload.validUntil ?? "")) / 1000;
  if (!Number.isFinite(from) || !Number.isFinite(until) || from > now + 300) {
    res.reasons.push("The validity dates are missing or not yet in effect.");
    res.steps.push(["Dates", "Must be inside the validity window.", false]);
    return res;
  }
  if (until < now) {
    res.state = "expired";
    res.reasons.push(`This credential expired on ${dmy(until)}.`);
    res.steps.push(["Dates", `Expired ${dmy(until)}.`, false]);
    return res;
  }
  res.steps.push(["Dates", `Valid from ${dmy(from)} until ${dmy(until)}.`, true]);

  const jti = String(payload.id ?? "").replace(/^urn:uuid:/, "");
  const row = jti !== "" ? await one<{ status: string }>("SELECT status FROM passport_credentials WHERE jti = $1", [jti]) : null;
  if (!row) {
    res.reasons.push("GrowQR has no record of this credential.");
    res.steps.push(["Status", "GrowQR must have issued it and not withdrawn it.", false]);
    return res;
  }
  if (row.status === "revoked") {
    res.state = "revoked";
    res.reasons.push("The holder withdrew this passport, or GrowQR revoked it.");
    res.steps.push(["Status", "Withdrawn or revoked.", false]);
    return res;
  }
  if (row.status === "superseded") {
    res.state = "superseded";
    res.ok = true;
    res.reasons.push("Authentic, but the holder has since published a newer version.");
    res.steps.push(["Status", "Authentic. A newer version has replaced it.", true]);
    return res;
  }
  res.steps.push(["Status", "Current: not withdrawn, not replaced.", true]);
  res.ok = true;
  res.state = "valid";
  return res;
}

// ------------------------------------------------------------------ published documents

export async function didDocument(): Promise<Record<string, unknown>> {
  const d = await did();
  const methods = Array.from(await publicKeys()).map(([kid, raw]) => ({
    id: `${d}#${kid}`,
    type: "JsonWebKey2020",
    controller: d,
    publicKeyJwk: { kty: "OKP", crv: "Ed25519", x: b64u(raw), kid },
  }));
  const refs = methods.map((m) => m.id);
  return {
    "@context": ["https://www.w3.org/ns/did/v1", "https://w3id.org/security/suites/jws-2020/v1"],
    id: d,
    verificationMethod: methods,
    assertionMethod: refs,
    authentication: refs,
  };
}

export async function jwks(): Promise<Record<string, unknown>> {
  return { keys: Array.from(await publicKeys()).map(([kid, raw]) => ({ kty: "OKP", crv: "Ed25519", x: b64u(raw), kid, use: "sig", alg: "EdDSA" })) };
}
