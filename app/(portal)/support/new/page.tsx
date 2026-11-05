import type { Metadata } from "next";
import Link from "next/link";
import { supportUser } from "@/lib/support/page";
import { PortalPage } from "@/components/portal/shell";
import { Card } from "@/components/portal/shell";
import { CATEGORIES, LIMITS } from "@/lib/support/model";
import { Flash, btnPrimary, inputCls } from "@/components/support/ui";
import { newTicketAction } from "../actions";
import { captchaMode, turnstileSiteKey } from "@/lib/portal/captcha";
import { CheckedSubmit } from "@/components/support/checked-submit";

export const metadata: Metadata = { title: "Raise a support ticket | GrowQR" };
export const dynamic = "force-dynamic";

export default async function NewTicketPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await supportUser("/support/new");
  const sp = await searchParams;
  const mode = captchaMode();
  const captcha = { mode, siteKey: mode === "turnstile" ? turnstileSiteKey() : "" };
  return (
    <PortalPage user={me} active="support" title="Raise a support ticket" subtitle="Tell us what is wrong or what you need. The team replies here and by email." wide>
      <Flash err={sp.e} />
      <Card>
        <form action={newTicketAction} className="grid gap-5">
          <div>
            <label htmlFor="category" className="text-[15px] font-semibold text-ink">What is it about? <span className="text-red-700" aria-hidden>*</span></label>
            <select id="category" name="category" required defaultValue="" className={`${inputCls} mt-1.5`}>
              <option value="" disabled>Choose one</option>
              {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="subject" className="text-[15px] font-semibold text-ink">Subject <span className="text-red-700" aria-hidden>*</span></label>
            <input id="subject" name="subject" required minLength={5} maxLength={160} placeholder="One line that sums it up" className={`${inputCls} mt-1.5`} />
          </div>
          <div>
            <label htmlFor="related_ref" className="text-[15px] font-semibold text-ink">Order, payment or reference number (optional)</label>
            <input id="related_ref" name="related_ref" maxLength={80} placeholder="For example, from your receipt email" className={`${inputCls} mt-1.5`} />
          </div>
          <div>
            <label htmlFor="body" className="text-[15px] font-semibold text-ink">Describe the problem <span className="text-red-700" aria-hidden>*</span></label>
            <textarea id="body" name="body" required minLength={15} maxLength={8000} rows={8} placeholder="What happened, what you expected, and any error message you saw." className={`${inputCls} mt-1.5 min-h-[180px]`} />
            <p className="mt-1.5 text-[13px] text-ink-4">The ticket is linked to your account ({me.email}). Please do not include passwords or full card numbers.</p>
          </div>
          <CheckedSubmit captcha={captcha} label="Send ticket" className={btnPrimary} extra={<Link href="/support/tickets" className="text-[14.5px] underline">My tickets</Link>} />
          <p className="text-[13px] text-ink-4">You can open up to {LIMITS.perHour} tickets an hour and keep {LIMITS.openAtOnce} open at a time.</p>
        </form>
      </Card>
    </PortalPage>
  );
}
