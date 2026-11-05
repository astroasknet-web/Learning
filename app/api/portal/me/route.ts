import { NextResponse } from "next/server";
import { databaseConfigured } from "@/lib/portal/db";
import { getSession } from "@/lib/portal/session";

export const dynamic = "force-dynamic";

// Tells the site-wide menu whether the visitor has a portal session (first name and role only), so it can offer "Log in" or "My account".
export async function GET() {
  const h = { "Cache-Control": "private, no-store" };
  if (!databaseConfigured()) return NextResponse.json({ user: null }, { headers: h });
  try {
    const u = (await getSession())?.user;
    return NextResponse.json({ user: u ? { name: u.name, role: u.role } : null }, { headers: h });
  } catch {
    return NextResponse.json({ user: null }, { headers: h });
  }
}
