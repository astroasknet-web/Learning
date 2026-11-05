import Link from "next/link";
import { ALL_IELTS_TESTS, FREE_IELTS_TESTS, SILVER_IELTS_TESTS } from "@/lib/market/plan-services";

/** Shown instead of a test the person has not unlocked: what is free, how to open the rest, and what it costs. */
export default function LockedTest({ label, n, offer, signedIn }: { label: string; n: number; offer: { priceRupees: number | null; buy: string }; signedIn: boolean }) {
  const btn = "inline-flex min-h-[48px] items-center rounded-lg px-6 text-[15px] font-semibold";
  return (
    <section aria-label="This test is locked" className="mt-6 max-w-3xl rounded-2xl border border-black/[0.1] bg-white p-6 shadow-card sm:p-8">
      <h2 className="text-[20px] font-bold text-ink">{label} Test {n} is part of the full practice set</h2>
      <p className="mt-2 text-ink-3">Tests 1 to {FREE_IELTS_TESTS} of every IELTS kind are free. The full set has all {ALL_IELTS_TESTS} Reading and all {ALL_IELTS_TESTS} Listening tests, timed and marked, with an explanation for every answer.</p>
      <ul className="mt-4 space-y-1.5 text-[15px] text-ink-2">
        {offer.priceRupees ? <li>Buy the full set once: <b>₹{offer.priceRupees.toLocaleString("en-IN")}</b></li> : null}
        <li>Silver opens the first {SILVER_IELTS_TESTS} tests of each kind, and Gold opens all {ALL_IELTS_TESTS}.</li>
      </ul>
      <div className="mt-5 flex flex-wrap gap-3">
        {offer.priceRupees ? <Link href={offer.buy} className={`${btn} bg-orange-deep text-white hover:bg-ink`}>Buy the full set · ₹{offer.priceRupees.toLocaleString("en-IN")}</Link> : null}
        <Link href="/pricing" className={`${btn} border border-black/[0.15] text-ink hover:bg-cream-2`}>See plans</Link>
        <Link href={`/practice-tests/${label.toLowerCase().includes("listening") ? "ielts-listening" : "ielts-reading"}`} className={`${btn} border border-black/[0.15] text-ink hover:bg-cream-2`}>Free tests</Link>
        {!signedIn ? <Link href="/login" className={`${btn} border border-black/[0.15] text-ink hover:bg-cream-2`}>Log in</Link> : null}
      </div>
    </section>
  );
}
