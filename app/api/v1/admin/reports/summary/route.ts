import { summary } from "@/lib/pay/admin";
import { ok, staffApi } from "@/lib/pay/http";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/admin/reports/summary?from=YYYY-MM-DD&to=YYYY-MM-DD  (permission: export, i.e. finance and admin)
 * One block per currency: gross (paid orders), refunded (confirmed refunds), net and tax. Currencies are never added together.
 */
export const GET = staffApi("export", async (req) => {
  const u = new URL(req.url);
  return ok(await summary({ from: u.searchParams.get("from") ?? undefined, to: u.searchParams.get("to") ?? undefined }));
});
