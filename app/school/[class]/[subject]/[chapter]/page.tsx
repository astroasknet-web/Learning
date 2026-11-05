import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MarketShell } from "@/components/market/shell";
import SchoolChapter from "@/components/lms/SchoolChapter";
import ImoPaywall from "@/components/lms/ImoPaywall";
import { imoAccess } from "@/lib/lms/imo-access";
import { chapter, classNumber, isClass, subject } from "@/lib/lms/school";

export const dynamic = "force-dynamic"; // Maths Olympiad chapters open only for a buyer of that class

type P = { params: Promise<{ class: string; subject: string; chapter: string }> };
const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9-]/g, "");

async function load(params: P["params"]) {
  const p = await params;
  const cls = clean(p.class);
  const sub = isClass(cls) ? subject(cls, clean(p.subject)) : null;
  const ch = sub ? chapter(cls, sub.subject, clean(p.chapter)) : null;
  return { sub, ch };
}

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { sub, ch } = await load(params);
  if (!sub || !ch) return { title: "Chapter not found | GrowQR", robots: { index: false, follow: true } };
  const title = `${ch.title}: Class ${classNumber(sub.class)} ${sub.label} Lesson | GrowQR`;
  return { title: title.length > 72 ? `${ch.title}: Class ${classNumber(sub.class)} ${sub.label} | GrowQR` : title, description: ch.description || `${ch.title}: lessons, worked examples, quizzes and a chapter test for Class ${classNumber(sub.class)} ${sub.label}.`, alternates: { canonical: `/school/${sub.class}/${sub.subject}/${ch.slug}` } };
}

export default async function ChapterPage({ params }: P) {
  const { sub, ch } = await load(params);
  if (!sub || !ch) notFound();
  const locked = sub.subject === "imo" ? await imoAccess(sub.class).then((a) => (a.open ? null : a)) : null;
  const base = `/school/${sub.class}/${sub.subject}/${ch.slug}`;
  const pos = sub.chapters.findIndex((c) => c.slug === ch.slug);
  const prev = sub.chapters[pos - 1];
  const next = sub.chapters[pos + 1];
  return (
    <MarketShell user={null} active="courses">
      <nav aria-label="Breadcrumb" className="mb-4 text-[13px] text-ink-3"><Link href="/school" className="underline">School</Link> / <Link href={`/school/${sub.class}`} className="underline">Class {classNumber(sub.class)}</Link> / <Link href={`/school/${sub.class}/${sub.subject}`} className="underline">{sub.label}</Link> / Chapter {ch.number}</nav>
      <h1 className="text-[26px] font-bold leading-tight tracking-tight text-ink sm:text-[34px]">{ch.title}</h1>
      <p className="mt-1 text-[14.5px] text-ink-3">Class {classNumber(sub.class)} · {sub.label}{ch.level ? ` · ${ch.level}` : ""}{ch.estTime ? ` · ${ch.estTime}` : ""}</p>
      {locked ? <div className="mt-6"><ImoPaywall cls={classNumber(sub.class)} access={locked} chapters={sub.chapters.length} minutes={sub.fullTest?.time_limit_minutes} /></div> : <div className="mt-6 grid items-start gap-6 lg:grid-cols-[15rem_1fr]">
        <aside aria-label="In this chapter" className="rounded-2xl border border-black/[0.08] bg-white p-4 text-[14px] lg:sticky lg:top-24">
          <h2 className="text-[14px] font-bold text-ink">In this chapter</h2>
          <ul className="mt-2 space-y-1.5">
            {ch.topics.map((t, i) => <li key={i}><a href={`#t${i + 1}`} className="text-ink-3 hover:text-orange-deep hover:underline">{t.title}</a></li>)}
            {ch.tests.online || ch.tests.imo ? <li><a href="#tests" className="font-semibold text-orange-deep underline">Tests</a></li> : null}
          </ul>
        </aside>
        <div className="min-w-0 space-y-6">
          <SchoolChapter c={ch} base={base} />
          <nav aria-label="Chapters" className="flex flex-wrap justify-between gap-3 border-t border-black/10 pt-5 text-[14px]">
            {prev ? <Link href={`/school/${sub.class}/${sub.subject}/${prev.slug}`} className="font-semibold text-orange-deep underline">← {prev.title}</Link> : <span />}
            {next ? <Link href={`/school/${sub.class}/${sub.subject}/${next.slug}`} className="font-semibold text-orange-deep underline">{next.title} →</Link> : null}
          </nav>
        </div>
      </div>}
    </MarketShell>
  );
}
