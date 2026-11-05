import { allow } from "@/lib/pay/rate-limit";
import { assertSameOrigin, fail, handleError, ipOf, ok, viewerOf } from "@/lib/pay/http";
import { quoteOrder, quoteSchema } from "@/lib/pay/quote";

export const dynamic = "force-dynamic";

/** POST /api/v1/orders/quote: the price of a basket for a country (and optional currency and coupon). Nothing is stored. */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    if (!(await allow(`pay:quote:${await ipOf()}`, 120, 15))) return fail("rate_limited", "Too many requests. Please wait a moment.", 429);
    const body = quoteSchema.parse(await req.json().catch(() => ({})));
    const v = await viewerOf(req);
    return ok(await quoteOrder(body, { userId: v.userId }));
  } catch (e) {
    return handleError(e);
  }
}
