import Link from "next/link";
import type { NativeCourse } from "@/lib/market/lessons";
import { formatDate } from "@/lib/learn/course-seo";

/**
 * Landing-page sections for university-programme courses (BBA, BCA, MCA, MBA...). Everything comes from the lesson file's `landing` block,
 * so the next course needs no new code. Server component: no client JavaScript, works with scripts off.
 */
const card = "bg-white rounded-2xl border border-black/[0.08] shadow-card p-5 sm:p-7";
const h2 = "text-[20px] sm:text-[22px] font-bold text-ink tracking-tight";

export function UniversityCourseSections({ nc, slug }: { nc: NativeCourse; slug: string }) {
  const L = nc.landing;
  if (!L) return null;
  const tiles: Array<[string, number]> = [["Lessons", L.stats.lessons], ["Worked examples", L.stats.examples], ["Quiz questions", L.stats.quizQuestions], ["Exam numericals", L.stats.numericals], ["Key terms", L.stats.glossary]];
  return (
    <>
      <section aria-labelledby="inside-h" className={card}>
        <h2 id="inside-h" className={h2}>What is inside</h2>
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {tiles.map(([k, v]) => (
            <li key={k} className="rounded-xl bg-cream-2 px-4 py-3 text-center"><b className="block text-[26px] leading-none text-orange-deep">{v}</b><span className="mt-1 block text-[13px] text-ink-3">{k}</span></li>
          ))}
        </ul>
        <p className="mt-4 text-[15px] text-ink-2">Plain-English lessons with Indian rupee examples, diagrams, step-by-step solutions, a case study in every unit, a software lab, and a final assessment. Free to learn, no sign-up needed to read.</p>
      </section>

      <section aria-labelledby="curriculum-h" className={card}>
        <h2 id="curriculum-h" className={h2}>Curriculum</h2>
        <p className="mt-1 text-[14.5px] text-ink-3">{nc.modules.length} units, about {nc.hours} hours. Open any lesson directly.</p>
        <ol className="mt-4 space-y-3">
          {nc.modules.map((m, i) => (
            <li key={m.slug}>
              <details className="group rounded-xl border border-black/[0.09] bg-cream" open={i === 0}>
                <summary className="flex cursor-pointer items-start gap-3 px-4 py-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep">
                  <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-orange-deep text-[14px] font-bold text-white" aria-hidden="true">{i + 1}</span>
                  <span className="min-w-0"><b className="block text-[16px] text-ink">{m.title}</b><span className="block text-[13.5px] text-ink-3">{m.summary}</span><span className="mt-1 block text-[12.5px] text-ink-3">About {m.hours} h &middot; {m.topics.length} lessons{m.quiz ? ` · ${m.quiz.questions.length}-question quiz` : ""}</span></span>
                </summary>
                <ul className="border-t border-black/[0.07] px-4 py-3 pl-[3.75rem] text-[14.5px]">
                  {m.topics.map((t) => (<li key={t.slug} className="py-1"><Link className="text-ink-2 underline decoration-black/20 underline-offset-2 hover:text-orange-deep" href={`/courses/${slug}/learn/${m.slug}#${t.slug}`}>{t.title}</Link></li>))}
                  <li className="pt-1"><Link className="font-semibold text-orange-deep underline underline-offset-2" href={`/courses/${slug}/learn/${m.slug}`}>Open this unit</Link></li>
                </ul>
              </details>
            </li>
          ))}
          <li className="rounded-xl border border-orange/30 bg-orange-lighter px-4 py-3">
            <Link href={`/courses/${slug}/learn/capstone`} className="block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep"><b className="block text-[16px] text-ink">{nc.capstone.title}</b><span className="block text-[13.5px] text-ink-3">{nc.capstone.summary}</span></Link>
          </li>
        </ol>
      </section>

      <section aria-labelledby="outcomes-h" className={card}>
        <h2 id="outcomes-h" className={h2}>Learning outcomes</h2>
        <p className="mt-1 text-[14.5px] text-ink-3">By the end you will be able to:</p>
        <ul className="mt-3 space-y-2 text-[15px] text-ink-2">
          {L.outcomes.map((o) => (<li key={o.id} className="flex gap-3"><span className="mt-0.5 shrink-0 rounded-md bg-cream-3 px-2 py-0.5 text-[12px] font-bold text-ink-2">{o.id}</span><span>{o.text}</span></li>))}
        </ul>
      </section>

      <section aria-labelledby="align-h" className={card}>
        <h2 id="align-h" className={h2}>Matches your university syllabus</h2>
        <p className="mt-1 text-[14.5px] text-ink-3">{L.alignmentNote}</p>
        <div className="mt-4 overflow-x-auto rounded-xl border border-black/[0.09]" role="region" aria-label="University syllabus alignment" tabIndex={0}>
          <table className="w-full min-w-[560px] border-collapse text-left text-[14px]">
            <thead><tr className="bg-ink text-white"><th scope="col" className="px-4 py-2.5 font-semibold">University</th><th scope="col" className="px-4 py-2.5 font-semibold">Paper</th><th scope="col" className="px-4 py-2.5 font-semibold">Semester</th><th scope="col" className="px-4 py-2.5 font-semibold">Scheme</th></tr></thead>
            <tbody>
              {L.alignment.map((a) => (
                <tr key={a.university + a.code} className="border-t border-black/[0.07] align-top odd:bg-white even:bg-cream-2">
                  <th scope="row" className="px-4 py-2.5 font-semibold text-ink">{a.university}</th>
                  <td className="px-4 py-2.5 text-ink-2"><a className="underline decoration-black/20 underline-offset-2 hover:text-orange-deep" href={a.source} target="_blank" rel="noopener noreferrer">{a.code}: {a.title}<span className="sr-only"> (opens the official syllabus in a new tab)</span></a></td>
                  <td className="px-4 py-2.5 text-ink-2">{a.semester}</td>
                  <td className="px-4 py-2.5 text-ink-2">{a.scheme}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="terms-h" className={card}>
        <h2 id="terms-h" className={h2}>Key terms you will learn</h2>
        <details className="mt-3 rounded-xl border border-black/[0.09] bg-cream-2 px-4 py-3">
          <summary className="cursor-pointer text-[15px] font-semibold text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep">Show all {L.glossary.length} terms</summary>
          <dl className="mt-3 grid gap-x-8 gap-y-3 sm:grid-cols-2">
            {L.glossary.map((g) => (<div key={g.term}><dt className="text-[14.5px] font-semibold text-ink">{g.term}</dt><dd className="text-[14px] text-ink-3">{g.definition}</dd></div>))}
          </dl>
        </details>
      </section>

      <section aria-labelledby="faq-h" className={card}>
        <h2 id="faq-h" className={h2}>Frequently asked questions</h2>
        <div className="mt-3 space-y-2">
          {L.faqs.map((f) => (
            <details key={f.q} className="rounded-xl border border-black/[0.09] bg-cream px-4 py-3">
              <summary className="cursor-pointer text-[15.5px] font-semibold text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep">{f.q}</summary>
              <p className="mt-2 text-[15px] text-ink-2">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section aria-labelledby="sources-h" className={card}>
        <h2 id="sources-h" className={h2}>Sources and official references</h2>
        <p className="mt-1 text-[14.5px] text-ink-3">Check any rule against the official body. Law and standards change, and the official text always prevails.</p>
        <ul className="mt-3 grid gap-2 text-[14.5px] sm:grid-cols-2">
          {L.references.map((r) => (<li key={r.url} className="rounded-xl bg-cream-2 px-4 py-3"><a className="font-semibold text-ink underline decoration-black/20 underline-offset-2 hover:text-orange-deep" href={r.url} target="_blank" rel="noopener noreferrer">{r.name}<span className="sr-only"> (opens in a new tab)</span></a><span className="block text-[13px] text-ink-3">{r.use}</span></li>))}
        </ul>
        {L.textbooks.length ? (<><h3 className="mt-5 text-[15px] font-semibold text-ink">Textbooks named in university syllabi</h3><ul className="mt-1 list-disc space-y-1 pl-5 text-[14px] text-ink-2">{L.textbooks.map((t) => <li key={t}>{t}</li>)}</ul></>) : null}
      </section>

      <section aria-labelledby="about-h" className={card}>
        <h2 id="about-h" className={h2}>About this course</h2>
        <p className="mt-2 text-[15px] text-ink-2">Written by <b>{L.author.name}</b>, published by {L.author.publisher}. Every calculation is re-computed by an automated check before release. Last updated {formatDate(L.updated)} &middot; version {L.version}.</p>
        <p className="mt-2 text-[14.5px] text-ink-3">Found something unclear or wrong? <Link href="/contact" className="font-semibold text-orange-deep underline underline-offset-2">Tell us</Link> and we will correct it.</p>
      </section>
    </>
  );
}
