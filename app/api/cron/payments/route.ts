export const dynamic = "force-dynamic";

import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { databaseConfigured } from "@/lib/portal/db";
import { runPaymentJobs } from "@/lib/pay/jobs";

/**
 * GET /api/cron/payments
 * Expires unpaid orders, retries failed webhooks, finishes stuck refunds, reconciles with the providers (about every six hours) and raises
 * alerts. Safe to call every few minutes. Auth: `Authorization: Bearer <CRON_SECRET>`; it refuses everything when CRON_SECRET is not set.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET ?? "";
  const given = req.headers.get("authorization") ?? "";
  const want = `Bearer ${secret}`;
  if (!secret || given.length !== want.length || !timingSafeEqual(Buffer.from(given), Buffer.from(want))) return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });
  if (!databaseConfigured()) return NextResponse.json({ status: "error", error: "DATABASE_URL is not set" }, { status: 503 });
  return NextResponse.json({ status: "ok", ...(await runPaymentJobs()) }, { headers: { "Cache-Control": "no-store" } });
}
