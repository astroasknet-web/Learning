import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MarketShell, currentViewer } from "@/components/market/shell";
import MockTest, { type MockSec } from "@/components/lms/MockTest";
import { loadExam, testSections } from "@/lib/lms/exams";
import ExamLocked from "@/components/lms/ExamLocked";
import { lockedExam } from "@/lib/lms/exam-access";
import { examForExamSlug } from "@/lib/lms/exam-products";
import { mapExamTopic } from "@/lib/mathstudio/adapters/exam";
import { getSession } from "@/lib/portal/session";

export const dynamic = "force-dynamic"; // what the visitor can open depends on what they bought

type P = { params: Promise<{ slug: string; paper: string }> };
const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9-]/g, "");

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const p = await params;
  const d = loadExam(clean(p.slug));
  const t = d?.tests.find((x) => x.key === clean(p.paper));
  if (!d || !t) return { title: "Test not found | GrowQR", robots: { index: false, follow: true } };
  return { title: `${d.raw.meta.name} ${t.name}: Online Mock Test | GrowQR`, description: `${t.questions} questions, ${t.marks} marks, ${t.minutes} minutes. ${t.marking} Worked explanations after you submit.`.slice(0, 160), alternates: { canonical: `/exam/${d.slug}/test/${t.key}` } };
}

export default async function ExamTestPage({ params }: P) {
  const p = await params;
  const d = loadExam(clean(p.slug));
  const data = d ? testSections(d, clean(p.paper)) : null;
  if (!d || !data) notFound();
  const lock = await lockedExam(examForExamSlug(d.slug));
  if (lock) return <ExamLocked access={lock} title={`${d.raw.meta.name}: ${data.test.name}`} back={{ href: `/exam/${d.slug}`, label: d.raw.meta.name }} />;
  const { test, sections } = data;
  const me = await currentViewer();
  const tagged: MockSec[] = sections.map((s) => ({ ...s, questions: s.questions.map((q) => ({ ...q, studioTopic: mapExamTopic(q.section ?? s.title, q.topic, false), difficulty: 3 })) }));
  const student = me && me.role === "student";
  const studio = student ? { source: d.slug, sourceRef: test.key, label: `${d.raw.meta.name}: ${test.name}`, csrf: (await getSession())?.csrf ?? "" } : null;
  return (
    <MarketShell user={me} active="courses">
      <nav aria-label="Breadcrumb" className="mb-4 text-[13px] text-ink-3"><Link href="/exam-prep" className="underline">Exam prep</Link> / <Link href={`/exam/${d.slug}`} className="underline">{d.raw.meta.name}</Link> / {test.name}</nav>
      <MockTest id={`exam-${d.slug}-${test.key}`} title={`${d.raw.meta.name}: ${test.name}`} level={test.role} minutes={test.minutes} sections={tagged} marking={test.marking} note={test.note} studio={studio} />
      {student ? <p className="mt-4 text-[13px] text-ink-3">The mathematics questions in this mock feed your <Link href="/math-studio/dashboard" className="underline">Mathematics Studio</Link> when you finish.</p> : null}
    </MarketShell>
  );
}
