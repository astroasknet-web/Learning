import { orderDetail } from "@/lib/pay/admin";
import { ok, staffApi } from "@/lib/pay/http";

export const dynamic = "force-dynamic";

/** GET /api/v1/admin/payments/{orderId}: the full picture of one order: items, payments, refunds, disputes, documents, webhooks and the audit timeline (permission: view). Provider messages are shown to staff, never to customers. */
export const GET = staffApi<{ id: string }>("view", async (_req, _staff, { id }) => ok(await orderDetail(id)));
