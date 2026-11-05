import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { box, field, btnDark } from "@/components/admin/console-page";
import { orderDetail } from "@/lib/pay/admin";
import { PayError } from "@/lib/pay/orders";
import { can } from "@/lib/pay/staff";
import { refundAction, retryWebhookAction } from "../../actions";
import { payGate } from "../../gate";
import { money, PayConsole, when } from "../../nav";

export const metadata: Metadata = { title: "Order | Payments | GrowQR admin" };
export const dynamic = "force-dynamic";

export default async function PaymentOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { me, role } = await payGate("view");
  const { id } = await params;
  let d;
  try { d = await orderDetail(id); } catch (e) { if (e instanceof PayError) notFound(); throw e; }
  const o = d.order;
  const refundable = o.totalMinor - o.refundedMinor;
  const canRefund = can(role, "refund") && refundable > 0 && d.payments.some((p) => ["succeeded", "partially_refunded"].includes(p.status));
  const idemKey = `rf-${crypto.randomUUID()}`; // one per rendered form, so a double click or a retry cannot create two refunds

  return (
    <PayConsole me={me} role={role} section="orders" title={`Order ${o.id}`} subtitle={`${o.status.replace("_", " ")} - ${o.name} (${o.email})`}>
      <p className="mb-4 text-[14px]"><Link href="/console/payments" className="underline">Back to orders</Link></p>

      <section className={box} aria-labelledby="sum">
        <h2 id="sum" className="mb-3 text-[17px] font-semibold">Summary</h2>
        <dl className="grid gap-x-8 gap-y-2 text-[14px] sm:grid-cols-2">
          <div className="flex justify-between"><dt className="text-ink-4">Created</dt><dd>{when(o.createdAt)}</dd></div>
          <div className="flex justify-between"><dt className="text-ink-4">Paid</dt><dd>{when(o.paidAt) || "not paid"}</dd></div>
          <div className="flex justify-between"><dt className="text-ink-4">Country</dt><dd>{o.country}</dd></div>
          <div className="flex justify-between"><dt className="text-ink-4">Coupon</dt><dd>{o.coupon ?? "none"}</dd></div>
          <div className="flex justify-between"><dt className="text-ink-4">Discount</dt><dd>{money(o.discountMinor, o.currency)}</dd></div>
          <div className="flex justify-between"><dt className="text-ink-4">{o.taxName || "Tax"} {o.taxInclusive ? "(included)" : ""}</dt><dd>{money(o.taxMinor, o.currency)}</dd></div>
          <div className="flex justify-between font-semibold"><dt>Total</dt><dd>{money(o.totalMinor, o.currency)}</dd></div>
          <div className="flex justify-between"><dt className="text-ink-4">Refunded</dt><dd>{money(o.refundedMinor, o.currency)}</dd></div>
        </dl>
        <ul className="mt-4 divide-y divide-black/[0.07] text-[14px]">{d.items.map((i) => <li key={i.sku} className="flex justify-between py-2"><span>{i.title} x {i.qty} <span className="text-ink-4">({i.sku})</span></span><span>{money(i.totalMinor, o.currency)}</span></li>)}</ul>
        {d.documents.length ? <p className="mt-3 text-[14px]">Documents: {d.documents.map((x) => <a key={x.number} className="mr-3 underline" href={`/api/v1/orders/${o.id}/receipt?doc=${x.number}`} target="_blank" rel="noreferrer">{x.number}</a>)}</p> : null}
        {d.entitlements.length ? <p className="mt-2 text-[14px] text-ink-3">Access granted: {d.entitlements.map((e) => `${e.kind}:${e.ref} (${e.status})`).join(", ")}</p> : null}
      </section>

      <section className={box} aria-labelledby="pay">
        <h2 id="pay" className="mb-3 text-[17px] font-semibold">Payment attempts</h2>
        {d.payments.length ? <ul className="space-y-3 text-[14px]">{d.payments.map((p) => (
          <li key={p.id} className="rounded-lg bg-cream-2 px-3 py-2">
            <strong>{p.provider}</strong> - {p.status.replace("_", " ")} - {money(p.amountMinor, o.currency)}{p.method ? ` via ${p.method}` : ""}<br />
            <span className="break-all font-mono text-[12px] text-ink-4">{p.paymentRef ?? p.sessionRef}</span>
            {p.failureCode ? <><br /><span className="text-red-700">Failed: {p.failureCode}{p.failureMessage ? ` - ${p.failureMessage}` : ""}</span></> : null}
          </li>))}</ul> : <p className="text-ink-3">No payment attempt yet.</p>}
      </section>

      <section className={box} aria-labelledby="ref">
        <h2 id="ref" className="mb-3 text-[17px] font-semibold">Refunds</h2>
        {d.refunds.length ? <ul className="mb-4 space-y-2 text-[14px]">{d.refunds.map((r) => <li key={r.id}>{money(r.amountMinor, r.currency)} - <strong>{r.status}</strong> - {r.reason} <span className="text-ink-4">({r.id}, {when(r.createdAt)})</span>{r.failureMessage ? <span className="text-red-700"> - {r.failureMessage}</span> : null}</li>)}</ul> : <p className="mb-4 text-ink-3">No refunds.</p>}
        {canRefund ? (
          <form action={refundAction} className="grid max-w-xl gap-3 border-t border-black/10 pt-4">
            <h3 className="text-[15px] font-semibold">Refund this order</h3>
            <input type="hidden" name="orderId" value={o.id} />
            <input type="hidden" name="key" value={idemKey} />
            <label className="text-[13px] text-ink-3">Amount in {o.currency} (leave empty to refund the remaining {money(refundable, o.currency)})<input name="amount" inputMode="decimal" className={`${field} mt-1 w-full`} /></label>
            <label className="text-[13px] text-ink-3">Reason (kept in the audit log)<input name="reason" required minLength={3} maxLength={255} className={`${field} mt-1 w-full`} /></label>
            <label className="flex items-start gap-2 text-[14px]"><input type="checkbox" name="confirm" value="yes" required className="mt-1 h-5 w-5" /> I understand this sends money back to the customer and cannot be undone.</label>
            <div><button className={btnDark}>Refund</button></div>
          </form>
        ) : <p className="text-[13px] text-ink-4">{refundable > 0 ? "Your role cannot issue refunds, or no confirmed payment exists to refund." : "Nothing left to refund."}</p>}
      </section>

      {d.disputes.length ? (
        <section className={box} aria-labelledby="dis"><h2 id="dis" className="mb-3 text-[17px] font-semibold">Disputes</h2>
          <ul className="space-y-2 text-[14px]">{d.disputes.map((x) => <li key={x.ref}>{money(x.amountMinor, x.currency)} - <strong>{x.status}</strong> - {x.reason}{x.respondBy ? ` - respond by ${when(x.respondBy)}` : ""}</li>)}</ul>
          <p className="mt-2 text-[13px] text-ink-4">Submit evidence in the provider dashboard. This console only tracks the status.</p></section>
      ) : null}

      <section className={box} aria-labelledby="wh">
        <h2 id="wh" className="mb-3 text-[17px] font-semibold">Webhook events for this order</h2>
        {d.webhooks.length ? <ul className="space-y-2 text-[14px]">{d.webhooks.map((h) => (
          <li key={h.id} className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[12px]">{h.type}</span> <strong>{h.status}</strong> <span className="text-ink-4">{when(h.receivedAt)}, {h.attempts} tries</span>
            {h.lastError ? <span className="text-red-700">{h.lastError}</span> : null}
            {can(role, "retry_webhook") && h.status !== "processed" ? <form action={retryWebhookAction}><input type="hidden" name="id" value={h.id} /><button className="rounded border border-black/20 px-2 py-1 text-[12px]">Retry</button></form> : null}
          </li>))}</ul> : <p className="text-ink-3">None recorded.</p>}
      </section>

      <section className={box} aria-labelledby="tl">
        <h2 id="tl" className="mb-3 text-[17px] font-semibold">Timeline</h2>
        <ol className="space-y-1.5 text-[14px]">{d.timeline.map((t, i) => <li key={i}><span className="text-ink-4">{when(t.at)}</span> - {t.action} <span className="text-ink-4">by {t.actorType}{t.actorId ? ` ${t.actorId}` : ""}</span></li>)}</ol>
      </section>
    </PayConsole>
  );
}
