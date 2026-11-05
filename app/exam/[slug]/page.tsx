import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MarketShell } from "@/components/market/shell";
import { EXAM_SLUGS, loadExam } from "@/lib/lms/exams";
import ExamBuyStrip from "@/components/lms/ExamBuyStrip";
import { examForExamSlug } from "@/lib/lms/exam-products";

export const dynamic = "force-dynamic"; // the purchase strip depends on the visitor

type P = { params: Promise<{ slug: string }> };
const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9-]/g, "");

export function generateStaticParams() { return EXAM_SLUGS.map((slug) => ({ slug })); }

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const d = loadExam(clean((await params).slug));
  if (!d) return { title: "Exam not found | GrowQR", robots: { index: false, follow: true } };
  const m = d.raw.meta;
  return { title: `${m.name} Mock Test: Syllabus, Pattern and Online Test | GrowQR`, description: `${m.fullName}: exam pattern, syllabus, strategy and a full-length mock test with worked explanations. ${m.tagline}`.slice(0, 160), alternates: { canonical: `/exam/${d.slug}` } };
}

export default async function ExamOverview({ params }: P) {
  const d = loadExam(clean((await params).slug));
  if (!d) notFound();
  const { meta, pattern, papers, briefing, strategy, subjects } = d.raw;
  return (
    <MarketShell user={null} active="courses">
      <nav aria-label="Breadcrumb" className="mb-4 text-[13px] text-ink-3"><Link href="/" className="underline">Home</Link> / <Link href="/exam-prep" className="underline">Exam prep</Link> / {meta.name}</nav>
      <p className="text-[0.74rem] font-bold uppercase tracking-wider text-orange-dark">{meta.category} · {meta.level}</p>
      <h1 className="mt-1 text-[26px] font-bold leading-tight tracking-tight text-ink sm:text-[34px]">{meta.fullName}</h1>
      <p className="mt-2 max-w-3xl text-[16px] text-ink-3">{meta.tagline}</p>
      {examForExamSlug(d.slug) ? <ExamBuyStrip examKey={examForExamSlug(d.slug)!} /> : null}

      <section className="mt-6" aria-label="Take a mock test">
        <h2 className="text-[20px] font-bold text-ink">Take the mock test</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {d.tests.map((t) => (
            <li key={t.key}><Link href={`/exam/${d.slug}/test/${t.key}`} className="block h-full rounded-xl border border-black/[0.08] bg-white p-4 transition hover:border-orange">
              <b className="text-[15px] text-ink">{t.name}</b><span className="mt-0.5 block text-[13px] text-ink-3">{t.role}</span>
              <span className="mt-1.5 block text-[13px] text-ink-4">{t.questions} questions · {t.marks} marks · {t.minutes} minutes</span><span className="mt-1 block text-[12px] text-ink-4">{t.marking}</span>
            </Link></li>
          ))}
        </ul>
      </section>

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0 space-y-6">
          <article className="rounded-2xl border border-black/[0.08] bg-white p-5 shadow-card sm:p-7">
            <h2 className="text-[20px] font-bold text-ink">About the exam</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{briefing}</p>
            <h3 className="mt-5 text-[16px] font-semibold text-ink">How to prepare</h3>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[15px] text-ink-2">{strategy.map((s) => <li key={s}>{s}</li>)}</ul>
          </article>
          <article className="rounded-2xl border border-black/[0.08] bg-white p-5 shadow-card sm:p-7">
            <h2 className="text-[20px] font-bold text-ink">Syllabus</h2>
            <div className="mt-3 space-y-5">
              {subjects.map((s) => (
                <section key={s.name} aria-label={s.name}><h3 className="text-[16px] font-semibold text-ink">{s.name}</h3>
                  <ul className="mt-2 flex flex-wrap gap-2">{s.chapters.map((c) => <li key={c} className="rounded-full bg-cream-3 px-3 py-1 text-[13px] text-ink-2">{c}</li>)}</ul>
                </section>
              ))}
            </div>
          </article>
        </div>
        <aside aria-label="Exam pattern" className="space-y-4 rounded-2xl border border-black/[0.08] bg-white p-5 shadow-card">
          <h2 className="text-[17px] font-bold text-ink">Exam pattern</h2>
          <dl className="space-y-2 text-[14px]">
            {pattern.facts.map((f) => <div key={f.k}><dt className="text-[12px] text-ink-4">{f.k}</dt><dd className="text-ink">{f.v}</dd></div>)}
          </dl>
          {(papers?.length ? papers : null)?.map((p) => (
            <div key={p.key} className="border-t border-black/10 pt-3 text-[14px]"><b className="text-ink">{p.name}</b><p className="text-ink-3">{p.totalQuestions} questions · {p.totalMarks} marks · {p.durationMin} min</p><p className="text-ink-3">{p.marking}</p>
              <ul className="mt-1 text-[13px] text-ink-3">{p.sections.map((s) => <li key={s.name}>{s.name}: {s.questions}</li>)}</ul></div>
          ))}
          {!papers?.length ? <div className="border-t border-black/10 pt-3 text-[14px]"><p className="text-ink-3">{pattern.totalQuestions} questions · {pattern.totalMarks} marks · {pattern.durationMin} min</p><p className="text-ink-3">{pattern.marking}</p>
            <ul className="mt-1 text-[13px] text-ink-3">{pattern.sections.map((s) => <li key={s.name}>{s.name}: {s.questions} questions, {s.marks} marks</li>)}</ul></div> : null}
          <p className="border-t border-black/10 pt-3 text-[12px] text-ink-4">Official information: <a href={meta.authorityUrl} target="_blank" rel="noopener noreferrer" className="underline">{meta.authority}</a></p>
        </aside>
      </div>
    </MarketShell>
  );
}
