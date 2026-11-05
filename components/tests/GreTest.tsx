import Link from "next/link";
import type { PortalUser } from "@/lib/portal/session";
import { MarketShell } from "@/components/market/shell";
import { Countdown } from "@/components/tests/TestClient";
import * as gre from "@/lib/tests/gre";
import { testJsonLd } from "@/lib/tests/jsonld";
import { serializeJsonLd } from "@/lib/json-ld";
import { submitGre } from "@/app/practice-tests/actions";

const card = "bg-white rounded-2xl border border-black/[0.08] shadow-card p-5 sm:p-6";
const btnPrimary = "inline-flex items-center justify-center min-h-[48px] px-6 rounded-lg bg-orange-deep hover:bg-ink text-white font-semibold text-[15px]";
const btnGhost = "inline-flex items-center justify-center min-h-[48px] px-6 rounded-lg border border-black/[0.15] hover:bg-cream-2 font-semibold text-[15px]";
const base = "/practice-tests/gre-quant";

export function GreList({ user, best }: { user: PortalUser | null; best: Map<number, { raw: number; total: number; score: number | null }> }) {
  return (
    <MarketShell user={user} active="courses">
      <nav aria-label="Breadcrumb" className="text-[13px] text-ink-3 mb-4"><Link href="/practice-tests" className="underline">Practice tests</Link> / GRE Quant</nav>
      <h1 className="text-[28px] sm:text-[34px] font-bold text-ink tracking-tight">GRE Quantitative Reasoning practice tests</h1>
      <p className="text-[16px] text-ink-3 mt-1 max-w-2xl">{gre.QUESTIONS} questions in {gre.MINUTES} minutes. Every test covers all 26 syllabus topics and no question repeats between tests. {user?.role === "student" ? "Your best score is shown on each test." : "Log in as a student to keep your scores."}</p>
      <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
        {Array.from({ length: gre.TOTAL_TESTS }, (_, i) => i + 1).map((n) => {
          const b = best.get(n);
          return (
            <li key={n} className="bg-white rounded-2xl border border-black/[0.08] shadow-card p-4">
              <p className="text-[12px] text-ink-3">Test {n}</p>
              <h2 className="text-[16px] font-semibold text-ink mt-0.5"><Link href={`${base}/${n}`} className="hover:underline">GRE Quant Practice Test {n}</Link></h2>
              <p className="text-[13px] text-ink-3 mt-1">{gre.QUESTIONS} questions · {gre.MINUTES} minutes</p>
              {b ? <p className="text-[13px] mt-2 font-semibold text-emerald-800">Best: {b.raw}/{b.total}{b.score != null ? ` · about ${b.score}` : ""}</p> : null}
            </li>
          );
        })}
      </ul>
    </MarketShell>
  );
}

export function GreTest({ user, n, a, t }: { user: PortalUser | null; n: number; a?: string; t?: string }) {
  const crumbs = <nav aria-label="Breadcrumb" className="text-[13px] text-ink-3 mb-4"><Link href="/practice-tests" className="underline">Practice tests</Link> / <Link href={base} className="underline">GRE Quant</Link> / Test {n}</nav>;

  if (a !== undefined) {
    const res = gre.grade(n, gre.decodeAnswers(a));
    const secs = Math.max(0, Math.trunc(Number(t) || 0));
    return (
      <MarketShell user={user} active="courses">
        {crumbs}
        <h1 className="text-[28px] sm:text-[34px] font-bold text-ink tracking-tight">GRE Quant Test {n}: your result</h1>
        <div id="result" role="status" className="mt-4 grid sm:grid-cols-3 gap-3">
          <div className={card}><p className="text-[13px] text-ink-3">Score</p><p className="text-[32px] font-bold text-ink">{res.raw}<span className="text-[18px] text-ink-3"> / {res.total}</span></p></div>
          <div className={card}><p className="text-[13px] text-ink-3">Estimated scaled score</p><p className="text-[32px] font-bold text-ink">{res.scaled}</p></div>
          <div className={card}><p className="text-[13px] text-ink-3">Time taken</p><p className="text-[32px] font-bold text-ink">{Math.floor(secs / 60)}<span className="text-[18px] text-ink-3"> min</span></p></div>
        </div>
        <p className="text-[14px] text-ink-3 mt-3">{user?.role === "student" ? "This attempt is saved to your account. " : "Log in as a student to keep your results. "}The 130 to 170 figure is a straight-line estimate from your percentage. The real exam is adaptive and ETS does not publish its conversion, so use it as a rough guide only.</p>
        <h2 className="text-[20px] font-bold text-ink mt-6 mb-2">By topic</h2>
        <ul className="flex flex-wrap gap-2">{res.byTopic.map((x) => <li key={x.topic} className={`px-3 py-2 rounded-lg border text-[13px] ${x.correct === x.total ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>{x.topic}: <b>{x.correct === x.total ? "right" : "missed"}</b></li>)}</ul>
        <h2 className="text-[20px] font-bold text-ink mt-6 mb-2">Every question explained</h2>
        <ol className="space-y-3">
          {res.rows.map((r) => (
            <li key={r.id} className={`${card} ${r.right ? "" : "border-red-200"}`}>
              <p className="text-[12px] text-ink-3">Question {r.position} · {r.topic}</p>
              <p className="text-[16px] text-ink mt-1">{r.q}</p>
              <ul className="mt-2 space-y-1 text-[14px]">
                {r.options.map((o, i) => (
                  <li key={i} className={`px-2 py-1 rounded ${i === r.correct ? "bg-emerald-50 text-emerald-900" : i === r.picked ? "bg-red-50 text-red-900" : "text-ink-2"}`}>
                    <b>{gre.label(i)}.</b> {o}{i === r.correct ? <span className="ml-2 text-[12px] font-semibold">Correct answer</span> : i === r.picked ? <span className="ml-2 text-[12px] font-semibold">Your answer</span> : null}
                  </li>
                ))}
              </ul>
              {r.picked === null ? <p className="text-[13px] text-ink-3 mt-1">You did not answer this one.</p> : null}
              {r.explain ? <p className="text-[14px] text-ink-3 mt-2"><b>Why:</b> {r.explain}</p> : null}
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap gap-3 mt-6">
          <Link href={`${base}/${n}`} className={btnPrimary}>Retake this test</Link>
          {n < gre.TOTAL_TESTS ? <Link href={`${base}/${n + 1}`} className={btnGhost}>Next test</Link> : null}
          <Link href={base} className={btnGhost}>All tests</Link>
        </div>
      </MarketShell>
    );
  }

  const qs = gre.publicView(gre.mock(n));
  const formId = "test-form";
  const ld = testJsonLd({ exam: gre.EXAM, examLabel: "GRE Quant", n, name: `GRE Quant Practice Test ${n}`, minutes: gre.MINUTES, questions: gre.QUESTIONS });
  return (
    <MarketShell user={user} active="courses">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(ld) }} />
      {crumbs}
      <h1 className="text-[26px] sm:text-[32px] font-bold text-ink tracking-tight">GRE Quant Practice Test {n}</h1>
      <p className="text-[15px] text-ink-3 mt-1">{gre.QUESTIONS} questions in {gre.MINUTES} minutes. The test submits itself when the timer ends. Questions can be left blank; there is no penalty for guessing.</p>
      <form id={formId} action={submitGre} className="mt-4 space-y-4 max-w-3xl">
        <input type="hidden" name="n" value={n} />
        <Countdown minutes={gre.MINUTES} formId={formId} />
        <ol className="space-y-4">
          {qs.map((q, i) => (
            <li key={q.id} className={card}>
              <fieldset>
                <legend className="text-[16px] text-ink"><b className="mr-1">{i + 1}.</b>{q.q}</legend>
                <div className="mt-2 space-y-1">
                  {q.options.map((o, j) => (
                    <label key={j} className="flex items-start gap-2.5 min-h-[44px] px-2 py-1.5 rounded-lg text-[15px] text-ink-2 hover:bg-cream-2 has-[:checked]:bg-orange/10">
                      <input type="radio" name={`g${q.id}`} value={j} className="mt-1 accent-orange" /><span><b>{gre.label(j)}.</b> {o}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </li>
          ))}
        </ol>
        <button type="submit" className="inline-flex items-center justify-center min-h-[52px] px-8 rounded-lg bg-orange-deep hover:bg-ink text-white font-semibold text-[16px]">Submit test and see my score</button>
      </form>
    </MarketShell>
  );
}
