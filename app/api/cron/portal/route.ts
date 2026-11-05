export const dynamic = "force-dynamic";

import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { databaseConfigured } from "@/lib/portal/db";
import { flushMail } from "@/lib/portal/mail";
import { purgeExpiredSessions } from "@/lib/portal/session";
import * as VI from "@/lib/abroad/visa";
import { syncIfStale } from "@/lib/market/external";
import { autoCloseIdle } from "@/lib/support/store";

/**
 * GET /api/cron/portal
 *
 * The scheduled jobs the PHP app ran from cron, in one endpoint: send queued email, send visa-appointment reminders (7 days and 1 day, once
 * each), and delete expired sessions. Every step is safe to repeat. Run it every 10 minutes (see vercel.json).
 *
 * Auth: `Authorization: Bearer <CRON_SECRET>` (Vercel Cron adds it). Fails closed when CRON_SECRET is not set.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET ?? "";
  const given = req.headers.get("authorization") ?? "";
  const want = `Bearer ${secret}`;
  if (!secret || given.length !== want.length || !timingSafeEqual(Buffer.from(given), Buffer.from(want))) {
    return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });
  }
  if (!databaseConfigured()) return NextResponse.json({ status: "error", error: "DATABASE_URL is not set" }, { status: 503 });

  const out: Record<string, unknown> = {};
  const step = async (name: string, f: () => Promise<unknown>) => {
    try {
      out[name] = (await f()) ?? "ok";
    } catch (e) {
      console.error(`[cron/portal] ${name}:`, (e as Error).message);
      out[name] = "failed";
    }
  };
  await step("visa_reminders", () => VI.sendDueReminders()); // queue first, so the flush below sends them in the same run
  await step("mail", () => flushMail());
  await step("support_closed", () => autoCloseIdle());
  await step("sessions_purged", () => purgeExpiredSessions());
  await step("external_internships", () => syncIfStale()); // Adzuna India feed; runs about once a day, no-op until the keys are set
  return NextResponse.json({ status: "ok", ...out }, { headers: { "Cache-Control": "no-store" } });
}
