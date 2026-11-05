import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MarketShell } from "@/components/market/shell";
import QuizBlock from "@/components/lms/QuizBlock";
import { chapter, exam, render, subjectIndex } from "@/lib/lms/content";
import ExamLocked from "@/components/lms/ExamLocked";
import { lockedExam } from "@/lib/lms/exam-access";
import { examForLearn } from "@/lib/lms/exam-products";

export const dynamic = "force-dynamic"; // what the visitor can open depends on what they bought

type P = { params: Promise<{ exam: string; subject: string; chapter: string }> };
const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9-]/g, "");

async function load(params: P["params"]) {
  const p = await params;
  const ex = exam(clean(p.exam));
  const subject = clean(p.subject);
  const ch = ex ? chapter(ex, subject, clean(p.chapter)) : null;
  const idx = ex ? subjectIndex(ex, subject) : null;
  return { ex, subject, ch, idx };
}

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { ex, ch, idx } = await load(params);
  if (!ex || !ch || !idx) return { title: "Chapter not found | GrowQR", robots: { index: false, follow: true } };
  const title = `${ch.title} (${ex.title} ${idx.subject_label}): Notes and Mock Tests | GrowQR`;
  return { title: title.length > 70 ? `${ch.title}: ${ex.title} Notes | GrowQR` : title, description: ch.seo?.meta_description ?? ch.subtitle, alternates: { canonical: `/learn/${ex.slug}/${idx.subject}/${ch.slug}` } };
}

export default async function ChapterPage({ params }: P) {
  const { ex, ch, idx } = await load(params);
  if (!ex || !ch || !idx) notFound();
  const lock = await lockedExam(examForLearn(ex.slug));
  if (lock) return <ExamLocked access={lock} title={ch.title} back={{ href: `/learn/${ex.slug}`, label: ex.title }} />;
  const base = `/learn/${ex.slug}/${idx.subject}`;
  const pos = idx.chapters.findIndex((c) => c.slug === ch.slug);
  const prev = idx.chapters[pos - 1];
  const next = idx.chapters[pos + 1];
  return (
    <MarketShell user={null} active="courses">
      <nav aria-label="Breadcrumb" className="mb-4 text-[13px] text-ink-3"><Link href="/" className="underline">Home</Link> / <Link href={`/learn/${ex.slug}`} className="underline">{ex.title}</Link> / <Link href={base} className="underline">{idx.subject_label}</Link> / Chapter {ch.chapter}</nav>
      <p className="text-[0.74rem] font-bold uppercase tracking-wider" style={{ color: ch.color }}>{ex.title} · {idx.subject_label} · Chapter {ch.chapter}</p>
      <h1 className="mt-1 text-[26px] font-bold leading-tight tracking-tight text-ink sm:text-[34px]">{ch.title}</h1>
      <p className="mt-2 max-w-3xl text-[16px] text-ink-3">{ch.subtitle}</p>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[16rem_1fr]">
        <aside aria-label="In this chapter" className="rounded-2xl border border-black/[0.08] bg-white p-4 lg:sticky lg:top-24">
          <h2 className="text-[14px] font-bold text-ink">In this chapter</h2>
          <ol className="mt-2 space-y-3 text-[14px]">
            {ch.modules.map((m) => (
              <li key={m.number}><b className="block text-ink">{m.title}</b>
                <ul className="mt-1 space-y-1 border-l border-black/10 pl-3">{m.topics.map((t) => <li key={t.number}><a href={`#t${m.number}-${t.number}`} className="text-ink-3 hover:text-orange-deep hover:underline">{t.title}</a></li>)}</ul>
              </li>
            ))}
            {ch.mock_tests.length ? <li><a href="#tests" className="font-semibold text-orange-deep underline">Mock tests ({ch.mock_tests.length})</a></li> : null}
          </ol>
        </aside>

        <div className="min-w-0 space-y-10">
          {ch.modules.map((m) => (
            <section key={m.number} aria-label={m.title}>
              <h2 className="text-[22px] font-bold text-ink">Module {m.number}: {m.title}</h2>
              <div className="mt-4 space-y-8">
                {m.topics.map((t) => (
                  <article key={t.number} id={`t${m.number}-${t.number}`} className="scroll-mt-24 rounded-2xl border border-black/[0.08] bg-white p-5 shadow-card sm:p-7">
                    <h3 className="text-[19px] font-bold text-ink">{t.title}</h3>
                    <div className="lms-prose mt-3 text-[15.5px] leading-relaxed text-ink-2 [&_li]:mt-1 [&_p]:mt-3 [&_strong]:text-ink [&_table]:my-3 [&_table]:w-full [&_td]:border [&_td]:p-2 [&_th]:border [&_th]:bg-cream-2 [&_th]:p-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5" dangerouslySetInnerHTML={{ __html: render(t.concept) }} />
                    {t.visual ? <div className="mt-4 overflow-x-auto rounded-lg bg-cream-2 p-3 text-[13px] [&_pre]:whitespace-pre" dangerouslySetInnerHTML={{ __html: render(t.visual) }} /> : null}
                    {typeof t.note === "string" && t.note ? <div className="mt-4 rounded-lg border-l-4 border-orange bg-orange-lighter px-4 py-3 text-[14.5px] text-ink-2" dangerouslySetInnerHTML={{ __html: render(t.note) }} /> : null}
                    {t.examples.length ? (
                      <div className="mt-5">
                        <h4 className="text-[15px] font-bold text-ink">Worked examples</h4>
                        <div className="mt-2 space-y-2">
                          {t.examples.map((e) => (
                            <details key={e.number} className="group rounded-xl border border-black/[0.1] bg-cream-2 p-3">
                              <summary className="cursor-pointer text-[14.5px] font-semibold text-ink"><span className="mr-2 text-ink-4">Example {e.number}.</span><span className="[&_p]:inline" dangerouslySetInnerHTML={{ __html: render(e.problem) }} /></summary>
                              <div className="mt-3 border-t border-black/10 pt-3 text-[14.5px] text-ink-2 [&_p]:mt-2" dangerouslySetInnerHTML={{ __html: render(e.solution) }} />
                            </details>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {t.quiz.length ? <QuizBlock items={t.quiz.map((q) => ({ q: render(q.q), options: q.options.map((o) => render(o)), correct: q.correct, explanation: render(q.explanation) }))} /> : null}
                  </article>
                ))}
              </div>
            </section>
          ))}

          {ch.mock_tests.length ? (
            <section id="tests" className="scroll-mt-24" aria-label="Mock tests">
              <h2 className="text-[22px] font-bold text-ink">Mock tests</h2>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {ch.mock_tests.map((t) => (
                  <li key={t.id}><Link href={`${base}/${ch.slug}/test/${t.id}`} className="block rounded-xl border border-black/[0.08] bg-white p-4 transition hover:border-orange">
                    <b className="text-[15px] text-ink">{t.title}</b><span className="mt-1 block text-[13px] text-ink-3">{t.level}</span><span className="mt-1 block text-[13px] text-ink-4">{t.total || t.sections.reduce((n, s) => n + s.questions.length, 0)} questions · {t.time_limit_minutes} minutes</span>
                  </Link></li>
                ))}
              </ul>
            </section>
          ) : null}

          <nav aria-label="Chapters" className="flex flex-wrap justify-between gap-3 border-t border-black/10 pt-5 text-[14px]">
            {prev ? <Link href={`${base}/${prev.slug}`} className="font-semibold text-orange-deep underline">← {prev.title}</Link> : <span />}
            {next ? <Link href={`${base}/${next.slug}`} className="font-semibold text-orange-deep underline">{next.title} →</Link> : null}
          </nav>
        </div>
      </div>
    </MarketShell>
  );
}
