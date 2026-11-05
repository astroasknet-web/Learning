import type { Metadata } from "next";
import { box, field, btnDark, btnLine } from "@/components/admin/console-page";
import { listProducts } from "@/lib/pay/catalogue";
import { pool, rows } from "@/lib/pay/db";
import { minorUnits } from "@/lib/pay/money";
import { createProductAction, couponActiveAction, couponAction, currencyAction, productActiveAction, setPriceAction, staffAction, taxRuleAction } from "../actions";
import { payGate } from "../gate";
import { money, PayConsole } from "../nav";

export const metadata: Metadata = { title: "Prices and staff | Payments | GrowQR admin" };
export const dynamic = "force-dynamic";

export default async function PaymentCatalogue() {
  const { me, role } = await payGate("manage_catalogue", "/console/payments/catalogue");
  const [products, currencies, tax, coupons, staff] = await Promise.all([
    listProducts(),
    rows(pool, "SELECT code, symbol, enabled FROM pay_currencies ORDER BY code"),
    rows(pool, "SELECT country, name, rate_bp, active FROM pay_tax_rules ORDER BY country"),
    rows(pool, "SELECT code, kind, percent_bp, fixed_minor, currency, max_redemptions, redeemed, ends_at, active FROM pay_coupons ORDER BY id DESC LIMIT 50"),
    rows(pool, "SELECT s.user_id, s.role, u.email, u.name FROM pay_staff s JOIN users u ON u.id = s.user_id ORDER BY s.created_at"),
  ]);
  const enabled = currencies.filter((c) => c.enabled).map((c) => c.code as string);

  return (
    <PayConsole me={me} role={role} section="catalogue" title="Prices, coupons and staff" subtitle="Changes apply to new orders only. Every change is written to the audit log.">
      <section className={box} aria-labelledby="np">
        <h2 id="np" className="mb-1 text-[17px] font-semibold">Add a product</h2>
        <p className="mb-3 text-[13px] text-ink-3">Step 1 of 2: create it. Step 2: save a price for it in the list below. Until it has a price in an enabled currency it cannot be bought.</p>
        <form action={createProductAction} className="flex flex-wrap items-end gap-2">
          <label className="text-[12px] text-ink-3">Code (no spaces)<input name="sku" required maxLength={80} placeholder="demo-workshop" className={`${field} mt-1 block w-48`} /></label>
          <label className="text-[12px] text-ink-3">Name shown to buyers<input name="title" required maxLength={190} placeholder="Interview Masterclass" className={`${field} mt-1 block w-64`} /></label>
          <label className="text-[12px] text-ink-3">Type<select name="kind" className={`${field} mt-1 block`}><option value="other">Other</option><option value="class">Class</option><option value="ebook">E-book</option><option value="consulting">Consulting</option><option value="course">Course (use the course code)</option><option value="plan">Plan</option></select></label>
          <label className="text-[12px] text-ink-3">Access days (empty = lifetime)<input name="days" type="number" min={1} className={`${field} mt-1 block w-28`} /></label>
          <label className="text-[12px] text-ink-3">Short description<input name="description" maxLength={500} className={`${field} mt-1 block w-64`} /></label>
          <button className={btnDark}>Add product</button>
        </form>
      </section>

      <section className={box} aria-labelledby="pr">
        <h2 id="pr" className="mb-1 text-[17px] font-semibold">Products and prices</h2>
        <p className="mb-4 text-[13px] text-ink-3">Prices are set per currency. Nothing is converted automatically: a currency with no price here cannot be used to buy that product.</p>
        <div className="space-y-4">{products.map((p) => (
          <div key={p.sku} className="rounded-xl border border-black/10 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><strong>{p.title}</strong> <span className="font-mono text-[12px] text-ink-4">{p.sku}</span>{!p.active ? <span className="ml-2 rounded bg-red-100 px-2 py-0.5 text-[12px] text-red-800">off sale</span> : null}</div>
              <form action={productActiveAction}><input type="hidden" name="sku" value={p.sku} /><input type="hidden" name="active" value={p.active ? "0" : "1"} /><button className={btnLine}>{p.active ? "Take off sale" : "Put on sale"}</button></form>
            </div>
            <p className="mt-1 text-[14px]">{p.prices.length ? p.prices.map((x) => `${money(x.amountMinor, x.currency)}${x.taxInclusive ? " incl. tax" : " + tax"}`).join("   |   ") : <span className="text-amber-700">No price in any enabled currency</span>}</p>
            <form action={setPriceAction} className="mt-3 flex flex-wrap items-end gap-2">
              <input type="hidden" name="sku" value={p.sku} />
              <label className="text-[12px] text-ink-3">Currency<select name="currency" className={`${field} mt-1 block`}>{enabled.map((c) => <option key={c}>{c}</option>)}</select></label>
              <label className="text-[12px] text-ink-3">Price<input name="amount" required inputMode="decimal" placeholder="499" className={`${field} mt-1 block w-32`} /></label>
              <label className="flex items-center gap-2 pb-3 text-[13px]"><input type="checkbox" name="inclusive" defaultChecked className="h-5 w-5" /> Tax included</label>
              <button className={btnDark}>Save price</button>
            </form>
          </div>))}</div>
        <p className="mt-3 text-[12px] text-ink-4">Decimals follow the currency (INR and USD use 2). Currencies enabled: {enabled.map((c) => `${c} (${minorUnits(c)})`).join(", ")}.</p>
      </section>

      <section className={box} aria-labelledby="cur">
        <h2 id="cur" className="mb-3 text-[17px] font-semibold">Currencies</h2>
        <div className="flex flex-wrap gap-3">{currencies.map((c) => (
          <form key={c.code} action={currencyAction} className="flex items-center gap-2 rounded-lg border border-black/10 px-3 py-2 text-[14px]">
            <strong>{c.code}</strong> <span className="text-ink-4">{c.enabled ? "on" : "off"}</span>
            <input type="hidden" name="code" value={c.code} /><input type="hidden" name="enabled" value={c.enabled ? "0" : "1"} /><button className="rounded border border-black/20 px-2 py-1 text-[12px]">{c.enabled ? "Turn off" : "Turn on"}</button>
          </form>))}</div>
      </section>

      <section className={box} aria-labelledby="tx">
        <h2 id="tx" className="mb-1 text-[17px] font-semibold">Tax rules</h2>
        <p className="mb-3 text-[13px] text-ink-3">Where no rule exists for a country, no tax is added. Ask your accountant which rates apply to you before adding any.</p>
        <ul className="mb-3 space-y-1 text-[14px]">{tax.map((t) => <li key={t.country}>{t.country}: {t.name} {Number(t.rate_bp) / 100}% {t.active ? "" : "(off)"}</li>)}{!tax.length ? <li className="text-ink-3">No tax rules set.</li> : null}</ul>
        <form action={taxRuleAction} className="flex flex-wrap items-end gap-2">
          <label className="text-[12px] text-ink-3">Country (2 letters)<input name="country" required maxLength={2} className={`${field} mt-1 block w-24 uppercase`} /></label>
          <label className="text-[12px] text-ink-3">Name<input name="name" placeholder="GST" className={`${field} mt-1 block w-28`} /></label>
          <label className="text-[12px] text-ink-3">Rate %<input name="percent" required inputMode="decimal" className={`${field} mt-1 block w-24`} /></label>
          <button className={btnDark}>Save rule</button>
        </form>
      </section>

      <section className={box} aria-labelledby="cp">
        <h2 id="cp" className="mb-3 text-[17px] font-semibold">Coupons</h2>
        <ul className="mb-4 space-y-2 text-[14px]">{coupons.map((c) => (
          <li key={c.code} className="flex flex-wrap items-center justify-between gap-2"><span><strong className="font-mono">{c.code}</strong> - {c.kind === "percent" ? `${Number(c.percent_bp) / 100}% off` : `${money(Number(c.fixed_minor), c.currency)} off`} - used {c.redeemed}{c.max_redemptions ? ` of ${c.max_redemptions}` : ""}{c.active ? "" : " (off)"}</span>
            <form action={couponActiveAction}><input type="hidden" name="code" value={c.code} /><input type="hidden" name="active" value={c.active ? "0" : "1"} /><button className="rounded border border-black/20 px-2 py-1 text-[12px]">{c.active ? "Turn off" : "Turn on"}</button></form></li>))}{!coupons.length ? <li className="text-ink-3">No coupons.</li> : null}</ul>
        <form action={couponAction} className="flex flex-wrap items-end gap-2 border-t border-black/10 pt-4">
          <label className="text-[12px] text-ink-3">Code<input name="code" required maxLength={40} className={`${field} mt-1 block w-40 uppercase`} /></label>
          <label className="text-[12px] text-ink-3">Type<select name="kind" className={`${field} mt-1 block`}><option value="percent">Percent off</option><option value="fixed">Fixed amount off</option></select></label>
          <label className="text-[12px] text-ink-3">Value (% or amount)<input name="value" required inputMode="decimal" className={`${field} mt-1 block w-28`} /></label>
          <label className="text-[12px] text-ink-3">Currency (fixed only)<select name="currency" className={`${field} mt-1 block`}>{enabled.map((c) => <option key={c}>{c}</option>)}</select></label>
          <label className="text-[12px] text-ink-3">Max uses<input name="max" type="number" min={1} className={`${field} mt-1 block w-24`} /></label>
          <label className="text-[12px] text-ink-3">Ends<input name="ends" type="date" className={`${field} mt-1 block`} /></label>
          <button className={btnDark}>Create coupon</button>
        </form>
      </section>

      <section className={box} aria-labelledby="st">
        <h2 id="st" className="mb-1 text-[17px] font-semibold">Payment staff</h2>
        <p className="mb-3 text-[13px] text-ink-3">Support can look. Finance can also refund, export, retry webhooks and reconcile. Admin can also change prices and staff. Portal administrators are always payment admins. You cannot change your own role.</p>
        <ul className="mb-4 space-y-2 text-[14px]">{staff.map((x) => (
          <li key={x.user_id} className="flex flex-wrap items-center justify-between gap-2"><span>{x.name} ({x.email}) - <strong>{x.role}</strong></span>
            {Number(x.user_id) !== me.id ? <form action={staffAction}><input type="hidden" name="userId" value={x.user_id} /><input type="hidden" name="role" value="" /><button className="rounded border border-black/20 px-2 py-1 text-[12px]">Remove</button></form> : null}</li>))}{!staff.length ? <li className="text-ink-3">Only portal administrators have access.</li> : null}</ul>
        <form action={staffAction} className="flex flex-wrap items-end gap-2 border-t border-black/10 pt-4">
          <label className="text-[12px] text-ink-3">User id (from the Users list)<input name="userId" type="number" min={1} required className={`${field} mt-1 block w-32`} /></label>
          <label className="text-[12px] text-ink-3">Role<select name="role" className={`${field} mt-1 block`}><option value="support">Support</option><option value="finance">Finance</option><option value="admin">Admin</option></select></label>
          <button className={btnDark}>Grant role</button>
        </form>
      </section>
    </PayConsole>
  );
}
