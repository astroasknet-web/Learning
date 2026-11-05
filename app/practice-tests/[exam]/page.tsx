import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { currentViewer, MarketShell } from "@/components/market/shell";
import { databaseConfigured } from "@/lib/portal/db";
import * as attempts from "@/lib/tests/attempts";
import * as ielts from "@/lib/tests/ielts";
import { GreList } from "@/components/tests/GreTest";
import { SITE_URL } from "@/lib/seo";
import { ieltsLimit } from "@/lib/tests/access";
import { FREE_IELTS_TESTS } from "@/lib/market/plan-services";

export const dynamic = "force-dynamic";
const kindOf = (exam: string): ielts.Kind | null => {
  const k = exam.replace(/^ielts-/, "");
  return exam.startsWith("ielts-") && ielts.isKind(k) ? k : null;
};
const LABEL = { reading: "IELTS Academic Reading", listening: "IELTS Listening" } as const;

export async function generateMetadata({ params }: { params: Promise<{ exam: string }> }): Promise<Metadata> {
  const exam = (await params).exam;
  if (exam === "gre-quant") return { title: "GRE Quant Practice Tests (30 Free Tests) | GrowQR", description: "Thirty timed GRE Quantitative Reasoning practice tests covering all 26 topics, marked instantly with an explanation for every question.", alternates: { canonical: `${SITE_URL}/practice-tests/gre-quant` }, robots: { index: true, follow: true } };
  const kind = kindOf(exam);
  if (!kind) return { title: "Practice tests | GrowQR", robots: { index: false, follow: true } };
  return {
    title: `${LABEL[kind]} Practice Tests (30 Tests, First 3 Free) | GrowQR`,
    description: `Thirty full ${LABEL[kind]} practice tests, the first three free, with timed marking, an indicative band score and explanations for every answer.`,
    alternates: { canonical: `${SITE_URL}/practice-tests/ielts-${kind}` },
    robots: { index: true, follow: true },
  };
}

export default async function ExamListPage({ params }: { params: Promise<{ exam: string }> }) {
  const exam = (await params).exam;
  const me = await currentViewer();
  if (exam === "gre-quant") {
    const bestG = me?.role === "student" && databaseConfigured() ? await attempts.bestByTest(me.id, exam) : new Map<number, attempts.Attempt>();
    return <GreList user={me} best={bestG} />;
  }
  const kind = kindOf(exam);
  if (!kind) notFound();
  const best = me?.role === "student" && databaseConfigured() ? await attempts.bestByTest(me.id, exam) : new Map<number, attempts.Attempt>();
  const tests = ielts.list(kind);
  const limit = await ieltsLimit(me?.role === "student" ? me.id : null);
  return (
    <MarketShell user={me} active="courses">
      <nav aria-label="Breadcrumb" className="text-[13px] text-ink-3 mb-4"><Link href="/practice-tests" className="underline">Practice tests</Link> / {LABEL[kind]}</nav>
      <h1 className="text-[28px] sm:text-[34px] font-bold text-ink tracking-tight">{LABEL[kind]} practice tests</h1>
      <p className="text-[16px] text-ink-3 mt-1 max-w-2xl">{ielts.QUESTIONS} questions in {ielts.MINUTES[kind]} minutes, marked on the server. {me?.role === "student" ? "Your best score is shown on each test." : "Log in as a student to keep your scores."}</p>
      <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
        {tests.map((t) => {
          const b = best.get(t.n);
          return (
            <li key={t.n} className="bg-white rounded-2xl border border-black/[0.08] shadow-card p-4">
              <p className="text-[12px] text-ink-3">Test {t.n} · {t.level}{t.n > limit ? <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">Locked</span> : t.n <= FREE_IELTS_TESTS ? <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">Free</span> : null}</p>
              <h2 className="text-[16px] font-semibold text-ink leading-snug mt-0.5"><Link href={`/practice-tests/${exam}/${t.n}`} className="hover:underline">{t.title.replace(/^IELTS (Academic )?/, "")}</Link></h2>
              <p className="text-[13px] text-ink-3 mt-1 line-clamp-2">{t.topics.join(" · ")}</p>
              {b ? <p className="text-[13px] mt-2 font-semibold text-emerald-800">Best: {b.raw}/{b.total}{b.band != null ? ` · band ${b.band.toFixed(1)}` : ""}</p> : null}
            </li>
          );
        })}
      </ul>
    </MarketShell>
  );
}
