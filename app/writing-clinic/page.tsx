import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BarChart3, FileText, Target, Timer } from "lucide-react";
import PageShell from "@/components/layout/PageShell";
import WritingClinic from "@/components/writing-clinic/WritingClinic";
import { EXAMS, TAGLINES } from "@/lib/writing-clinic/exams";
import { PLANS } from "@/lib/market/plans";
import { currentUser } from "@/lib/portal/guard";
import { accessFor, buyHref, courseFee } from "@/lib/pay/course-access";
import { activePlan } from "@/lib/pay/entitlements";
import { canonicalUrl, OG_IMAGE } from "@/lib/seo";

const TITLE = "Writing Clinic: IELTS, GRE, GMAT, SAT and College Essay Practice | GrowQR";
const DESC = "Practise exam essays and get an instant score on every criterion. IELTS, GRE, GMAT-style arguments, SAT-style analysis and college essays. Start free.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: canonicalUrl("/writing-clinic") },
  openGraph: { title: TITLE, description: DESC, url: canonicalUrl("/writing-clinic"), images: [OG_IMAGE] },
};

const STEPS = [
  { icon: Target, title: "Pick your exam and prompt", text: "Choose IELTS, GRE, GMAT, SAT or a college essay, then a real exam-style prompt. Or paste your own." },
  { icon: Timer, title: "Write against the clock", text: "A built-in timer keeps you to exam time, and a live word count shows how far you are from the target." },
  { icon: BarChart3, title: "See your score in seconds", text: "Get an estimate on each criterion, what is working, and the one or two things that will lift your score most." },
  { icon: FileText, title: "Repeat and watch it climb", text: "Your recent checks are saved on your device, so you can see your scores improve across drafts." },
];

const FAQ = [
  { q: "Is this an official score?", a: "No. It is a practice tool that estimates your score from things a computer can measure, such as length, structure, linking words, vocabulary variety and sentence variety. It cannot judge whether your ideas are right, so use it to spot patterns and build habits, and ask a teacher to mark a few essays too." },
  { q: "Which exams does it cover?", a: "IELTS Writing (Task 1 and Task 2), GRE Analytical Writing (Issue and Argument), GMAT-style argument critique, SAT-style analytical essays, and personal statements and statements of purpose for college applications." },
  { q: "Does the GMAT or SAT still have an essay?", a: "The current GMAT and the main SAT no longer include a written essay. These modes train the same skills, which are analysing arguments and explaining how an author persuades. They are also used in school tests, MBA preparation and college applications." },
  { q: "Is my writing stored?", a: "No. Your answer is checked in your browser and is not sent anywhere. Your recent scores are kept on your own device only." },
  { q: "What does it cost?", a: "Free to try, with 2 essay checks a month. The English Writing Studio is a one-time ₹499 for unlimited checks, and the Pro, Silver and Gold packages raise the monthly limit to 15, 25 and then unlimited." },
];

export const dynamic = "force-dynamic";

const SLUG = "english-writing-studio";
const PLAN_CHECKS: Record<string, number | null> = { pro: 15, silver: 25, gold: null };

export default async function WritingClinicRoute() {
  const paid = PLANS.filter((p) => p.key !== "free");
  const me = await currentUser().catch(() => null);
  const [fee, access, plan] = await Promise.all([
    courseFee(SLUG).catch(() => null),
    me ? accessFor(me.id, SLUG).catch(() => null) : Promise.resolve(null),
    me ? activePlan(me.id).catch(() => null) : Promise.resolve(null),
  ]);
  const price = fee ? Math.round(fee.amountMinor / 100) : null;
  const owned = access === "purchase" || access === "free";
  const monthly = owned ? null : plan && plan in PLAN_CHECKS ? PLAN_CHECKS[plan] : 2;
  const buy = me ? buyHref(SLUG) : `/login?next=${encodeURIComponent(buyHref(SLUG))}`;
  return (
    <PageShell>
      <div className="bg-cream-2">
        <section className="mx-auto max-w-[1180px] px-5 pb-8 pt-28 text-center md:pt-36">
          <p className="text-[0.78rem] font-semibold uppercase tracking-[0.16em] text-ink-4">Writing Clinic by GrowQR</p>
          <h1 className="mx-auto mt-3 max-w-[14em] text-[clamp(2.4rem,6vw,4.4rem)] font-semibold leading-[1.04] tracking-tight text-ink">{TAGLINES.main}</h1>
          <p className="mx-auto mt-5 max-w-[40em] text-[1.1rem] leading-relaxed text-ink-3">{TAGLINES.sub}</p>
          <div className="mt-7 flex flex-wrap justify-center gap-2" aria-label="Exams covered">
            {EXAMS.map((e) => <span key={e.key} className="rounded-full border border-black/10 bg-white px-4 py-1.5 text-[0.88rem] font-medium text-ink-2">{e.short}</span>)}
          </div>
          <a href="#practice" className="mt-8 inline-flex min-h-[50px] items-center gap-2 rounded-xl bg-ink px-7 text-[1rem] font-semibold text-white hover:opacity-90">Try it free <ArrowRight className="h-4 w-4" aria-hidden /></a>
          {price ? <Link href={buy} className="ml-3 mt-8 inline-flex min-h-[50px] items-center gap-2 rounded-xl border border-ink px-7 text-[1rem] font-semibold text-ink hover:bg-white">Unlock unlimited · ₹{price}</Link> : null}
          <p className="mt-3 text-[0.82rem] text-ink-4">No sign-up needed to try. 2 free essay checks a month{price ? `, then unlimited for a one-time ₹${price}` : ""}.</p>
        </section>

        <section className="mx-auto max-w-[1180px] px-5 pb-16"><WritingClinic allowance={{ monthly, buyHref: buy, price }} /></section>

        <section className="mx-auto max-w-[1180px] px-5 pb-16" aria-labelledby="how">
          <h2 id="how" className="text-center text-[1.8rem] font-semibold text-ink">How it works</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <div key={s.title} className="rounded-2xl border border-black/10 bg-white p-5">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-cream-3 text-ink"><s.icon className="h-5 w-5" aria-hidden /></span>
                <p className="mt-4 text-[0.76rem] font-semibold text-ink-4">Step {i + 1}</p>
                <h3 className="mt-1 text-[1.02rem] font-semibold text-ink">{s.title}</h3>
                <p className="mt-2 text-[0.9rem] leading-relaxed text-ink-3">{s.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-[1180px] px-5 pb-16" aria-labelledby="why">
          <div className="rounded-[28px] bg-ink px-6 py-12 text-center text-white md:px-14">
            <h2 id="why" className="text-[clamp(1.6rem,3.4vw,2.4rem)] font-semibold leading-tight">Built for one thing: a better essay every time you write.</h2>
            <ul className="mx-auto mt-8 grid max-w-[900px] gap-3 text-left sm:grid-cols-2">
              {TAGLINES.more.map((t) => <li key={t} className="rounded-xl bg-white/10 px-4 py-3 text-[0.98rem]">{t}</li>)}
            </ul>
          </div>
        </section>

        <section className="mx-auto max-w-[1180px] px-5 pb-16" aria-labelledby="plans">
          <h2 id="plans" className="text-center text-[1.8rem] font-semibold text-ink">Practise more with a package</h2>
          <p className="mx-auto mt-2 max-w-[36em] text-center text-ink-3">The Writing Clinic comes with every GrowQR package. Higher packages mean more essay checks every month.</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {paid.map((p) => (
              <div key={p.key} className="rounded-2xl border border-black/10 bg-white p-5">
                <p className="flex items-center gap-2 font-semibold text-ink"><span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: p.accent }} />{p.name}</p>
                <p className="mt-2 text-[1.8rem] font-semibold text-ink">₹{p.monthly}<span className="text-[0.9rem] font-normal text-ink-4"> a month</span></p>
                <p className="mt-2 text-[0.9rem] text-ink-3">{p.features.find((f) => /Writing Clinic/.test(f.text))?.text}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-center"><Link href="/pricing" className="font-medium text-ink underline">See all packages</Link></p>
        </section>

        <section className="mx-auto max-w-[760px] px-5 pb-24" aria-labelledby="faq">
          <h2 id="faq" className="text-center text-[1.6rem] font-semibold text-ink">Questions</h2>
          <div className="mt-6 divide-y divide-black/[0.08] rounded-2xl border border-black/10 bg-white">
            {FAQ.map((f) => (
              <details key={f.q} className="group px-5 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[0.98rem] font-medium text-ink">{f.q}<span aria-hidden className="text-ink-4 transition group-open:rotate-45">+</span></summary>
                <p className="mt-2 text-[0.92rem] leading-relaxed text-ink-3">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
    </PageShell>
  );
}
