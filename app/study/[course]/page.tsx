import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MarketShell } from "@/components/market/shell";
import { STUDY_KEYS, chapterCount, studyIndex } from "@/lib/lms/study";
import ExamBuyStrip from "@/components/lms/ExamBuyStrip";
import { examForStudy } from "@/lib/lms/exam-products";

export const dynamic = "force-dynamic"; // the purchase strip depends on the visitor

type P = { params: Promise<{ course: string }> };
const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9-]/g, "");

export function generateStaticParams() { return STUDY_KEYS.map((course) => ({ course })); }

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const c = studyIndex(clean((await params).course));
  if (!c) return { title: "Course not found | GrowQR", robots: { index: false, follow: true } };
  return { title: `${c.title}: Course, ${chapterCount(c)} Chapters | GrowQR`, description: c.blurb, alternates: { canonical: `/study/${c.key}` } };
}

export default async function StudyCourse({ params }: P) {
  const c = studyIndex(clean((await params).course));
  if (!c) notFound();
  return (
    <MarketShell user={null} active="courses">
      <nav aria-label="Breadcrumb" className="mb-4 text-[13px] text-ink-3"><Link href="/" className="underline">Home</Link> / <Link href="/study" className="underline">Study courses</Link> / {c.title}</nav>
      <p className="text-[0.74rem] font-bold uppercase tracking-wider text-orange-dark">{c.kind}</p>
      <h1 className="mt-1 text-[26px] font-bold leading-tight tracking-tight text-ink sm:text-[34px]">{c.title}</h1>
      <p className="mt-2 max-w-3xl text-[16px] text-ink-3">{c.blurb}</p>
      {examForStudy(c.key) ? <ExamBuyStrip examKey={examForStudy(c.key)!} /> : null}
      <div className="mt-8 space-y-9">
        {c.modules.map((m) => (
          <section key={m.number} aria-label={m.title}>
            <h2 className="text-[20px] font-bold text-ink">Module {m.number}: {m.title}</h2>
            {m.summary ? <p className="mt-1 max-w-3xl text-[14.5px] text-ink-3">{m.summary}</p> : null}
            <ol className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {m.chapters.map((ch) => (
                <li key={ch.slug}><Link href={`/study/${c.key}/${ch.slug}`} className="block h-full rounded-xl border border-black/[0.08] bg-white p-4 transition hover:border-orange">
                  <span className="text-[12px] text-ink-4">Chapter {ch.number}</span><b className="mt-0.5 block text-[15px] text-ink">{ch.title}</b>
                  {ch.topics.length ? <span className="mt-1 block text-[12.5px] leading-snug text-ink-3">{ch.topics.slice(0, 3).join(" · ")}{ch.topics.length > 3 ? ` · +${ch.topics.length - 3} more` : ""}</span> : null}
                </Link></li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </MarketShell>
  );
}
