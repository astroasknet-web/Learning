import { databaseConfigured } from "@/lib/portal/db";
import { activeProviders, payableCurrencies } from "@/lib/pay/providers";
import { fail, ok } from "@/lib/pay/http";
import { pool, rows } from "@/lib/pay/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/payments/config?country=IN
 * What the checkout page needs to know: whether payments are switched on, and the currencies a visitor from that country can pay in.
 * Public, and reveals no keys or settings.
 */
export async function GET(req: Request) {
  if (!databaseConfigured()) return ok({ enabled: false, providers: [], currencies: [] });
  const country = (new URL(req.url).searchParams.get("country") ?? "IN").toUpperCase();
  if (!/^[A-Z]{2}$/.test(country)) return fail("invalid_request", "country must be a two-letter code.", 422);
  try {
    const enabledCurrencies = (await rows<{ code: string }>(pool, "SELECT code FROM pay_currencies WHERE enabled = 1")).map((r) => r.code);
    const providers = activeProviders().map((p) => p.id);
    return ok({ enabled: providers.length > 0, providers, currencies: payableCurrencies(country, enabledCurrencies) });
  } catch {
    return ok({ enabled: false, providers: [], currencies: [] });
  }
}
