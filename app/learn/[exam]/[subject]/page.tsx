import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MarketShell } from "@/components/market/shell";
import { EXAMS, exam, subjectIndex } from "@/lib/lms/content";

type P = { params: Promise<{ exam: string; subject: string }> };
const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9-]/g, "");

export function generateStaticParams() { return EXAMS.flatMap((e) => e.subjects.map((s) => ({ exam: e.slug, subject: s }))); }

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const p = await params;
  const ex = exam(clean(p.exam));
  const idx = ex ? subjectIndex(ex, clean(p.subject)) : null;
  if (!ex || !idx) return { title: "Course not found | GrowQR", robots: { index: false, follow: true } };
  return { title: `${ex.title} ${idx.subject_label}: ${idx.chapters.length} Chapters | GrowQR`, description: `${ex.title} ${idx.subject_label}: ${idx.chapters.length} chapters with notes, worked examples, quizzes and mock tests.`, alternates: { canonical: `/learn/${ex.slug}/${idx.subject}` } };
}

export default async function SubjectPage({ params }: P) {
  const p = await params;
  const ex = exam(clean(p.exam));
  const idx = ex ? subjectIndex(ex, clean(p.subject)) : null;
  if (!ex || !idx) notFound();
  return (
    <MarketShell user={null} active="courses">
      <nav aria-label="Breadcrumb" className="mb-4 text-[13px] text-ink-3"><Link href="/" className="underline">Home</Link> / <Link href="/exam-prep" className="underline">Exam prep</Link> / <Link href={`/learn/${ex.slug}`} className="underline">{ex.title}</Link> / {idx.subject_label}</nav>
      <h1 className="text-[26px] font-bold leading-tight tracking-tight text-ink sm:text-[34px]">{ex.title}: {idx.subject_label}</h1>
      {idx.blurb ? <p className="mt-2 max-w-3xl text-[16px] text-ink-3">{idx.blurb}</p> : <p className="mt-2 text-[16px] text-ink-3">{idx.chapters.length} chapters. Open one to read the notes, try the quizzes and take the mock tests.</p>}
      <ol className="mt-6 grid gap-3 sm:grid-cols-2">
        {idx.chapters.map((c) => (
          <li key={c.slug}>
            <Link href={`/learn/${ex.slug}/${idx.subject}/${c.slug}`} className="flex h-full gap-4 rounded-xl border border-black/[0.08] bg-white p-4 transition hover:border-orange">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-[15px] font-bold text-white" style={{ background: c.color }} aria-hidden>{c.number}</span>
              <span><b className="block text-[15px] text-ink">{c.title}</b><span className="mt-0.5 block text-[13px] leading-snug text-ink-3">{c.tagline}</span><span className="mt-1.5 block text-[12px] text-ink-4">{c.topics_count} topics · {c.quiz_count} quiz questions · {c.mock_tests} {c.mock_tests === 1 ? "mock test" : "mock tests"}</span></span>
            </Link>
          </li>
        ))}
      </ol>
    </MarketShell>
  );
}
