import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MarketShell } from "@/components/market/shell";
import { Flashcards, PracticeList } from "@/components/lms/Practice";
import { flatChapters, studyChapter, studyIndex } from "@/lib/lms/study";
import ExamLocked from "@/components/lms/ExamLocked";
import { lockedExam } from "@/lib/lms/exam-access";
import { examForStudy } from "@/lib/lms/exam-products";

export const dynamic = "force-dynamic"; // what the visitor can open depends on what they bought

type P = { params: Promise<{ course: string; chapter: string }> };
const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9-]/g, "");
const paras = (s: string) => s.split(/\n{2,}/).map((x) => x.trim()).filter(Boolean);

async function load(params: P["params"]) {
  const p = await params;
  const course = studyIndex(clean(p.course));
  const ch = course ? studyChapter(course.key, clean(p.chapter)) : null;
  return { course, ch };
}

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { course, ch } = await load(params);
  if (!course || !ch) return { title: "Chapter not found | GrowQR", robots: { index: false, follow: true } };
  const title = `${ch.title} (${course.title}): Notes, Formulas and Practice | GrowQR`;
  return { title: title.length > 72 ? `${ch.title}: ${course.title} | GrowQR` : title, description: Array.from(ch.intro).slice(0, 155).join(""), alternates: { canonical: `/study/${course.key}/${ch.slug}` } };
}

function Box({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) {
  return <section id={id} className="scroll-mt-24 rounded-2xl border border-black/[0.08] bg-white p-5 shadow-card sm:p-7"><h2 className="text-[20px] font-bold text-ink">{title}</h2><div className="mt-3">{children}</div></section>;
}

export default async function StudyChapterPage({ params }: P) {
  const { course, ch } = await load(params);
  if (!course || !ch) notFound();
  const lock = await lockedExam(examForStudy(course.key));
  if (lock) return <ExamLocked access={lock} title={ch.title} back={{ href: `/study/${course.key}`, label: course.title }} />;
  const list = flatChapters(course);
  const pos = list.findIndex((c) => c.slug === ch.slug);
  const prev = list[pos - 1];
  const next = list[pos + 1];
  return (
    <MarketShell user={null} active="courses">
      <nav aria-label="Breadcrumb" className="mb-4 text-[13px] text-ink-3"><Link href="/study" className="underline">Study courses</Link> / <Link href={`/study/${course.key}`} className="underline">{course.title}</Link> / {ch.title}</nav>
      <p className="text-[0.74rem] font-bold uppercase tracking-wider text-orange-dark">{course.title}{ch.domain ? ` · ${ch.domain}` : ""}</p>
      <h1 className="mt-1 text-[26px] font-bold leading-tight tracking-tight text-ink sm:text-[34px]">{ch.title}</h1>
      {ch.difficulty || ch.weightage ? <p className="mt-2 text-[14.5px] text-ink-3">{ch.difficulty ? <>Difficulty: <b>{ch.difficulty}</b>. </> : null}{ch.weightage ? <>Weightage: {ch.weightage}.</> : null}</p> : null}

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[15rem_1fr]">
        <aside aria-label="In this chapter" className="rounded-2xl border border-black/[0.08] bg-white p-4 text-[14px] lg:sticky lg:top-24">
          <h2 className="text-[14px] font-bold text-ink">In this chapter</h2>
          <ul className="mt-2 space-y-1.5">
            {ch.formulas.length ? <li><a href="#formulas" className="text-ink-3 hover:text-orange-deep hover:underline">Formulas</a></li> : null}
            {ch.topics.map((t) => <li key={t.slug}><a href={`#${t.slug}`} className="text-ink-3 hover:text-orange-deep hover:underline">{t.name}</a></li>)}
            {ch.shortcuts.length ? <li><a href="#shortcuts" className="text-ink-3 hover:text-orange-deep hover:underline">Shortcuts</a></li> : null}
            {ch.mistakes.length ? <li><a href="#mistakes" className="text-ink-3 hover:text-orange-deep hover:underline">Common mistakes</a></li> : null}
            {ch.flashcards.length ? <li><a href="#flashcards" className="text-ink-3 hover:text-orange-deep hover:underline">Flashcards</a></li> : null}
          </ul>
        </aside>

        <div className="min-w-0 space-y-6">
          {ch.intro ? <Box title="Overview">{paras(ch.intro).map((p, i) => <p key={i} className="mt-2 text-[15.5px] leading-relaxed text-ink-2 first:mt-0">{p}</p>)}</Box> : null}

          {ch.formulas.length ? (
            <Box title="Formulas" id="formulas">
              <div className="space-y-5">
                {ch.formulas.map((g) => (
                  <div key={g.title}><h3 className="text-[16px] font-semibold text-ink">{g.title}</h3>
                    <dl className="mt-2 divide-y divide-black/[0.07] rounded-xl border border-black/[0.08]">{g.items.map((f) => <div key={f.name} className="grid gap-1 px-3 py-2.5 sm:grid-cols-[14rem_1fr]"><dt className="text-[14px] text-ink-3">{f.name}</dt><dd className="font-mono text-[14px] text-ink">{f.formula}</dd></div>)}</dl>
                  </div>
                ))}
              </div>
            </Box>
          ) : null}

          {ch.topics.map((t) => (
            <Box key={t.slug} id={t.slug} title={t.name}>
              {paras(t.details).map((p, i) => <p key={i} className="mt-2 text-[15.5px] leading-relaxed text-ink-2 first:mt-0">{p}</p>)}
              {t.solved.length ? (
                <div className="mt-5"><h3 className="text-[15px] font-bold text-ink">Solved examples</h3>
                  <div className="mt-2 space-y-2">{t.solved.map((s, i) => (
                    <details key={i} className="rounded-xl border border-black/[0.1] bg-cream-2 p-3"><summary className="cursor-pointer text-[14.5px] font-semibold text-ink"><span className="mr-2 text-ink-4">Example {i + 1}.</span>{s.problem}</summary><p className="mt-3 border-t border-black/10 pt-3 text-[14.5px] text-ink-2">{s.solution}</p></details>
                  ))}</div>
                </div>
              ) : null}
              {t.unsolved.length ? <div className="mt-5"><h3 className="mb-2 text-[15px] font-bold text-ink">Try these</h3><PracticeList items={t.unsolved} /></div> : null}
            </Box>
          ))}

          {ch.shortcuts.length ? <Box title="Shortcuts" id="shortcuts"><ul className="list-disc space-y-1.5 pl-5 text-[15px] text-ink-2">{ch.shortcuts.map((s, i) => <li key={i}>{s}</li>)}</ul></Box> : null}
          {ch.mistakes.length ? <Box title="Common mistakes" id="mistakes"><ul className="list-disc space-y-1.5 pl-5 text-[15px] text-ink-2">{ch.mistakes.map((s, i) => <li key={i}>{s}</li>)}</ul></Box> : null}
          {ch.pyq ? <Box title="In past papers">{paras(ch.pyq).map((p, i) => <p key={i} className="mt-2 text-[15px] leading-relaxed text-ink-2 first:mt-0">{p}</p>)}</Box> : null}
          {ch.flashcards.length ? <Box title="Flashcards" id="flashcards"><p className="mb-3 text-[13.5px] text-ink-3">Tap a card to see the answer.</p><Flashcards cards={ch.flashcards} /></Box> : null}
          {ch.summary ? <Box title="Summary"><p className="text-[15.5px] leading-relaxed text-ink-2">{ch.summary}</p></Box> : null}

          <nav aria-label="Chapters" className="flex flex-wrap justify-between gap-3 border-t border-black/10 pt-5 text-[14px]">
            {prev ? <Link href={`/study/${course.key}/${prev.slug}`} className="font-semibold text-orange-deep underline">← {prev.title}</Link> : <span />}
            {next ? <Link href={`/study/${course.key}/${next.slug}`} className="font-semibold text-orange-deep underline">{next.title} →</Link> : null}
          </nav>
        </div>
      </div>
    </MarketShell>
  );
}
