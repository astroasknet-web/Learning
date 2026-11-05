import type { Metadata } from "next";
import Link from "next/link";
import { MarketShell, currentViewer } from "@/components/market/shell";
import { AREAS, SEED_TOPICS } from "@/lib/mathstudio/taxonomy";
import { FREE_FEATURES, PREMIUM_FEATURES, feeNow } from "@/lib/mathstudio/access";
import { databaseConfigured } from "@/lib/portal/db";
import { SITE_URL } from "@/lib/seo";

export const dynamic = "force-dynamic";

const TITLE = "Mathematics Studio: One Performance Engine for Every Maths Test | GrowQR";
const DESC = "Every maths test you take on GrowQR feeds one intelligence engine: topic-by-topic mastery, evidence-based weakness detection, interactive charts and a personalised practice plan. A free summary stays open to everyone.";
export const metadata: Metadata = {
  title: TITLE, description: DESC, alternates: { canonical: `${SITE_URL}/math-studio` },
  openGraph: { type: "website", url: `${SITE_URL}/math-studio`, siteName: "GrowQR", title: TITLE, description: DESC },
  twitter: { card: "summary_large_image", title: TITLE, description: DESC },
};
const btn = "inline-flex min-h-[54px] items-center justify-center rounded-full px-8 text-[16px] font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";

const STEPS: Array<[string, string]> = [
  ["Take any maths test", "GRE Quant mocks, the Mathematics Speed studio, and more to come. No uploading, no entering scores."],
  ["It flows into one engine", "Every question is mapped to a universal topic and difficulty, so a weakness seen in two tests becomes one diagnosis."],
  ["See where you stand", "A performance score you can trace, topic mastery with confidence bands, and the evidence behind every finding."],
  ["Know what is limiting you", "Not just “65%”: which topics, why you lose the marks, and how sure we are."],
  ["Get a plan and improve", "A prioritised practice plan with targets and revisit dates, linked to real practice on the platform."],
];
const WHY: Array<[string, string]> = [
  ["One intelligence engine for every test", "Your tests do not live in separate report cards. They build one profile, so progress and weaknesses are seen across the whole platform."],
  ["Evidence, not just a score", "Every diagnosis carries an evidence level from the amount of data behind it, and the engine says plainly when there is not enough to be sure."],
  ["Honest by design", "Scores are provisional and labelled so; reading speed is only measured where a test records it; nothing invents a weakness to sell a plan."],
];
const FAQ: Array<[string, string]> = [
  ["How does it get my results?", "Automatically. When you finish a maths test on GrowQR, it is normalised into the Studio in the background. Your history is backfilled too, so the Studio is complete the day you open it."],
  ["Which tests does it cover today?", "The GRE Quant mocks and the Mathematics Speed studio. The engine is built around a standard integration contract, so new maths tests connect through a small adapter without rebuilding it."],
  ["Is the scoring done by AI?", "No. Scores come from fixed, published formulas on our server — a Bayesian mastery estimate, difficulty-weighted accuracy and robust speed statistics. They are provisional: the weights are starting values, not yet validated against real outcomes, and we say so."],
  ["What is free?", "An overall performance score, your accuracy and counts, your three weakest topics, a basic progress trend and a preview of the plan. The full topic breakdown, weakness diagnosis, charts, plan and question-level analysis are the premium Studio."],
  ["Does speed count against me?", "Only together with accuracy, and only where a test records per-question time (the Mathematics Speed studio does; the GRE mocks record only the whole-test time, and the Studio says so). A long time on a hard question is never, by itself, called a weakness."],
];

export default async function MathStudioLanding() {
  const me = await currentViewer();
  const student = me && me.role === "student";
  const fee = databaseConfigured() ? await feeNow().catch(() => null) : null;
  const price = fee ? `₹${(fee.amountMinor / 100).toLocaleString("en-IN")}` : null;
  const cta = student ? { href: "/math-studio/dashboard", label: "Open my Mathematics Studio" } : { href: `/login?next=${encodeURIComponent("/math-studio")}`, label: "Open my Studio (free summary)" };
  const jsonld = { "@context": "https://schema.org", "@type": "Course", name: "Mathematics Studio", description: DESC, url: `${SITE_URL}/math-studio`, provider: { "@type": "Organization", name: "GrowQR", url: SITE_URL }, inLanguage: "en", ...(fee ? { offers: { "@type": "Offer", category: "Paid", price: String(fee.amountMinor / 100), priceCurrency: "INR", url: `${SITE_URL}/math-studio` } } : {}) };
  const faqLd = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) };
  return (
    <MarketShell user={me} active="courses">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonld) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <section className="relative -mx-4 overflow-hidden rounded-[2rem] bg-[#0B0D14] px-5 py-12 text-white sm:mx-0 sm:px-10 sm:py-16 lg:px-14" aria-labelledby="h">
        <div aria-hidden className="pointer-events-none absolute -left-24 -top-28 h-[26rem] w-[26rem] rounded-full bg-[#1F4E79]/50 blur-[110px]" />
        <div aria-hidden className="pointer-events-none absolute -bottom-32 right-[-6rem] h-[30rem] w-[30rem] rounded-full bg-[#6B3FA0]/40 blur-[120px]" />
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)", backgroundSize: "44px 44px" }} />
        <div className="relative max-w-3xl">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-[12.5px] font-semibold text-white backdrop-blur"><span aria-hidden className="h-2 w-2 rounded-full bg-emerald-400" />One engine · every maths test · one profile</p>
          <h1 id="h" className="mt-5 text-[clamp(2.3rem,6vw,4.2rem)] font-bold leading-[1.03] tracking-tight text-white">Mathematics Studio</h1>
          <p className="mt-4 text-[clamp(1.1rem,2.4vw,1.5rem)] font-medium leading-snug text-[#8FB6E6]">Stop reading report cards. Start fixing the maths.</p>
          <p className="mt-4 max-w-2xl text-[17.5px] leading-relaxed text-white/80">Every maths test you take on GrowQR feeds one performance engine: topic-by-topic mastery, evidence-based weaknesses, interactive charts and a practice plan built from your own results.</p>
          <div className="mt-8 flex flex-wrap items-center gap-4"><Link href={cta.href} className={`${btn} bg-orange text-white shadow-glow hover:bg-orange-dark focus-visible:outline-white`}>{cta.label}</Link><a href="#how" className={`${btn} border border-white/30 text-white hover:bg-white/10 focus-visible:outline-white`}>How it works</a></div>
          <p className="mt-4 text-[14px] text-white/65">Free summary for every student. {price ? `Full Studio ${price}, paid once.` : ""} No card to start.</p>
        </div>
      </section>

      <section id="how" className="mt-16 scroll-mt-28" aria-labelledby="how-h">
        <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-orange-deep">How it works</p>
        <h2 id="how-h" className="mt-1 max-w-3xl text-[clamp(1.7rem,3.6vw,2.6rem)] font-bold leading-tight text-ink">A score tells you where you stand. This tells you what to fix.</h2>
        <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{STEPS.map(([t, d], i) => <li key={t} className="rounded-2xl border border-black/[0.08] bg-white p-5 shadow-card"><span className="grid h-9 w-9 place-items-center rounded-full bg-[#1F4E79] text-[15px] font-bold text-white" aria-hidden>{i + 1}</span><h3 className="mt-3 text-[16.5px] font-semibold text-ink">{t}</h3><p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-3">{d}</p></li>)}</ol>
      </section>

      <section className="mt-16 grid gap-5 md:grid-cols-3" aria-label="Why">
        {WHY.map(([t, d]) => <article key={t} className="rounded-3xl border border-black/[0.08] bg-white p-6 shadow-card"><h3 className="text-[19px] font-semibold text-ink">{t}</h3><p className="mt-2 text-[14.5px] leading-relaxed text-ink-2">{d}</p></article>)}
      </section>

      <section className="mt-16" aria-labelledby="free-h">
        <h2 id="free-h" className="text-[clamp(1.6rem,3.2vw,2.3rem)] font-bold text-ink">Free and full</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-black/[0.08] bg-white p-5 shadow-card"><h3 className="text-[17px] font-semibold text-ink">Free for every student</h3><ul className="mt-2 space-y-1.5 text-[14.5px] text-ink-2">{FREE_FEATURES.map((f) => <li key={f}>✓ {f}</li>)}</ul></div>
          <div className="rounded-2xl border border-orange/50 bg-orange-lighter p-5 shadow-card"><h3 className="text-[17px] font-semibold text-ink">With the Studio{price ? ` · ${price}` : ""}</h3><ul className="mt-2 space-y-1.5 text-[14.5px] text-ink-2">{PREMIUM_FEATURES.map((f) => <li key={f}>+ {f}</li>)}</ul></div>
        </div>
      </section>

      <section className="mt-16" aria-labelledby="cov-h">
        <h2 id="cov-h" className="text-[clamp(1.6rem,3.2vw,2.3rem)] font-bold text-ink">One taxonomy across six areas</h2>
        <p className="mt-1 max-w-2xl text-[15px] text-ink-3">Every question from every test is mapped into the same {SEED_TOPICS.length} topics, so your mastery is comparable wherever it was earned.</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{AREAS.map((a) => <div key={a.id} className="rounded-2xl border border-black/[0.08] bg-white p-4 shadow-card"><span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: a.hue }} /> <span className="text-[16px] font-semibold text-ink">{a.name}</span><p className="mt-1 text-[13px] text-ink-3">{SEED_TOPICS.filter((t) => t.area === a.id).map((t) => t.name).slice(0, 4).join(", ")}{SEED_TOPICS.filter((t) => t.area === a.id).length > 4 ? " and more" : ""}</p></div>)}</div>
      </section>

      <section className="mt-16 max-w-3xl" aria-labelledby="faq-h">
        <h2 id="faq-h" className="text-[clamp(1.6rem,3.2vw,2.2rem)] font-bold text-ink">Questions</h2>
        <div className="mt-4 divide-y divide-black/[0.08] rounded-2xl border border-black/[0.08] bg-white shadow-card">{FAQ.map(([q, a]) => <details key={q} className="group p-5"><summary className="cursor-pointer list-none text-[16.5px] font-semibold text-ink marker:hidden">{q}</summary><p className="mt-2 text-[15px] leading-relaxed text-ink-2">{a}</p></details>)}</div>
        <div className="mt-8"><Link href={cta.href} className={`${btn} bg-orange text-white hover:bg-orange-dark focus-visible:outline-orange-deep`}>{cta.label}</Link></div>
      </section>
    </MarketShell>
  );
}
