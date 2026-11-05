import { listAudit } from "@/lib/pay/admin";
import { verifyAuditChain } from "@/lib/pay/audit";
import { pool } from "@/lib/pay/db";
import { ok, pageParams, staffApi } from "@/lib/pay/http";

export const dynamic = "force-dynamic";

/** GET /api/v1/admin/audit?entity=&entityId=&page=&perPage=  (permission: view_audit). Add ?verify=1 to check the whole hash chain for tampering. */
export const GET = staffApi("view_audit", async (req) => {
  const u = new URL(req.url);
  if (u.searchParams.get("verify") === "1") return ok(await verifyAuditChain(pool));
  const { page, perPage } = pageParams(req, 200);
  const r = await listAudit({ entity: u.searchParams.get("entity") ?? undefined, entityId: u.searchParams.get("entityId") ?? undefined, page, perPage });
  return ok(r.rows, 200, { page, perPage, total: r.total });
});
