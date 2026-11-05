import { ok, staffApi } from "@/lib/pay/http";
import { anomalies, paymentHealth, paymentMetrics } from "@/lib/pay/metrics";

export const dynamic = "force-dynamic";

/** GET /api/v1/admin/metrics?hours=24  (permission: view): counts, success rate, webhook backlog, reconciliation state, plus the conditions that would raise an alert. */
export const GET = staffApi("view", async (req) => {
  const hours = Math.min(24 * 30, Math.max(1, Number(new URL(req.url).searchParams.get("hours")) || 24));
  const m = await paymentMetrics(hours);
  return ok({ metrics: m, alerts: anomalies(m), health: await paymentHealth() });
});
