import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MarketShell, currentViewer } from "@/components/market/shell";
import MockTest, { type MockSec } from "@/components/lms/MockTest";
import { render } from "@/lib/lms/content";
import ImoPaywall from "@/components/lms/ImoPaywall";
import { imoAccess } from "@/lib/lms/imo-access";
import { IMO_SECTIONS, assembleImoMock, subject, classNumber, isClass, sectionLabel } from "@/lib/lms/school";
import { mapExamTopic } from "@/lib/mathstudio/adapters/exam";
import { getSession } from "@/lib/portal/session";

export const dynamic = "force-dynamic"; // a fresh set of questions on every visit

type P = { params: Promise<{ class: string }> };
const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9-]/g, "");

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const c = clean((await params).class);
  if (!isClass(c)) return { title: "Test not found | GrowQR", robots: { index: false, follow: true } };
  return { title: `Class ${classNumber(c)} IMO Mock Test: Maths Olympiad Test | GrowQR`, description: `A full-syllabus Class ${classNumber(c)} Maths Olympiad mock test, sectioned like the real olympiad, with worked explanations.`, alternates: { canonical: `/olympiad/imo/${c}/mock` } };
}

export default async function ImoMock({ params }: P) {
  const c = clean((await params).class);
  if (!isClass(c) || !subject(c, "imo")) notFound();
  const access = await imoAccess(c);
  if (!access.open) {
    // Locked: the questions are never assembled or sent, only the purchase card.
    return (
      <MarketShell user={null} active="courses">
        <nav aria-label="Breadcrumb" className="mb-4 text-[13px] text-ink-3"><Link href="/olympiad/imo" className="underline">Maths Olympiad</Link> / <Link href={`/olympiad/imo/${c}`} className="underline">Class {classNumber(c)}</Link> / Mock test</nav>
        <h1 className="mb-6 text-[26px] font-bold text-ink">Class {classNumber(c)} IMO mock test</h1>
        <ImoPaywall cls={classNumber(c)} access={access} chapters={subject(c, "imo")!.chapters.length} minutes={subject(c, "imo")!.fullTest?.time_limit_minutes} />
      </MarketShell>
    );
  }
  const mock = assembleImoMock(c);
  if (!mock || !mock.questions.length) notFound();
  const sections: MockSec[] = IMO_SECTIONS.map((s) => ({
    type: "mcq",
    title: sectionLabel(s.key),
    questions: mock.questions.filter((q) => q.section === s.key).map((q) => ({
      q: render(q.q) + (q.diagram ? `<div class="mt-2">${render(q.diagram)}</div>` : ""),
      options: q.options.map((o) => render(o)),
      correct: q.correct,
      explanation: render(q.explanation),
      marks: mock.marks[s.key] ?? mock.marks.default ?? 1,
      neg: 0,
      studioTopic: mapExamTopic(s.key, undefined, true),
      difficulty: s.key === "achievers" ? 4 : 3,
    })),
  })).filter((s) => s.questions.length);
  const me = await currentViewer();
  const studio = me && me.role === "student" ? { source: `imo-${c}`, sourceRef: "mock", label: `Class ${classNumber(c)} IMO mock test`, csrf: (await getSession())?.csrf ?? "" } : null;
  return (
    <MarketShell user={me} active="courses">
      <nav aria-label="Breadcrumb" className="mb-4 text-[13px] text-ink-3"><Link href="/olympiad/imo" className="underline">Maths Olympiad</Link> / <Link href={`/olympiad/imo/${c}`} className="underline">Class {classNumber(c)}</Link> / Mock test</nav>
      <MockTest id={`imo-${c}-mock`} title={`Class ${classNumber(c)} IMO mock test`} level="Full syllabus" minutes={mock.minutes} sections={sections} marking="1 mark for each question, 3 marks in the Achievers Section. No negative marking." studio={studio} />
      {me && me.role === "student" ? <p className="mt-4 text-[13px] text-ink-3">This mock feeds your <Link href="/math-studio/dashboard" className="underline">Mathematics Studio</Link> when you finish.</p> : null}
    </MarketShell>
  );
}
