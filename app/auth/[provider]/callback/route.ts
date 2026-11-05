import { NextResponse } from "next/server";
import { homeFor } from "@/lib/portal/auth";
import { exchangeCode, fetchProfile, isProvider, providerEnabled, sameState } from "@/lib/portal/oauth";
import { asOAuthRole, signInWithProvider } from "@/lib/portal/oauth-accounts";
import { siteOrigin } from "@/lib/portal/origin";
import { audit, clientIpFrom, safeNext } from "@/lib/portal/security";
import { dropSessionData, endAllSessions, getSession, startSession } from "@/lib/portal/session";

export const dynamic = "force-dynamic";
const MAX_AGE_MS = 10 * 60 * 1000;

/** The provider sends the person back here with a one-time code. Check the state, fetch the profile, sign in or create the account. */
export async function GET(req: Request, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  const origin = siteOrigin(req);
  const url = new URL(req.url);
  const go = (path: string) => { const r = NextResponse.redirect(new URL(path, origin), 303); r.headers.set("Cache-Control", "no-store"); return r; };
  const fail = (code: string) => go(`/login?e=${code}`);

  if (!isProvider(provider) || !providerEnabled(provider)) return fail("oauth_unavailable");
  const s = await getSession();
  const saved = (s?.data.oauth ?? null) as { s?: string; v?: string; p?: string; role?: string; next?: string; t?: number } | null;
  if (saved) await dropSessionData("oauth"); // a state works once, whatever happens next

  if (url.searchParams.get("error")) return fail("oauth_denied");
  const code = url.searchParams.get("code") ?? "";
  if (!saved || saved.p !== provider || !sameState(saved.s, url.searchParams.get("state")) || !saved.t || Date.now() - saved.t > MAX_AGE_MS || code.length < 8 || code.length > 2048) return fail("oauth_state");

  const token = await exchangeCode(provider, code, String(saved.v ?? ""), origin);
  if (!token) return fail("oauth_failed");
  const profile = await fetchProfile(provider, token);
  if (!profile) return fail("oauth_failed");

  const r = await signInWithProvider(provider, profile, asOAuthRole(saved.role), clientIpFrom(req.headers), endAllSessions);
  if (!r.ok) return fail(r.code);

  const next = safeNext(saved.next, "");
  if (r.user.mfa_enabled_at) {
    await startSession(null, { mfa_uid: r.user.id, mfa_t: Date.now(), mfa_next: next });
    return go("/login/mfa");
  }
  await startSession(r.user.id);
  await audit(r.user.id, r.user.id, `login.${provider}`, r.created ? "created" : "");
  return go(r.created ? `${homeFor(r.user.role)}?welcome=1` : safeNext(next, homeFor(r.user.role)));
}
