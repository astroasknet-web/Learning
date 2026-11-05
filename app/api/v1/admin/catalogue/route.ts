import { z } from "zod";
import { createCoupon, createProduct, setCouponActive, setCurrencyEnabled, setPrice, setProductActive, setTaxRule } from "@/lib/pay/admin";
import { listProducts } from "@/lib/pay/catalogue";
import { pool, rows } from "@/lib/pay/db";
import { ok, staffApi } from "@/lib/pay/http";

export const dynamic = "force-dynamic";

/** GET /api/v1/admin/catalogue: products with prices, enabled currencies, tax rules and coupons (permission: view). */
export const GET = staffApi((m) => (m === "GET" ? "view" : "manage_catalogue"), async () => {
  return ok({
    products: await listProducts(),
    currencies: await rows(pool, "SELECT code, minor_units AS minorUnits, symbol, enabled FROM pay_currencies ORDER BY code"),
    taxRules: await rows(pool, "SELECT country, name, rate_bp AS rateBp, active FROM pay_tax_rules ORDER BY country"),
    coupons: await rows(pool, "SELECT code, kind, percent_bp AS percentBp, fixed_minor AS fixedMinor, currency, max_redemptions AS maxRedemptions, per_user_limit AS perUserLimit, redeemed, starts_at AS startsAt, ends_at AS endsAt, skus, active FROM pay_coupons ORDER BY id DESC LIMIT 200"),
  });
});

const action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create_product"), sku: z.string().max(80), kind: z.string().max(20), title: z.string().max(190), description: z.string().max(500).optional(), fulfilRef: z.string().max(120).optional(), accessDays: z.number().int().positive().nullable().optional(), allowGuest: z.boolean().optional() }),
  z.object({ action: z.literal("set_price"), sku: z.string().max(80), currency: z.string().length(3), amountMinor: z.number().int().min(0), taxInclusive: z.boolean().default(true), active: z.boolean().default(true) }),
  z.object({ action: z.literal("set_product_active"), sku: z.string().max(80), active: z.boolean() }),
  z.object({ action: z.literal("set_currency"), code: z.string().length(3), enabled: z.boolean() }),
  z.object({ action: z.literal("set_tax_rule"), country: z.string().length(2), name: z.string().max(40), rateBp: z.number().int().min(0).max(10_000), active: z.boolean().default(true) }),
  z.object({ action: z.literal("create_coupon"), code: z.string().max(40), kind: z.enum(["percent", "fixed"]), percentBp: z.number().int().optional(), fixedMinor: z.number().int().optional(), currency: z.string().length(3).optional(), maxRedemptions: z.number().int().positive().nullable().optional(), perUserLimit: z.number().int().positive().optional(), startsAt: z.string().nullable().optional(), endsAt: z.string().nullable().optional(), skus: z.array(z.string()).nullable().optional() }),
  z.object({ action: z.literal("set_coupon_active"), code: z.string().max(40), active: z.boolean() }),
]);

/** POST /api/v1/admin/catalogue: change prices, currencies, tax rules and coupons (permission: manage_catalogue). Every change is audited with the old value. */
export const POST = staffApi("manage_catalogue", async (req, staff) => {
  const a = action.parse(await req.json().catch(() => ({})));
  switch (a.action) {
    case "create_product": await createProduct(staff.user.id, a); break;
    case "set_price": await setPrice(staff.user.id, a.sku, a.currency, a.amountMinor, a.taxInclusive, a.active); break;
    case "set_product_active": await setProductActive(staff.user.id, a.sku, a.active); break;
    case "set_currency": await setCurrencyEnabled(staff.user.id, a.code, a.enabled); break;
    case "set_tax_rule": await setTaxRule(staff.user.id, a.country, a.name, a.rateBp, a.active); break;
    case "create_coupon": await createCoupon(staff.user.id, a); break;
    case "set_coupon_active": await setCouponActive(staff.user.id, a.code, a.active); break;
  }
  return ok({ done: true });
});
