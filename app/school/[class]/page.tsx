import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MarketShell } from "@/components/market/shell";
import { CLASSES, classNumber, isClass, subjectsOfClass } from "@/lib/lms/school";

type P = { params: Promise<{ class: string }> };
const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9-]/g, "");

export function generateStaticParams() { return CLASSES.map((c) => ({ class: c })); }

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const c = clean((await params).class);
  if (!isClass(c)) return { title: "Class not found | GrowQR", robots: { index: false, follow: true } };
  return { title: `Class ${classNumber(c)} Free Lessons and Tests | GrowQR`, description: `Free Class ${classNumber(c)} lessons, worked examples, quizzes and chapter tests: ${subjectsOfClass(c).map((s) => s.label).join(", ")}.`, alternates: { canonical: `/school/${c}` } };
}

export default async function ClassPage({ params }: P) {
  const c = clean((await params).class);
  if (!isClass(c)) notFound();
  const subs = subjectsOfClass(c);
  return (
    <MarketShell user={null} active="courses">
      <nav aria-label="Breadcrumb" className="mb-4 text-[13px] text-ink-3"><Link href="/school" className="underline">School</Link> / Class {classNumber(c)}</nav>
      <h1 className="text-[26px] font-bold leading-tight tracking-tight text-ink sm:text-[34px]">Class {classNumber(c)}</h1>
      <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {subs.map((s) => (
          <li key={s.subject}>
            <Link href={s.subject === "imo" ? `/olympiad/imo/${c}` : `/school/${c}/${s.subject}`} className="block h-full rounded-2xl border border-black/[0.08] bg-white p-5 shadow-card transition hover:-translate-y-1 hover:shadow-glow">
              <h2 className="text-[1.1rem] font-semibold text-ink">{s.label}</h2>
              <p className="mt-2 text-[0.88rem] leading-relaxed text-ink-3">{s.chapters.slice(0, 3).map((x) => x.title).join(", ")}{s.chapters.length > 3 ? ` and ${s.chapters.length - 3} more` : ""}</p>
              <p className="mt-3 text-[0.8rem] text-ink-4">{s.chapters.length} chapters</p>
            </Link>
          </li>
        ))}
      </ul>
    </MarketShell>
  );
}
