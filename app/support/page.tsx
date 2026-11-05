import type { Metadata } from "next";
import Link from "next/link";
import { LifeBuoy, MessageSquare, ShieldCheck } from "lucide-react";
import { MarketShell, currentViewer } from "@/components/market/shell";
import { SITE_URL } from "@/lib/seo";
import { LIMITS } from "@/lib/support/model";

export const dynamic = "force-dynamic";

const TITLE = "GrowQR Support: raise a ticket and track the reply";
const DESC = "Get help with your GrowQR account, payments, courses, internships or study abroad. Log in, raise a ticket, and follow the conversation with our team.";
export const metadata: Metadata = { title: TITLE, description: DESC, alternates: { canonical: `${SITE_URL}/support` }, openGraph: { type: "website", url: `${SITE_URL}/support`, siteName: "GrowQR", title: TITLE, description: DESC } };

const btn = "inline-flex min-h-[52px] items-center justify-center rounded-lg px-7 text-[16px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep";

const HELP: Array<[string, string]> = [
  ["I paid but cannot see my purchase", "Open Billing in your account first: paid orders and invoices appear there within a few minutes. If it is still missing after an hour, raise a ticket under Billing and payments with the reference from your receipt."],
  ["I cannot log in or forgot my password", "Use Forgot password on the login page. If the email never arrives, check spam, then raise a ticket from another signed-in device or contact us through the ticket form once you are back in."],
  ["How fast will you reply?", "Most tickets get a first reply within one working day. Urgent payment and login problems are looked at first."],
  ["Can I add to a ticket later?", "Yes. Reply on the ticket at any time. A resolved ticket reopens when you reply; a closed one needs a new ticket."],
];

export default async function SupportPage() {
  const me = await currentViewer();
  return (
    <MarketShell user={me} active="">
      <header className="max-w-3xl">
        <p className="inline-flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wider text-orange-deep"><LifeBuoy className="h-4 w-4" aria-hidden /> Support</p>
        <h1 className="mt-2 text-[clamp(1.9rem,4.5vw,2.8rem)] font-bold leading-tight text-ink">How can we help?</h1>
        <p className="mt-3 text-[18px] leading-relaxed text-ink-2">Raise a ticket and our team will reply on the ticket and by email. Every ticket is linked to your GrowQR account, so you can follow it from your dashboard.</p>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          {me ? (
            <>
              <Link href="/support/new" className={`${btn} bg-orange text-white hover:bg-orange-dark`}>Raise a ticket</Link>
              <Link href="/support/tickets" className={`${btn} border border-black/[0.15] bg-white text-ink hover:bg-cream-2`}>My tickets</Link>
            </>
          ) : (
            <>
              <Link href={`/login?next=${encodeURIComponent("/support/new")}`} className={`${btn} bg-orange text-white hover:bg-orange-dark`}>Log in to raise a ticket</Link>
              <Link href="/signup" className={`${btn} border border-black/[0.15] bg-white text-ink hover:bg-cream-2`}>Create a free account</Link>
            </>
          )}
        </div>
        {!me ? <p className="mt-3 text-[14px] text-ink-3">Support tickets are for registered, signed-in members. That keeps your conversation private and lets us see which account you mean.</p> : null}
      </header>

      <ul className="mt-12 grid gap-4 md:grid-cols-3">
        {[[MessageSquare, "One place for every conversation", "Replies arrive on the ticket and in your inbox. Add details whenever you need to."], [ShieldCheck, "Private to your account", "Only you and the GrowQR support team can see your ticket."], [LifeBuoy, "Clear status", `Open, in progress, waiting for you, resolved or closed. Up to ${LIMITS.openAtOnce} tickets can be open at once.`]].map(([Icon, t, d]) => {
          const I = Icon as typeof LifeBuoy;
          return <li key={String(t)} className="rounded-2xl border border-black/[0.08] bg-white p-5 shadow-card"><I className="h-6 w-6 text-orange" aria-hidden /><h2 className="mt-2 text-[17px] font-semibold text-ink">{String(t)}</h2><p className="mt-1 text-[14.5px] text-ink-3">{String(d)}</p></li>;
        })}
      </ul>

      <section className="mt-12 max-w-3xl" aria-labelledby="help">
        <h2 id="help" className="text-[24px] font-bold text-ink">Quick answers</h2>
        <div className="mt-3 divide-y divide-black/[0.08] rounded-2xl border border-black/[0.08] bg-white shadow-card">
          {HELP.map(([q, a]) => <details key={q} className="p-4"><summary className="cursor-pointer text-[16px] font-semibold text-ink">{q}</summary><p className="mt-2 text-[15px] text-ink-2">{a}</p></details>)}
        </div>
      </section>
    </MarketShell>
  );
}
