import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { canStudy } from "@/lib/pay/course-access";
import { databaseConfigured } from "@/lib/portal/db";
import * as courses from "@/lib/market/courses";
import * as learning from "@/lib/market/learning";
import * as lessons from "@/lib/market/lessons";
import { activitiesFor, requiredFor } from "@/lib/learn/activities";
import * as results from "@/lib/learn/results";
import { currentViewer, MarketShell } from "@/components/market/shell";
import { quizAction } from "../actions";
import { OG_IMAGE, SITE_URL } from "@/lib/seo";
import { moduleTitle } from "@/lib/learn/course-seo";
import { ExpandAll, HashOpen } from "@/components/learn/LessonTools";
import { WidgetHost } from "@/components/learn/widgets/WidgetHost";

export const dynamic = "force-dynamic";
const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9-]/g, "");
const html = (s: string) => ({ __html: lessons.cleanHtml(s) });

export async function generateMetadata({ params, searchParams }: { params: Promise<{ slug: string; step: string }>; searchParams: Promise<Record<string, string | undefined>> }): Promise<Metadata> {
  const p = await params;
  const noindexResult = (await searchParams).a !== undefined;
  const slug = clean(p.slug);
  const nc = lessons.nativeCourse(slug);
  const at = nc ? lessons.stepFor(nc, clean(p.step)) : null;
  if (!nc || !at) return { title: "Lesson not found | GrowQR", robots: { index: false, follow: true } };
  const title = at.capstone ? nc.capstone.title : at.module!.title;
  const desc = at.capstone ? nc.capstone.summary : at.module!.summary;
  const full = moduleTitle(at.capstone ? title : at.module!.seoTitle ?? title, nc.landing?.shortTitle ?? nc.title); // short keyword title, never cut mid-word
  const url = `${SITE_URL}/courses/${slug}/learn/${at.capstone ? "capstone" : at.module!.slug}`;
  const description = Array.from(desc).slice(0, 155).join("");
  return {
    title: full,
    description,
    alternates: { canonical: url },
    robots: noindexResult ? { index: false, follow: true } : { index: true, follow: true },
    openGraph: { type: "article", url, siteName: "GrowQR", title: full, description, images: [OG_IMAGE] },
    twitter: { card: "summary_large_image", title: full, description, images: [OG_IMAGE.url] },
  };
}

const card = "bg-white rounded-2xl border border-black/[0.09] p-5 sm:p-6";
const prose =
  "text-[16px] leading-relaxed text-ink-2 [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1 [&_h3]:text-[18px] [&_h3]:font-semibold [&_h3]:text-ink [&_h3]:mt-4 [&_h3]:mb-2 [&_code]:bg-cream-3 [&_code]:px-1 [&_code]:rounded [&_pre]:bg-cream-3 [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_table]:block [&_table]:overflow-x-auto [&_img]:max-w-full [&_img]:h-auto [&_svg]:max-w-full [&_svg]:h-auto";
const btn = "inline-flex min-h-[48px] items-center justify-center rounded-lg px-6 text-[15px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep";
const KIND: Record<string, string> = { word: "Document", sheet: "Spreadsheet", slides: "Presentation", classify: "Sort and decide" };

export default async function StepPage({ params, searchParams }: { params: Promise<{ slug: string; step: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const p = await params;
  const sp = await searchParams;
  const slug = clean(p.slug);
  const nc = lessons.nativeCourse(slug);
  const at = nc ? lessons.stepFor(nc, clean(p.step)) : null;
  if (!nc || !at || !databaseConfigured()) notFound();
  const course = await courses.bySlug(slug);
  if (!course) notFound();
  const me = await currentViewer();
  const isStudent = me?.role === "student";
  if (!(await canStudy(me?.id ?? null, course.id, slug))) redirect(`/courses/${slug}`); // lessons of a course with a fee open after payment
  const enrol = isStudent ? await learning.find(me!.id, course.id) : null;
  const res = isStudent ? await results.resultsFor(me!.id, slug) : new Map<string, results.Result>();
  const m = at.module;
  const quiz = at.capstone ? nc.capstone.quiz : m?.quiz ?? null;
  const key = at.capstone ? "capstone" : m!.slug;
  const acts = activitiesFor(slug, key);
  const req = requiredFor(slug, key);
  const passedReq = req.filter((a) => res.get(a.id)?.passed).length;
  const quizRes = res.get(`quiz:${key}`);
  const moduleDone = Boolean(enrol?.done.includes(at.index));
  const prev = at.index > 0 ? nc.modules[at.index - 1].slug : null;
  const next = at.capstone ? null : at.index + 1 < nc.modules.length ? nc.modules[at.index + 1].slug : "capstone";
  const nextTitle = next === null ? null : next === "capstone" ? nc.capstone.title : nc.modules.find((x) => x.slug === next)!.title;
  const picked = (sp.a ?? "").split(".").slice(0, 60).map((x) => (/^\d{1,2}$/.test(x) ? Number(x) : null));
  const result = quiz && sp.a ? lessons.gradeQuiz(quiz, picked) : null;
  const title = at.capstone ? nc.capstone.title : m!.title;
  const remember = m ? m.topics.flatMap((t) => t.keyPoints.slice(0, 2)).slice(0, 10) : [];
  const jsonld = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "LearningResource", name: title, isPartOf: { "@type": "Course", name: nc.title, url: `${SITE_URL}/courses/${slug}` }, inLanguage: nc.landing ? "en-IN" : "en", learningResourceType: at.capstone ? "Project" : "Lesson", isAccessibleForFree: true,
        ...(nc.landing ? {
          url: `${SITE_URL}/courses/${slug}/learn/${key}`, description: at.capstone ? nc.capstone.summary : m!.summary, educationalLevel: nc.level, dateModified: nc.landing.updated,
          author: { "@type": "Person", name: nc.landing.author.name }, ...(m ? { timeRequired: `PT${Math.max(1, Math.round(m.hours))}H`, teaches: m.topics.map((t) => t.title) } : {}),
        } : {}),
      },
      { "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "Courses", item: `${SITE_URL}/courses` },
        { "@type": "ListItem", position: 2, name: nc.title, item: `${SITE_URL}/courses/${slug}/learn` },
        { "@type": "ListItem", position: 3, name: title },
      ] },
    ],
  };
  const stepState = (ok: boolean, partial: boolean) => (ok ? "Done" : partial ? "In progress" : "To do");

  return (
    <MarketShell user={me} active="courses">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonld).replace(/</g, "\\u003c") }} />
      <HashOpen />
      <WidgetHost slug={slug} scope={String(at.index)} />
      <nav aria-label="Breadcrumb" className="mb-4 text-[13px] text-ink-3"><Link href="/courses" className="underline">Courses</Link> / <Link href={`/courses/${slug}/learn`} className="underline">{nc.title}</Link> / {at.capstone ? "Capstone" : `Module ${at.index + 1}`}</nav>

      <header>
        <p className="text-[13px] font-semibold uppercase tracking-wide text-orange-deep">{at.capstone ? "Capstone project" : `Module ${at.index + 1} of ${nc.modules.length}`}{moduleDone ? " · Complete" : ""}</p>
        <h1 className="mt-1 text-[28px] font-bold leading-tight tracking-tight text-ink sm:text-[36px]">{title}</h1>
        <p className="mt-2 max-w-3xl text-[17px] text-ink-2">{m ? m.outcome || m.summary : nc.capstone.summary}</p>
        <ul className="mt-3 flex flex-wrap gap-2 text-[13px] text-ink-2" aria-label="Module details">
          {m ? <li className="rounded-full bg-cream-3 px-3 py-1">About {m.hours} h</li> : null}
          {m ? <li className="rounded-full bg-cream-3 px-3 py-1">{m.topics.length} lessons</li> : null}
          {acts.length ? <li className="rounded-full bg-cream-3 px-3 py-1">{acts.length} practice {acts.length === 1 ? "activity" : "activities"}</li> : null}
          {quiz ? <li className="rounded-full bg-cream-3 px-3 py-1">{quiz.questions.length}-question quiz</li> : null}
        </ul>
      </header>

      <ol aria-label="Your path through this module" className="mt-6 grid gap-3 sm:grid-cols-4">
        {[
          { label: "Learn", sub: m ? `${m.topics.length} short lessons` : "Read the brief", href: "#lessons", state: "" },
          { label: "Practice", sub: acts.length ? (isStudent ? `${passedReq}/${req.length || acts.length} required passed` : `${acts.length} activities`) : "Do it on your computer", href: "#practice", state: acts.length && isStudent ? stepState(req.length > 0 && passedReq === req.length, passedReq > 0) : "" },
          { label: "Check", sub: quiz ? `${quiz.questions.length} questions` : "", href: "#quiz", state: isStudent && quiz ? stepState(Boolean(quizRes?.passed), Boolean(quizRes)) : "" },
          { label: "Complete", sub: moduleDone ? "Module complete" : "Practice + quiz", href: "#next", state: isStudent ? stepState(moduleDone, false) : "" },
        ].map((s, i) => (
          <li key={s.label}><a href={s.href} className="block rounded-xl border border-black/[0.09] bg-white p-3 hover:bg-cream-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-deep"><span className="text-[12px] font-semibold text-ink-3">Step {i + 1}</span><b className="block text-[15px] text-ink">{s.label}{s.state ? <span className={`ml-2 text-[12px] font-semibold ${s.state === "Done" ? "text-emerald-800" : s.state === "In progress" ? "text-amber-800" : "text-ink-3"}`}>{s.state}</span> : null}</b><span className="text-[12.5px] text-ink-3">{s.sub}</span></a></li>
        ))}
      </ol>

      <div className="mt-8 grid max-w-4xl grid-cols-[minmax(0,1fr)] gap-6">
        {m ? (
          <section id="lessons" aria-labelledby="lessons-h" className="scroll-mt-28">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 id="lessons-h" className="text-[22px] font-bold text-ink">Learn</h2>
              {m.topics.length > 2 ? <ExpandAll target="lessons" /> : null}
            </div>
            {m.intro ? (
              <details open className={`${card} mb-3`}>
                <summary className="cursor-pointer text-[17px] font-semibold text-ink">Why this matters</summary>
                <div className={`${prose} mt-3`} dangerouslySetInnerHTML={html(m.intro)} />
              </details>
            ) : null}
            <div className="space-y-3">
              {m.topics.map((t, i) => (
                <details key={t.slug} id={t.slug} className={`${card} scroll-mt-28`} open={i === 0}>
                  <summary className="cursor-pointer text-[17px] font-semibold text-ink"><span className="mr-2 text-ink-3">{i + 1}.</span>{t.title}</summary>
                  <div className={`${prose} mt-3`} dangerouslySetInnerHTML={html(t.html)} />
                  {t.keyPoints.length ? (<div className="mt-4 rounded-xl bg-cream-2 p-4"><h3 className="text-[14px] font-semibold uppercase tracking-wide text-ink-3">Remember</h3><ul className="mt-1 list-disc space-y-1 pl-5 text-[15px] text-ink-2">{t.keyPoints.map((k) => <li key={k}>{k}</li>)}</ul></div>) : null}
                </details>
              ))}
            </div>
            {m.practical ? (
              <article className={`${card} mt-3`}>
                <h3 className="text-[17px] font-semibold text-ink">{m.practical.title}</h3>
                {m.practical.intro ? <p className="mt-1 text-[15px] text-ink-2">{m.practical.intro}</p> : null}
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-[15px] text-ink-2">{m.practical.steps.map((s, i) => <li key={i} dangerouslySetInnerHTML={html(s)} />)}</ol>
              </article>
            ) : null}
          </section>
        ) : (
          <article className={card}>
            {nc.capstone.intro ? <div className={prose} dangerouslySetInnerHTML={html(nc.capstone.intro)} /> : null}
            {nc.capstone.projectTitle ? <h2 className="mb-2 mt-4 text-[20px] font-bold text-ink">{nc.capstone.projectTitle}</h2> : null}
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-[15px] text-ink-2">{nc.capstone.steps.map((s, i) => <li key={i} dangerouslySetInnerHTML={html(s)} />)}</ol>
          </article>
        )}

        {acts.length ? (
          <section id="practice" aria-labelledby="practice-h" className="scroll-mt-28">
            <h2 id="practice-h" className="text-[22px] font-bold text-ink">Practice</h2>
            <p className="mb-3 mt-1 text-[14.5px] text-ink-3">Do each activity in your browser. The activities marked required must be passed, together with the quiz, to complete this module.</p>
            <ul className="grid gap-3 sm:grid-cols-2">
              {acts.map((a) => {
                const r = res.get(a.id);
                return (
                  <li key={a.id} className="flex flex-col rounded-2xl border border-black/[0.09] bg-white p-4">
                    <p className="flex flex-wrap items-center gap-2 text-[12px] text-ink-3"><span className="rounded-full bg-cream-3 px-2 py-0.5 font-semibold text-ink-2">{KIND[a.kind]}</span><span>{a.level === "beginner" ? "Beginner" : a.level === "intermediate" ? "Intermediate" : "Challenge"}</span><span>~{a.minutes} min</span><span>{a.xp} XP</span>{a.required ? <span className="font-semibold text-orange-deep">Required</span> : null}</p>
                    <h3 className="mt-1.5 text-[16px] font-semibold text-ink">{a.title}</h3>
                    <p className="mt-1 text-[13.5px] text-ink-3">{a.objective}</p>
                    <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                      <span className={`text-[12.5px] font-semibold ${r?.passed ? "text-emerald-800" : r ? "text-amber-800" : "text-ink-3"}`}>{r?.passed ? "Passed" : r ? `Best so far: ${r.best}%` : isStudent ? "Not started" : ""}</span>
                      <Link href={`/courses/${slug}/learn/${key}/a/${a.id}`} className={`inline-flex min-h-[40px] items-center rounded-lg px-4 text-[14px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep ${r?.passed ? "border border-black/[0.18] text-ink hover:bg-cream-2" : "bg-orange-deep text-white hover:bg-ink"}`}>{r?.passed ? "Review" : r ? "Continue" : "Start"}<span className="sr-only">: {a.title}</span></Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        {quiz ? (
          <section className={`${card} scroll-mt-28`} id="quiz" aria-labelledby="quiz-h">
            <h2 id="quiz-h" className="mb-1 text-[22px] font-bold text-ink">{at.capstone ? "Final assessment" : "Check what you know"}</h2>
            <p className="mb-4 text-[14px] text-ink-3">{quiz.questions.length} questions. You need {quiz.pass}% to pass{isStudent ? " and your pass is recorded" : ""}. You can try again as often as you like.</p>
            {result ? (
              <div id="result" role="status" className={`mb-5 rounded-xl p-4 ${result.passed ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-900"}`}>
                <b className="block text-[16px]">{result.passed ? "Passed" : "Not passed yet"}: {result.score} of {result.total} correct ({result.percent}%)</b>
                <span className="text-[14px]">
                  {result.passed
                    ? sp.s === "completed" ? "Course complete. Every part is done and verified by GrowQR." : sp.s === "saved" ? "Module complete: the quiz and the required practice are both done." : sp.s === "pending" ? `Quiz passed. Finish the required practice (${passedReq} of ${req.length} passed) to complete this module.` : sp.s === "guest" ? "Log in as a student to save your progress." : ""
                    : `Review the answers below and try again. The pass mark is ${quiz.pass}%.`}
                </span>
              </div>
            ) : null}
            <form action={quizAction}>
              <input type="hidden" name="slug" value={slug} /><input type="hidden" name="step" value={key} />
              <ol className="space-y-6">
                {quiz.questions.map((q, i) => {
                  const r = result?.review[i];
                  return (
                    <li key={i}>
                      <fieldset>
                        <legend className="mb-2 text-[15px] font-semibold text-ink"><span dangerouslySetInnerHTML={html(`${i + 1}. ${q.text}`)} /></legend>
                        <ul className="space-y-1">
                          {q.options.map((o, j) => (
                            <li key={j}>
                              <label className={`flex min-h-[44px] items-start gap-2.5 rounded-lg px-2 py-1.5 text-[15px] text-ink-2 ${r && j === r.correct ? "bg-emerald-50" : r && j === r.picked ? "bg-red-50" : ""}`}>
                                <input type="radio" name={`q${i}`} value={j} defaultChecked={r?.picked === j} className="mt-1" />
                                <span dangerouslySetInnerHTML={html(o)} />
                                {r && j === r.correct ? <span className="ml-auto text-[12px] font-semibold text-emerald-800">Correct answer</span> : r && j === r.picked ? <span className="ml-auto text-[12px] font-semibold text-red-800">Your answer</span> : null}
                              </label>
                            </li>
                          ))}
                        </ul>
                        {r && !r.right && r.explanation ? <p className="mt-2 text-[14px] text-ink-3" dangerouslySetInnerHTML={html(r.explanation)} /> : null}
                      </fieldset>
                    </li>
                  );
                })}
              </ol>
              <button type="submit" className={`${btn} mt-6 bg-orange-deep text-white hover:bg-ink`}>{result ? "Submit again" : "Submit answers"}</button>
            </form>
          </section>
        ) : null}

        {remember.length ? (
          <section aria-labelledby="sum-h" className={card}>
            <h2 id="sum-h" className="text-[20px] font-bold text-ink">Summary: what to remember</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[15px] text-ink-2">{remember.map((k) => <li key={k}>{k}</li>)}</ul>
          </section>
        ) : null}

        <section id="next" aria-labelledby="next-h" className="scroll-mt-28 rounded-2xl bg-cream-2 p-5 sm:p-6">
          <h2 id="next-h" className="text-[20px] font-bold text-ink">{moduleDone ? "Module complete. Keep going." : "Your next step"}</h2>
          <p className="mt-1 text-[14.5px] text-ink-2">{moduleDone ? "Well done. Move on while it is fresh." : acts.length && req.length > passedReq ? `Finish the required practice (${passedReq} of ${req.length} so far), then take the quiz.` : quiz && !quizRes?.passed ? "Take the quiz above to finish this module." : "Move on to the next module."}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            {prev ? <Link href={`/courses/${slug}/learn/${prev}`} className={`${btn} border border-black/[0.18] bg-white hover:bg-cream-3`}>&larr; Previous module</Link> : <Link href={`/courses/${slug}/learn`} className={`${btn} border border-black/[0.18] bg-white hover:bg-cream-3`}>Course overview</Link>}
            {next ? <Link href={`/courses/${slug}/learn/${next}`} className={`${btn} bg-orange-deep text-white hover:bg-ink`}>{nextTitle}: continue &rarr;</Link> : <Link href={`/courses/${slug}/learn`} className={`${btn} bg-orange-deep text-white hover:bg-ink`}>Back to the course</Link>}
          </div>
        </section>
      </div>
    </MarketShell>
  );
}
