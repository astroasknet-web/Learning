import Link from "next/link";
import type { NativeCourse } from "@/lib/market/lessons";
import type { LearnCourse } from "@/lib/learn/types";
import type { Summary } from "@/lib/learn/results";
import { activitiesFor, requiredFor } from "@/lib/learn/activities";
import { HeroArt, Icon } from "./art";

/**
 * The course overview for a course that has interactive activities. All text comes from the course's landing content and lesson file,
 * all progress from what the student has actually passed, so the same page serves any course that ships a `landing` block.
 */
const focus = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep";
const btnPrimary = `inline-flex min-h-[52px] items-center justify-center rounded-xl bg-orange-deep px-7 text-[16px] font-semibold text-white hover:bg-ink ${focus}`;
const btnGhost = `inline-flex min-h-[52px] items-center justify-center rounded-xl border border-black/[0.2] bg-white px-6 text-[16px] font-semibold text-ink hover:bg-cream-2 ${focus}`;

export default function CourseLanding({ slug, nc, lc, summary, done, next, signedIn, isStudent, enrolled, progress, sampleHref, owned = true }: {
  slug: string; nc: NativeCourse; lc: LearnCourse; summary: Summary | null; done: Set<number>; next: { href: string; label: string };
  signedIn: boolean; isStudent: boolean; enrolled: boolean; progress: number; sampleHref: string | null; owned?: boolean;
}) {
  const L = lc.landing!;
  const keys = [...nc.modules.map((m) => m.slug), "capstone"];
  const firstOpen = keys.findIndex((_, i) => !done.has(i));
  const totalActs = lc.activities.length;
  return (
    <div>
      <section aria-labelledby="hero-h" className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#fff8f3] via-white to-[#ffeede] ring-1 ring-black/[0.06]">
        <div className="grid items-center gap-8 p-6 sm:p-10 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-orange-deep">{L.hero.eyebrow}</p>
            <h1 id="hero-h" className="mt-2 text-[32px] font-bold leading-[1.1] tracking-tight text-ink sm:text-[46px]">{L.hero.title}</h1>
            <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-ink-2">{L.hero.subtitle}</p>
            <ul className="mt-5 flex flex-wrap gap-2 text-[13px] font-medium text-ink-2" aria-label="Course facts">
              {[L.hero.level, `About ${nc.hours} hours`, `${nc.modules.length} modules`, `${totalActs} hands-on activities`, "Lifetime access"].map((t) => <li key={t} className="rounded-full bg-white px-3 py-1.5 ring-1 ring-black/[0.1]">{t}</li>)}
            </ul>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              {owned
                ? <Link href={next.href} className={btnPrimary}>{enrolled && progress > 0 ? next.label : "Start learning"}</Link>
                : <Link href={`/courses/${slug}`} className={btnPrimary}>See price and buy</Link>}
              <a href="#roadmap" className={btnGhost}>See the roadmap</a>
            </div>
            <p className="mt-4 max-w-xl text-[14.5px] text-ink-3">{L.hero.outcomeLine}</p>
            {enrolled ? <p className="mt-3 text-[14px] font-semibold text-ink-2">{progress}% of the course complete</p> : null}
          </div>
          <div className="mx-auto w-full max-w-[520px]"><HeroArt /></div>
        </div>
      </section>

      {isStudent && summary ? (
        <section aria-labelledby="prog-h" className="mt-8 rounded-2xl border border-black/[0.09] bg-white p-5 sm:p-6">
          <h2 id="prog-h" className="text-[20px] font-bold text-ink">Your progress</h2>
          <div className="mt-3 grid gap-5 lg:grid-cols-3">
            <div><p className="text-[13px] text-ink-3">Learning XP</p><p className="text-[30px] font-bold text-ink">{summary.xp}</p><p className="text-[13.5px] text-ink-2">Level: <b>{summary.level.title}</b>{summary.level.next ? ` · ${summary.level.next.need} XP to ${summary.level.next.title}` : " · top level reached"}</p>
              <p className="mt-1 text-[12.5px] text-ink-3">XP is earned only when every check on an activity passes.</p></div>
            <div><p className="text-[13px] text-ink-3">Skills you have shown</p>
              <ul className="mt-1 space-y-1.5">{summary.skills.filter((s) => s.total > 0).map((s) => (
                <li key={s.id} className="text-[13px] text-ink-2"><div className="flex justify-between"><span>{s.label}</span><span>{s.done}/{s.total}</span></div>
                  <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-cream-3" role="img" aria-label={`${s.label}: ${s.done} of ${s.total} activities passed`}><span className="block h-full rounded-full bg-emerald-600" style={{ width: `${s.total ? (s.done / s.total) * 100 : 0}%` }} /></div></li>
              ))}</ul></div>
            <div><p className="text-[13px] text-ink-3">Badges</p>
              <ul className="mt-1 grid gap-1.5">{summary.badges.map((b) => (
                <li key={b.id} className={`flex items-start gap-2 rounded-lg px-2.5 py-1.5 text-[13px] ${b.earned ? "bg-emerald-50 text-emerald-950" : "bg-cream-2 text-ink-3"}`}><span aria-hidden="true">{b.earned ? "★" : "☆"}</span><span><b>{b.title}</b><span className="sr-only">{b.earned ? " (earned)" : " (not yet earned)"}</span><br /><span className="text-[12px]">{b.description}</span></span></li>
              ))}</ul></div>
          </div>
        </section>
      ) : !owned ? (
        <p className="mt-6 rounded-xl bg-cream-2 px-4 py-3 text-[14px] text-ink-2">The lessons, labs and quizzes open when you buy this course or choose it from a plan that includes courses. {sampleHref ? "You can try one sample activity below without an account. " : ""}{!signedIn ? <><Link href={`/login?next=${encodeURIComponent(`/courses/${slug}/learn`)}`} className="font-semibold underline">Log in as a student</Link> to save your work, earn XP and badges, and get your completion recorded.</> : null}</p>
      ) : !signedIn ? (
        <p className="mt-6 rounded-xl bg-cream-2 px-4 py-3 text-[14px] text-ink-2"><Link href={`/login?next=${encodeURIComponent(`/courses/${slug}/learn`)}`} className="font-semibold underline">Log in as a student</Link> to save your work, earn XP and badges, and get your completion recorded.</p>
      ) : null}

      <section aria-labelledby="out-h" className="mt-12">
        <h2 id="out-h" className="text-[26px] font-bold text-ink">What you will be able to do</h2>
        <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {L.outcomes.map((o) => (
            <li key={o.title} className="rounded-2xl border border-black/[0.09] bg-white p-5">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-orange-light text-orange-deep"><Icon name={o.icon} /></span>
              <h3 className="mt-3 text-[16px] font-semibold text-ink">{o.title}</h3><p className="mt-1 text-[14px] leading-relaxed text-ink-3">{o.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section id="roadmap" aria-labelledby="road-h" className="mt-14 scroll-mt-28">
        <h2 id="road-h" className="text-[26px] font-bold text-ink">Your learning roadmap</h2>
        <p className="mt-1 max-w-2xl text-[15px] text-ink-3">Each module has short lessons, hands-on practice and a quiz. Finish the practice and the quiz to complete a module.</p>
        <ol className="mt-6 space-y-4">
          {[...nc.modules.map((m, i) => ({ key: m.slug, i, title: m.title, text: m.outcome || m.summary, hours: m.hours, lessons: m.topics.length, quiz: m.quiz?.questions.length ?? 0 })), { key: "capstone", i: nc.modules.length, title: nc.capstone.title, text: nc.capstone.summary, hours: 0, lessons: 0, quiz: nc.capstone.quiz?.questions.length ?? 0 }].map((m) => {
            const acts = activitiesFor(slug, m.key);
            const req = requiredFor(slug, m.key);
            const passedReq = summary ? req.filter((a) => summary.passed.has(a.id)).length : 0;
            const isDone = done.has(m.i);
            const current = m.i === firstOpen;
            return (
              <li key={m.key} className={`relative rounded-2xl border bg-white p-5 sm:p-6 ${current ? "border-orange-deep ring-1 ring-orange-deep/30" : "border-black/[0.09]"}`}>
                <div className="flex flex-wrap items-start gap-4">
                  <span aria-hidden="true" className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-[16px] font-bold ${isDone ? "bg-emerald-700 text-white" : current ? "bg-orange-deep text-white" : "bg-cream-3 text-ink-2"}`}>{isDone ? "✓" : m.key === "capstone" ? "★" : m.i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[19px] font-semibold text-ink"><Link href={`/courses/${slug}/learn/${m.key}`} className={`rounded hover:underline ${focus}`}>{m.title}</Link>{isDone ? <span className="sr-only"> (complete)</span> : current ? <span className="ml-2 rounded-full bg-orange-light px-2.5 py-0.5 text-[12px] font-semibold text-orange-deep">{enrolled ? "Up next" : "Start here"}</span> : null}</h3>
                    <p className="mt-1 text-[14.5px] leading-relaxed text-ink-3">{m.text}</p>
                    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-3">
                      {m.hours ? <li>About {m.hours} h</li> : null}{m.lessons ? <li>{m.lessons} lessons</li> : null}{acts.length ? <li>{acts.length} practice {acts.length === 1 ? "activity" : "activities"}</li> : null}{m.quiz ? <li>{m.quiz}-question quiz</li> : null}
                    </ul>
                    {isStudent && req.length && !isDone ? <p className="mt-2 text-[13px] font-medium text-ink-2">Required practice: {passedReq} of {req.length} passed</p> : null}
                  </div>
                  <Link href={`/courses/${slug}/learn/${m.key}`} className={`inline-flex min-h-[44px] items-center rounded-lg border border-black/[0.18] px-4 text-[14px] font-semibold text-ink hover:bg-cream-2 ${focus}`}>{isDone ? "Review" : current ? "Open" : "Preview"}<span className="sr-only"> {m.title}</span></Link>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-labelledby="proj-h" className="mt-14">
        <h2 id="proj-h" className="text-[26px] font-bold text-ink">Projects you will complete</h2>
        <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {L.projects.map((p) => (
            <li key={p.title} className="rounded-2xl border border-black/[0.09] bg-white p-5">
              <h3 className="text-[16px] font-semibold text-ink">{p.title}</h3><p className="mt-1 text-[14px] text-ink-3">{p.text}</p>
              <Link href={`/courses/${slug}/learn/${p.module}`} className={`mt-3 inline-flex min-h-[40px] items-center text-[14px] font-semibold text-orange-deep underline underline-offset-2 ${focus}`}>See where<span className="sr-only">: {p.title}</span></Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="tools-h" className="mt-14">
        <h2 id="tools-h" className="text-[26px] font-bold text-ink">Practice tools built into the course</h2>
        <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {L.tools.map((t) => (
            <li key={t.title} className="rounded-2xl bg-cream-2 p-4"><span className="text-orange-deep"><Icon name={t.icon} /></span><h3 className="mt-2 text-[15px] font-semibold text-ink">{t.title}</h3><p className="mt-1 text-[13.5px] text-ink-3">{t.text}</p></li>
          ))}
        </ul>
        {sampleHref ? <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-ink p-5 text-white sm:p-6"><div><h3 className="text-[18px] font-semibold !text-white">Try a sample activity</h3><p className="mt-1 text-[14px] !text-white/80">A five-minute sorting activity. No account needed.</p></div><Link href={sampleHref} className={`inline-flex min-h-[48px] items-center rounded-lg bg-white px-6 text-[15px] font-semibold text-ink hover:bg-orange-light ${focus}`}>Try it now</Link></div> : null}
      </section>

      <section aria-labelledby="ass-h" className="mt-14">
        <h2 id="ass-h" className="text-[26px] font-bold text-ink">How you finish the course</h2>
        <ol className="mt-4 list-decimal space-y-2 pl-6 text-[15.5px] text-ink-2">{L.assessment.map((a) => <li key={a}>{a}</li>)}</ol>
      </section>

      <section aria-labelledby="faq-h" className="mt-14">
        <h2 id="faq-h" className="text-[26px] font-bold text-ink">Questions</h2>
        <div className="mt-4 divide-y divide-black/[0.08] rounded-2xl border border-black/[0.09] bg-white">
          {L.faq.map((f) => (
            <details key={f.q} className="group p-4 sm:p-5"><summary className={`cursor-pointer text-[16px] font-semibold text-ink ${focus}`}>{f.q}</summary><p className="mt-2 text-[15px] leading-relaxed text-ink-2">{f.a}</p></details>
          ))}
        </div>
      </section>

      <div className="mt-14 rounded-3xl bg-gradient-to-r from-orange-light to-[#fff3ea] p-8 text-center">
        <h2 className="text-[24px] font-bold text-ink">Ready when you are</h2>
        <p className="mx-auto mt-1 max-w-lg text-[15px] text-ink-2">Start with the first module. You can stop and come back at any time.</p>
        <div className="mt-5"><Link href={next.href} className={btnPrimary}>{enrolled && progress > 0 ? next.label : "Start learning"}</Link></div>
      </div>
    </div>
  );
}
