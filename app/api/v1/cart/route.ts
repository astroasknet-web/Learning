import { cartSchema, viewCart } from "@/lib/pay/cart";
import { assertSameOrigin, fail, handleError, ipOf, ok, viewerOf } from "@/lib/pay/http";
import { allow } from "@/lib/pay/rate-limit";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/cart  { skus, country, currency?, coupon? }
 * Turns the browser's cart (a list of product codes) into labelled lines (buyable, already owned, or unavailable) and a price for the buyable
 * ones. Read-only: nothing is stored on the server and nothing is reserved. Checkout prices everything again from scratch.
 */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    if (!(await allow(`pay:cart:${await ipOf()}`, 120, 15))) return fail("rate_limited", "Too many requests. Please wait a moment.", 429);
    const body = cartSchema.parse(await req.json().catch(() => ({})));
    const v = await viewerOf(req);
    return ok(await viewCart(body, { userId: v.userId }));
  } catch (e) {
    return handleError(e);
  }
}
