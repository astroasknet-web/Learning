import { z } from "zod";
import { confirmPayment } from "@/lib/pay/checkout";
import { assertSameOrigin, fail, handleError, ipOf, ok, viewerOf } from "@/lib/pay/http";
import { allow } from "@/lib/pay/rate-limit";

export const dynamic = "force-dynamic";

const schema = z.object({ razorpay_payment_id: z.string().max(60).optional(), razorpay_signature: z.string().max(200).optional() });

/**
 * POST /api/v1/orders/{id}/confirm
 * Called when the customer returns from checkout (and by the status page while it waits). It never marks anything paid by itself: the
 * server asks the provider for the payment and checks amount, currency and order before it changes state. The optional Razorpay fields only help
 * find the payment, and are used only when Razorpay's checkout signature on them is valid.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const { id } = await ctx.params;
    if (!(await allow(`pay:confirm:${id}`, 60, 15)) || !(await allow(`pay:confirm:ip:${await ipOf()}`, 200, 15))) return fail("rate_limited", "Please wait a moment before checking again.", 429);
    const body = schema.parse(await req.json().catch(() => ({})));
    const r = await confirmPayment(id, await viewerOf(req), { razorpayPaymentId: body.razorpay_payment_id, razorpaySignature: body.razorpay_signature });
    return ok({ order: r.order, settled: r.outcome?.newlyPaid ?? false });
  } catch (e) {
    return handleError(e);
  }
}
