import type { Metadata } from "next";
import PageShell from "@/components/layout/PageShell";
import OrderStatus from "@/components/pay/OrderStatus";

export const metadata: Metadata = { title: "Your order | GrowQR", robots: { index: false, follow: false }, referrer: "no-referrer" };
export const dynamic = "force-dynamic";

/** Where the customer lands after paying (also the Stripe success and cancel URL). The optional `?k=` is the guest order's access token. */
export default async function CheckoutStatusPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const token = sp.k && sp.k.length < 100 ? sp.k : null;
  return (
    <PageShell>
      <main className="mx-auto max-w-2xl px-5 pb-24 pt-28 sm:pt-32">
        <OrderStatus id={id} token={token} retryHref="/cart" />
      </main>
    </PageShell>
  );
}
