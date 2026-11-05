import type { Metadata } from "next";
import Link from "next/link";
import { MarketShell } from "@/components/market/shell";
import { allStudy, chapterCount } from "@/lib/lms/study";

export const metadata: Metadata = {
  title: "Study Courses: CAT, SAT, GRE, SSC CGL, CTET | GrowQR",
  description: "Chapter-by-chapter courses for CAT Quant, SAT Math, GRE Quant, SSC CGL and CTET, with formulas, shortcuts, solved examples, practice problems and flashcards.",
  alternates: { canonical: "/study" },
};

export default function StudyIndex() {
  const courses = allStudy();
  return (
    <MarketShell user={null} active="courses">
      <h1 className="font-sans text-[clamp(1.8rem,4vw,2.6rem)] font-semibold text-ink">Study courses</h1>
      <p className="mt-2 max-w-[46em] text-ink-3">Chapter-by-chapter courses with formulas, shortcuts, solved examples, practice problems and flashcards. CAT, SAT, GRE and SSC CGL are paid exam-prep products; CTET is free.</p>
      <ul className="mt-6 grid gap-4 sm:grid-cols-2">
        {courses.map((c) => (
          <li key={c.key}>
            <Link href={`/study/${c.key}`} className="block h-full rounded-2xl border border-black/[0.08] bg-white p-5 shadow-card transition hover:-translate-y-1 hover:shadow-glow">
              <p className="text-[0.72rem] font-bold uppercase tracking-wider text-orange-dark">{c.kind}</p>
              <h2 className="mt-1 text-[1.15rem] font-semibold text-ink">{c.title}</h2>
              <p className="mt-2 text-[0.9rem] leading-relaxed text-ink-3">{c.blurb}</p>
              <p className="mt-3 text-[0.8rem] text-ink-4">{c.modules.length} modules · {chapterCount(c)} chapters</p>
            </Link>
          </li>
        ))}
      </ul>
    </MarketShell>
  );
}
