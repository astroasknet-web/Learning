import { ok, staffApi } from "@/lib/pay/http";
import { PayError } from "@/lib/pay/orders";
import { forceRetry } from "@/lib/pay/webhooks";

export const dynamic = "force-dynamic";

/** POST /api/v1/admin/webhooks/{id}/retry  (permission: retry_webhook). Body: { confirm: true }. Processing is idempotent, so a retry can never pay or fulfil an order twice. */
export const POST = staffApi<{ id: string }>("retry_webhook", async (req, staff, { id }) => {
  const b = (await req.json().catch(() => ({}))) as { confirm?: boolean };
  if (b.confirm !== true) throw new PayError("confirmation_required", "Confirm the retry.", 400);
  const n = Number(id);
  if (!Number.isInteger(n) || n < 1) throw new PayError("not_found", "No such event.", 404);
  const r = await forceRetry(n, staff.user.id);
  return ok({ result: r.body });
});
