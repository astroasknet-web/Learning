import type { Metadata } from "next";
import Link from "next/link";
import { MarketShell } from "@/components/market/shell";
import { CLASSES, IMO_SECTIONS, classNumber, subject } from "@/lib/lms/school";
import ImoThumb from "@/components/lms/ImoThumb";
import { imoFeeRupees } from "@/lib/pay/course-fees";

export const metadata: Metadata = {
  title: "Maths Olympiad (IMO) Preparation, Class 1 to 12 | GrowQR",
  description: "IMO preparation for every class, bought one class at a time: chapter lessons, chapter tests and full-syllabus mock tests across Logical Reasoning, Mathematical Reasoning, Everyday Mathematics and the Achievers Section.",
  alternates: { canonical: "/olympiad/imo" },
};

const rs = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const BANDS = [
  { label: "Class 1 to 5", price: imoFeeRupees(1) },
  { label: "Class 6 to 8", price: imoFeeRupees(6) },
  { label: "Class 9 to 12", price: imoFeeRupees(9) },
];

export default function ImoHome() {
  return (
    <MarketShell user={null} active="courses">
      <nav aria-label="Breadcrumb" className="mb-4 text-[13px] text-ink-3"><Link href="/exam-prep" className="underline">Exam prep</Link> / Maths Olympiad</nav>
      <h1 className="font-sans text-[clamp(1.8rem,4vw,2.6rem)] font-semibold text-ink">Maths Olympiad (IMO), Class 1 to 12</h1>
      <p className="mt-2 max-w-[46em] text-ink-3">Preparation for every class: chapter lessons, in-lesson checks, chapter tests, and unlimited full-syllabus mock tests sectioned like the real olympiad. Each class is its own course, bought once.</p>
      <ul className="mt-4 flex flex-wrap gap-2">{IMO_SECTIONS.map((s) => <li key={s.key} className="rounded-full bg-cream-3 px-3 py-1 text-[13px] text-ink-2">{s.label}</li>)}</ul>
      <ul className="mt-4 flex flex-wrap gap-2 text-[14px]" aria-label="Prices">{BANDS.map((b) => <li key={b.label} className="rounded-full border border-black/10 bg-white px-4 py-1.5 font-semibold text-ink">{b.label}: {rs(b.price)}</li>)}</ul>
      <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {CLASSES.map((c) => {
          const s = subject(c, "imo");
          return (
            <li key={c}>
              <Link href={`/olympiad/imo/${c}`} className="block h-full overflow-hidden rounded-2xl border border-black/[0.08] bg-white shadow-card transition hover:-translate-y-1 hover:shadow-glow">
                <ImoThumb cls={classNumber(c)} className="aspect-video w-full" />
                <div className="p-5">
                <h2 className="text-[1.15rem] font-semibold text-ink">Class {classNumber(c)}</h2>
                <p className="mt-2 text-[0.85rem] text-ink-3">{s ? `${s.chapters.length} chapters · full mock tests` : "Coming soon"}</p>
                {s ? <p className="mt-3 text-[1.1rem] font-bold text-ink">{rs(imoFeeRupees(classNumber(c)))}</p> : null}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </MarketShell>
  );
}
