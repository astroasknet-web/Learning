import { NextResponse } from "next/server";
import { paymentHealth } from "@/lib/pay/metrics";

export const dynamic = "force-dynamic";

/** GET /api/v1/payments/health: readiness for uptime checks. 200 when the database answers and at least one provider has its keys; 503 otherwise. No keys or values are shown. */
export async function GET() {
  try {
    const h = await paymentHealth();
    return NextResponse.json({ ok: h.ok, database: h.database, providers: h.providers.map((p) => ({ id: p.id, configured: p.configured, webhook: p.webhook })) }, { status: h.ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false, database: false, providers: [] }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
