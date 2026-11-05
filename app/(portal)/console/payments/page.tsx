import type { Metadata } from "next";
import Link from "next/link";
import { box, field, btnDark, btnLine, Stats } from "@/components/admin/console-page";
import { searchPayments, summary } from "@/lib/pay/admin";
import { anomalies, paymentHealth, paymentMetrics } from "@/lib/pay/metrics";
import { can } from "@/lib/pay/staff";
import { databaseConfigured } from "@/lib/portal/db";
import { payGate } from "./gate";
import { money, PayConsole, when } from "./nav";

export const metadata: Metadata = { title: "Payments | GrowQR admin" };
export const dynamic = "force-dynamic";

const STATUSES = ["pending", "paid", "fulfilled", "failed", "cancelled", "expired", "partially_refunded", "refunded", "disputed"];

export default async function PaymentsOverview({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { me, role } = await payGate("view");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const f = { q: sp.q, status: sp.status, provider: sp.provider, currency: sp.currency, from: sp.from, to: sp.to };
  const qs = (extra: Record<string, string>) => new URLSearchParams(Object.entries({ ...f, ...extra }).filter(([, v]) => v) as [string, string][]).toString();

  if (!databaseConfigured()) {
    return <PayConsole me={me} role={role} section="orders" title="Payments"><p className={box}>The database is not connected.</p></PayConsole>;
  }
  const [list, sum, m, health] = await Promise.all([searchPayments({ ...f, page, perPage: 25 }), summary({ from: f.from, to: f.to }), paymentMetrics(24), paymentHealth()]);
  const alerts = anomalies(m);
  const pages = Math.max(1, Math.ceil(list.total / 25));

  return (
    <PayConsole me={me} role={role} section="orders" title="Payments" subtitle={`Signed in with the ${role} role`}>
      {alerts.length ? <ul role="alert" className="mb-5 space-y-1 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-[14px] text-amber-900">{alerts.map((a) => <li key={a}>{a}</li>)}</ul> : null}

      <Stats items={[
        ["Orders, last 24 hours", Object.values(m.orders).reduce((a, b) => a + b, 0)],
        ["Payment success rate", m.payments.successRate === null ? "n/a" : `${Math.round(m.payments.successRate * 100)}%`, `${m.payments.succeeded} paid, ${m.payments.failed} failed`],
        ["Webhooks waiting", m.webhooks.processing + m.webhooks.failed, m.webhooks.dead ? `${m.webhooks.dead} gave up` : undefined],
        ["Open disputes", m.disputesOpen],
      ]} />

      <section aria-labelledby="rev" className={box}>
        <h2 id="rev" className="mb-3 text-[17px] font-semibold">Revenue{f.from || f.to ? " in the selected dates" : ", all time"}</h2>
        {sum.byCurrency.length ? (
          <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-[14px]">
            <caption className="sr-only">Revenue by currency. Currencies are never added together.</caption>
            <thead className="text-ink-4"><tr><th scope="col" className="py-2 pr-4">Currency</th><th scope="col" className="py-2 pr-4 text-right">Paid orders</th><th scope="col" className="py-2 pr-4 text-right">Gross</th><th scope="col" className="py-2 pr-4 text-right">Refunded</th><th scope="col" className="py-2 pr-4 text-right">Net</th><th scope="col" className="py-2 text-right">Tax in gross</th></tr></thead>
            <tbody className="divide-y divide-black/[0.07]">{sum.byCurrency.map((c) => <tr key={c.currency}><th scope="row" className="py-2 pr-4 font-semibold">{c.currency}</th><td className="py-2 pr-4 text-right">{c.paidOrders}</td><td className="py-2 pr-4 text-right">{money(c.grossMinor, c.currency)}</td><td className="py-2 pr-4 text-right">{money(c.refundedMinor, c.currency)}</td><td className="py-2 pr-4 text-right font-semibold">{money(c.netMinor, c.currency)}</td><td className="py-2 text-right">{money(c.taxMinor, c.currency)}</td></tr>)}</tbody>
          </table></div>
        ) : <p className="text-ink-3">No paid orders yet.</p>}
        <p className="mt-3 text-[13px] text-ink-4">Providers: {health.providers.map((p) => `${p.id} ${p.configured ? "ready" : "not configured"}${p.configured && !p.webhook ? " (webhook secret missing)" : ""}`).join(", ")}.</p>
      </section>

      <form method="get" className={`${box} grid items-end gap-3 sm:grid-cols-3 lg:grid-cols-6`} aria-label="Search orders">
        <label className="text-[13px] text-ink-3 lg:col-span-2">Order, email, name or provider id<input name="q" defaultValue={f.q} className={`${field} mt-1 w-full`} /></label>
        <label className="text-[13px] text-ink-3">Status<select name="status" defaultValue={f.status ?? ""} className={`${field} mt-1 w-full`}><option value="">Any</option>{STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}</select></label>
        <label className="text-[13px] text-ink-3">Provider<select name="provider" defaultValue={f.provider ?? ""} className={`${field} mt-1 w-full`}><option value="">Any</option><option value="razorpay">Razorpay</option><option value="stripe">Stripe</option></select></label>
        <label className="text-[13px] text-ink-3">From<input type="date" name="from" defaultValue={f.from} className={`${field} mt-1 w-full`} /></label>
        <label className="text-[13px] text-ink-3">To<input type="date" name="to" defaultValue={f.to} className={`${field} mt-1 w-full`} /></label>
        <div className="flex gap-2 sm:col-span-3 lg:col-span-6">
          <button className={btnDark}>Search</button>
          <Link href="/console/payments" className={`${btnLine} inline-flex items-center`}>Clear</Link>
          {can(role, "export") ? <a href={`/api/v1/admin/export?${qs({})}`} className={`${btnLine} inline-flex items-center`}>Download CSV</a> : null}
        </div>
      </form>

      <section aria-labelledby="ord" className={box}>
        <h2 id="ord" className="mb-3 text-[17px] font-semibold">{list.total} order{list.total === 1 ? "" : "s"}</h2>
        {list.rows.length ? (
          <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-[14px]">
            <caption className="sr-only">Orders</caption>
            <thead className="text-ink-4"><tr><th scope="col" className="py-2 pr-3">Created</th><th scope="col" className="py-2 pr-3">Order</th><th scope="col" className="py-2 pr-3">Customer</th><th scope="col" className="py-2 pr-3">Provider</th><th scope="col" className="py-2 pr-3">Status</th><th scope="col" className="py-2 text-right">Total</th></tr></thead>
            <tbody className="divide-y divide-black/[0.07]">{list.rows.map((r) => (
              <tr key={r.orderId}>
                <td className="py-2 pr-3 whitespace-nowrap text-ink-3">{when(r.createdAt)}</td>
                <td className="py-2 pr-3"><Link href={`/console/payments/orders/${r.orderId}`} className="font-mono text-[13px] underline">{r.orderId}</Link></td>
                <td className="py-2 pr-3">{r.name}<br /><span className="text-[12px] text-ink-4">{r.email}</span></td>
                <td className="py-2 pr-3">{r.provider ?? "none"}{r.method ? <span className="text-ink-4"> ({r.method})</span> : null}</td>
                <td className="py-2 pr-3">{r.status.replace("_", " ")}</td>
                <td className="py-2 text-right whitespace-nowrap">{money(r.totalMinor, r.currency)}{r.refundedMinor ? <><br /><span className="text-[12px] text-ink-4">refunded {money(r.refundedMinor, r.currency)}</span></> : null}</td>
              </tr>))}</tbody>
          </table></div>
        ) : <p className="text-ink-3">No orders match.</p>}
        {pages > 1 ? (
          <nav aria-label="Pages" className="mt-4 flex items-center gap-3 text-[14px]">
            {page > 1 ? <Link className={btnLine + " inline-flex items-center"} href={`/console/payments?${qs({ page: String(page - 1) })}`}>Previous</Link> : null}
            <span className="text-ink-3">Page {page} of {pages}</span>
            {page < pages ? <Link className={btnLine + " inline-flex items-center"} href={`/console/payments?${qs({ page: String(page + 1) })}`}>Next</Link> : null}
          </nav>
        ) : null}
      </section>
    </PayConsole>
  );
}
