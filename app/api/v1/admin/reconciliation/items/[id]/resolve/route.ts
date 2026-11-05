import { ok, staffApi } from "@/lib/pay/http";
import { PayError } from "@/lib/pay/orders";
import { resolveItem } from "@/lib/pay/reconcile";

export const dynamic = "force-dynamic";

/** POST /api/v1/admin/reconciliation/items/{id}/resolve: mark a difference as looked at (permission: reconcile). This only closes the note; it never changes a payment. */
export const POST = staffApi<{ id: string }>("reconcile", async (_req, staff, { id }) => {
  const n = Number(id);
  if (!Number.isInteger(n) || n < 1) throw new PayError("not_found", "No such item.", 404);
  await resolveItem(n, staff.user.id);
  return ok({ resolved: true });
});
