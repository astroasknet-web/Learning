import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MarketShell } from "@/components/market/shell";
import { classNumber, isClass, subject } from "@/lib/lms/school";

type P = { params: Promise<{ class: string; subject: string }> };
const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9-]/g, "");

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const p = await params;
  const s = subject(clean(p.class), clean(p.subject));
  if (!s) return { title: "Subject not found | GrowQR", robots: { index: false, follow: true } };
  return { title: `Class ${classNumber(s.class)} ${s.label}: ${s.chapters.length} ${s.subject === "imo" ? "" : "Free "}Chapters | GrowQR`, description: s.description || `Class ${classNumber(s.class)} ${s.label}: lessons, worked examples, quizzes and chapter tests.`, alternates: { canonical: `/school/${s.class}/${s.subject}` } };
}

export default async function SubjectPage({ params }: P) {
  const p = await params;
  const cls = clean(p.class);
  const s = isClass(cls) ? subject(cls, clean(p.subject)) : null;
  if (!s) notFound();
  return (
    <MarketShell user={null} active="courses">
      <nav aria-label="Breadcrumb" className="mb-4 text-[13px] text-ink-3"><Link href="/school" className="underline">School</Link> / <Link href={`/school/${s.class}`} className="underline">Class {classNumber(s.class)}</Link> / {s.label}</nav>
      <h1 className="text-[26px] font-bold leading-tight tracking-tight text-ink sm:text-[34px]">Class {classNumber(s.class)}: {s.label}</h1>
      {s.description ? <p className="mt-2 max-w-3xl text-[16px] text-ink-3">{s.description}</p> : null}
      <ol className="mt-6 grid gap-3 sm:grid-cols-2">
        {s.chapters.map((c) => (
          <li key={c.slug}>
            <Link href={`/school/${s.class}/${s.subject}/${c.slug}`} className="flex h-full gap-4 rounded-xl border border-black/[0.08] bg-white p-4 transition hover:border-orange">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-ink text-[15px] font-bold text-white" style={c.color ? { background: c.color } : undefined} aria-hidden>{c.number}</span>
              <span><b className="block text-[15px] text-ink">{c.title}</b><span className="mt-0.5 block text-[13px] leading-snug text-ink-3">{c.topics.slice(0, 3).join(" · ")}</span><span className="mt-1.5 block text-[12px] text-ink-4">{c.topics.length} topics{c.online ? ` · ${c.online}-question test` : ""}</span></span>
            </Link>
          </li>
        ))}
      </ol>
    </MarketShell>
  );
}
