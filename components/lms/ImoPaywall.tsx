import Link from "next/link";
import { Lock } from "lucide-react";
import { buyHref } from "@/lib/pay/course-access";
import type { ImoAccess } from "@/lib/lms/imo-access";

const rs = (n: number) => `₹${n.toLocaleString("en-IN")}`;

/** The purchase card shown wherever a Maths Olympiad class is locked. What the class contains is listed; the lessons and questions themselves are not sent to the browser. */
export default function ImoPaywall({ cls, access, chapters, minutes }: { cls: number; access: ImoAccess; chapters: number; minutes?: number }) {
  const buy = buyHref(access.slug);
  return (
    <section aria-label={`Buy Class ${cls} Maths Olympiad`} className="rounded-2xl border border-black/[0.1] bg-white p-6 shadow-card sm:p-8">
      <p className="inline-flex items-center gap-2 text-[0.74rem] font-bold uppercase tracking-wider text-orange-dark"><Lock className="h-4 w-4" aria-hidden />Class {cls} Maths Olympiad</p>
      <h2 className="mt-2 text-[22px] font-bold text-ink">Unlock Class {cls}: {rs(access.rupees)}, one payment</h2>
      <ul className="mt-4 grid gap-2 text-[15px] text-ink-2 sm:grid-cols-2">
        <li>{chapters} chapters with lessons and in-lesson checks</li>
        <li>A chapter test for every chapter</li>
        <li>Unlimited full-syllabus mock tests{minutes ? `, ${minutes} minutes each` : ""}</li>
        <li>Worked explanation for every answer</li>
      </ul>
      <div className="mt-6 flex flex-wrap gap-3">
        {access.onSale ? (
          <Link href={access.signedIn ? buy : `/login?next=${encodeURIComponent(buy)}`} className="inline-flex min-h-[48px] items-center rounded-lg bg-orange-deep px-6 font-semibold text-white hover:bg-ink">Buy Class {cls} · {rs(access.rupees)}</Link>
        ) : (
          <p className="text-[14px] text-ink-3">Purchase for this class is not open yet.</p>
        )}
        {!access.signedIn ? <Link href={`/login?next=${encodeURIComponent(`/olympiad/imo/class-${cls}`)}`} className="inline-flex min-h-[48px] items-center rounded-lg border border-black/[0.15] px-6 font-semibold text-ink hover:bg-cream-2">Already bought? Log in</Link> : null}
      </div>
    </section>
  );
}
