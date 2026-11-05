import type { Metadata } from "next";
import Link from "next/link";
import { MarketShell } from "@/components/market/shell";
import { SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Free IELTS and GRE Practice Tests | GrowQR",
  description: "Timed IELTS Reading, IELTS Listening and GRE Quant practice tests, marked instantly with a score and an explanation for every answer.",
  alternates: { canonical: `${SITE_URL}/practice-tests` },
  robots: { index: true, follow: true },
};

const TESTS = [
  { href: "/practice-tests/ielts-reading", title: "IELTS Academic Reading", meta: "30 full tests · 40 questions · 60 minutes", text: "Three passages per test with matching headings, True/False/Not Given, multiple choice and completion questions." },
  { href: "/practice-tests/ielts-listening", title: "IELTS Listening", meta: "30 full tests · 40 questions · 40 minutes", text: "Four sections voiced by your browser, played once, with the same question types as the real exam." },
  { href: "/practice-tests/gre-quant", title: "GRE Quantitative Reasoning", meta: "30 full tests · 27 questions · 47 minutes", text: "Each test covers all 26 syllabus topics, from number properties to data interpretation, with no repeated questions between tests." },
];

export default function PracticeTestsPage() {
  return (
    <MarketShell user={null} active="courses">
      <p className="mb-3 rounded-xl border border-black/[0.08] bg-orange-lighter px-4 py-3 text-[14px] text-ink-2">IELTS Reading is a track of the <Link href="/reading-studio" className="font-semibold underline">English Reading Studio</Link>, together with a reading-skills pathway and essay tests for SSC, CDS, CAT, UPSC and CTET. Your results sit in one dashboard.</p>
      <h1 className="text-[28px] sm:text-[34px] font-bold text-ink tracking-tight">Practice tests</h1>
      <p className="text-[16px] text-ink-3 mt-1 max-w-2xl">Sit a full timed test, get a score and a band straight away, and see why every wrong answer was wrong. Log in as a student to keep your results.</p>
      <ul className="grid md:grid-cols-2 gap-4 mt-6">
        {TESTS.map((t) => (
          <li key={t.href} className="bg-white rounded-2xl border border-black/[0.08] shadow-card p-5">
            <h2 className="text-[20px] font-bold text-ink"><Link href={t.href} className="hover:underline">{t.title}</Link></h2>
            <p className="text-[13px] text-ink-3 mt-1">{t.meta}</p>
            <p className="text-[15px] text-ink-2 mt-2">{t.text}</p>
            <Link href={t.href} className="inline-flex items-center min-h-[44px] mt-3 px-5 rounded-lg bg-orange-deep hover:bg-ink text-white font-semibold text-[14px]">Choose a test</Link>
          </li>
        ))}
      </ul>
      <p className="text-[13px] text-ink-3 mt-6">IELTS bands and GRE scores are indicative estimates: the real conversions differ between test versions. IELTS and GRE are trademarks of their owners, and these are independent practice materials.</p>
    </MarketShell>
  );
}
