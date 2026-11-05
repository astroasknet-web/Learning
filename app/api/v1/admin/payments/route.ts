import { searchPayments } from "@/lib/pay/admin";
import { ok, pageParams, staffApi } from "@/lib/pay/http";

export const dynamic = "force-dynamic";

/** GET /api/v1/admin/payments?q=&status=&provider=&currency=&from=YYYY-MM-DD&to=YYYY-MM-DD&page=&perPage=  (permission: view) */
export const GET = staffApi("view", async (req) => {
  const u = new URL(req.url);
  const { page, perPage } = pageParams(req, 200);
  const r = await searchPayments({ q: u.searchParams.get("q") ?? undefined, status: u.searchParams.get("status") ?? undefined, provider: u.searchParams.get("provider") ?? undefined, currency: u.searchParams.get("currency") ?? undefined, from: u.searchParams.get("from") ?? undefined, to: u.searchParams.get("to") ?? undefined, page, perPage });
  return ok(r.rows, 200, { page, perPage, total: r.total });
});
