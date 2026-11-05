import { startCheckout } from "@/lib/pay/checkout";
import { assertSameOrigin, fail, handleError, ipOf, ok, viewerOf } from "@/lib/pay/http";
import { allow } from "@/lib/pay/rate-limit";
import { siteOrigin } from "@/lib/portal/origin";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/orders/{id}/checkout
 * (Re)start payment for an unpaid order, for example after a failed attempt. If an earlier attempt turns out to have been paid, no new charge
 * is started and { paid: true } is returned instead.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const { id } = await ctx.params;
    if (!(await allow(`pay:start:${await ipOf()}`, 30, 15))) return fail("rate_limited", "Too many attempts. Please wait a few minutes.", 429);
    const v = await viewerOf(req);
    const body = (await req.json().catch(() => ({}))) as { provider?: string };
    const r = await startCheckout(id, v, { origin: siteOrigin(req), provider: body.provider === "razorpay" || body.provider === "stripe" ? body.provider : null });
    return ok(r);
  } catch (e) {
    return handleError(e);
  }
}
