"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";
import { removeMany } from "@/lib/cart/store";
import { formatMoney } from "@/lib/pay/money";

interface OrderData {
  order: { id: string; status: string; currency: string; totalMinor: number; refundedMinor: number; email: string; items: Array<{ sku?: string; title: string; qty: number; totalMinor: number }> };
  payment: { status: string; provider: string; problem: string | null } | null;
  documents: Array<{ number: string; kind: string; title: string }>;
}

const money = (n: number, c: string): string => formatMoney(n, c, c === "INR" ? "en-IN" : "en-US");
const DONE = new Set(["paid", "fulfilled", "partially_refunded", "refunded", "disputed"]);
const DEAD = new Set(["failed", "cancelled", "expired"]);

/** Polls the order until it settles. The page never trusts the redirect: "paid" only appears once the server has verified the payment with the provider. */
export default function OrderStatus({ id, token, retryHref }: { id: string; token: string | null; retryHref: string }) {
  const [data, setData] = useState<OrderData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tries, setTries] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const q = token ? `?k=${encodeURIComponent(token)}` : "";
  const headers: Record<string, string> = token ? { "x-order-token": token } : {};

  const load = useCallback(async (confirm: boolean) => {
    try {
      if (confirm) await fetch(`/api/v1/orders/${id}/confirm`, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: "{}", cache: "no-store" });
      const r = await fetch(`/api/v1/orders/${id}${q}`, { headers, cache: "no-store" });
      const j = await r.json();
      if (!r.ok) { setError(r.status === 404 ? "We could not find this order. Sign in with the account that placed it, or open the link from your receipt email." : j.error?.message ?? "We could not load this order."); return; }
      setError(null);
      setData(j.data as OrderData);
    } catch { setError("We could not reach the server. Check your connection; this page will keep trying."); }
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let stop = false;
    const tick = async (n: number) => {
      if (stop) return;
      await load(n % 2 === 0); // ask the server to re-check with the provider on every second round
      setTries(n + 1);
      if (!stop && n < 40) timer.current = setTimeout(() => tick(n + 1), n < 5 ? 2000 : 5000);
    };
    void tick(0);
    return () => { stop = true; if (timer.current) clearTimeout(timer.current); };
  }, [load]);

  // Once the server says the order is paid, the things in it are no longer waiting in the cart.
  const paidSkus = data && DONE.has(data.order.status) ? data.order.items.map((i) => i.sku ?? "").filter(Boolean).join(",") : "";
  useEffect(() => { if (paidSkus) removeMany(paidSkus.split(",")); }, [paidSkus]);

  if (!data) {
    return error ? (
      <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800"><AlertCircle className="mb-2 h-5 w-5" aria-hidden />{error}</div>
    ) : <p className="flex items-center gap-2 text-ink-3" role="status"><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Checking your payment...</p>;
  }

  const { order, payment, documents } = data;
  const paid = DONE.has(order.status);
  const dead = DEAD.has(order.status);
  const settled = paid || dead;
  const receipt = documents.find((d) => d.kind !== "credit_note") ?? documents[0];
  const stillWaiting = !settled && tries >= 40;

  return (
    <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm sm:p-10" aria-live="polite">
      {paid ? (
        <>
          <CheckCircle2 className="h-10 w-10 text-emerald-600" aria-hidden />
          <h1 className="mt-4 text-[1.7rem] font-bold text-ink">{order.status === "refunded" ? "This order was refunded" : order.status === "disputed" ? "This payment is under review" : "Payment received. Thank you!"}</h1>
          <p className="mt-2 text-ink-3">{order.status === "paid" ? "Your payment is confirmed and we are activating your purchase. This usually takes a few seconds." : order.status === "fulfilled" ? "Your purchase is active." : "See the details below."} A receipt was sent to {order.email}.</p>
        </>
      ) : dead ? (
        <>
          <XCircle className="h-10 w-10 text-red-600" aria-hidden />
          <h1 className="mt-4 text-[1.7rem] font-bold text-ink">{order.status === "expired" ? "This checkout timed out" : order.status === "cancelled" ? "Checkout cancelled" : "The payment did not go through"}</h1>
          <p className="mt-2 text-ink-3">You have not been charged for this order. If your bank shows a charge, it is released automatically, usually within 5 to 7 working days; if you are worried, write to us with order number {order.id}.</p>
          <Link href={retryHref} className="mt-6 inline-flex min-h-[48px] items-center rounded-xl bg-ink px-6 font-semibold text-white">Try again</Link>
        </>
      ) : (
        <>
          {payment?.problem === "declined" ? <XCircle className="h-10 w-10 text-red-600" aria-hidden /> : stillWaiting ? <Clock className="h-10 w-10 text-amber-600" aria-hidden /> : <Loader2 className="h-10 w-10 animate-spin text-ink-3" aria-hidden />}
          <h1 className="mt-4 text-[1.7rem] font-bold text-ink">{payment?.problem === "declined" ? "That payment was declined" : stillWaiting ? "We are still waiting for your bank" : "Confirming your payment"}</h1>
          <p className="mt-2 text-ink-3">{stillWaiting ? `Some payments take longer to confirm. You do not need to pay again. We will email ${order.email} as soon as it is confirmed, and you can check this page later.` : payment?.problem === "declined" ? "You have not been charged. Your cart is still saved." : "Please do not close this page or pay again. This takes a few seconds."}</p>
          {payment?.problem === "declined" ? <p className="mt-3 text-red-700">Your bank declined an attempt. You can try again with another method.</p> : null}
          {stillWaiting || payment?.problem ? <Link href={retryHref} className="mt-6 inline-flex min-h-[44px] items-center rounded-xl border border-black/15 px-5 font-semibold text-ink">Pay again</Link> : null}
        </>
      )}

      <div className="mt-8 border-t border-black/10 pt-6">
        <p className="text-[0.85rem] text-ink-4">Order {order.id}</p>
        <ul className="mt-3 divide-y divide-black/[0.07]">
          {order.items.map((i, n) => <li key={n} className="flex justify-between gap-4 py-2.5"><span className="text-ink-2">{i.title}{i.qty > 1 ? ` x ${i.qty}` : ""}</span><span className="font-medium text-ink">{money(i.totalMinor, order.currency)}</span></li>)}
        </ul>
        <p className="mt-3 flex justify-between border-t border-black/10 pt-3 text-[1.05rem] font-bold text-ink"><span>Total</span><span>{money(order.totalMinor, order.currency)}</span></p>
        {order.refundedMinor > 0 ? <p className="mt-1 flex justify-between text-ink-3"><span>Refunded</span><span>{money(order.refundedMinor, order.currency)}</span></p> : null}
      </div>

      {receipt ? <a href={`/api/v1/orders/${order.id}/receipt${q}`} target="_blank" rel="noreferrer" className="mt-6 inline-flex min-h-[44px] items-center rounded-xl border border-black/15 px-5 font-semibold text-ink">View {receipt.title.toLowerCase()}</a> : null}
      {paid ? <div className="mt-6 flex flex-wrap gap-3"><Link href="/account" className="inline-flex min-h-[48px] items-center rounded-xl bg-ink px-6 font-semibold text-white">Go to my account</Link><Link href="/billing" className="inline-flex min-h-[48px] items-center rounded-xl border border-black/15 px-6 font-semibold text-ink">Billing history</Link></div> : null}
      {error ? <p role="status" className="mt-4 text-[0.85rem] text-amber-700">{error}</p> : null}
    </div>
  );
}
