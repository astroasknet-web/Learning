import type { Metadata } from "next";
import Link from "next/link";
import { MarketShell, currentViewer } from "@/components/market/shell";
import { SEED_LEVELS } from "@/lib/reading/content/levels";
import { feeNow, TRACKS, type Track } from "@/lib/reading/access";
import { databaseConfigured } from "@/lib/portal/db";
import { SITE_URL } from "@/lib/seo";

export const dynamic = "force-dynamic";

const TITLE = "English Reading Studio: Reading Skills, Indian Competitive Exams and IELTS in One Place | GrowQR";
const DESC = "One reading studio with one set of analytics. Build reading skills through ten levels, practise essay tests for SSC, CDS, CAT, UPSC and CTET, or sit IELTS Reading tests. Choose what you need; the starting assessment is free.";
export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: `${SITE_URL}/reading-studio` },
  openGraph: { type: "website", url: `${SITE_URL}/reading-studio`, siteName: "GrowQR", title: TITLE, description: DESC },
  twitter: { card: "summary_large_image", title: TITLE, description: DESC },
};

const btn = "inline-flex min-h-[54px] items-center justify-center rounded-full px-8 text-[16px] font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";
const HUE: Record<Track, string> = { skills: "#0F766E", indian: "#B4530F", international: "#1F4E79" };

const TRACK_DETAIL: Record<Track, { who: string; items: string[]; free: string; cta: string; href: string }> = {
  skills: { who: "For any student who wants to read faster and understand more, whatever the exam.", items: ["Ten levels, from Reading Foundations to Advanced Reading Mastery", "Practice with an explanation after every answer", "Mastery checks that open the next level", "Delayed recall and timed reading", "A 7-day plan built from your answers"], free: "Free: the starting assessment and the Level A lesson.", cta: "Open the skills pathway", href: "/reading-studio/dashboard" },
  indian: { who: "For SSC, CDS, CAT, UPSC, CTET and similar examinations.", items: ["30 essays of 600 to 1,000 words on defence, economy, education, technology, environment and polity", "300 exam-style questions: main idea, inference, statement-based, negation", "Explanations that quote the essay", "Filter by exam and theme", "Every attempt feeds your analytics"], free: "Free: three full tests.", cta: "See the 30 essay tests", href: "/reading-tests" },
  international: { who: "For IELTS Academic Reading.", items: ["30 full IELTS Reading tests, 40 questions, 60 minutes", "Matching headings, True/False/Not Given and more", "A band score and an explanation for every answer", "Your attempts appear in your studio progress"], free: "Free: the first tests. Silver opens 10, Gold opens all.", cta: "Open IELTS Reading tests", href: "/practice-tests/ielts-reading" },
};

const FAQ: Array<[string, string]> = [
  ["What is the English Reading Studio?", "One place for reading practice and reading analytics. It has three tracks: a skills pathway, essay tests for Indian competitive examinations, and IELTS Reading tests. You choose the tracks you want and your dashboard shows only those."],
  ["Do I have to buy all three?", "No. Each track is a separate package, and the first few tests of each are free. You see on your dashboard exactly which packages you hold."],
  ["What do my analytics cover?", "Every skills-pathway assessment and every essay test is scored by the same engine, so skill-by-skill analysis, charts, your 7-day plan and your history cover them together. IELTS Reading results appear in your progress as band scores; they are not broken down by skill, because IELTS question types are different."],
  ["Is the scoring done by AI?", "No. Scores come from fixed, published rules on our server. They are provisional: the starting weights have not been validated against real student data, and reading speed is an estimate."],
  ["When does a package open?", "Only after the payment is verified by our payment system. Nothing in your browser can open it, and there are no countdowns or fake discounts."],
];

export default async function ReadingStudioHub() {
  const me = await currentViewer();
  const student = me && me.role === "student" && databaseConfigured();
  const fees = databaseConfigured() ? await Promise.all(TRACKS.map((t) => feeNow(t.id).catch(() => null))) : TRACKS.map(() => null);
  const price = (i: number) => (fees[i] ? `₹${(fees[i]!.amountMinor / 100).toLocaleString("en-IN")}` : null);
  const cta = student ? { href: "/reading-studio/dashboard", label: "Open my dashboard" } : { href: `/login?next=${encodeURIComponent("/reading-studio/dashboard")}`, label: "Start free: take the starting assessment" };
  const jsonld = { "@context": "https://schema.org", "@type": "Course", name: "English Reading Studio", description: DESC, url: `${SITE_URL}/reading-studio`, provider: { "@type": "Organization", name: "GrowQR", url: SITE_URL }, inLanguage: "en" };
  const faqLd = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) };
  return (
    <MarketShell user={me} active="courses">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonld) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />

      <section className="relative -mx-4 overflow-hidden rounded-[2rem] bg-[#0B0D14] px-5 py-12 text-white sm:mx-0 sm:px-10 sm:py-16 lg:px-14" aria-labelledby="hub-h">
        <div aria-hidden className="pointer-events-none absolute -left-24 -top-28 h-[26rem] w-[26rem] rounded-full bg-orange/40 blur-[110px]" />
        <div aria-hidden className="pointer-events-none absolute -bottom-32 right-[-6rem] h-[30rem] w-[30rem] rounded-full bg-[#5B3BE6]/40 blur-[120px]" />
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)", backgroundSize: "44px 44px" }} />
        <div className="relative max-w-3xl">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-[12.5px] font-semibold text-white backdrop-blur"><span aria-hidden className="h-2 w-2 rounded-full bg-emerald-400" />One studio · three tracks · one set of analytics</p>
          <h1 id="hub-h" className="mt-5 text-[clamp(2.3rem,6vw,4.2rem)] font-bold leading-[1.03] tracking-tight text-white">English Reading Studio</h1>
          <p className="mt-4 text-[clamp(1.1rem,2.4vw,1.5rem)] font-medium leading-snug text-orange">Build the skill. Practise for your exam. See exactly what to fix.</p>
          <p className="mt-4 max-w-2xl text-[17.5px] leading-relaxed text-white/80">Choose what you are preparing for: reading skills, Indian competitive exams (SSC, CDS, CAT, UPSC, CTET) or IELTS. Every test feeds one reading profile, with a score you can trace, a speed estimate, and a plan built from your own answers.</p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link href={cta.href} className={`${btn} bg-orange text-white shadow-glow hover:bg-orange-dark focus-visible:outline-white`}>{cta.label}</Link>
            <a href="#tracks" className={`${btn} border border-white/30 text-white hover:bg-white/10 focus-visible:outline-white`}>See the three tracks</a>
          </div>
          <p className="mt-4 text-[14px] text-white/65">The starting assessment is free and works for every track.</p>
        </div>
      </section>

      <section id="tracks" className="mt-16 scroll-mt-28" aria-labelledby="tracks-h">
        <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-orange-deep">Choose your track</p>
        <h2 id="tracks-h" className="mt-1 max-w-3xl text-[clamp(1.7rem,3.6vw,2.6rem)] font-bold leading-tight text-ink">Pick one, two or all three. Your dashboard shows only what you choose.</h2>
        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          {TRACKS.map((t, i) => {
            const x = TRACK_DETAIL[t.id];
            return (
              <article key={t.id} className="relative flex flex-col overflow-hidden rounded-3xl border border-black/[0.08] bg-white p-6 shadow-card sm:p-7">
                <span aria-hidden className="absolute inset-x-0 top-0 h-2" style={{ background: HUE[t.id] }} />
                <p className="text-[12px] font-bold uppercase tracking-[0.14em]" style={{ color: HUE[t.id] }}>Track {i + 1} · {t.short}</p>
                <h3 className="mt-1 text-[22px] font-bold leading-snug text-ink">{t.name}</h3>
                <p className="mt-2 text-[14.5px] text-ink-2">{x.who}</p>
                <ul className="mt-4 space-y-2 text-[14.5px] text-ink-2">{x.items.map((it) => <li key={it} className="flex gap-2.5"><span aria-hidden style={{ color: HUE[t.id] }}>✓</span>{it}</li>)}</ul>
                <p className="mt-4 rounded-xl bg-cream-2 p-3 text-[13.5px] text-ink-2">{x.free}</p>
                <div className="mt-auto pt-5">
                  <p className="mb-3 text-[15px] font-semibold text-ink">{price(i) ? `Package ${price(i)}, paid once` : "Package"}</p>
                  <Link href={x.href} className={`${btn} w-full text-white hover:opacity-90 focus-visible:outline-ink`} style={{ background: HUE[t.id] }}>{x.cta}</Link>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mt-16 overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#16122B] via-[#1B1740] to-[#0B0D14] px-5 py-12 text-white sm:px-10" aria-labelledby="an-h">
        <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-orange">One set of analytics</p>
        <h2 id="an-h" className="mt-1 max-w-3xl text-[clamp(1.7rem,3.6vw,2.5rem)] font-bold leading-tight text-white">Everything you read adds to the same picture</h2>
        <ul className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[["Score you can trace", "An overall score out of 100 with every part and weight shown. Provisional, and labelled so."], ["Skill by skill", "Accuracy by skill and difficulty, with the number of questions behind each figure."], ["Speed that needs accuracy", "A reading-speed estimate that only counts together with understanding."], ["A plan from your answers", "A 7-day plan, practice on your weakest skills, and progress compared like with like."]].map(([t, d]) => (
            <li key={t} className="rounded-2xl border border-white/15 bg-white/[0.06] p-5"><h3 className="text-[17px] font-semibold text-white">{t}</h3><p className="mt-1.5 text-[14px] leading-relaxed text-white/70">{d}</p></li>
          ))}
        </ul>
        <p className="mt-6 max-w-2xl text-[13.5px] text-white/60">Skill-level analytics cover the skills pathway and the Indian competitive exam essays. IELTS Reading results show in your progress as band scores.</p>
      </section>

      <section className="mt-16" aria-labelledby="lv-h">
        <h2 id="lv-h" className="text-[clamp(1.5rem,3vw,2.2rem)] font-bold text-ink">The skills pathway: ten levels, named for the skill</h2>
        <ol className="mt-4 grid gap-3 md:grid-cols-2">{SEED_LEVELS.map((l) => <li key={l.key} className="flex gap-4 rounded-2xl border border-black/[0.08] bg-white p-4 shadow-card"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-cream-3 text-[20px] font-bold text-ink" aria-hidden>{l.key}</span><div><h3 className="text-[16px] font-semibold text-ink">Level {l.key}: {l.name}</h3><p className="mt-0.5 text-[13.5px] text-ink-3">{l.objective}</p></div></li>)}</ol>
      </section>

      <section className="mt-16 max-w-3xl" aria-labelledby="faq-h">
        <h2 id="faq-h" className="text-[clamp(1.6rem,3.2vw,2.2rem)] font-bold text-ink">Questions</h2>
        <div className="mt-4 divide-y divide-black/[0.08] rounded-2xl border border-black/[0.08] bg-white shadow-card">{FAQ.map(([q, a]) => <details key={q} className="group p-5"><summary className="cursor-pointer list-none text-[16.5px] font-semibold text-ink marker:hidden">{q}</summary><p className="mt-2 text-[15px] leading-relaxed text-ink-2">{a}</p></details>)}</div>
        <div className="mt-8"><Link href={cta.href} className={`${btn} bg-orange text-white hover:bg-orange-dark focus-visible:outline-orange-deep`}>{cta.label}</Link></div>
      </section>
    </MarketShell>
  );
}
