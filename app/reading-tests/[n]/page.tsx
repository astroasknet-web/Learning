import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MarketShell, currentViewer } from "@/components/market/shell";
import { databaseConfigured } from "@/lib/portal/db";
import { essayCards, essayDetail } from "@/lib/reading/essays/library";
import { EXAMS } from "@/lib/reading/essays/meta";
import { SITE_URL } from "@/lib/seo";
import { startEssayAction } from "../actions";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ n: string }> }): Promise<Metadata> {
  const { n } = await params;
  if (!databaseConfigured()) return { title: "Reading test | GrowQR" };
  const d = await essayDetail(Number(n), null);
  if (!d) return { title: "Reading test | GrowQR" };
  const title = `${d.card.title}: essay reading test | GrowQR`;
  const description = `A ${d.card.words}-word essay and ${d.card.questions} exam-style questions on ${d.card.themeName.toLowerCase()}, good practice for ${d.card.exams.join(", ")}. Scored and analysed by the English Reading Studio.`;
  return { title, description, alternates: { canonical: `${SITE_URL}/reading-tests/${d.card.n}` }, openGraph: { title, description, url: `${SITE_URL}/reading-tests/${d.card.n}`, siteName: "GrowQR", type: "article" } };
}

const btn = "inline-flex min-h-[54px] items-center justify-center rounded-full px-8 text-[16px] font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";

export default async function ReadingTestPage({ params, searchParams }: { params: Promise<{ n: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const [{ n }, sp] = await Promise.all([params, searchParams]);
  const num = Number(n);
  if (!Number.isInteger(num) || !databaseConfigured()) notFound();
  const me = await currentViewer();
  const student = me && me.role === "student" ? me : null;
  const d = await essayDetail(num, student?.id ?? null);
  if (!d) notFound();
  const c = d.card;
  const { cards } = await essayCards(student?.id ?? null);
  const related = cards.filter((x) => x.theme === c.theme && x.n !== c.n).slice(0, 3);
  const prev = cards.find((x) => x.n === c.n - 1), next = cards.find((x) => x.n === c.n + 1);
  const totalQ = c.skills.reduce((a, s) => a + s.n, 0) || 1;
  const startLabel = c.attempts ? "Take it again" : "Start this test";
  return (
    <MarketShell user={me} active="courses">
      <nav aria-label="Breadcrumb" className="mb-4 text-[13.5px] text-ink-3"><ol className="flex flex-wrap gap-1.5"><li><Link className="underline hover:text-ink" href="/reading-tests">Reading tests</Link></li><li aria-hidden>/</li><li><Link className="underline hover:text-ink" href={`/reading-tests#library`}>{c.themeName}</Link></li><li aria-hidden>/</li><li aria-current="page" className="font-medium text-ink">Test {String(c.n).padStart(2, "0")}</li></ol></nav>

      <header className="relative overflow-hidden rounded-[2rem] px-6 py-10 text-white sm:px-10 sm:py-12" style={{ background: `linear-gradient(135deg, ${c.hue} 0%, #0B0D14 92%)` }}>
        <span aria-hidden className="pointer-events-none absolute -right-4 -top-8 select-none text-[170px] font-bold leading-none opacity-[0.10]">{String(c.n).padStart(2, "0")}</span>
        <p className="relative text-[12.5px] font-semibold uppercase tracking-[0.16em] text-white/80">{c.themeName} · essay reading test</p>
        <h1 className="relative mt-2 max-w-3xl text-white text-[clamp(1.8rem,4.6vw,3rem)] font-bold leading-[1.08]">{c.title}</h1>
        <ul className="relative mt-5 flex flex-wrap gap-2 text-[13.5px]">
          <li className="rounded-full bg-white/15 px-3.5 py-1.5">{c.words} words</li><li className="rounded-full bg-white/15 px-3.5 py-1.5">{c.questions} questions</li><li className="rounded-full bg-white/15 px-3.5 py-1.5">about {c.minutes} minutes</li>
          <li className="rounded-full bg-white/15 px-3.5 py-1.5" aria-label={`Difficulty ${c.difficulty} of 5`}>Difficulty {"●".repeat(c.difficulty)}{"○".repeat(5 - c.difficulty)}</li>
        </ul>
        <p className="relative mt-4 flex flex-wrap items-center gap-2 text-[13px] text-white"><span className="text-white/75">Good practice for</span>{c.exams.map((e) => <span key={e} className="rounded-md border border-white/40 bg-white/10 px-2 py-0.5 font-bold tracking-wide">{e}</span>)}</p>
        <div className="relative mt-7 flex flex-wrap items-center gap-4">
          {sp.e ? <p role="alert" className="w-full rounded-xl bg-white/15 p-3 text-[14.5px]">{sp.e}</p> : null}
          {c.locked ? (
            <Link href={`/reading-studio/upgrade?from=essay-${c.n}`} className={`${btn} bg-white text-ink hover:bg-cream focus-visible:outline-white`}>Unlock this test with the plan</Link>
          ) : student ? (
            <form action={startEssayAction}><input type="hidden" name="n" value={c.n} /><button type="submit" className={`${btn} bg-orange text-white shadow-glow hover:bg-orange-dark focus-visible:outline-white`}>{startLabel}</button></form>
          ) : (
            <form action={startEssayAction}><input type="hidden" name="n" value={c.n} /><button type="submit" className={`${btn} bg-orange text-white shadow-glow hover:bg-orange-dark focus-visible:outline-white`}>{c.free ? "Sign in and start free" : "Sign in to start"}</button></form>
          )}
          {c.free ? <span className="rounded-full bg-white px-3.5 py-1.5 text-[12.5px] font-bold text-orange-deep">FREE TEST</span> : c.locked ? <span className="rounded-full bg-white/15 px-3.5 py-1.5 text-[12.5px] font-semibold">Part of the plan</span> : <span className="rounded-full bg-white/15 px-3.5 py-1.5 text-[12.5px] font-semibold">Included in your plan</span>}
          {c.lastId ? <Link href={`/reading-studio/results/${c.lastId}`} className="text-[14.5px] font-semibold underline underline-offset-2">See my last result{c.best !== null ? ` (best ${Math.round(c.best)}/100)` : ""}</Link> : null}
        </div>
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <article className="relative overflow-hidden rounded-3xl border border-black/[0.08] bg-white p-6 shadow-card sm:p-8" aria-labelledby="prev-h">
          <h2 id="prev-h" className="text-[13px] font-semibold uppercase tracking-[0.14em] text-ink-3">Preview of the essay</h2>
          <p className="mt-3 text-[18px] leading-[1.85] text-ink">{d.preview}</p>
          <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-white via-white/95 to-transparent" />
          <p className="relative mt-6 rounded-2xl bg-cream-2 p-4 text-[14.5px] text-ink-2">The full essay opens in the reading screen once you start{c.locked ? ", which needs the plan for this test" : ""}. Your reading time is recorded as an estimate and the questions stay hidden until you have finished reading.</p>
        </article>

        <aside className="space-y-5">
          <section className="rounded-3xl border border-black/[0.08] bg-white p-6 shadow-card" aria-labelledby="skills-h">
            <h2 id="skills-h" className="text-[17px] font-semibold text-ink">Skills this test trains</h2>
            <ul className="mt-4 space-y-3">
              {c.skills.slice(0, 5).map((s) => (
                <li key={s.skill}><div className="flex justify-between text-[13.5px] text-ink-2"><span>{s.label}</span><span>{s.n} of {totalQ}</span></div><div className="mt-1 h-2 overflow-hidden rounded-full bg-cream-3" role="presentation"><div className="h-full rounded-full" style={{ width: `${(100 * s.n) / totalQ}%`, background: c.hue }} /></div></li>
              ))}
            </ul>
            <p className="mt-3 text-[12.5px] text-ink-4">Skills are tagged by the wording of each question. After your attempt, the Reading Studio shows how you did on each.</p>
          </section>
          {d.sample ? (
            <section className="rounded-3xl border border-black/[0.08] bg-white p-6 shadow-card" aria-labelledby="sq-h">
              <h2 id="sq-h" className="text-[17px] font-semibold text-ink">A taste of the questions</h2>
              <p className="mt-3 text-[15px] font-medium leading-snug text-ink">{d.sample.stem}</p>
              <ol className="mt-3 space-y-1.5 text-[14px] text-ink-2">{d.sample.options.map((o, i) => <li key={i} className="flex gap-2"><span className="font-semibold text-ink-3">{String.fromCharCode(65 + i)}.</span>{o}</li>)}</ol>
              <p className="mt-3 text-[12.5px] text-ink-4">The answer and its explanation come after you hand in the test.</p>
            </section>
          ) : null}
          <section className="rounded-3xl bg-ink p-6 text-white" aria-labelledby="after-h">
            <h2 id="after-h" className="text-[17px] font-semibold text-white">After you finish</h2>
            <ul className="mt-3 space-y-2 text-[14px] text-white/80">{["Score out of 100, with the working shown", "Reading speed estimate", "Strongest and weakest skills", c.locked ? "With the plan: every explanation, charts and a 7-day plan" : "Every explanation, charts and a 7-day plan (plan students)"].map((x) => <li key={x} className="flex gap-2"><span aria-hidden className="text-orange">✦</span>{x}</li>)}</ul>
          </section>
        </aside>
      </div>

      {related.length ? (
        <section className="mt-12" aria-labelledby="more-h">
          <h2 id="more-h" className="text-[22px] font-bold text-ink">More on {c.themeName.toLowerCase()}</h2>
          <ul className="mt-4 grid gap-4 md:grid-cols-3">{related.map((r) => <li key={r.n}><Link href={`/reading-tests/${r.n}`} className="block h-full rounded-2xl border border-black/[0.08] bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-deep"><p className="text-[12px] font-semibold text-ink-3">Test {String(r.n).padStart(2, "0")} · {r.free ? "FREE" : "With the plan"}</p><p className="mt-1 text-[16px] font-semibold leading-snug text-ink">{r.title}</p><p className="mt-2 text-[12.5px] text-ink-3">{r.exams.join(" · ")}</p></Link></li>)}</ul>
        </section>
      ) : null}
      <nav aria-label="Other tests" className="mt-8 flex flex-wrap justify-between gap-3 text-[14.5px]">
        {prev ? <Link href={`/reading-tests/${prev.n}`} className="font-semibold text-orange-deep underline">← Test {String(prev.n).padStart(2, "0")}: {prev.title.slice(0, 48)}</Link> : <span />}
        {next ? <Link href={`/reading-tests/${next.n}`} className="font-semibold text-orange-deep underline">Test {String(next.n).padStart(2, "0")}: {next.title.slice(0, 48)} →</Link> : null}
      </nav>
      <p className="sr-only">{EXAMS.length} examinations covered</p>
    </MarketShell>
  );
}
