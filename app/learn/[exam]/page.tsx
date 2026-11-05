import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MarketShell } from "@/components/market/shell";
import { EXAMS, exam, subjectsOf, totalChapters } from "@/lib/lms/content";
import ExamBuyStrip from "@/components/lms/ExamBuyStrip";
import { examForLearn } from "@/lib/lms/exam-products";

export const dynamic = "force-dynamic"; // the purchase strip depends on the visitor

type P = { params: Promise<{ exam: string }> };
const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9-]/g, "");

export function generateStaticParams() { return EXAMS.map((e) => ({ exam: e.slug })); }

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const ex = exam(clean((await params).exam));
  if (!ex) return { title: "Course not found | GrowQR", robots: { index: false, follow: true } };
  return { title: `${ex.title}: Chapters, Notes and Mock Tests | GrowQR`, description: `${ex.title} preparation: ${totalChapters(ex)} chapters with notes, worked examples, quick quizzes and timed mock tests.`, alternates: { canonical: `/learn/${ex.slug}` } };
}

export default async function ExamPage({ params }: P) {
  const ex = exam(clean((await params).exam));
  if (!ex) notFound();
  const subjects = subjectsOf(ex);
  return (
    <MarketShell user={null} active="courses">
      <nav aria-label="Breadcrumb" className="mb-4 text-[13px] text-ink-3"><Link href="/" className="underline">Home</Link> / <Link href="/exam-prep" className="underline">Exam prep</Link> / {ex.title}</nav>
      <p className="text-[0.74rem] font-bold uppercase tracking-wider text-orange-dark">{ex.kind}</p>
      <h1 className="mt-1 text-[26px] font-bold leading-tight tracking-tight text-ink sm:text-[34px]">{ex.title}</h1>
      <p className="mt-2 max-w-3xl text-[16px] text-ink-3">{totalChapters(ex)} chapters across {subjects.length} {subjects.length === 1 ? "subject" : "subjects"}. Each chapter has notes, worked examples, quick quizzes and timed mock tests.</p>
      {examForLearn(ex.slug) ? <ExamBuyStrip examKey={examForLearn(ex.slug)!} /> : null}
      <div className="mt-8 space-y-10">
        {subjects.map((s) => (
          <section key={s.subject} aria-label={s.subject_label}>
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-[22px] font-bold text-ink">{s.subject_label}</h2>
              <Link href={`/learn/${ex.slug}/${s.subject}`} className="text-[14px] font-semibold text-orange-deep underline">All {s.chapters.length} chapters</Link>
            </div>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {s.chapters.slice(0, 6).map((c) => (
                <li key={c.slug}><Link href={`/learn/${ex.slug}/${s.subject}/${c.slug}`} className="block h-full rounded-xl border border-black/[0.08] bg-white p-4 transition hover:border-orange">
                  <span className="text-[12px] text-ink-4">Chapter {c.number}</span><b className="mt-0.5 block text-[15px] text-ink">{c.title}</b><span className="mt-1 block text-[13px] text-ink-3">{c.topics_count} topics · {c.mock_tests} {c.mock_tests === 1 ? "mock test" : "mock tests"}</span>
                </Link></li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </MarketShell>
  );
}
