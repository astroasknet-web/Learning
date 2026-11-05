import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/portal/guard";
import { Card, PortalPage } from "@/components/portal/shell";
import { databaseConfigured } from "@/lib/portal/db";
import { entitlementsFor } from "@/lib/pay/entitlements";
import { listOrders } from "@/lib/pay/orders";
import { formatMoney } from "@/lib/pay/money";

export const metadata: Metadata = { title: "Billing | GrowQR" };
export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = { pending: "Awaiting payment", paid: "Paid", fulfilled: "Paid", failed: "Failed", cancelled: "Cancelled", expired: "Expired", partially_refunded: "Partly refunded", refunded: "Refunded", disputed: "Under review" };
const money = (n: number, c: string): string => formatMoney(n, c, c === "INR" ? "en-IN" : "en-US");
const day = (s: string | null): string => (s ? new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");

export default async function BillingPage() {
  const me = await requireUser();
  const ready = databaseConfigured();
  const [{ orders }, plans] = ready ? await Promise.all([listOrders(me.id, 1, 50), entitlementsFor(me.id)]) : [{ orders: [] }, []];
  return (
    <PortalPage user={me} active="billing" title="Billing" subtitle="Your purchases, receipts and refunds">
      <Card title="What you have">
        {plans.length ? (
          <ul className="divide-y divide-black/[0.07]">
            {plans.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <span className="font-medium text-ink">{p.title}</span>
                <span className="text-[0.9rem] text-ink-3">{p.status === "active" ? (p.expiresAt ? `Active until ${day(p.expiresAt)}` : "Active") : p.status === "revoked" ? "Ended (refunded)" : "Expired"}</span>
              </li>
            ))}
          </ul>
        ) : <p className="text-ink-3">You have no paid plans yet. <Link href="/pricing" className="font-semibold underline">See plans</Link>.</p>}
      </Card>
      <Card title="Orders">
        {orders.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-[0.92rem]">
              <caption className="sr-only">Your orders</caption>
              <thead className="text-ink-4"><tr><th scope="col" className="py-2 pr-4 font-medium">Date</th><th scope="col" className="py-2 pr-4 font-medium">Order</th><th scope="col" className="py-2 pr-4 font-medium">Status</th><th scope="col" className="py-2 text-right font-medium">Total</th></tr></thead>
              <tbody className="divide-y divide-black/[0.07]">
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td className="py-3 pr-4 text-ink-3">{day(o.createdAt)}</td>
                    <td className="py-3 pr-4"><Link href={`/billing/${o.id}`} className="font-semibold text-ink underline">{o.items.map((i) => i.title).join(", ") || o.id}</Link></td>
                    <td className="py-3 pr-4 text-ink-2">{STATUS[o.status] ?? o.status}</td>
                    <td className="py-3 text-right font-medium text-ink">{money(o.totalMinor, o.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="text-ink-3">No orders yet.</p>}
      </Card>
    </PortalPage>
  );
}
