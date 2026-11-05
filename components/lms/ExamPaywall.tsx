import Link from "next/link";
import { Lock } from "lucide-react";
import { buyHref } from "@/lib/pay/course-access";
import { examProduct } from "@/lib/lms/exam-products";
import type { ExamAccess } from "@/lib/lms/exam-access";

const rs = (n: number) => `₹${n.toLocaleString("en-IN")}`;

/** The purchase card shown wherever an exam-preparation product is locked. The notes and questions themselves are never sent to the browser. */
export default function ExamPaywall({ access }: { access: ExamAccess }) {
  const buy = buyHref(access.slug);
  const hub = examProduct(access.key)?.hub;
  return (
    <section aria-label={`Unlock ${access.title}`} className="rounded-2xl border border-black/[0.1] bg-white p-6 shadow-card sm:p-8">
      <p className="inline-flex items-center gap-2 text-[0.74rem] font-bold uppercase tracking-wider text-orange-dark"><Lock className="h-4 w-4" aria-hidden />Exam preparation</p>
      <h2 className="mt-2 text-[22px] font-bold text-ink">{access.onSale ? `Unlock ${access.title}: ${rs(access.rupees)}, one payment` : `${access.title} is coming soon`}</h2>
      <p className="mt-3 max-w-[44em] text-[15px] leading-relaxed text-ink-2">{access.blurb}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        {access.onSale ? (
          <Link href={access.signedIn ? buy : `/login?next=${encodeURIComponent(buy)}`} className="inline-flex min-h-[48px] items-center rounded-lg bg-orange-deep px-6 font-semibold text-white hover:bg-ink">Buy now · {rs(access.rupees)}</Link>
        ) : null}
        {!access.signedIn && access.onSale ? <Link href={`/login?next=${encodeURIComponent(hub ? `/exam-prep/${hub}` : "/exam-prep")}`} className="inline-flex min-h-[48px] items-center rounded-lg border border-black/[0.15] px-6 font-semibold text-ink hover:bg-cream-2">Already bought? Log in</Link> : null}
        <Link href={hub ? `/exam-prep/${hub}` : "/exam-prep"} className="inline-flex min-h-[48px] items-center rounded-lg px-4 font-semibold text-ink underline underline-offset-4">See what is included</Link>
      </div>
    </section>
  );
}
