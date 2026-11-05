import { listWebhooks } from "@/lib/pay/admin";
import { ok, pageParams, staffApi } from "@/lib/pay/http";

export const dynamic = "force-dynamic";

/** GET /api/v1/admin/webhooks?status=failed|dead|processed|ignored|received&page=&perPage=  (permission: view) */
export const GET = staffApi("view", async (req) => {
  const { page, perPage } = pageParams(req, 200);
  const r = await listWebhooks({ status: new URL(req.url).searchParams.get("status") ?? undefined, page, perPage });
  return ok(r.rows, 200, { page, perPage, total: r.total });
});
