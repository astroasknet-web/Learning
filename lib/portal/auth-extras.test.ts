import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { authorizeUrl, mapProfile, newState, pkcePair, providerEnabled, redirectUri, sameState } from "./oauth";
import { countInRange, sha1Parts } from "./pwned";
import { estimate } from "./strength";
import { search, sha256Bytes, zeroBits } from "../../components/portal/pow";

const hex = (h: Uint32Array) => Array.from(h).map((x) => (x >>> 0).toString(16).padStart(8, "0")).join("");

describe("sign in with Google and LinkedIn", () => {
  it("makes a PKCE pair whose challenge is the S256 of the verifier", () => {
    const { verifier, challenge } = pkcePair();
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(challenge).toBe(createHash("sha256").update(verifier).digest("base64url"));
  });

  it("compares state in constant time and rejects short or different values", () => {
    const s = newState();
    expect(s).toMatch(/^[a-f0-9]{48}$/);
    expect(sameState(s, s)).toBe(true);
    expect(sameState(s, newState())).toBe(false);
    expect(sameState(s, s.slice(0, 40))).toBe(false);
    expect(sameState(undefined, s)).toBe(false);
    expect(sameState("a", "a")).toBe(false);
  });

  it("builds the authorisation address with state, redirect and PKCE for Google only", () => {
    process.env.GOOGLE_CLIENT_ID = "gid"; process.env.GOOGLE_CLIENT_SECRET = "gsecret";
    process.env.LINKEDIN_CLIENT_ID = "lid"; process.env.LINKEDIN_CLIENT_SECRET = "lsecret";
    const g = new URL(authorizeUrl("google", { origin: "https://qrscore.mathstudy.in/", state: "st", challenge: "ch" }));
    expect(g.origin + g.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(g.searchParams.get("redirect_uri")).toBe("https://qrscore.mathstudy.in/auth/google/callback");
    expect(g.searchParams.get("state")).toBe("st");
    expect(g.searchParams.get("code_challenge_method")).toBe("S256");
    expect(g.searchParams.get("scope")).toBe("openid email profile");
    const l = new URL(authorizeUrl("linkedin", { origin: "https://x.test", state: "st", challenge: "ch" }));
    expect(l.searchParams.get("code_challenge")).toBeNull();
    expect(l.searchParams.get("scope")).toBe("openid profile email");
    expect(redirectUri("linkedin", "https://x.test")).toBe("https://x.test/auth/linkedin/callback");
  });

  it("is off until both keys are set", () => {
    delete process.env.GOOGLE_CLIENT_ID;
    expect(providerEnabled("google")).toBe(false);
    process.env.GOOGLE_CLIENT_ID = "gid";
    expect(providerEnabled("google")).toBe(true);
  });

  it("maps a userinfo response and refuses one without a usable email or id", () => {
    expect(mapProfile({ sub: "123", email: "Ada@Example.com", email_verified: true, name: "Ada Lovelace", picture: "https://p.example/a.png" })).toEqual({ sub: "123", email: "ada@example.com", emailVerified: true, name: "Ada Lovelace", picture: "https://p.example/a.png" });
    expect(mapProfile({ sub: "9", email: "a@b.co", email_verified: "true", given_name: "A", family_name: "B" })?.name).toBe("A B");
    expect(mapProfile({ sub: "9", email: "a@b.co", email_verified: false })?.emailVerified).toBe(false);
    expect(mapProfile({ sub: "9", email: "a@b.co", picture: "http://insecure/x.png" })?.picture).toBeNull();
    expect(mapProfile({ email: "a@b.co" })).toBeNull();
    expect(mapProfile({ sub: "9", email: "not-an-email" })).toBeNull();
  });
});

describe("password breach check", () => {
  it("splits the SHA-1 into a 5-character prefix and the rest", () => {
    const { prefix, suffix } = sha1Parts("password");
    expect(prefix + suffix).toBe("5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8");
    expect(prefix).toBe("5BAA6");
  });
  it("reads a range response and ignores padding rows", () => {
    const body = "003D68EB55068C33ACE09247EE4C639306B:3\r\n1E4C9B93F3F0682250B6CF8331B7EE68FD8:3861493\r\nFFFF0000000000000000000000000000000:0";
    expect(countInRange(body, "1E4C9B93F3F0682250B6CF8331B7EE68FD8")).toBe(3861493);
    expect(countInRange(body, "FFFF0000000000000000000000000000000")).toBe(0);
    expect(countInRange(body, "ABSENT")).toBe(0);
  });
});

describe("password strength meter", () => {
  it("scores short, common and long passwords sensibly", () => {
    expect(estimate("").score).toBe(0);
    expect(estimate("abc").score).toBe(0);
    expect(estimate("password123").score).toBeLessThanOrEqual(1);
    expect(estimate("ada12345", "ada@example.com", "Ada").score).toBeLessThanOrEqual(1);
    expect(estimate("correct horse battery staple 47!").score).toBe(4);
    expect(estimate("Tr1cky-Plum-Lantern").score).toBeGreaterThanOrEqual(3);
  });
});

describe("built-in human check (browser side)", () => {
  it("hashes exactly like Node's SHA-256", () => {
    for (const s of ["", "abc", "1700000000000.deadbeef.16.sig:zz", "x".repeat(55), "x".repeat(56), "x".repeat(64), "x".repeat(200), "naïve ✓"]) {
      expect(hex(sha256Bytes(new TextEncoder().encode(s)))).toBe(createHash("sha256").update(s, "utf8").digest("hex"));
    }
  });
  it("finds a nonce with the required zero bits that the server-side check accepts", () => {
    const challenge = "1700000000000.0123456789abcdef01234567.12.signature";
    const nonce = search(challenge, 12, 0, 500000);
    expect(nonce).not.toBeNull();
    const d = createHash("sha256").update(`${challenge}:${nonce}`).digest();
    let bits = 0;
    for (const byte of d) { if (byte === 0) { bits += 8; continue; } bits += Math.clz32(byte) - 24; break; }
    expect(bits).toBeGreaterThanOrEqual(12);
    expect(zeroBits(new Uint32Array([0x0000ffff, 0]))).toBe(16);
  });
});
