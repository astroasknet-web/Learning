"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AlertCircle, Loader2, ShoppingCart, Trash2 } from "lucide-react";
import { removeFromCart, useCart } from "@/lib/cart/store";
import { formatMoney } from "@/lib/pay/money";
import type { CartView as View } from "@/lib/pay/cart";

const money = (n: number, c: string): string => formatMoney(n, c, c === "INR" ? "en-IN" : "en-US");
const field = "min-h-[44px] rounded-xl border border-black/[0.15] bg-white px-3 text-[15px] text-ink outline-none focus:border-ink focus:ring-4 focus:ring-black/5";

/** The cart page: the browser's list of product codes, shown with live prices from the server, and a hand-off to checkout. */
export default function CartView({ initialCountry, countries }: { initialCountry: string; countries: Array<{ code: string; name: string }> }) {
  const { skus, ready } = useCart();
  const [country, setCountry] = useState(initialCountry);
  const [currency, setCurrency] = useState<string | undefined>();
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState("");
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    if (!ready) return;
    if (!skus.length) { setView(null); setError(null); return; }
    const mine = ++seq.current;
    setBusy(true);
    fetch("/api/v1/cart", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ skus, country, currency, coupon: coupon || undefined }), cache: "no-store" })
      .then(async (r) => ({ ok: r.ok, j: await r.json().catch(() => ({})) }))
      .then(({ ok, j }) => {
        if (mine !== seq.current) return;
        if (ok) { setView(j.data as View); setError(null); } else { setView(null); setError(j.error?.message ?? "We could not load your cart."); }
      })
      .catch(() => { if (mine === seq.current) setError("We could not reach the server. Check your connection."); })
      .finally(() => { if (mine === seq.current) setBusy(false); });
  }, [ready, skus.join(","), country, currency, coupon]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!ready) return <p className="flex items-center gap-2 text-ink-3" role="status"><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading your cart...</p>;

  if (!skus.length) {
    return (
      <div className="rounded-3xl border border-black/10 bg-white p-10 text-center shadow-sm">
        <ShoppingCart className="mx-auto h-10 w-10 text-ink-4" aria-hidden />
        <h2 className="mt-4 text-[1.3rem] font-semibold text-ink">Your cart is empty</h2>
        <p className="mt-1 text-ink-3">Add courses or a plan, then check out once.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/courses" className="inline-flex min-h-[48px] items-center rounded-xl bg-ink px-6 font-semibold text-white">Browse courses</Link>
          <Link href="/pricing" className="inline-flex min-h-[48px] items-center rounded-xl border border-black/15 px-6 font-semibold text-ink">See plans</Link>
        </div>
      </div>
    );
  }

  const q = view?.quote ?? null;
  const buyable = view?.lines.filter((l) => l.status === "ok") ?? [];
  const params = new URLSearchParams({ sku: buyable.map((l) => l.sku).join(","), country });
  if (view?.currency) params.set("currency", view.currency);
  if (q?.coupon) params.set("coupon", q.coupon);

  return (
    <div className="grid gap-8 lg:grid-cols-[1.25fr,0.75fr]">
      <section aria-labelledby="cart-items" className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm sm:p-8">
        <h2 id="cart-items" className="text-[1.25rem] font-semibold text-ink">{skus.length} {skus.length === 1 ? "item" : "items"}</h2>
        {error ? <div role="alert" className="mt-4 flex gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[0.9rem] text-red-800"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{error}</div> : null}
        <ul className="mt-4 divide-y divide-black/[0.07]">
          {(view?.lines ?? skus.map((s) => ({ sku: s, title: s, kind: "other", unitMinor: null, status: "ok" as const, reason: null }))).map((l) => (
            <li key={l.sku} className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div className="min-w-0">
                <p className="font-medium text-ink">{l.title}</p>
                {l.status !== "ok" ? <p className={`text-[0.85rem] ${l.status === "owned" ? "text-emerald-700" : "text-amber-700"}`}>{l.reason} It will not be charged. Remove it to tidy your cart.</p> : <p className="text-[0.85rem] text-ink-4">One-time payment</p>}
              </div>
              <div className="flex items-center gap-4">
                {l.unitMinor !== null && view ? <span className="font-semibold text-ink">{money(l.unitMinor, view.currency)}</span> : null}
                <button type="button" onClick={() => removeFromCart(l.sku)} aria-label={`Remove ${l.title} from cart`} className="grid h-11 w-11 place-items-center rounded-full border border-black/10 text-ink-3 transition hover:border-red-300 hover:text-red-700"><Trash2 className="h-4 w-4" aria-hidden /></button>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[0.85rem]"><Link href="/courses" className="font-semibold underline">Keep shopping</Link></p>
      </section>

      <aside aria-labelledby="cart-sum" className="h-fit rounded-3xl border border-black/10 bg-white p-6 shadow-sm sm:p-8 lg:sticky lg:top-32">
        <h2 id="cart-sum" className="text-[1.25rem] font-semibold text-ink">Order summary</h2>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="text-[0.8rem] text-ink-3">Country
            <select className={`${field} mt-1 w-full`} value={country} onChange={(e) => { setCountry(e.target.value); setCurrency(undefined); }}>{countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</select>
          </label>
          <label className="text-[0.8rem] text-ink-3">Pay in
            <select className={`${field} mt-1 w-full`} value={view?.currency ?? ""} onChange={(e) => setCurrency(e.target.value)} disabled={!view || view.currencies.length < 2}>{(view?.currencies ?? []).map((c) => <option key={c}>{c}</option>)}</select>
          </label>
        </div>
        <div className="mt-4 flex gap-2">
          <input className={`${field} w-full`} placeholder="Coupon code" aria-label="Coupon code" value={couponInput} onChange={(e) => setCouponInput(e.target.value.toUpperCase())} autoComplete="off" spellCheck={false} />
          <button type="button" onClick={() => setCoupon(couponInput.trim())} className="min-h-[44px] shrink-0 rounded-xl border border-black/15 px-4 text-[0.9rem] font-semibold text-ink hover:bg-cream-2">Apply</button>
        </div>
        {q?.couponError ? <p className="mt-1.5 text-[0.84rem] text-red-700" role="status">{q.couponError}</p> : null}
        {q?.coupon && !q.couponError ? <p className="mt-1.5 text-[0.84rem] text-emerald-700" role="status">Coupon {q.coupon} applied.</p> : null}

        {q && view ? (
          <dl className="mt-5 space-y-2 border-t border-black/10 pt-4 text-[0.94rem]" aria-live="polite">
            <div className="flex justify-between"><dt className="text-ink-3">Subtotal</dt><dd>{money(q.subtotalMinor, view.currency)}</dd></div>
            {q.discountMinor > 0 ? <div className="flex justify-between text-emerald-700"><dt>Discount</dt><dd>-{money(q.discountMinor, view.currency)}</dd></div> : null}
            <div className="flex justify-between text-ink-3"><dt>{q.taxMinor > 0 ? `${q.taxName || "Tax"}${q.taxInclusive ? " (included)" : ""}` : "Tax"}</dt><dd>{q.taxMinor > 0 ? money(q.taxMinor, view.currency) : "None charged"}</dd></div>
            <div className="flex items-baseline justify-between border-t border-black/10 pt-3"><dt className="font-semibold text-ink">Total</dt><dd className="text-[1.5rem] font-bold text-ink">{money(q.totalMinor, view.currency)}</dd></div>
          </dl>
        ) : <p className="mt-5 text-[0.92rem] text-ink-3">{busy ? "Working out your total..." : "Nothing in your cart can be bought right now."}</p>}

        {buyable.length ? (
          <Link href={`/checkout?${params.toString()}`} aria-disabled={busy} className="mt-6 inline-flex min-h-[54px] w-full items-center justify-center rounded-xl bg-ink px-6 text-[1rem] font-bold text-white transition hover:opacity-90">
            Checkout {buyable.length > 1 ? `(${buyable.length} items)` : ""}
          </Link>
        ) : null}
        <p className="mt-4 text-[0.8rem] leading-snug text-ink-4">Prices are set by our server at checkout. You pay once, on the payment provider&rsquo;s secure page.</p>
      </aside>
    </div>
  );
}
