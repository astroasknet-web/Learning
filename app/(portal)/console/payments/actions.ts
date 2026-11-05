"use server";

import { redirect } from "next/navigation";
import { putSessionData } from "@/lib/portal/session";
import { createCoupon, createProduct, grantStaff, setCouponActive, setCurrencyEnabled, setPrice, setProductActive, setTaxRule } from "@/lib/pay/admin";
import { first, pool } from "@/lib/pay/db";
import { minorUnits } from "@/lib/pay/money";
import { PayError } from "@/lib/pay/orders";
import { reconcileAll, resolveItem } from "@/lib/pay/reconcile";
import { requestRefund } from "@/lib/pay/refunds";
import { forceRetry } from "@/lib/pay/webhooks";
import { payGate } from "./gate";

/** Payment console Server Actions. Each re-checks the staff permission it needs, runs the same library code as the API, and leaves a one-time message. */
const flash = (kind: "ok" | "err", text: string) => putSessionData({ console_flash: [kind, text] });
const s = (fd: FormData, k: string): string => String(fd.get(k) ?? "").trim();
const n = (fd: FormData, k: string): number => Math.round(Number(s(fd, k))) || 0;

async function run(back: string, work: () => Promise<string>): Promise<never> {
  try {
    await flash("ok", await work());
  } catch (e) {
    if (e instanceof PayError) await flash("err", e.message);
    else { console.error("payment console action failed", e); await flash("err", "That did not work. Nothing was changed that we can confirm; check the audit log and try again."); }
  }
  return redirect(back);
}

/** Amount is typed in major units (rupees, dollars) and converted here using the currency's decimals, so staff never type paise or cents. */
function toMinor(amount: string, minorUnits: number): number {
  if (!/^\d{1,9}(\.\d{1,3})?$/.test(amount)) throw new PayError("bad_amount", "Enter an amount like 499 or 12.50.");
  const [w, f = ""] = amount.split(".");
  if (f.length > minorUnits) throw new PayError("bad_amount", `This currency has ${minorUnits} decimal places.`);
  return Number(w) * 10 ** minorUnits + Number(f.padEnd(minorUnits, "0") || 0);
}

export async function refundAction(fd: FormData): Promise<void> {
  const { me } = await payGate("refund");
  const id = s(fd, "orderId");
  const back = `/console/payments/orders/${encodeURIComponent(id)}`;
  await run(back, async () => {
    if (fd.get("confirm") !== "yes") throw new PayError("confirm_required", "Tick the box to confirm that this moves money.");
    const ord = await first(pool, "SELECT currency FROM pay_orders WHERE public_id = $1", [id]);
    if (!ord) throw new PayError("order_not_found", "Order not found.", 404);
    const mu = minorUnits(ord.currency); // from the order itself, never from the form
    const full = s(fd, "amount") === "";
    const r = await requestRefund({ orderPublicId: id, amountMinor: full ? undefined : toMinor(s(fd, "amount"), mu), reason: s(fd, "reason"), staffUserId: me.id, idempotencyKey: s(fd, "key") });
    return r.status === "succeeded" ? "Refund completed." : r.status === "failed" ? `The provider did not accept the refund: ${r.failureMessage ?? "unknown reason"}. Nothing was refunded.` : "Refund requested. It stays pending until the provider confirms it.";
  });
}

export async function retryWebhookAction(fd: FormData): Promise<void> {
  const { me } = await payGate("retry_webhook", "/console/payments/ops");
  await run("/console/payments/ops", async () => {
    const r = await forceRetry(n(fd, "id"), me.id);
    return r.body.ok ? "Event processed." : `Event still failing: ${r.body.message ?? "see the log"}.`;
  });
}

export async function reconcileAction(fd: FormData): Promise<void> {
  const { me } = await payGate("reconcile", "/console/payments/ops");
  await run("/console/payments/ops", async () => {
    const hours = Math.min(24 * 30, Math.max(1, n(fd, "hours") || 48));
    const out = await reconcileAll(hours, `staff:${me.id}`);
    return out.length ? out.map((r) => `${r.provider}: checked ${r.checked}, ${r.mismatches} to review`).join("; ") : "No payment provider is switched on, so there was nothing to check.";
  });
}

export async function resolveItemAction(fd: FormData): Promise<void> {
  const { me } = await payGate("reconcile", "/console/payments/ops");
  await run("/console/payments/ops", async () => { await resolveItem(n(fd, "id"), me.id); return "Marked as reviewed."; });
}

const BACK = "/console/payments/catalogue";

export async function setPriceAction(fd: FormData): Promise<void> {
  const { me } = await payGate("manage_catalogue", BACK);
  await run(BACK, async () => {
    const cur = s(fd, "currency").toUpperCase();
    await setPrice(me.id, s(fd, "sku"), cur, toMinor(s(fd, "amount"), minorUnits(cur)), fd.get("inclusive") === "on", true);
    return `Price saved for ${s(fd, "sku")} in ${cur}. It applies to new orders only.`;
  });
}

export async function createProductAction(fd: FormData): Promise<void> {
  const { me } = await payGate("manage_catalogue", BACK);
  await run(BACK, async () => {
    const days = s(fd, "days");
    await createProduct(me.id, { sku: s(fd, "sku"), kind: s(fd, "kind"), title: s(fd, "title"), description: s(fd, "description"), accessDays: days ? n(fd, "days") : null, allowGuest: fd.get("guest") === "on" });
    return `Product ${s(fd, "sku").toLowerCase()} added. It cannot be bought until you save a price for it below.`;
  });
}

export async function productActiveAction(fd: FormData): Promise<void> {
  const { me } = await payGate("manage_catalogue", BACK);
  await run(BACK, async () => { await setProductActive(me.id, s(fd, "sku"), s(fd, "active") === "1"); return "Product updated."; });
}

export async function currencyAction(fd: FormData): Promise<void> {
  const { me } = await payGate("manage_catalogue", BACK);
  await run(BACK, async () => { await setCurrencyEnabled(me.id, s(fd, "code"), s(fd, "enabled") === "1"); return "Currency updated."; });
}

export async function taxRuleAction(fd: FormData): Promise<void> {
  const { me } = await payGate("manage_catalogue", BACK);
  await run(BACK, async () => {
    const pct = Number(s(fd, "percent"));
    if (!(pct >= 0 && pct <= 100)) throw new PayError("bad_rate", "Enter a tax rate between 0 and 100.");
    await setTaxRule(me.id, s(fd, "country").toUpperCase(), s(fd, "name") || "Tax", Math.round(pct * 100), fd.get("active") !== "off");
    return "Tax rule saved. It applies to new orders only.";
  });
}

export async function couponAction(fd: FormData): Promise<void> {
  const { me } = await payGate("manage_catalogue", BACK);
  await run(BACK, async () => {
    const kind = s(fd, "kind") === "fixed" ? "fixed" : "percent";
    const cur = s(fd, "currency").toUpperCase();
    await createCoupon(me.id, {
      code: s(fd, "code").toUpperCase(), kind,
      percentBp: kind === "percent" ? Math.round(Number(s(fd, "value")) * 100) : undefined,
      fixedMinor: kind === "fixed" ? toMinor(s(fd, "value"), minorUnits(cur)) : undefined,
      currency: kind === "fixed" ? cur : undefined,
      maxRedemptions: s(fd, "max") ? n(fd, "max") : null, endsAt: s(fd, "ends") || null,
    });
    return "Coupon created.";
  });
}

export async function couponActiveAction(fd: FormData): Promise<void> {
  const { me } = await payGate("manage_catalogue", BACK);
  await run(BACK, async () => { await setCouponActive(me.id, s(fd, "code"), s(fd, "active") === "1"); return "Coupon updated."; });
}

export async function staffAction(fd: FormData): Promise<void> {
  const { me } = await payGate("manage_staff", BACK);
  await run(BACK, async () => {
    const uid = n(fd, "userId");
    if (uid === me.id) throw new PayError("forbidden", "You cannot change your own payment role.", 403);
    const role = s(fd, "role");
    await grantStaff(me.id, uid, role === "support" || role === "finance" || role === "admin" ? role : null);
    return "Staff role updated.";
  });
}
