import { NextResponse } from "next/server";
import { databaseConfigured, val } from "@/lib/portal/db";

export const dynamic = "force-dynamic";

/** Settings the portal needs: reported as present or missing only, never their values. */
const EXPECTED = ["DATABASE_URL", "SITE_MODE", "PORTAL_APP_URL", "PORTAL_AUTO_MIGRATE", "STORAGE_DIR", "PASSPORT_SIGNING_SEED", "CRON_SECRET", "RESEND_API_KEY"];

// For uptime checks after a deploy: is the server up, can it reach the database, and which settings arrived. Reveals no values.
export async function GET() {
  const h = { "Cache-Control": "no-store" };
  const settings = Object.fromEntries(EXPECTED.map((k) => [k, Boolean(process.env[k])]));
  if (!databaseConfigured()) return NextResponse.json({ ok: false, database: "not configured", settings }, { status: 503, headers: h });
  try {
    await val("SELECT 1");
    return NextResponse.json({ ok: true, database: "ok", settings }, { headers: h });
  } catch {
    return NextResponse.json({ ok: false, database: "unreachable", settings }, { status: 503, headers: h });
  }
}
