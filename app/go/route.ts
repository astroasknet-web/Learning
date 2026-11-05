import { NextResponse } from "next/server";
import { databaseConfigured } from "@/lib/portal/db";
import { recordClick } from "@/lib/portal/events";
import { getSession } from "@/lib/portal/session";

export const dynamic = "force-dynamic";

// Outbound link to MathStudy.in: count the click, then redirect. The host is fixed (MATHSTUDY_URL) and the path is validated,
// so this cannot be used as an open redirect.
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const campaign = (q.get("c") ?? "site").replace(/[^\w-]/g, "") || "site";
  let path = q.get("p") ?? "/shop";
  if (!/^\/[A-Za-z0-9/_\-.?=&%]{0,200}$/.test(path) || path.startsWith("//") || path.includes("..")) path = "/shop";
  if (databaseConfigured()) {
    const user = (await getSession())?.user ?? null;
    await recordClick(req.headers, campaign, path, user ? { id: user.id, role: user.role } : null);
  }
  const base = (process.env.MATHSTUDY_URL || "https://mathstudy.in").replace(/\/+$/, "");
  const dest = `${base}${path}${path.includes("?") ? "&" : "?"}utm_source=growqr&utm_medium=referral&utm_campaign=${encodeURIComponent(campaign)}`;
  return NextResponse.redirect(dest, { status: 302, headers: { "X-Robots-Tag": "noindex, nofollow", "Cache-Control": "no-store" } });
}
