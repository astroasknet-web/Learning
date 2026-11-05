import { NextResponse } from "next/server";
import { authorizeUrl, isProvider, newState, pkcePair, providerEnabled } from "@/lib/portal/oauth";
import { asOAuthRole } from "@/lib/portal/oauth-accounts";
import { siteOrigin } from "@/lib/portal/origin";
import { safeNext } from "@/lib/portal/security";
import { getSession, putSessionData } from "@/lib/portal/session";
import { databaseConfigured } from "@/lib/portal/db";

export const dynamic = "force-dynamic";

/** Start a Google or LinkedIn sign-in: remember a one-time state in the server session, then send the browser to the provider. */
export async function GET(req: Request, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  const origin = siteOrigin(req);
  const url = new URL(req.url);
  const back = (code: string) => NextResponse.redirect(new URL(`/login?e=${code}`, origin), 303);
  if (!isProvider(provider) || !providerEnabled(provider) || !databaseConfigured()) return back("oauth_unavailable");
  if ((await getSession())?.user) return NextResponse.redirect(new URL("/account", origin), 303);

  const state = newState();
  const { verifier, challenge } = pkcePair();
  await putSessionData({ oauth: { s: state, v: verifier, p: provider, role: asOAuthRole(url.searchParams.get("role")), next: safeNext(url.searchParams.get("next"), ""), t: Date.now() } });
  const res = NextResponse.redirect(authorizeUrl(provider, { origin, state, challenge }), 303);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
