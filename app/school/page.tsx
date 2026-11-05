import type { Metadata } from "next";
import Link from "next/link";
import { MarketShell } from "@/components/market/shell";
import { CLASSES, classNumber, subjectsOfClass } from "@/lib/lms/school";

export const metadata: Metadata = {
  title: "Free School Lessons and Tests, Class 1 to 12 | GrowQR",
  description: "Free lessons, worked examples, quizzes and chapter tests for Class 1 to 12: Mathematics, Science, Physics, Chemistry, Biology, English, Accountancy, and Economics.",
  alternates: { canonical: "/school" },
};

export default function SchoolHome() {
  return (
    <MarketShell user={null} active="courses">
      <h1 className="font-sans text-[clamp(1.8rem,4vw,2.6rem)] font-semibold text-ink">School lessons, Class 1 to 12</h1>
      <p className="mt-2 max-w-[46em] text-ink-3">Free lessons with worked examples, quick quizzes and chapter tests, class by class. No sign-up needed.</p>
      <p className="mt-3 text-[0.92rem]"><Link href="/olympiad/imo" className="font-semibold text-orange-deep underline">Maths Olympiad (IMO) for Class 1 to 12, from ₹499</Link></p>
      <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CLASSES.map((c) => {
          const subs = subjectsOfClass(c).filter((s) => s.subject !== "imo");
          return (
            <li key={c}>
              <Link href={`/school/${c}`} className="block h-full rounded-2xl border border-black/[0.08] bg-white p-5 shadow-card transition hover:-translate-y-1 hover:shadow-glow">
                <h2 className="text-[1.2rem] font-semibold text-ink">Class {classNumber(c)}</h2>
                <p className="mt-2 text-[0.9rem] text-ink-3">{subs.map((s) => s.label).join(" · ")}</p>
                <p className="mt-3 text-[0.8rem] text-ink-4">{subs.reduce((n, s) => n + s.chapters.length, 0)} chapters</p>
              </Link>
            </li>
          );
        })}
      </ul>
    </MarketShell>
  );
}
