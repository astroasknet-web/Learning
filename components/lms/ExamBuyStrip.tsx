import Link from "next/link";
import { BadgeCheck, Lock } from "lucide-react";
import { buyHref } from "@/lib/pay/course-access";
import { examAccess } from "@/lib/lms/exam-access";

const rs = (n: number) => `₹${n.toLocaleString("en-IN")}`;

/** A one-line purchase strip for the public overview pages of an exam: what it costs and a buy button, or a note that the visitor already owns it. */
export default async function ExamBuyStrip({ examKey }: { examKey: string }) {
  const a = await examAccess(examKey);
  if (!a.onSale) return null;
  return (
    <div className={`mt-5 flex flex-wrap items-center gap-x-5 gap-y-3 rounded-2xl border px-5 py-4 ${a.open ? "border-emerald-200 bg-emerald-50" : "border-black/[0.1] bg-white shadow-card"}`}>
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${a.open ? "bg-emerald-500 text-white" : "bg-orange-light text-orange-deep"}`}>{a.open ? <BadgeCheck className="h-5 w-5" aria-hidden /> : <Lock className="h-5 w-5" aria-hidden />}</span>
      <span className="min-w-0 flex-1 text-[14.5px] text-ink-2">
        {a.open ? <b className="text-emerald-800">You own {a.title}. All the notes and tests are unlocked.</b> : <><b className="text-ink">{a.title}</b>: notes, chapter tests and mock tests open with one payment of <b className="text-ink">{rs(a.rupees)}</b>.</>}
      </span>
      {a.open ? null : <Link href={a.signedIn ? buyHref(a.slug) : `/login?next=${encodeURIComponent(buyHref(a.slug))}`} className="inline-flex min-h-[46px] items-center rounded-lg bg-orange-deep px-5 font-semibold text-white hover:bg-ink">Buy now · {rs(a.rupees)}</Link>}
    </div>
  );
}
