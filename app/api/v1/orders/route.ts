import { releaseHeldCoupon, startCheckout } from "@/lib/pay/checkout";
import { assertSameOrigin, fail, handleError, ipOf, ok, pageParams, viewerOf } from "@/lib/pay/http";
import { withIdempotency } from "@/lib/pay/idempotency";
import { createOrder, createOrderSchema, listOrders, PayError } from "@/lib/pay/orders";
import { allow } from "@/lib/pay/rate-limit";
import { siteOrigin } from "@/lib/portal/origin";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/orders
 * Creates an order from SKUs, quantities, a country, an optional coupon and the buyer's details, prices it on the server, and starts payment.
 * Send an `Idempotency-Key` header: repeating the call with the same key and body returns the first result instead of creating a second order.
 * Response 201: { data: { order, checkout, accessToken? } }. `accessToken` is only for guests and is shown once.
 */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const ip = await ipOf();
    if (!(await allow(`pay:order:${ip}`, 20, 15))) return fail("rate_limited", "Too many checkouts started. Please wait a few minutes.", 429);
    const body = createOrderSchema.parse(await req.json().catch(() => ({})));
    const v = await viewerOf(req);
    if (v.userId !== null && !(await allow(`pay:order:user:${v.userId}`, 30, 60))) return fail("rate_limited", "Too many checkouts started. Please wait a few minutes.", 429);
    const origin = siteOrigin(req);
    let guestToken: string | null = null; // the guest's bearer token: returned once, never stored with the replayable answer

    if (v.userId !== null && body.coupon) await releaseHeldCoupon(v.userId, body.coupon);
    const out = await withIdempotency(`order:${v.userId ?? ip}`, req.headers.get("idempotency-key"), body, async () => {
      const created = await createOrder(body, { userId: v.userId });
      if (v.userId === null) guestToken = created.accessToken;
      try {
        const started = await startCheckout(created.order.id, { userId: v.userId, token: created.accessToken }, { origin, provider: body.provider ?? null });
        return { status: 201, body: { order: started.order, checkout: started.checkout, paid: started.paid } };
      } catch (e) {
        // The order exists and is unpaid. Tell the caller its id so the same checkout can be retried, and do not remember this failure under the idempotency key.
        if (e instanceof PayError) throw new PayError(e.code, e.message, e.status, { ...(e.details ?? {}), orderId: created.order.id });
        throw e;
      }
    });
    return ok({ ...(out.body as object), ...(guestToken && !out.replayed ? { accessToken: guestToken } : {}) }, out.status, out.replayed ? { replayed: true } : {});
  } catch (e) {
    return handleError(e);
  }
}

/** GET /api/v1/orders?page=1&perPage=20: the signed-in customer's own orders, newest first. */
export async function GET(req: Request) {
  try {
    const v = await viewerOf(req);
    if (v.userId === null) return fail("unauthenticated", "Please sign in.", 401);
    const { page, perPage } = pageParams(req, 50);
    const r = await listOrders(v.userId, page, perPage);
    return ok(r.orders, 200, { page, perPage, total: r.total });
  } catch (e) {
    return handleError(e);
  }
}
