import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Sign in with Google and LinkedIn: OAuth 2.0 authorization-code flow with OpenID Connect scopes.
 *
 *  - Google uses PKCE (S256) on top of its client secret; LinkedIn is a confidential client and uses the secret and `state`.
 *  - The anonymous session (server side, httpOnly cookie) keeps the random `state` and the PKCE verifier, so nothing secret
 *    travels through the browser's URL. The callback must return the same `state` within 10 minutes, once.
 *  - The person's profile comes from the provider's userinfo endpoint over TLS using the access token, and the account is only
 *    used when the provider says the email is verified.
 *
 * Environment: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET. A provider with no keys is simply off.
 * The redirect address to register with each provider is <site>/auth/<provider>/callback (see migration/AUTH-SETUP.md).
 */
export type Provider = "google" | "linkedin";
export const PROVIDERS: Provider[] = ["google", "linkedin"];
export const isProvider = (s: string): s is Provider => (PROVIDERS as string[]).includes(s);

interface Cfg { label: string; authUrl: string; tokenUrl: string; userinfoUrl: string; scope: string; pkce: boolean; idVar: string; secretVar: string }
const CFG: Record<Provider, Cfg> = {
  google: { label: "Google", authUrl: "https://accounts.google.com/o/oauth2/v2/auth", tokenUrl: "https://oauth2.googleapis.com/token", userinfoUrl: "https://openidconnect.googleapis.com/v1/userinfo", scope: "openid email profile", pkce: true, idVar: "GOOGLE_CLIENT_ID", secretVar: "GOOGLE_CLIENT_SECRET" },
  linkedin: { label: "LinkedIn", authUrl: "https://www.linkedin.com/oauth/v2/authorization", tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken", userinfoUrl: "https://api.linkedin.com/v2/userinfo", scope: "openid profile email", pkce: false, idVar: "LINKEDIN_CLIENT_ID", secretVar: "LINKEDIN_CLIENT_SECRET" },
};

export const providerLabel = (p: Provider): string => CFG[p].label;
export const providerEnabled = (p: Provider): boolean => Boolean(process.env[CFG[p].idVar] && process.env[CFG[p].secretVar]);

export interface OAuthProfile { sub: string; email: string; emailVerified: boolean; name: string; picture: string | null }

const b64url = (b: Buffer): string => b.toString("base64url");

/** A PKCE verifier and its S256 challenge (RFC 7636). */
export function pkcePair(): { verifier: string; challenge: string } {
  const verifier = b64url(randomBytes(48));
  return { verifier, challenge: b64url(createHash("sha256").update(verifier).digest()) };
}

export const newState = (): string => randomBytes(24).toString("hex");

/** Constant-time comparison of two state strings. */
export function sameState(a: unknown, b: unknown): boolean {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length || a.length < 16) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export const redirectUri = (p: Provider, origin: string): string => `${origin.replace(/\/+$/, "")}/auth/${p}/callback`;

export function authorizeUrl(p: Provider, o: { origin: string; state: string; challenge: string }): string {
  const c = CFG[p];
  const q = new URLSearchParams({ response_type: "code", client_id: process.env[c.idVar] ?? "", redirect_uri: redirectUri(p, o.origin), scope: c.scope, state: o.state });
  if (c.pkce) { q.set("code_challenge", o.challenge); q.set("code_challenge_method", "S256"); }
  if (p === "google") { q.set("prompt", "select_account"); q.set("include_granted_scopes", "false"); }
  return `${c.authUrl}?${q.toString()}`;
}

const timeout = () => AbortSignal.timeout(8000);

export async function exchangeCode(p: Provider, code: string, verifier: string, origin: string): Promise<string | null> {
  const c = CFG[p];
  const body = new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri(p, origin), client_id: process.env[c.idVar] ?? "", client_secret: process.env[c.secretVar] ?? "" });
  if (c.pkce) body.set("code_verifier", verifier);
  try {
    const res = await fetch(c.tokenUrl, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" }, body, signal: timeout(), cache: "no-store" });
    if (!res.ok) { console.error(`[oauth] ${p} token exchange failed: ${res.status}`); return null; }
    const j = (await res.json()) as { access_token?: unknown };
    return typeof j.access_token === "string" && j.access_token.length > 10 ? j.access_token : null;
  } catch (e) {
    console.error(`[oauth] ${p} token exchange error:`, (e as Error).message);
    return null;
  }
}

/** Map a provider's userinfo response to our profile. Exported for tests. */
export function mapProfile(j: Record<string, unknown>): OAuthProfile | null {
  const sub = typeof j.sub === "string" ? j.sub.trim() : "";
  const email = typeof j.email === "string" ? j.email.trim().toLowerCase() : "";
  if (!sub || sub.length > 190 || !email || email.length > 190 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return null;
  const verified = j.email_verified === true || j.email_verified === "true";
  const name = (typeof j.name === "string" && j.name.trim()) || [j.given_name, j.family_name].filter((x) => typeof x === "string" && x).join(" ") || email.slice(0, email.indexOf("@"));
  const pic = typeof j.picture === "string" && /^https:\/\//.test(j.picture) && j.picture.length <= 500 ? j.picture : null;
  return { sub, email, emailVerified: verified, name: Array.from(String(name)).slice(0, 120).join(""), picture: pic };
}

export async function fetchProfile(p: Provider, accessToken: string): Promise<OAuthProfile | null> {
  try {
    const res = await fetch(CFG[p].userinfoUrl, { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" }, signal: timeout(), cache: "no-store" });
    if (!res.ok) { console.error(`[oauth] ${p} userinfo failed: ${res.status}`); return null; }
    return mapProfile((await res.json()) as Record<string, unknown>);
  } catch (e) {
    console.error(`[oauth] ${p} userinfo error:`, (e as Error).message);
    return null;
  }
}

/** Friendly text for the ?e= code that /login shows after a failed or cancelled provider sign-in. */
export const OAUTH_ERRORS: Record<string, string> = {
  oauth_unavailable: "That sign-in option is not available yet. Please use your email instead.",
  oauth_denied: "Sign-in was cancelled. You can try again, or use your email.",
  oauth_failed: "We could not complete that sign-in. Please try again, or use your email.",
  oauth_state: "That sign-in link expired or was already used. Please start again.",
  oauth_email: "Your account did not share a verified email address, so we could not sign you in. Please use your email instead.",
  oauth_staff: "Staff accounts must sign in with their email, password and verification code.",
  oauth_limit: "Too many sign-in attempts from this network. Please try again later.",
};
