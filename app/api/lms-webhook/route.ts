import { NextResponse } from "next/server";
import { databaseConfigured } from "@/lib/portal/db";
import { handleWebhook } from "@/lib/market/learning";

export const dynamic = "force-dynamic";

// Optional signed completion callback from an external learning platform. Disabled until LMS_WEBHOOK_SECRET is set. See lib/market/learning.ts for the signature rule.
export async function POST(req: Request) {
  const headers = { "Cache-Control": "no-store" };
  if (!databaseConfigured()) return NextResponse.json({ error: "unavailable" }, { status: 503, headers });
  const raw = await req.text();
  if (Buffer.byteLength(raw) > 20000) return NextResponse.json({ error: "too large" }, { status: 413, headers });
  const r = await handleWebhook(raw, req.headers.get("x-timestamp") ?? "", req.headers.get("x-signature") ?? "");
  return NextResponse.json(r.body, { status: r.status, headers });
}
