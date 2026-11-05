import Link from "next/link";
import QuizBlock from "@/components/lms/QuizBlock";
import { render } from "@/lib/lms/content";
import type { SChapter, SQ } from "@/lib/lms/school";

const quizItems = (qs: SQ[]) => qs.map((q) => ({ q: render(q.q), options: q.options.map((o) => render(o)), correct: q.correct, explanation: render(q.explanation) }));
const PROSE = "text-[15.5px] leading-relaxed text-ink-2 [&_li]:mt-1 [&_p]:mt-3 [&_strong]:text-ink [&_table]:my-3 [&_table]:w-full [&_td]:border [&_td]:p-2 [&_th]:border [&_th]:bg-cream-2 [&_th]:p-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_svg]:max-w-full";

/* eslint-disable @typescript-eslint/no-explicit-any */
function Html({ html, className = "" }: { html: string; className?: string }) {
  return <div className={`${PROSE} ${className}`} dangerouslySetInnerHTML={{ __html: render(html) }} />;
}
const A = (v: unknown): any[] => (Array.isArray(v) ? v : []);

function Card({ title, id, children }: { title: string; id?: string; children: React.ReactNode }) {
  return <section id={id} className="scroll-mt-24 rounded-2xl border border-black/[0.08] bg-white p-5 shadow-card sm:p-7"><h3 className="text-[19px] font-bold text-ink">{title}</h3><div className="mt-3">{children}</div></section>;
}

/** English chapters carry extra teaching blocks (rule box, vocabulary, practice, reading, speaking, writing). */
function EnglishExtras({ e }: { e: Record<string, any> }) {
  const p = e.practice ?? {};
  return (
    <>
      {A(e.outcomes).length ? <Card title="What you will learn"><ul className="list-disc space-y-1 pl-5 text-[15px] text-ink-2">{A(e.outcomes).map((o, i) => <li key={i}>{String(o)}</li>)}</ul></Card> : null}
      {e.intro?.en ? <Card title="Introduction"><Html html={e.intro.en} /></Card> : null}
      {e.real_life ? <Card title="In real life"><p className="text-[15px] text-ink-2"><b>Situation:</b> <span dangerouslySetInnerHTML={{ __html: render(e.real_life.situation) }} /></p><p className="mt-2 text-[15px] text-ink-2"><b>Why it matters:</b> <span dangerouslySetInnerHTML={{ __html: render(e.real_life.why) }} /></p></Card> : null}
      {e.rule_box ? <Card title="The rule"><Html html={e.rule_box.html ?? ""} />{e.rule_box.formula ? <p className="mt-3 rounded-lg bg-cream-2 px-3 py-2 font-mono text-[14px] text-ink">{e.rule_box.formula}</p> : null}{e.rule_box.example ? <p className="mt-2 text-[14.5px] text-ink-3"><b>Example:</b> {e.rule_box.example}</p> : null}</Card> : null}
      {A(e.vocabulary?.words).length ? (
        <Card title="Vocabulary"><dl className="divide-y divide-black/[0.07] rounded-xl border border-black/[0.08]">{A(e.vocabulary.words).map((w, i) => <div key={i} className="grid gap-1 px-3 py-2.5 sm:grid-cols-[12rem_1fr]"><dt className="font-semibold text-ink">{w.word}</dt><dd className="text-[14.5px] text-ink-2">{w.meaning}{w.hindi ? <span className="ml-2 text-ink-4">{w.hindi}</span> : null}</dd></div>)}</dl></Card>
      ) : null}
      {A(e.common_mistakes).length ? (
        <Card title="Common mistakes"><ul className="space-y-3">{A(e.common_mistakes).map((m, i) => <li key={i} className="rounded-xl border border-black/[0.08] p-3 text-[14.5px]"><p className="text-red-700"><b>Not:</b> <span dangerouslySetInnerHTML={{ __html: render(m.wrong) }} /></p><p className="text-emerald-800"><b>Say:</b> <span dangerouslySetInnerHTML={{ __html: render(m.right) }} /></p>{m.note ? <p className="mt-1 text-ink-3">{m.note}</p> : null}</li>)}</ul></Card>
      ) : null}
      {(p.fill_l1 || p.fill_l2 || p.error_detection || p.sentence_correction || p.rearrangement || p.match) ? (
        <Card title="Practice">
          <div className="space-y-5">
            {[["Fill in the blanks (level 1)", p.fill_l1], ["Fill in the blanks (level 2)", p.fill_l2]].map(([t, b]: any) => b && A(b.items).length ? <div key={t}><h4 className="text-[15px] font-bold text-ink">{t}</h4>{b.instructions ? <p className="text-[13.5px] text-ink-3">{b.instructions}</p> : null}<ol className="mt-2 space-y-2">{A(b.items).map((it, i) => <li key={i}><details className="rounded-lg border border-black/[0.1] bg-cream-2 p-2.5"><summary className="cursor-pointer text-[14.5px] text-ink">{i + 1}. {it.q}</summary><p className="mt-2 text-[14.5px] font-semibold text-emerald-800">{it.answer}</p></details></li>)}</ol></div> : null)}
            {A(p.error_detection).length ? <div><h4 className="text-[15px] font-bold text-ink">Spot the error</h4><ol className="mt-2 space-y-2">{A(p.error_detection).map((it, i) => <li key={i}><details className="rounded-lg border border-black/[0.1] bg-cream-2 p-2.5"><summary className="cursor-pointer text-[14.5px] text-ink">{i + 1}. {it.sentence}</summary><p className="mt-2 text-[14.5px] text-ink-2"><b>Error:</b> {it.error}. <b className="text-emerald-800">Correct:</b> {it.correct}</p></details></li>)}</ol></div> : null}
            {A(p.sentence_correction).length ? <div><h4 className="text-[15px] font-bold text-ink">Correct the sentence</h4><ol className="mt-2 space-y-2">{A(p.sentence_correction).map((it, i) => <li key={i}><details className="rounded-lg border border-black/[0.1] bg-cream-2 p-2.5"><summary className="cursor-pointer text-[14.5px] text-ink">{i + 1}. {it.wrong}</summary><p className="mt-2 text-[14.5px] font-semibold text-emerald-800">{it.correct}</p></details></li>)}</ol></div> : null}
            {A(p.rearrangement).length ? <div><h4 className="text-[15px] font-bold text-ink">Put in order</h4><ol className="mt-2 space-y-2">{A(p.rearrangement).map((it, i) => <li key={i}><details className="rounded-lg border border-black/[0.1] bg-cream-2 p-2.5"><summary className="cursor-pointer text-[14.5px] text-ink">{i + 1}. {it.jumbled}</summary><p className="mt-2 text-[14.5px] font-semibold text-emerald-800">{it.answer}</p></details></li>)}</ol></div> : null}
            {p.match && A(p.match.left).length ? <div><h4 className="text-[15px] font-bold text-ink">Match</h4><div className="mt-2 grid gap-4 sm:grid-cols-2"><ul className="space-y-1.5 text-[14.5px]">{A(p.match.left).map((l, i) => <li key={i}>{i + 1}. {l}</li>)}</ul><ul className="space-y-1.5 text-[14.5px]">{A(p.match.right).map((r, i) => <li key={i}>{String.fromCharCode(65 + i)}. {r}</li>)}</ul></div><details className="mt-2 rounded-lg border border-black/[0.1] bg-cream-2 p-2.5"><summary className="cursor-pointer text-[14px] font-semibold text-ink">Show the answers</summary><ul className="mt-2 text-[14.5px] text-emerald-800">{A(p.match.answers).map((a, i) => <li key={i}>{String(a)}</li>)}</ul></details></div> : null}
          </div>
        </Card>
      ) : null}
      {e.reading?.passage ? <Card title="Reading"><Html html={e.reading.passage} />{A(e.reading.questions).length ? <ol className="mt-3 space-y-2">{A(e.reading.questions).map((q, i) => <li key={i}><details className="rounded-lg border border-black/[0.1] bg-cream-2 p-2.5"><summary className="cursor-pointer text-[14.5px] text-ink">{i + 1}. {q.q}</summary><p className="mt-2 text-[14.5px] text-emerald-800">{q.answer}</p></details></li>)}</ol> : null}</Card> : null}
      {A(e.speaking).length ? <Card title="Speaking practice"><ul className="list-disc space-y-1.5 pl-5 text-[15px] text-ink-2">{A(e.speaking).map((s, i) => <li key={i}>{String(s)}</li>)}</ul></Card> : null}
      {e.writing?.prompt ? <Card title="Writing"><p className="text-[15px] text-ink-2">{e.writing.prompt}</p>{e.writing.example ? <details className="mt-2 rounded-lg border border-black/[0.1] bg-cream-2 p-2.5"><summary className="cursor-pointer text-[14px] font-semibold text-ink">See an example</summary><p className="mt-2 text-[14.5px] text-ink-2">{e.writing.example}</p></details> : null}</Card> : null}
      {A(e.micro_quiz).length ? <Card title="Quick quiz"><QuizBlock items={quizItems(A(e.micro_quiz) as SQ[])} /></Card> : null}
      {A(e.challenge).length ? <Card title="Challenge"><QuizBlock items={quizItems(A(e.challenge) as SQ[])} /></Card> : null}
      {A(e.revision).length ? <Card title="Revision"><ul className="list-disc space-y-1.5 pl-5 text-[15px] text-ink-2">{A(e.revision).map((s, i) => <li key={i}>{String(s)}</li>)}</ul></Card> : null}
    </>
  );
}

export default function SchoolChapter({ c, base }: { c: SChapter; base: string }) {
  return (
    <div className="min-w-0 space-y-6">
      {c.english ? <EnglishExtras e={c.english as Record<string, any>} /> : null}
      {c.topics.map((t, ti) => (
        <article key={ti} id={`t${ti + 1}`} className="scroll-mt-24 rounded-2xl border border-black/[0.08] bg-white p-5 shadow-card sm:p-7">
          <h2 className="text-[20px] font-bold text-ink">{t.title}</h2>
          {t.wonder ? <div className="mt-3 rounded-xl bg-orange-lighter p-4"><p className="text-[15px] font-semibold text-ink" dangerouslySetInnerHTML={{ __html: render(t.wonder.text) }} />{t.wonder.qa.length ? <ul className="mt-2 space-y-2">{t.wonder.qa.map((x, i) => <li key={i}><details><summary className="cursor-pointer text-[14.5px] text-ink">{x.q}</summary><p className="mt-1 text-[14.5px] text-ink-2">{x.a}</p></details></li>)}</ul> : null}</div> : null}
          {t.sections?.length ? (
            <div className="mt-3 space-y-4">{t.sections.map((s, i) => (
              <div key={i}>{s.heading ? <h3 className="text-[16px] font-semibold text-ink">{s.heading}</h3> : null}{s.content ? <Html html={s.content} /> : null}
                {s.items?.length ? <ul className="mt-2 list-disc space-y-1 pl-5 text-[15px] text-ink-2">{s.items.map((x, k) => <li key={k} dangerouslySetInnerHTML={{ __html: render(x) }} />)}</ul> : null}
                {s.points?.length ? <ul className="mt-2 list-disc space-y-1 pl-5 text-[15px] text-ink-2">{s.points.map((x, k) => <li key={k} dangerouslySetInnerHTML={{ __html: render(x) }} />)}</ul> : null}</div>
            ))}</div>
          ) : <Html html={t.concept} className="mt-3" />}
          {t.visual && !t.sections?.length ? <div className="mt-4 overflow-x-auto rounded-lg bg-cream-2 p-3 text-[13px] [&_pre]:whitespace-pre" dangerouslySetInnerHTML={{ __html: render(t.visual) }} /> : null}
          {t.examples.length ? (
            <div className="mt-5"><h3 className="text-[15px] font-bold text-ink">Worked examples</h3>
              <div className="mt-2 space-y-2">{t.examples.map((e) => (
                <details key={e.number} className="rounded-xl border border-black/[0.1] bg-cream-2 p-3">
                  <summary className="cursor-pointer text-[14.5px] font-semibold text-ink"><span className="mr-2 text-ink-4">Example {e.number}.</span><span className="[&_p]:inline" dangerouslySetInnerHTML={{ __html: render(e.problem) }} /></summary>
                  <div className="mt-3 border-t border-black/10 pt-3 text-[14.5px] text-ink-2 [&_p]:mt-2" dangerouslySetInnerHTML={{ __html: render(e.solution) }} />
                </details>
              ))}</div>
            </div>
          ) : null}
          {t.recap.length ? <div className="mt-5 rounded-xl border-l-4 border-orange bg-orange-lighter px-4 py-3"><h3 className="text-[14px] font-bold text-ink">Remember</h3><ul className="mt-1 list-disc space-y-1 pl-5 text-[14.5px] text-ink-2">{t.recap.map((r, i) => <li key={i} dangerouslySetInnerHTML={{ __html: render(r) }} />)}</ul></div> : null}
          {t.quiz.length ? <QuizBlock items={quizItems(t.quiz)} /> : null}
        </article>
      ))}
      {c.tests.online || c.tests.imo ? (
        <section id="tests" className="scroll-mt-24" aria-label="Tests">
          <h2 className="text-[22px] font-bold text-ink">Tests</h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {c.tests.online ? <li><Link href={`${base}/test/online`} className="block rounded-xl border border-black/[0.08] bg-white p-4 transition hover:border-orange"><b className="text-[15px] text-ink">Chapter test</b><span className="mt-1 block text-[13px] text-ink-4">{c.tests.online.questions.length} questions · {c.tests.online.minutes} minutes</span></Link></li> : null}
            {c.tests.imo ? <li><Link href={`${base}/test/imo`} className="block rounded-xl border border-black/[0.08] bg-white p-4 transition hover:border-orange"><b className="text-[15px] text-ink">Olympiad-style test</b><span className="mt-1 block text-[13px] text-ink-4">{c.tests.imo.questions.length} questions · {c.tests.imo.minutes} minutes</span></Link></li> : null}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
