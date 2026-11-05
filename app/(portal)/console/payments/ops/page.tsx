import type { Metadata } from "next";
import { box, field, btnDark, btnLine } from "@/components/admin/console-page";
import { listAudit, listWebhooks } from "@/lib/pay/admin";
import { verifyAuditChain } from "@/lib/pay/audit";
import { pool } from "@/lib/pay/db";
import { listItems, listRuns } from "@/lib/pay/reconcile";
import { can } from "@/lib/pay/staff";
import { reconcileAction, resolveItemAction, retryWebhookAction } from "../actions";
import { payGate } from "../gate";
import { PayConsole, when } from "../nav";

export const metadata: Metadata = { title: "Payment operations | GrowQR admin" };
export const dynamic = "force-dynamic";

export default async function PaymentOps({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { me, role } = await payGate("view_audit", "/console/payments/ops");
  const sp = await searchParams;
  const [hooks, runs, audit, chain] = await Promise.all([
    listWebhooks({ status: sp.hook || undefined, page: 1, perPage: 25 }),
    listRuns(10),
    listAudit({ entity: sp.entity || undefined, entityId: sp.entityId || undefined, page: Math.max(1, Number(sp.page) || 1), perPage: 25 }),
    sp.verify ? verifyAuditChain(pool) : Promise.resolve(null),
  ]);
  const openItems = (await Promise.all(runs.slice(0, 5).map((r) => listItems(Number(r.id))))).flat().filter((i) => !i.resolved);

  return (
    <PayConsole me={me} role={role} section="ops" title="Webhooks, reconciliation and audit">
      <section className={box} aria-labelledby="wh">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 id="wh" className="text-[17px] font-semibold">Webhook events ({hooks.total})</h2>
          <form method="get" className="flex gap-2"><select name="hook" defaultValue={sp.hook ?? ""} className={field} aria-label="Filter by status"><option value="">All</option><option value="failed">Failed</option><option value="processing">Processing</option><option value="dead">Gave up</option><option value="processed">Processed</option></select><button className={btnLine}>Filter</button></form>
        </div>
        <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-[13px]">
          <caption className="sr-only">Webhook events, newest first</caption>
          <thead className="text-ink-4"><tr><th scope="col" className="py-2 pr-3">Received</th><th scope="col" className="py-2 pr-3">Provider</th><th scope="col" className="py-2 pr-3">Type</th><th scope="col" className="py-2 pr-3">Status</th><th scope="col" className="py-2 pr-3">Tries</th><th scope="col" className="py-2">Error / action</th></tr></thead>
          <tbody className="divide-y divide-black/[0.07]">{hooks.rows.map((h) => (
            <tr key={h.id}><td className="py-2 pr-3 whitespace-nowrap">{when(h.receivedAt)}</td><td className="py-2 pr-3">{h.provider}</td><td className="py-2 pr-3 font-mono">{h.type}</td><td className="py-2 pr-3">{h.status}</td><td className="py-2 pr-3">{h.attempts}</td>
              <td className="py-2"><span className="text-red-700">{h.lastError}</span> {can(role, "retry_webhook") && h.status !== "processed" ? <form action={retryWebhookAction} className="inline"><input type="hidden" name="id" value={h.id} /><button className="rounded border border-black/20 px-2 py-1 text-[12px]">Retry</button></form> : null}</td></tr>))}</tbody>
        </table></div>
        {!hooks.rows.length ? <p className="text-ink-3">No events.</p> : null}
      </section>

      <section className={box} aria-labelledby="rec">
        <h2 id="rec" className="mb-3 text-[17px] font-semibold">Reconciliation</h2>
        <p className="mb-3 text-[14px] text-ink-3">Compares our records with what Razorpay and Stripe say, and lists differences for a person to review. It never changes money or orders by itself. It also runs on a schedule when the cron job is set up.</p>
        {can(role, "reconcile") ? (
          <form action={reconcileAction} className="mb-4 flex flex-wrap items-end gap-2">
            <label className="text-[13px] text-ink-3">Look back (hours)<input name="hours" type="number" min={1} max={720} defaultValue={48} className={`${field} mt-1 block w-28`} /></label>
            <button className={btnDark}>Run now</button>
          </form>
        ) : null}
        <ul className="mb-4 space-y-1 text-[14px]">{runs.map((r) => <li key={r.id}>{when(r.started_at)} - {r.provider} - <strong>{r.status}</strong> - checked {r.checked}, {r.mismatches} to review{r.error ? <span className="text-red-700"> - {r.error}</span> : null}</li>)}{!runs.length ? <li className="text-ink-3">No runs yet.</li> : null}</ul>
        <h3 className="mb-2 text-[15px] font-semibold">To review ({openItems.length})</h3>
        <ul className="space-y-2 text-[14px]">{openItems.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-cream-2 px-3 py-2"><span><strong>{String(i.kind).replace("_", " ")}</strong> - {i.detail} <span className="font-mono text-[12px] text-ink-4">{i.provider_ref}</span></span>
            {can(role, "reconcile") ? <form action={resolveItemAction}><input type="hidden" name="id" value={i.id} /><button className={btnLine}>Mark reviewed</button></form> : null}</li>))}</ul>
      </section>

      <section className={box} aria-labelledby="aud">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 id="aud" className="text-[17px] font-semibold">Audit log ({audit.total} events)</h2>
          <a href="?verify=1" className={`${btnLine} inline-flex items-center`}>Verify the chain</a>
        </div>
        {chain ? <p role="status" className={`mb-3 rounded-lg px-3 py-2 text-[14px] ${chain.brokenAt === null ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-800"}`}>{chain.brokenAt === null ? `Chain intact: ${chain.checked} events checked, none altered.` : `The chain is broken at event ${chain.brokenAt}. Someone may have changed or deleted a record.`}</p> : null}
        <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-[13px]">
          <caption className="sr-only">Audit events, newest first</caption>
          <thead className="text-ink-4"><tr><th scope="col" className="py-2 pr-3">When</th><th scope="col" className="py-2 pr-3">Who</th><th scope="col" className="py-2 pr-3">Action</th><th scope="col" className="py-2">Record</th></tr></thead>
          <tbody className="divide-y divide-black/[0.07]">{audit.rows.map((a) => <tr key={a.id}><td className="py-2 pr-3 whitespace-nowrap">{when(a.at)}</td><td className="py-2 pr-3">{a.actorType}{a.actorId ? ` ${a.actorId}` : ""}</td><td className="py-2 pr-3 font-mono">{a.action}</td><td className="py-2 font-mono text-[12px]">{a.entity} {a.entityId}</td></tr>)}</tbody>
        </table></div>
      </section>
    </PayConsole>
  );
}
