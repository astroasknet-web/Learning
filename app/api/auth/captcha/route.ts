import { NextResponse } from "next/server";
import { captchaMode, imageChallenge } from "@/lib/portal/captcha";
import { databaseConfigured } from "@/lib/portal/db";
import { clientIp, fails, recordFail } from "@/lib/portal/security";

export const dynamic = "force-dynamic";

/** A fresh signed token for the picture code on the login, sign-up and password-reset forms. */
export async function GET() {
  const h = { "Cache-Control": "no-store" };
  if (!databaseConfigured() || captchaMode() !== "image") return NextResponse.json({ error: "not_needed" }, { status: 404, headers: h });
  try {
    const ip = await clientIp();
    if ((await fails(`capnew:${ip}`)) >= 60) return NextResponse.json({ error: "slow_down" }, { status: 429, headers: h });
    await recordFail(`capnew:${ip}`);
    return NextResponse.json({ token: await imageChallenge() }, { headers: h });
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503, headers: h });
  }
}
