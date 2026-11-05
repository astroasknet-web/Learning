import { z } from "zod";
import { ok, staffApi } from "@/lib/pay/http";
import { PayError } from "@/lib/pay/orders";
import { requestRefund } from "@/lib/pay/refunds";

export const dynamic = "force-dynamic";

const schema = z.object({
  orderId: z.string().regex(/^ord_[a-z0-9]{10,40}$/),
  paymentId: z.number().int().positive().optional(),
  amountMinor: z.number().int().positive().optional(), // omit to refund everything that is left
  reason: z.string().trim().min(3).max(255),
  confirm: z.literal(true), // a refund moves money: the caller must say so explicitly
});

/**
 * POST /api/v1/admin/refunds  (permission: refund)
 * Body: { orderId, amountMinor?, reason, confirm: true }. Header `Idempotency-Key` is required: repeating the call with the same key returns the
 * same refund and never creates a second one. The refund is "pending" until the provider confirms it.
 */
export const POST = staffApi("refund", async (req, staff) => {
  const key = req.headers.get("idempotency-key");
  if (!key) throw new PayError("bad_idempotency_key", "An Idempotency-Key header is required for refunds.", 400);
  const b = schema.parse(await req.json().catch(() => ({})));
  const r = await requestRefund({ orderPublicId: b.orderId, paymentId: b.paymentId, amountMinor: b.amountMinor, reason: b.reason, staffUserId: staff.user.id, idempotencyKey: key });
  return ok(r, r.status === "failed" ? 200 : 202);
});
