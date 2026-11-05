import { NextResponse } from "next/server";
import { z } from "zod";
import { databaseConfigured, run } from "@/lib/portal/db";
import { rateLimit, rateLimited } from "@/lib/rate-limit";
import { createLogger } from "@/lib/log";

const log = createLogger("newsletter");
const Body = z.object({
  kind: z.literal("newsletter").optional(),
  email: z.string().trim().toLowerCase().email("Please enter a valid email address.").max(190),
  source: z.string().trim().max(60).default("footer"),
});

/** Newsletter box in the standard footer. Honeypot is handled in the browser; this route rate-limits and stores the address once. */
export async function POST(req: Request) {
  const rl = await rateLimit(req, { key: "newsletter", limit: 6, windowMs: 10 * 60_000 });
  if (!rl.ok) return rateLimited(rl.retryAfterSec);
  let json: unknown;
  try { json = await req.json(); } catch { return NextResponse.json({ error: "bad_request", message: "Invalid request." }, { status: 400 }); }
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid", message: parsed.error.issues[0]?.message ?? "Please check your email." }, { status: 422 });
  if (!databaseConfigured()) return NextResponse.json({ error: "unavailable", message: "We cannot take sign-ups right now. Please try again shortly." }, { status: 503 });
  try {
    await run("INSERT INTO newsletter_subscribers (email, source) VALUES ($1,$2) ON CONFLICT DO NOTHING", [parsed.data.email, parsed.data.source]);
  } catch (e) {
    log.error("insert failed", { message: (e as Error).message });
    return NextResponse.json({ error: "server", message: "Something went wrong. Please try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
