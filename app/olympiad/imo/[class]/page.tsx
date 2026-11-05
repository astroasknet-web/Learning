import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MarketShell } from "@/components/market/shell";
import ImoThumb from "@/components/lms/ImoThumb";
import ImoPaywall from "@/components/lms/ImoPaywall";
import { imoAccess } from "@/lib/lms/imo-access";
import { CLASSES, IMO_SECTIONS, classNumber, isClass, sectionLabel, subject } from "@/lib/lms/school";

type P = { params: Promise<{ class: string }> };
const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9-]/g, "");

export const dynamic = "force-dynamic"; // what the visitor can open depends on what they bought

export function generateStaticParams() { return CLASSES.filter((c) => subject(c, "imo")).map((c) => ({ class: c })); }

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const c = clean((await params).class);
  const s = isClass(c) ? subject(c, "imo") : null;
  if (!s) return { title: "Class not found | GrowQR", robots: { index: false, follow: true } };
  return { title: `Class ${classNumber(c)} Maths Olympiad (IMO): ${s.chapters.length} Chapters and Mock Tests | GrowQR`, description: `Class ${classNumber(c)} IMO preparation: ${s.chapters.length} chapters with lessons and tests, plus full-syllabus mock tests.`, alternates: { canonical: `/olympiad/imo/${c}` } };
}

export default async function ImoClass({ params }: P) {
  const c = clean((await params).class);
  const s = isClass(c) ? subject(c, "imo") : null;
  if (!s) notFound();
  const access = await imoAccess(c);
  const open = access.open;
  const bp = s.fullTest?.blueprint;
  return (
    <MarketShell user={null} active="courses">
      <nav aria-label="Breadcrumb" className="mb-4 text-[13px] text-ink-3"><Link href="/exam-prep" className="underline">Exam prep</Link> / <Link href="/olympiad/imo" className="underline">Maths Olympiad</Link> / Class {classNumber(c)}</nav>
      <h1 className="text-[26px] font-bold leading-tight tracking-tight text-ink sm:text-[34px]">Class {classNumber(c)} Maths Olympiad</h1>
      <p className="mt-2 max-w-3xl text-[16px] text-ink-3">{s.chapters.length} chapters with lessons and tests, and full-syllabus mock tests.</p>
      <div className="mt-5 grid items-start gap-6 lg:grid-cols-[minmax(0,480px)_minmax(0,1fr)]">
        <ImoThumb cls={classNumber(c)} priority full className="aspect-video w-full rounded-2xl shadow-card" />
        {!open ? <ImoPaywall cls={classNumber(c)} access={access} chapters={s.chapters.length} minutes={s.fullTest?.time_limit_minutes} /> : null}
      </div>

      <section className="mt-6 rounded-2xl border border-black/[0.08] bg-white p-5 shadow-card" aria-label="Full mock test">
        <h2 className="text-[19px] font-bold text-ink">Full-syllabus mock test</h2>
        <p className="mt-1 text-[14.5px] text-ink-3">{s.fullTest?.time_limit_minutes ?? 40} minutes. A new set of questions each time, drawn from every chapter.</p>
        {bp ? <ul className="mt-3 flex flex-wrap gap-2 text-[13px]">{IMO_SECTIONS.filter((x) => bp[x.key]).map((x) => <li key={x.key} className="rounded-full bg-cream-3 px-3 py-1 text-ink-2">{x.label}: {bp[x.key]}</li>)}</ul> : null}
        <p className="mt-2 text-[13px] text-ink-4">Marking: 1 mark for each question, 3 marks for the Achievers Section. No negative marking.</p>
        {open ? <Link href={`/olympiad/imo/${c}/mock`} className="mt-4 inline-flex min-h-[46px] items-center rounded-lg bg-orange-deep px-6 text-[15px] font-semibold text-white hover:bg-ink">Take the mock test</Link> : <p className="mt-4 text-[14px] font-semibold text-ink-3">Included when you buy Class {classNumber(c)}.</p>}
      </section>

      <h2 className="mt-8 text-[20px] font-bold text-ink">Chapters</h2>
      <ol className="mt-3 grid gap-3 sm:grid-cols-2">
        {s.chapters.map((ch) => {
          const inner = (
            <>
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-ink text-[15px] font-bold text-white" aria-hidden>{ch.number}</span>
              <span><b className="block text-[15px] text-ink">{ch.title}</b><span className="mt-1 block text-[12px] text-ink-4">{ch.topics.length} topics{ch.online ? ` · ${ch.online}-question test` : ""}</span></span>
            </>
          );
          return <li key={ch.slug}>{open ? <Link href={`/school/${c}/imo/${ch.slug}`} className="flex h-full gap-4 rounded-xl border border-black/[0.08] bg-white p-4 transition hover:border-orange">{inner}</Link> : <div className="flex h-full gap-4 rounded-xl border border-black/[0.08] bg-white/70 p-4">{inner}</div>}</li>;
        })}
      </ol>
      <p className="mt-6 text-[13px] text-ink-4">Sections in the mock: {IMO_SECTIONS.map((x) => sectionLabel(x.key)).join(", ")}.</p>
    </MarketShell>
  );
}
