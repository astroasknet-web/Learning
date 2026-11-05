import type { Metadata } from "next";
import Link from "next/link";
import { MarketShell, currentViewer } from "@/components/market/shell";
import Library from "@/components/reading-tests/Library";
import TryQuestion from "@/components/reading-tests/TryQuestion";
import { databaseConfigured } from "@/lib/portal/db";
import { feeNow } from "@/lib/reading/access";
import { essayCards, essayTotals, sampleQuestion } from "@/lib/reading/essays/library";
import { ensureSeed } from "@/lib/reading/store";
import { EXAMS, THEMES } from "@/lib/reading/essays/meta";
import { SITE_URL } from "@/lib/seo";

export const dynamic = "force-dynamic";

const TITLE = "Essay and Comprehension Reading Tests for SSC, CDS, CAT, UPSC and CTET | GrowQR";
const DESC = "30 essay-based reading tests with 300 exam-style questions, instant explanations and an English Reading Studio analysis of exactly where you lose marks. Three tests are free.";
export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: `${SITE_URL}/reading-tests` },
  openGraph: { type: "website", url: `${SITE_URL}/reading-tests`, siteName: "GrowQR", title: TITLE, description: DESC },
  twitter: { card: "summary_large_image", title: TITLE, description: DESC },
};

const btn = "inline-flex min-h-[54px] items-center justify-center rounded-full px-8 text-[16px] font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";

const FAQ: Array<[string, string]> = [
  ["Which examinations are these tests for?", "They are reading practice for SSC, CDS, CAT, UPSC and CTET and similar examinations. The essays are on the themes those papers lean on (defence, economy, education, technology, environment, polity and ethics) and the questions follow their styles: main idea, inference, statement-based, negation and factual. We do not claim any question appeared in a past paper."],
  ["How is this different from a normal mock test?", "Every test is run through the English Reading Studio. You get a score you can trace line by line, an estimate of your reading speed, accuracy by skill and by difficulty, and, with the plan, an explanation for every question and a 7-day plan built from your own answers."],
  ["What is free?", "Three full tests chosen to show different styles (an economy essay, an education essay and an essay on information and wisdom), with an overall score, a reading-speed estimate and your strongest and weakest skills. No payment details are asked for."],
  ["What does the plan add?", "All 30 tests, skill-by-skill analysis with the questions behind each score, full explanations, interactive charts, a personalised 7-day plan, the ten-level Reading Studio pathway, delayed-recall and timed reading, and your full progress history. One payment, no countdown timers or fake offers."],
  ["Are the scores accurate?", "Scoring is done by fixed rules on our server and is never decided by AI. The overall score is provisional: it uses starting weights that are not yet validated against real student data, and reading speed is an estimate from the time the essay was on your screen."],
  ["Can I use it on a phone?", "Yes. The reading screen is built for small screens, with large type, a question navigator and keyboard shortcuts on a computer."],
];

const STEPS: Array<[string, string]> = [
  ["Read", "A 600 to 900 word essay in a clean reading view. Your reading time is noted as an estimate."],
  ["Answer", "Ten questions in the styles of the examinations. Nothing is revealed until you hand in."],
  ["Score", "A transparent score out of 100, with comprehension, accuracy, inference and efficiency shown separately."],
  ["Diagnose", "Your answers feed the Reading Studio, which finds the skills and question types that cost you marks."],
  ["Improve", "Targeted practice, a 7-day plan and fresh tests, so you can see the same skill rise."],
];

export default async function ReadingTestsPage() {
  const me = await currentViewer();
  const student = me && me.role === "student" && databaseConfigured() ? me : null;
  const ok = databaseConfigured();
  if (ok) await ensureSeed();
  const [lib, totals, fee, sample] = ok
    ? await Promise.all([essayCards(student?.id ?? null), essayTotals(), feeNow("indian").catch(() => null), sampleQuestion(20, 0)])
    : [{ cards: [], premium: false }, { tests: 30, questions: 300, words: 22800 }, null, null];
  const premium = lib.premium;
  const price = fee ? `₹${(fee.amountMinor / 100).toLocaleString("en-IN")}` : null;
  const firstFree = lib.cards.find((c) => c.free && !c.attempts) ?? lib.cards.find((c) => c.free);
  const cta = student ? { href: firstFree ? `/reading-tests/${firstFree.n}` : "#library", label: premium ? "Pick your next test" : "Start a free test" } : { href: firstFree ? `/reading-tests/${firstFree.n}` : "#library", label: "Start a free test" };
  const stats: Array<[string, string]> = [[String(totals.tests), "essay tests"], [String(totals.questions), "exam-style questions"], [`${Math.round(totals.words / 1000)}k`, "words of reading"], ["5", "exam styles"]];
  const jsonld = {
    "@context": "https://schema.org", "@type": "Course", name: "Essay and Comprehension Reading Tests for Competitive Examinations", description: DESC, url: `${SITE_URL}/reading-tests`,
    provider: { "@type": "Organization", name: "GrowQR", url: SITE_URL }, inLanguage: "en",
    ...(fee ? { offers: { "@type": "Offer", category: "Paid", price: String(fee.amountMinor / 100), priceCurrency: "INR", url: `${SITE_URL}/reading-tests` } } : {}),
  };
  const faqLd = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) };

  return (
    <MarketShell user={me} active="courses">
      <style>{`
        @keyframes rt-float{0%,100%{transform:translate3d(0,0,0)}50%{transform:translate3d(0,-18px,0)}}
        @keyframes rt-drift{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
        @keyframes rt-shine{0%{background-position:0% 50%}100%{background-position:200% 50%}}
        .rt-orb{animation:rt-float 9s ease-in-out infinite}.rt-orb2{animation:rt-float 12s ease-in-out infinite reverse}
        .rt-marquee{animation:rt-drift 38s linear infinite}
        .rt-shine{background-image:linear-gradient(100deg,#fff 20%,#ffb48f 45%,#ff6a2f 55%,#fff 80%);background-size:200% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:rt-shine 7s linear infinite}
        @media (prefers-reduced-motion: reduce){.rt-orb,.rt-orb2,.rt-marquee,.rt-shine{animation:none}.rt-shine{color:#fff;background:none}}
      `}</style>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonld) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />

      {/* HERO */}
      <section className="relative -mx-4 overflow-hidden rounded-[2rem] bg-[#0B0D14] px-5 py-12 text-white sm:mx-0 sm:px-10 sm:py-16 lg:px-14 lg:py-20" aria-labelledby="hero-h">
        <div aria-hidden className="rt-orb pointer-events-none absolute -left-24 -top-28 h-[26rem] w-[26rem] rounded-full bg-orange/40 blur-[110px]" />
        <div aria-hidden className="rt-orb2 pointer-events-none absolute -bottom-32 right-[-6rem] h-[30rem] w-[30rem] rounded-full bg-[#5B3BE6]/40 blur-[120px]" />
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)", backgroundSize: "44px 44px" }} />
        <div className="relative grid items-center gap-10 lg:grid-cols-[1.15fr_1fr]">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-white text-[12.5px] font-semibold tracking-wide backdrop-blur"><span aria-hidden className="h-2 w-2 rounded-full bg-emerald-400" />Part of the <Link href="/reading-studio" className="underline underline-offset-2">English Reading Studio</Link> · Indian Competitive Exams track</p>
            <h1 id="hero-h" className="mt-5 text-white text-[clamp(2.3rem,6vw,4.3rem)] font-bold leading-[1.02] tracking-tight">Read the essay.<br /><span className="rt-shine">Find the marks you are losing.</span></h1>
            <p className="mt-5 max-w-xl text-[18px] leading-relaxed text-white/80">30 essay-based reading tests for SSC, CDS, CAT, UPSC and CTET. Ten exam-style questions each, every answer explained, and an English Reading Studio analysis that shows which skills and question types cost you marks.</p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link href={cta.href} className={`${btn} bg-orange text-white shadow-glow hover:bg-orange-dark focus-visible:outline-white`}>{cta.label}</Link>
              <a href="#library" className={`${btn} border border-white/30 text-white hover:bg-white/10 focus-visible:outline-white`}>Browse all {totals.tests} tests</a>
            </div>
            <p className="mt-4 text-[14px] text-white/65">Three full tests are free. No card needed to start.</p>
            <ul className="mt-8 flex flex-wrap gap-2.5" aria-label="Examinations these tests suit">
              {EXAMS.map((e) => <li key={e.id} className="rounded-full border border-white/25 bg-white/10 px-4 py-1.5 text-[13.5px] font-bold tracking-wide backdrop-blur">{e.name}</li>)}
              <li className="rounded-full border border-dashed border-white/25 px-4 py-1.5 text-[13.5px] text-white/70">and similar exams</li>
            </ul>
          </div>
          <div>{sample ? <TryQuestion q={sample} /> : null}</div>
        </div>
        <dl className="relative mt-12 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/15 bg-white/15 sm:grid-cols-4">
          {stats.map(([v, l]) => <div key={l} className="bg-[#0B0D14]/80 px-5 py-4 backdrop-blur"><dt className="text-[13px] text-white/65">{l}</dt><dd className="mt-1 text-[32px] font-bold leading-none text-white">{v}</dd></div>)}
        </dl>
      </section>

      {/* WHY */}
      <section className="mt-16" aria-labelledby="why-h">
        <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-orange-deep">Why these tests</p>
        <h2 id="why-h" className="mt-1 max-w-3xl text-[clamp(1.7rem,3.6vw,2.6rem)] font-bold leading-tight text-ink">A score tells you where you stand. A diagnosis tells you what to fix.</h2>
        <div className="mt-8 grid gap-5 md:grid-cols-6">
          {[
            { c: "md:col-span-3 bg-ink text-white", t: "Written for the way these exams read", d: "Six themes the papers lean on, argued essays and policy essays, and questions in five styles: main idea, inference, statement-based, negation and fact.", k: "01" },
            { c: "md:col-span-3 bg-orange-light text-ink", t: "Every answer explained, with proof", d: "Each explanation quotes the sentence of the essay that supports the key, so you learn what the passage actually says, not what merely sounds right.", k: "02" },
            { c: "md:col-span-2 bg-white text-ink border border-black/[0.08]", t: "Skill-by-skill analytics", d: "Accuracy by skill and difficulty, with the number of questions behind every figure.", k: "03" },
            { c: "md:col-span-2 bg-white text-ink border border-black/[0.08]", t: "Speed that never beats accuracy", d: "A reading-speed estimate that counts only together with understanding.", k: "04" },
            { c: "md:col-span-2 bg-[#EEF6F4] text-ink border border-[#0F766E]/20", t: "Honest numbers", d: "Provisional scores, labelled estimates and no invented comparisons with other students.", k: "05" },
          ].map((b) => (
            <article key={b.k} className={`relative overflow-hidden rounded-3xl p-6 shadow-card sm:p-7 [&_h3]:text-inherit [&_p]:text-inherit ${b.c}`}>
              <span aria-hidden className="absolute right-4 top-2 text-[64px] font-bold leading-none opacity-[0.12]">{b.k}</span>
              <h3 className="relative max-w-sm text-[20px] font-semibold leading-snug">{b.t}</h3>
              <p className="relative mt-2 max-w-md text-[15px] leading-relaxed opacity-85">{b.d}</p>
            </article>
          ))}
        </div>
      </section>

      {/* STUDIO PIPELINE */}
      <section className="mt-16 overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#16122B] via-[#1B1740] to-[#0B0D14] px-5 py-12 text-white sm:px-10" aria-labelledby="link-h">
        <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-orange">Powered by the English Reading Studio</p>
        <h2 id="link-h" className="mt-1 max-w-3xl text-white text-[clamp(1.7rem,3.6vw,2.5rem)] font-bold leading-tight">Every test feeds your reading profile</h2>
        <p className="mt-3 max-w-2xl text-[16px] leading-relaxed text-white/75">Your answers do not disappear into a mark sheet. They become question-level data in the Reading Studio, so each new test sharpens the picture of your strengths and the plan to fix your weak skills.</p>
        <ol className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {STEPS.map(([t, d], i) => (
            <li key={t} className="relative rounded-2xl border border-white/15 bg-white/[0.06] p-5 backdrop-blur">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-orange text-[15px] font-bold text-white" aria-hidden>{i + 1}</span>
              <h3 className="mt-3 text-[17px] font-semibold text-white">{t}</h3>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-white/70">{d}</p>
              {i < STEPS.length - 1 ? <span aria-hidden className="absolute -right-3 top-1/2 hidden -translate-y-1/2 text-white/40 lg:block">›</span> : null}
            </li>
          ))}
        </ol>
        <Link href="/reading-studio" className="mt-8 inline-flex min-h-[48px] items-center rounded-full border border-white/30 px-6 text-[15px] font-semibold hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">See the English Reading Studio →</Link>
      </section>

      {/* LIBRARY */}
      <section id="library" className="mt-16 scroll-mt-28" aria-labelledby="lib-h">
        <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-orange-deep">The test library</p>
        <h2 id="lib-h" className="mt-1 text-[clamp(1.7rem,3.6vw,2.6rem)] font-bold leading-tight text-ink">30 essays. Six themes. Pick your exam.</h2>
        <p className="mt-2 max-w-2xl text-[15px] text-ink-3">&ldquo;Suits&rdquo; means the theme and style are good practice for that exam. It does not mean the exam has asked about it.</p>
        <div className="mt-6">
          <Library
            cards={lib.cards.map((c) => ({ n: c.n, title: c.title, words: c.words, questions: c.questions, theme: c.theme, themeName: c.themeName, hue: c.hue, exams: c.exams, difficulty: c.difficulty, minutes: c.minutes, free: c.free, locked: c.locked, attempts: c.attempts, best: c.best, skills: c.skills.map((s) => s.label) }))}
            themes={THEMES.map((t) => ({ id: t.id, name: t.name, hue: t.hue }))}
            exams={EXAMS.map((e) => e.id)}
            signedIn={!!student}
          />
        </div>
      </section>

      {/* PLAN */}
      <section className="mt-16" aria-labelledby="plan-h">
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-3xl border border-black/[0.08] bg-white p-7 shadow-card">
            <p className="text-[13px] font-semibold uppercase tracking-wide text-ink-3">Free</p>
            <h2 id="plan-h" className="mt-1 text-[28px] font-bold text-ink">Start with three full tests</h2>
            <ul className="mt-4 space-y-2.5 text-[15px] text-ink-2">
              {["Three complete essay tests", "Overall score with the working shown", "Reading-speed estimate", "Strongest and weakest skills", "Level A lesson of the skills pathway"].map((f) => <li key={f} className="flex gap-2.5"><span aria-hidden className="text-emerald-600">✓</span>{f}</li>)}
            </ul>
            <Link href={cta.href} className={`${btn} mt-6 border border-black/20 text-ink hover:border-orange focus-visible:outline-orange-deep`}>{cta.label}</Link>
          </div>
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-orange to-[#D44F1A] p-7 text-white shadow-glow">
            <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/20 blur-3xl" />
            <p className="relative text-[13px] font-semibold uppercase tracking-wide text-white/85">The plan{price ? ` · ${price}, paid once` : ""}</p>
            <h2 className="relative mt-1 text-[28px] font-bold leading-tight text-white">All 30 tests, with full English Reading Studio analytics</h2>
            <ul className="relative mt-4 space-y-2.5 text-[15px]">
              {["All 30 essay tests, 300 questions", "Skill-by-skill analysis and every explanation", "Interactive charts and your progress history", "Personalised 7-day improvement plan", "Downloadable report for every test"].map((f) => <li key={f} className="flex gap-2.5"><span aria-hidden>✦</span>{f}</li>)}
            </ul>
            {premium ? <Link href="/reading-studio/dashboard" className={`${btn} relative mt-6 bg-white text-orange-deep hover:bg-cream focus-visible:outline-white`}>You have this package: open your dashboard</Link>
              : <Link href="/reading-studio/upgrade?from=reading-tests&track=indian" className={`${btn} relative mt-6 bg-white text-orange-deep hover:bg-cream focus-visible:outline-white`}>Get the Indian Competitive Exams package{price ? ` for ${price}` : ""}</Link>}
            <p className="relative mt-3 text-[13px] text-white/80">The skills pathway (ten levels, practice, timed reading) and IELTS Reading are separate packages in the same studio. Payment goes through our existing secure checkout. Access starts only after the payment is verified. No countdowns, no fake discounts.</p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mt-16 max-w-3xl" aria-labelledby="faq-h">
        <h2 id="faq-h" className="text-[clamp(1.6rem,3.2vw,2.2rem)] font-bold text-ink">Questions</h2>
        <div className="mt-4 divide-y divide-black/[0.08] rounded-2xl border border-black/[0.08] bg-white shadow-card">
          {FAQ.map(([q, a]) => <details key={q} className="group p-5"><summary className="cursor-pointer list-none text-[16.5px] font-semibold text-ink marker:hidden">{q}</summary><p className="mt-2 text-[15px] leading-relaxed text-ink-2">{a}</p></details>)}
        </div>
      </section>

      <section className="mt-16 rounded-[2rem] bg-ink px-6 py-12 text-center text-white sm:px-10" aria-label="Get started">
        <h2 className="mx-auto max-w-2xl text-white text-[clamp(1.7rem,3.6vw,2.5rem)] font-bold leading-tight">Your next essay is ten questions away from a clearer plan.</h2>
        <p className="mx-auto mt-3 max-w-xl text-[16px] text-white/75">Take a free test, read the analysis, and decide for yourself whether the plan is worth it.</p>
        <Link href={cta.href} className={`${btn} mt-7 bg-orange text-white hover:bg-orange-dark focus-visible:outline-white`}>{cta.label}</Link>
      </section>
    </MarketShell>
  );
}
