import { NextResponse } from "next/server";
import { receiveWebhook } from "@/lib/pay/webhooks";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/v1/webhooks/razorpay and /api/v1/webhooks/stripe
 * Provider to us. There is no login: trust comes only from the provider's signature over the EXACT raw body, so the body is read as text and
 * never parsed before it is verified. Register these URLs in each provider's dashboard (see migration/payments/OPERATIONS.md).
 * 200 means "received" (also for repeats and events we do not use); 500 and 503 make the provider try again later.
 */
export async function POST(req: Request, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  const raw = await req.text();
  const r = await receiveWebhook(provider, raw, req.headers);
  return NextResponse.json(r.body, { status: r.status, headers: { "Cache-Control": "no-store" } });
}
