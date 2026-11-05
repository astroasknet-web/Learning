import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Layers, ListChecks, Timer } from "lucide-react";
import { currentViewer, MarketShell } from "@/components/market/shell";
import ExamThumb from "@/components/lms/ExamThumb";
import { catalogue, hub, totalUnits } from "@/lib/market/exam-prep";
import { EXAM_PREP } from "@/lib/pay/course-fees";
import { hasPurchasedCourse } from "@/lib/pay/plans";
import { buyHref } from "@/lib/pay/course-access";

export const dynamic = "force-dynamic"; // "Unlocked" depends on what the visitor bought

export const metadata: Metadata = {
  title: "Exam Prep: JEE, NEET, UPSC, SSC CGL, CAT, SAT, GRE, GMAT, IELTS, AP Calculus | GrowQR",
  description: "Structured exam preparation with chapter notes, worked examples, chapter tests and full mock tests for JEE, NEET, UPSC, SSC CGL, CAT, SAT, GRE, GMAT, IELTS and AP Calculus AB. One payment per exam.",
  alternates: { canonical: "/exam-prep" },
};

const rs = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const GROUPS: Array<{ id: string; title: string; blurb: string; keys: string[] }> = [
  { id: "entrance", title: "Entrance exams", blurb: "Engineering, medical and MBA entrance.", keys: ["jee", "neet", "cat-quant"] },
  { id: "jobs", title: "Government and civil services", blurb: "Prelims and Tier mock tests, with explanations.", keys: ["upsc", "ssc-cgl"] },
  { id: "abroad", title: "Tests for studying abroad", blurb: "The quantitative and English tests that universities ask for.", keys: ["sat-math", "gre", "gmat", "ielts", "ap-calculus"] },
];
const PAID_OWN = new Set(["/learn/jee", "/learn/neet", "/exam/upsc-prelims", "/exam/ssc-cgl", "/ielts", "/learn/ap-calculus-ab"]);

export default async function ExamPrepPage() {
  const me = await currentViewer();
  const owned = new Set<string>();
  if (me) for (const e of EXAM_PREP) if (await hasPurchasedCourse(me.id, e.slug).catch(() => false)) owned.add(e.key);
  const onSale = EXAM_PREP.filter((e) => e.onSale);
  const lowest = Math.min(...onSale.map((e) => e.rupees));
  const free = catalogue().filter((c) => !(c.own && PAID_OWN.has(c.own)));
  const freeGroups = Array.from(new Set(free.map((c) => c.group)));

  return (
    <MarketShell user={me} active="courses">
      <section className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-[#0b1020] via-[#10204a] to-[#1b1740] px-5 py-10 text-white sm:px-10 sm:py-14" aria-labelledby="ep-h1">
        <span aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[#35d9ff]/25 blur-[70px]" />
        <span aria-hidden className="pointer-events-none absolute -bottom-28 left-10 h-72 w-72 rounded-full bg-[#7857ff]/30 blur-[80px]" />
        <p className="relative text-[0.78rem] font-semibold uppercase tracking-[0.16em] text-[#8ff0ff]">Exam preparation</p>
        <h1 id="ep-h1" className="relative mt-3 max-w-[16em] text-white text-[clamp(2rem,4.8vw,3.6rem)] font-semibold leading-[1.05] tracking-tight">Prepare for the exams that <span className="bg-gradient-to-r from-[#8ff0ff] to-[#b39dff] bg-clip-text text-transparent">open doors.</span></h1>
        <p className="relative mt-4 max-w-[44em] text-[1.05rem] leading-relaxed text-white/75">Structured notes, worked examples, chapter tests and full mock tests, exam by exam. Pay once per exam, from {rs(lowest)}, and study at your own pace.</p>
        <ul className="relative mt-7 flex flex-wrap gap-2.5 text-[0.9rem]" aria-label="What every exam includes">
          {[[Layers, `${onSale.length} exams`], [ListChecks, "Chapter tests and mock tests"], [BadgeCheck, "Worked explanations"], [Timer, "Timed, exam-style practice"]].map(([I, t]) => { const Ic = I as typeof Layers; return <li key={t as string} className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.07] px-4 py-2"><Ic className="h-4 w-4 text-[#8ff0ff]" aria-hidden />{t as string}</li>; })}
        </ul>
        <p className="relative mt-8 flex flex-wrap items-center gap-4">
          <a href="#entrance" className="inline-flex min-h-[50px] items-center gap-2 rounded-full bg-gradient-to-r from-[#7857ff] to-[#35d9ff] px-7 font-semibold text-[#0b1020] shadow-[0_16px_40px_-14px_rgba(120,87,255,0.8)]">Choose your exam <ArrowRight className="h-4 w-4" aria-hidden /></a>
          <Link href="/practice-tests" className="text-[0.95rem] font-semibold text-white/85 underline underline-offset-4 hover:text-white">Try IELTS and GRE practice tests</Link>
        </p>
      </section>

      {GROUPS.map((g) => (
        <section key={g.id} id={g.id} className="mt-12 scroll-mt-24" aria-labelledby={`ep-${g.id}`}>
          <h2 id={`ep-${g.id}`} className="text-[1.5rem] font-bold text-ink">{g.title}</h2>
          <p className="mt-1 text-[0.95rem] text-ink-3">{g.blurb}</p>
          <ul className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {g.keys.map((k) => {
              const e = EXAM_PREP.find((x) => x.key === k)!;
              const h = hub(e.hub)!;
              const units = totalUnits(h);
              const have = owned.has(k);
              return (
                <li key={k}>
                  <article className="group flex h-full flex-col overflow-hidden rounded-3xl border border-black/[0.08] bg-white shadow-card transition hover:-translate-y-1.5 hover:shadow-glow">
                    <Link href={`/exam-prep/${e.hub}`} className="relative block" aria-label={`${e.title}: details`}>
                      <ExamThumb examKey={k} alt="" className="aspect-video w-full transition duration-500 group-hover:scale-[1.03]" />
                      {have ? <span className="absolute left-3 top-3 rounded-full bg-emerald-500 px-3 py-1 text-[0.72rem] font-bold text-white">Unlocked</span> : !e.onSale ? <span className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-[0.72rem] font-bold text-ink">Coming soon</span> : null}
                    </Link>
                    <div className="flex flex-1 flex-col p-5">
                      <p className="text-[0.7rem] font-bold uppercase tracking-wider text-orange-dark">{h.kind}</p>
                      <h3 className="mt-1 text-[1.1rem] font-semibold leading-snug text-ink"><Link href={`/exam-prep/${e.hub}`} className="hover:underline">{e.title}</Link></h3>
                      <p className="mt-2 line-clamp-3 text-[0.9rem] leading-relaxed text-ink-3">{e.blurb}</p>
                      <p className="mt-3 text-[0.8rem] text-ink-4">{h.sections.length} {h.sections.length === 1 ? "section" : "sections"}{units ? ` · ${units} ${h.unit}` : ""}{h.tests.length ? ` · ${h.tests.length} ${h.tests.length === 1 ? "test set" : "test sets"}` : ""}</p>
                      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-5">
                        {e.onSale ? <p className="text-[1.5rem] font-bold leading-none text-ink">{rs(e.rupees)}<span className="ml-1.5 text-[0.78rem] font-medium text-ink-4">one payment</span></p> : <p className="text-[0.95rem] font-semibold text-ink-3">Coming soon</p>}
                        {e.onSale ? (have
                          ? <Link href={`/exam-prep/${e.hub}`} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-ink px-4 text-[0.9rem] font-semibold text-white">Start studying <ArrowRight className="h-4 w-4" aria-hidden /></Link>
                          : <Link href={me ? buyHref(e.slug) : `/login?next=${encodeURIComponent(buyHref(e.slug))}`} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-orange-deep px-4 text-[0.9rem] font-semibold text-white hover:bg-ink">Buy now <ArrowRight className="h-4 w-4" aria-hidden /></Link>)
                          : <Link href={`/exam-prep/${e.hub}`} className="inline-flex min-h-[44px] items-center rounded-lg border border-black/[0.15] px-4 text-[0.9rem] font-semibold text-ink hover:bg-cream-2">Details</Link>}
                      </div>
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <section className="mt-14 grid gap-4 md:grid-cols-3" aria-label="More ways to prepare">
        {[
          ["Maths Olympiad (IMO)", "Every class from 1 to 12 is its own course, with chapter tests and mock tests.", "/olympiad/imo", "Choose a class", "From ₹499 per class"],
          ["Practice tests", "IELTS and GRE tests, timed and marked instantly, with an explanation for every answer.", "/practice-tests", "Take a test", "Marked instantly"],
          ["School lessons", "Class 1 to 12 lessons with worked examples, quick quizzes and chapter tests.", "/school", "Open lessons", "Free"],
        ].map(([t, d, h, c, tag]) => (
          <Link key={t} href={h} className="group rounded-3xl border border-black/[0.08] bg-white p-6 shadow-card transition hover:-translate-y-1 hover:shadow-glow">
            <span className="inline-block rounded-full bg-cream-3 px-3 py-1 text-[0.72rem] font-bold text-ink-2">{tag}</span>
            <h3 className="mt-3 text-[1.1rem] font-semibold text-ink">{t}</h3>
            <p className="mt-1.5 text-[0.9rem] leading-relaxed text-ink-3">{d}</p>
            <span className="mt-4 inline-flex items-center gap-1.5 text-[0.9rem] font-semibold text-ink">{c} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden /></span>
          </Link>
        ))}
      </section>

      {freeGroups.length ? (
        <section className="mt-14" aria-labelledby="ep-free">
          <h2 id="ep-free" className="text-[1.5rem] font-bold text-ink">More to learn on GrowQR</h2>
          <p className="mt-1 text-[0.95rem] text-ink-3">School subjects, languages and skills courses.</p>
          {freeGroups.map((g) => (
            <div key={g} className="mt-5" role="group" aria-label={g}>
              <h3 className="text-[0.82rem] font-bold uppercase tracking-wider text-ink-3">{g}</h3>
              <ul className="mt-2 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {free.filter((c) => c.group === g).map((c) => (
                  <li key={c.title}>
                    {c.own
                      ? <Link href={c.own} className="flex items-center justify-between rounded-xl border border-black/[0.08] bg-white px-4 py-3.5 transition hover:border-orange"><span className="font-semibold text-ink">{c.title}</span></Link>
                      : <span className="flex items-center justify-between rounded-xl border border-dashed border-black/[0.12] px-4 py-3.5"><span className="font-semibold text-ink-3">{c.title}</span><span className="text-[0.78rem] text-ink-4">Coming soon</span></span>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ) : null}
    </MarketShell>
  );
}
