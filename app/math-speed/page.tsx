import type { Metadata } from "next";
import Link from "next/link";
import { MarketShell, currentViewer } from "@/components/market/shell";
import DrillRunner, { type ClientQuestion } from "@/components/mathspeed/DrillRunner";
import { LEVELS, COURSE_TITLE } from "@/lib/mathspeed/curriculum";
import { DEFAULT_CTX } from "@/lib/mathspeed/personalise";
import { buildQuestion } from "@/lib/mathspeed/skills";
import { courseFeeNow } from "@/lib/mathspeed/access";
import { databaseConfigured } from "@/lib/portal/db";
import { getEnrolment } from "@/lib/mathspeed/store";
import { SITE_URL } from "@/lib/seo";

export const dynamic = "force-dynamic";

const TITLE = "Mathematics Speed Enhancement Studio: 15 Levels | GrowQR";
const DESC = "Get faster and more accurate at calculation. One course in 15 levels, with a placement check, timed practice and spaced review. Level A, Module 1 is free.";
export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: `${SITE_URL}/math-speed` },
  openGraph: { type: "website", url: `${SITE_URL}/math-speed`, siteName: "GrowQR", title: TITLE, description: DESC },
  twitter: { card: "summary_large_image", title: TITLE, description: DESC },
};

const btn = "inline-flex min-h-[52px] items-center justify-center rounded-lg px-7 text-[16px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep";

const STEPS = [
  ["Placement check", "A short check finds the right level to begin at. Nothing is skipped for good: earlier levels stay open and a Foundation Check makes sure they are secure."],
  ["Learn, Understand, Practise", "Each module teaches one method, explains why it works, then gives you graded practice that gets harder as you go."],
  ["Timed drills", "Sixty seconds of questions at your level train speed. Your own speed is compared only with your own earlier results."],
  ["Level Assessment", "Pass a cumulative assessment to open the next level. If a skill lets you down, you get revision on that skill, not the whole level again."],
  ["Daily review", "Skills you have mastered come back at widening gaps, so what you learn stays learned."],
];

const FAQ: Array<[string, string]> = [
  ["Do I have to pay to try it?", "No. Enrolling, the placement check and Level A, Module 1 are free. The full course opens all 15 levels with a single payment."],
  ["Is the course the same in every country?", "Yes. The levels, the order and the standard are identical for everyone. Your country, age and language only change the examples, such as the currency and names in word problems."],
  ["What if I already know the basics?", "Take the placement check. It recommends a level to begin at. You can still start earlier, and the levels you pass over stay open for you to study."],
  ["How is it different from a normal worksheet?", "Every question is made fresh at the right difficulty for you, marked instantly, and timed. Easy questions never count as mastery, and slow answers are tracked separately from wrong ones."],
  ["What do I need?", "A phone, tablet or computer. The practice screen works with the keyboard alone: type the answer and press Enter."],
];

export default async function MathSpeedLanding() {
  const me = await currentViewer();
  const enrolled = me && me.role === "student" && databaseConfigured() ? await getEnrolment(me.id) : null;
  const fee = databaseConfigured() ? await courseFeeNow().catch(() => null) : null;
  const sample: ClientQuestion[] = ["add-single", "number-bonds", "doubles-halves", "sub-single", "mental-basic"].map((id, i) => {
    const q = buildQuestion(id, 3 + (i % 2), 40 + i, DEFAULT_CTX);
    return { prompt: q.prompt, kind: q.kind, options: q.options, unit: q.unit, allowedMs: q.allowedMs, answer: q.answer, tol: q.tol, lowest: q.lowest, working: q.working };
  });
  const open = LEVELS.filter((l) => l.authored).length;
  const jsonld = {
    "@context": "https://schema.org",
    "@type": "Course",
    name: COURSE_TITLE,
    description: DESC,
    url: `${SITE_URL}/math-speed`,
    provider: { "@type": "Organization", name: "GrowQR", url: SITE_URL },
    educationalLevel: "Beginner to advanced",
    inLanguage: "en",
    hasCourseInstance: { "@type": "CourseInstance", courseMode: "online", courseWorkload: "PT10M per day" },
    ...(fee ? { offers: { "@type": "Offer", category: "Paid", price: String(fee.amountMinor / 100), priceCurrency: "INR", url: `${SITE_URL}/math-speed` } } : {}),
  };
  const faqLd = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) };
  const cta = enrolled ? { href: "/math-speed/journey", label: "Continue my learning journey" } : { href: "/math-speed/enrol", label: "Start free: Level A, Module 1" };

  return (
    <MarketShell user={me} active="courses">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonld) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <header className="max-w-3xl">
        <p className="text-[13px] font-semibold uppercase tracking-wider text-orange-deep">One course · 15 levels · A to O</p>
        <h1 className="mt-2 text-[clamp(1.9rem,4.5vw,2.9rem)] font-bold leading-tight text-ink">Mathematics Speed Enhancement Studio</h1>
        <p className="mt-3 text-[18px] leading-relaxed text-ink-2">Become faster and more accurate at calculating in your head and on paper. Start from the very beginning, or find your level with a short placement check, and climb one level at a time.</p>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <Link href={cta.href} className={`${btn} bg-orange text-white hover:bg-orange-dark`}>{cta.label}</Link>
          <a href="#try" className="text-[15px] font-medium underline">Try five questions now</a>
        </div>
        <p className="mt-3 text-[14px] text-ink-3">{fee ? `The full course is ₹${(fee.amountMinor / 100).toLocaleString("en-IN")}, paid once. ` : ""}Level A, Module 1 is free.{open < LEVELS.length ? ` ${open} of ${LEVELS.length} levels are open today; the rest open as their lessons are finished.` : ""}</p>
      </header>

      <section className="mt-12" aria-labelledby="how">
        <h2 id="how" className="text-[24px] font-bold text-ink">How it works</h2>
        <ol className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {STEPS.map(([t, d], i) => (
            <li key={t} className="rounded-2xl border border-black/[0.08] bg-white p-5 shadow-card"><span className="grid h-8 w-8 place-items-center rounded-full bg-orange-light text-[14px] font-bold text-orange-deep" aria-hidden>{i + 1}</span><h3 className="mt-2 text-[17px] font-semibold text-ink">{t}</h3><p className="mt-1 text-[14.5px] text-ink-3">{d}</p></li>
          ))}
        </ol>
      </section>

      <section id="try" className="mt-12 scroll-mt-28" aria-labelledby="try-h">
        <h2 id="try-h" className="text-[24px] font-bold text-ink">Try the practice screen</h2>
        <p className="mb-4 mt-1 text-[15px] text-ink-3">Five quick questions. Type an answer and press Enter. Nothing is saved.</p>
        <DrillRunner title="Try five questions" sessionId="sample" csrf="" questions={sample} seconds={0} feedback mode="sample" intro={["No sign-up needed.", "This is the same screen you use in the course."]} after={<Link href={cta.href} className={`${btn} bg-orange text-white hover:bg-orange-dark`}>{cta.label}</Link>} />
      </section>

      <section className="mt-12" aria-labelledby="levels">
        <h2 id="levels" className="text-[24px] font-bold text-ink">The 15 levels</h2>
        <p className="mt-1 max-w-2xl text-[15px] text-ink-3">Each level has 8 to 13 modules, a cumulative assessment, and builds on the one before. Questions inside every level get harder as you improve.</p>
        <ol className="mt-4 grid gap-3 md:grid-cols-2">
          {LEVELS.map((l) => (
            <li key={l.letter} className="flex gap-4 rounded-2xl border border-black/[0.08] bg-white p-4 shadow-card">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-cream-3 text-[20px] font-bold text-ink" aria-hidden>{l.letter}</span>
              <div>
                <h3 className="text-[16px] font-semibold text-ink">Level {l.letter}: {l.title} <span className="ml-1 align-middle rounded-full bg-cream-3 px-2 py-0.5 text-[11.5px] font-semibold text-ink-3">{l.authored ? "Open" : "Opens soon"}</span></h3>
                <p className="mt-0.5 text-[13.5px] text-ink-3">{l.modules.length} modules · {l.topics.slice(0, 4).join(", ")}{l.topics.length > 4 ? " and more" : ""}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-12 max-w-3xl" aria-labelledby="faq">
        <h2 id="faq" className="text-[24px] font-bold text-ink">Questions</h2>
        <div className="mt-3 divide-y divide-black/[0.08] rounded-2xl border border-black/[0.08] bg-white shadow-card">
          {FAQ.map(([q, a]) => <details key={q} className="group p-4"><summary className="cursor-pointer text-[16px] font-semibold text-ink">{q}</summary><p className="mt-2 text-[15px] text-ink-2">{a}</p></details>)}
        </div>
        <div className="mt-8"><Link href={cta.href} className={`${btn} bg-orange text-white hover:bg-orange-dark`}>{cta.label}</Link></div>
      </section>
    </MarketShell>
  );
}
