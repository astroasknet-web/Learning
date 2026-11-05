import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/portal/guard";
import { PortalPage } from "@/components/portal/shell";
import OrderStatus from "@/components/pay/OrderStatus";
import { databaseConfigured } from "@/lib/portal/db";
import { pool } from "@/lib/pay/db";
import { loadOrder, PayError } from "@/lib/pay/orders";

export const metadata: Metadata = { title: "Order | GrowQR" };
export const dynamic = "force-dynamic";

export default async function BillingOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireUser();
  const { id } = await params;
  if (!databaseConfigured()) notFound();
  try {
    await loadOrder(pool, id, { userId: me.id, role: me.role, email: me.email }); // 404 for anyone else's order
  } catch (e) {
    if (e instanceof PayError) notFound();
    throw e;
  }
  return (
    <PortalPage user={me} active="billing" title="Order" subtitle={id}>
      <OrderStatus id={id} token={null} retryHref="/cart" />
      <p className="mt-6 text-[0.9rem] text-ink-3">Need a refund? See our <Link href="/refund-policy" className="font-semibold underline">refund policy</Link> and write to support with this order number.</p>
    </PortalPage>
  );
}
