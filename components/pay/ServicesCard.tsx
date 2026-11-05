import Link from "next/link";
import { Card } from "@/components/portal/shell";
import { serviceLines } from "@/lib/pay/services";
import { SERVICE_PRODUCTS } from "@/lib/pay/course-fees";
import { claimServiceAction } from "@/app/(portal)/account/service-actions";

/** The staff-delivered services the student's plan includes, how many are left, and a button to ask for one (it opens a support ticket). */
export default async function ServicesCard({ userId, msg }: { userId: number; msg: { ok?: string; err?: string } }) {
  const lines = await serviceLines(userId);
  if (!lines.length) return null;
  const fee = (k: string): number | undefined => SERVICE_PRODUCTS.find((s) => s.key === k)?.rupees;
  return (
    <div id="services">
      <Card title="Your included services">
        {msg.ok ? <p role="status" className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-[14px] text-emerald-900">Requested. Your ticket is <Link className="font-semibold underline" href={`/support/tickets/${msg.ok}`}>{msg.ok}</Link>. Our team will reply there.</p> : null}
        {msg.err ? <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-[14px] text-red-800">{msg.err}</p> : null}
        <ul className="divide-y divide-black/[0.07]">
          {lines.map((l) => (
            <li key={l.key} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0 max-w-[34em]">
                <p className="font-semibold text-ink">{l.name}{fee(l.key) ? <span className="ml-2 text-[13px] font-normal text-ink-4">worth ₹{fee(l.key)!.toLocaleString("en-IN")} each</span> : null}</p>
                <p className="text-[13.5px] text-ink-3">{l.what}.</p>
                <p className="mt-0.5 text-[13px] text-ink-3">{l.left} of {l.allowance.count} left {l.allowance.per === "month" ? "this month" : "this year"}</p>
              </div>
              <form action={claimServiceAction}>
                <input type="hidden" name="service" value={l.key} />
                <button type="submit" disabled={l.left === 0} className="inline-flex min-h-[44px] items-center rounded-lg bg-ink px-4 text-[14px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">Request</button>
              </form>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
