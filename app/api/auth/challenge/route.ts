import { NextResponse } from "next/server";
import { captchaMode, powChallenge } from "@/lib/portal/captcha";
import { databaseConfigured } from "@/lib/portal/db";

export const dynamic = "force-dynamic";

/** A fresh proof-of-work challenge for the built-in human check. */
export async function GET() {
  if (!databaseConfigured() || captchaMode() !== "pow") return NextResponse.json({ error: "not_needed" }, { status: 404 });
  try {
    const c = await powChallenge();
    return NextResponse.json(c, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
