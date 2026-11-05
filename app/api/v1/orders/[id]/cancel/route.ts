import { cancelOrder } from "@/lib/pay/checkout";
import { assertSameOrigin, handleError, ok, viewerOf } from "@/lib/pay/http";

export const dynamic = "force-dynamic";

/** POST /api/v1/orders/{id}/cancel: cancel an unpaid order. A paid order cannot be cancelled here (it is refunded by staff). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const { id } = await ctx.params;
    return ok({ order: await cancelOrder(id, await viewerOf(req)) });
  } catch (e) {
    return handleError(e);
  }
}
