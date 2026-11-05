import { getDocuments } from "@/lib/pay/invoices";
import { first, pool, rows } from "@/lib/pay/db";
import { handleError, ok, viewerOf } from "@/lib/pay/http";
import { loadOrder, orderView } from "@/lib/pay/orders";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/orders/{id}
 * An order the caller owns (signed in, or holding the order's access token in `X-Order-Token` or `?k=`), with the state of its latest
 * payment, its documents and its refunds. Provider messages are not passed through: `payment.problem` is a short, fixed category.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const v = await viewerOf(req);
    const o = await loadOrder(pool, id, v);
    const p = await first(pool, "SELECT status, provider, method, failure_code FROM pay_payments WHERE order_id = $1 AND provider <> 'free' ORDER BY id DESC LIMIT 1", [o.id]);
    const docs = await getDocuments(Number(o.id));
    const refunds = await rows(pool, "SELECT public_id, amount_minor, currency, status, created_at FROM pay_refunds WHERE order_id = $1 ORDER BY id", [o.id]);
    const problem = p && (p.status === "failed" || (p.status === "pending" && p.failure_code)) ? "declined" : p?.status === "expired" ? "expired" : p?.status === "cancelled" ? "cancelled" : null;
    return ok({
      order: await orderView(pool, o),
      payment: p ? { status: p.status, provider: p.provider, method: p.method, problem } : null,
      documents: docs.map((d) => ({ number: d.number, kind: d.kind, title: d.title, issuedAt: d.issuedAt })),
      refunds: refunds.map((r) => ({ id: r.public_id, amountMinor: Number(r.amount_minor), currency: r.currency, status: r.status })),
    });
  } catch (e) {
    return handleError(e);
  }
}
