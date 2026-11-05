import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MarketShell } from "@/components/market/shell";
import MockTest from "@/components/lms/MockTest";
import { render } from "@/lib/lms/content";
import ImoPaywall from "@/components/lms/ImoPaywall";
import { imoAccess } from "@/lib/lms/imo-access";
import { chapter, classNumber, isClass, subject } from "@/lib/lms/school";

export const dynamic = "force-dynamic"; // Maths Olympiad tests open only for a buyer of that class

type P = { params: Promise<{ class: string; subject: string; chapter: string; kind: string }> };
const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9-]/g, "");

async function load(params: P["params"]) {
  const p = await params;
  const cls = clean(p.class);
  const sub = isClass(cls) ? subject(cls, clean(p.subject)) : null;
  const ch = sub ? chapter(cls, sub.subject, clean(p.chapter)) : null;
  const kind = clean(p.kind);
  const t = ch ? (kind === "online" ? ch.tests.online : kind === "imo" ? ch.tests.imo : undefined) : undefined;
  return { sub, ch, t, kind };
}

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { sub, ch, t, kind } = await load(params);
  if (!sub || !ch || !t) return { title: "Test not found | GrowQR", robots: { index: false, follow: true } };
  return { title: `${ch.title} ${kind === "imo" ? "Olympiad Test" : "Chapter Test"}: Class ${classNumber(sub.class)} ${sub.label} | GrowQR`, description: `${t.questions.length} questions, ${t.minutes} minutes, with worked explanations.`, robots: { index: true, follow: true } };
}

export default async function SchoolTestPage({ params }: P) {
  const { sub, ch, t, kind } = await load(params);
  if (!sub || !ch || !t) notFound();
  if (sub.subject === "imo") {
    const access = await imoAccess(sub.class);
    if (!access.open) {
      // Locked: the questions are never rendered or sent, only the purchase card.
      return (
        <MarketShell user={null} active="courses">
          <nav aria-label="Breadcrumb" className="mb-4 text-[13px] text-ink-3"><Link href={`/olympiad/imo/${sub.class}`} className="underline">Class {classNumber(sub.class)} Maths Olympiad</Link> / {ch.title}</nav>
          <h1 className="mb-6 text-[26px] font-bold text-ink">{ch.title}: test</h1>
          <ImoPaywall cls={classNumber(sub.class)} access={access} chapters={sub.chapters.length} minutes={sub.fullTest?.time_limit_minutes} />
        </MarketShell>
      );
    }
  }
  const sections = [{ type: "mcq", title: kind === "imo" ? "Olympiad-style questions" : "Questions", questions: t.questions.map((q) => ({ q: render(q.q) + (q.diagram ? `<div class="mt-2">${render(q.diagram)}</div>` : ""), options: q.options.map((o) => render(o)), correct: q.correct, explanation: render(q.explanation) })) }];
  return (
    <MarketShell user={null} active="courses">
      <nav aria-label="Breadcrumb" className="mb-4 text-[13px] text-ink-3"><Link href={`/school/${sub.class}/${sub.subject}`} className="underline">Class {classNumber(sub.class)} {sub.label}</Link> / <Link href={`/school/${sub.class}/${sub.subject}/${ch.slug}#tests`} className="underline">{ch.title}</Link></nav>
      <MockTest id={`school-${sub.class}-${sub.subject}-${ch.slug}-${kind}`} title={`${ch.title}: ${kind === "imo" ? "Olympiad-style test" : "Chapter test"}`} level={`Class ${classNumber(sub.class)} · ${sub.label}`} minutes={t.minutes} sections={sections} />
    </MarketShell>
  );
}
