import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { currentViewer, MarketShell } from "@/components/market/shell";
import QuestionGroups from "@/components/tests/QuestionGroups";
import { Countdown, ListeningPlayer } from "@/components/tests/TestClient";
import { cleanHtml } from "@/lib/market/lessons";
import * as ielts from "@/lib/tests/ielts";
import * as gre from "@/lib/tests/gre";
import { testJsonLd } from "@/lib/tests/jsonld";
import { serializeJsonLd } from "@/lib/json-ld";
import { GreTest } from "@/components/tests/GreTest";
import { submitIelts } from "../../actions";
import { SITE_URL } from "@/lib/seo";
import { ieltsLimit, ieltsOffer } from "@/lib/tests/access";
import LockedTest from "@/components/tests/LockedTest";

export const dynamic = "force-dynamic";
const LABEL = { reading: "IELTS Academic Reading", listening: "IELTS Listening" } as const;
const kindOf = (exam: string): ielts.Kind | null => {
  const k = exam.replace(/^ielts-/, "");
  return exam.startsWith("ielts-") && ielts.isKind(k) ? k : null;
};

export async function generateMetadata({ params, searchParams }: { params: Promise<{ exam: string; n: string }>; searchParams: Promise<Record<string, string | undefined>> }): Promise<Metadata> {
  const p = await params;
  if ((await searchParams).a !== undefined) return { title: "Your result | GrowQR", robots: { index: false, follow: false } };
  const kind = kindOf(p.exam);
  const n = Number(p.n);
  if (p.exam === "gre-quant" && gre.validNumber(n)) return { title: `GRE Quant Practice Test ${n} | GrowQR`, description: `Timed GRE Quantitative Reasoning practice test ${n}: ${gre.QUESTIONS} questions, instant marking and an explanation for every question.`, alternates: { canonical: `${SITE_URL}/practice-tests/gre-quant/${n}` }, robots: { index: true, follow: true } };
  if (!kind || !ielts.validNumber(n)) return { title: "Practice test | GrowQR", robots: { index: false, follow: true } };
  return {
    title: `${LABEL[kind]} Practice Test ${n} | GrowQR`,
    description: `Timed ${LABEL[kind]} practice test ${n}: ${ielts.QUESTIONS} questions, instant marking, an indicative band and an explanation for every answer.`,
    alternates: { canonical: `${SITE_URL}/practice-tests/ielts-${kind}/${n}` },
    robots: { index: true, follow: true },
  };
}

const card = "bg-white rounded-2xl border border-black/[0.08] shadow-card p-5 sm:p-6";
const prose = "text-[16px] leading-relaxed text-ink-2 [&_p]:mb-3";

export default async function TestPage({ params, searchParams }: { params: Promise<{ exam: string; n: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const p = await params;
  const sp = await searchParams;
  const kind = kindOf(p.exam);
  const n = Math.trunc(Number(p.n));
  if (p.exam === "gre-quant") {
    if (!gre.validNumber(n)) notFound();
    return <GreTest user={await currentViewer()} n={n} a={sp.a} t={sp.t} />;
  }
  const test = kind && ielts.validNumber(n) ? ielts.load(kind, n) : null;
  if (!kind || !test) notFound();
  const me = await currentViewer();
  const base = `/practice-tests/ielts-${kind}`;

  // ---- locked: only the first tests are free (see lib/tests/access.ts) ----
  if (n > (await ieltsLimit(me?.role === "student" ? me.id : null))) {
    return (
      <MarketShell user={me} active="courses">
        <nav aria-label="Breadcrumb" className="text-[13px] text-ink-3 mb-4"><Link href="/practice-tests" className="underline">Practice tests</Link> / <Link href={base} className="underline">{LABEL[kind]}</Link> / Test {n}</nav>
        <h1 className="text-[26px] sm:text-[32px] font-bold text-ink tracking-tight">{test.title}</h1>
        <LockedTest label={LABEL[kind]} n={n} offer={await ieltsOffer(me?.role === "student" ? me.id : null)} signedIn={!!me} />
      </MarketShell>
    );
  }

  // ---- result ----
  if (sp.a !== undefined) {
    const res = ielts.grade(kind, test, ielts.decodeAnswers(sp.a));
    const secs = Math.max(0, Math.trunc(Number(sp.t) || 0));
    return (
      <MarketShell user={me} active="courses">
        <nav aria-label="Breadcrumb" className="text-[13px] text-ink-3 mb-4"><Link href="/practice-tests" className="underline">Practice tests</Link> / <Link href={base} className="underline">{LABEL[kind]}</Link> / Test {n}</nav>
        <h1 className="text-[28px] sm:text-[34px] font-bold text-ink tracking-tight">{LABEL[kind]} Test {n}: your result</h1>
        <div id="result" role="status" className="mt-4 grid sm:grid-cols-3 gap-3">
          <div className={card}><p className="text-[13px] text-ink-3">Raw score</p><p className="text-[32px] font-bold text-ink">{res.raw}<span className="text-[18px] text-ink-3"> / {res.total}</span></p></div>
          <div className={card}><p className="text-[13px] text-ink-3">Indicative band</p><p className="text-[32px] font-bold text-ink">{res.band.toFixed(1)}</p></div>
          <div className={card}><p className="text-[13px] text-ink-3">Time taken</p><p className="text-[32px] font-bold text-ink">{Math.floor(secs / 60)}<span className="text-[18px] text-ink-3"> min</span></p></div>
        </div>
        <p className="text-[14px] text-ink-3 mt-3">{me?.role === "student" ? "This attempt is saved to your account." : "Log in as a student to keep your results."} The band is indicative, because raw-score tables differ slightly between real test versions.</p>
        <h2 className="text-[20px] font-bold text-ink mt-6 mb-2">{kind === "reading" ? "By passage" : "By section"}</h2>
        <ul className="flex flex-wrap gap-2">{Object.entries(res.bySection).map(([k, v]) => <li key={k} className="px-3 py-2 rounded-lg bg-white border border-black/[0.08] text-[14px]">{kind === "reading" ? "Passage" : "Section"} {k}: <b>{v.correct}/{v.total}</b></li>)}</ul>
        <h2 className="text-[20px] font-bold text-ink mt-6 mb-2">Every answer explained</h2>
        <div className="overflow-x-auto bg-white rounded-2xl border border-black/[0.08] shadow-card">
          <table className="w-full text-[14px] text-left min-w-[640px]">
            <thead><tr className="border-b border-black/[0.08] text-ink-3"><th className="p-3 w-12">Q</th><th className="p-3">Your answer</th><th className="p-3">Correct answer</th><th className="p-3">Why</th></tr></thead>
            <tbody>
              {res.rows.map((r) => (
                <tr key={r.n} className="border-b border-black/[0.05] align-top">
                  <td className="p-3 font-semibold">{r.n}</td>
                  <td className="p-3"><span className={r.right ? "text-emerald-800 font-semibold" : "text-red-800 font-semibold"}>{r.right ? "Correct" : r.your === null ? "No answer" : "Wrong"}</span>{r.your ? <span className="block text-ink-3">{r.your}</span> : null}</td>
                  <td className="p-3 text-ink-2">{r.correct}</td>
                  <td className="p-3 text-ink-3">{r.explain}{r.location ? <span className="block text-[12px] text-ink-3 mt-0.5">{r.location}</span> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap gap-3 mt-6">
          <Link href={`${base}/${n}`} className="inline-flex items-center min-h-[48px] px-6 rounded-lg bg-orange-deep hover:bg-ink text-white font-semibold text-[15px]">Retake this test</Link>
          {n < ielts.TOTAL_TESTS ? <Link href={`${base}/${n + 1}`} className="inline-flex items-center min-h-[48px] px-6 rounded-lg border border-black/[0.15] hover:bg-cream-2 font-semibold text-[15px]">Next test</Link> : null}
          <Link href={base} className="inline-flex items-center min-h-[48px] px-6 rounded-lg border border-black/[0.15] hover:bg-cream-2 font-semibold text-[15px]">All tests</Link>
        </div>
      </MarketShell>
    );
  }

  // ---- runner ----
  const view = ielts.publicView(test);
  const formId = "test-form";
  const ld = testJsonLd({ exam: `ielts-${kind}`, examLabel: LABEL[kind], n, name: test.title, minutes: ielts.MINUTES[kind], questions: ielts.QUESTIONS });
  const groups = ielts.groupsOf(view);
  const scripts = kind === "listening" ? ielts.scriptOf(test) : [];
  return (
    <MarketShell user={me} active="courses">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(ld) }} />
      <nav aria-label="Breadcrumb" className="text-[13px] text-ink-3 mb-4"><Link href="/practice-tests" className="underline">Practice tests</Link> / <Link href={base} className="underline">{LABEL[kind]}</Link> / Test {n}</nav>
      <h1 className="text-[26px] sm:text-[32px] font-bold text-ink tracking-tight">{test.title}</h1>
      <p className="text-[15px] text-ink-3 mt-1">{ielts.QUESTIONS} questions in {ielts.MINUTES[kind]} minutes. The test submits itself when the timer ends. Spell answers exactly as the instructions ask.</p>
      <form id={formId} action={submitIelts} className="mt-4 space-y-6 max-w-4xl">
        <input type="hidden" name="exam" value={`ielts-${kind}`} /><input type="hidden" name="n" value={n} />
        <Countdown minutes={ielts.MINUTES[kind]} formId={formId} />
        {kind === "reading"
          ? view.passages!.map((ps) => (
              <div key={ps.n} className="space-y-4">
                <article className={card}>
                  <h2 className="text-[20px] font-bold text-ink">Reading Passage {ps.n}: {ps.title}</h2>
                  <div className="mt-3 space-y-1">{ps.paragraphs.map((pg) => <div key={pg.label} className="flex gap-3"><b className="shrink-0 w-6 text-ink">{pg.label}</b><div className={prose} dangerouslySetInnerHTML={{ __html: cleanHtml(pg.html) }} /></div>)}</div>
                </article>
                <QuestionGroups groups={groups.filter((g) => g.passage === ps.n)} />
              </div>
            ))
          : view.sections!.map((s) => (
              <div key={s.n} className="space-y-4">
                <article className={card}>
                  <h2 className="text-[20px] font-bold text-ink">{s.title}</h2>
                  <p className="text-[14px] text-ink-3 mt-1">{s.context}</p>
                  <div className="mt-3"><ListeningPlayer script={scripts.find((x) => x.n === s.n)!} /></div>
                </article>
                <QuestionGroups groups={groups.filter((g) => g.section === s.n)} />
              </div>
            ))}
        <button type="submit" className="inline-flex items-center justify-center min-h-[52px] px-8 rounded-lg bg-orange-deep hover:bg-ink text-white font-semibold text-[16px]">Submit test and see my score</button>
      </form>
    </MarketShell>
  );
}
