import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PortalPage } from "@/components/portal/shell";
import ChartCard from "@/components/reading/Charts";
import { Bar, Card, Crumbs, Locked, Stat, StartButton, btnLight, btnPrimary, clock, when } from "@/components/reading/ui";
import { studentPage } from "@/lib/reading/page";
import { getAssessment } from "@/lib/reading/store";
import { buildResults } from "@/lib/reading/views";
import { KIND_LABEL, type Kind } from "@/lib/reading/taxonomy";

export const metadata: Metadata = { title: "Your reading results | English Reading Studio | GrowQR", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const dimText = (s: number | null): string => (s === null ? "Not assessed" : `${Math.round(s)} / 100`);

export default async function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { me } = await studentPage(`/reading-studio/results/${id}`);
  const a = await getAssessment(me.id, id);
  if (!a) notFound();
  if (a.status === "open") redirect(`/reading-studio/assessment/${id}`);
  const v = await buildResults(me.id, id);
  if (!v) notFound();
  const c = v.comparison;
  return (
    <PortalPage user={me} active="reading-studio" title="Your reading results" subtitle={`${KIND_LABEL[v.kind as Kind]} · ${when(v.submittedAt)}`} wide="full">
      <Crumbs items={[{ href: "/reading-studio/dashboard", label: "My English Reading Studio" }, { label: "Results" }]} />

      {v.partialNote ? <p role="note" className="mb-5 rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-[14.5px] text-amber-900">{v.partialNote}</p> : null}
      {v.repeatNote ? <p role="note" className="mb-5 rounded-xl border border-black/10 bg-cream-2 p-3.5 text-[14.5px] text-ink-2">{v.repeatNote}</p> : null}

      {/* Section A: overall */}
      <Card id="overall" title="Overall">
        <div className="grid gap-5 lg:grid-cols-[1fr_2fr]">
          <div>
            <p className="text-[12.5px] font-medium uppercase tracking-wide text-ink-3">Reading Performance Score</p>
            <p className="mt-1 text-[56px] font-semibold leading-none text-ink">{v.overall.score === null ? "n/a" : v.overall.score}<span className="text-[20px] font-normal text-ink-3"> / 100</span></p>
            <p className="mt-2 inline-flex rounded-full bg-orange-light px-3 py-1 text-[13px] font-semibold text-orange-deep">{v.overall.classification ?? "Not enough answers to score"}</p>
            <p className="mt-3 text-[13px] leading-snug text-ink-3"><strong>Provisional.</strong> {v.provisionalNote.replace("Provisional score. ", "")}</p>
            {v.overall.capped ? <p className="mt-2 text-[13px] text-ink-3">Comprehension safeguard applied: speed cannot make up for understanding, so the score is capped while comprehension is low.</p> : null}
            <p className="mt-2 text-[12px] text-ink-4">{v.version}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label="Reading speed" value={v.tiles.wpm === null ? "n/a" : <>{Math.round(v.tiles.wpm)}<span className="text-[14px] font-normal text-ink-3"> wpm</span></>} sub={v.tiles.wpm === null ? v.tiles.wpmNote : `An estimate from your recorded reading time. A comfortable range here is near ${v.tiles.targetWpm}.`} hint="Words read divided by minutes spent on the reading screen" />
            <Stat label="Comprehension" value={v.tiles.comprehensionPct === null ? "n/a" : `${Math.round(v.tiles.comprehensionPct)}%`} sub="Weighted by question difficulty" />
            <Stat label="Question accuracy" value={v.tiles.qaPct === null ? "n/a" : `${Math.round(v.tiles.qaPct)}%`} sub="All questions, weighted" />
            <Stat label="Correct / incorrect" value={`${v.tiles.correct} / ${v.tiles.incorrect + v.tiles.skipped}`} sub={`${v.tiles.total} questions${v.tiles.skipped ? `, ${v.tiles.skipped} unanswered` : ""}`} />
            <Stat label="Time" value={clock(v.tiles.durationSecs)} sub={v.tiles.readingSecs === null ? "Reading time not recorded" : `${clock(v.tiles.readingSecs)} reading (estimate)`} />
            <Stat label="Compared with last time" value={c.verdict === "first" ? "First" : c.overallDelta === null ? "n/a" : `${c.overallDelta > 0 ? "+" : ""}${c.overallDelta}`} sub={c.message} />
          </div>
        </div>
      </Card>

      {/* How the score was calculated (free: transparency is part of the product) */}
      <Card id="how" title="How this score was calculated">
        <p className="mb-3 max-w-prose text-[14.5px] leading-relaxed text-ink-2">The overall score is a weighted average of the areas below. An area that was not assessed is left out and the other weights are rescaled, so you are never marked down for something you were not asked. Speed counts only together with accuracy.</p>
        <ul className="space-y-3 sm:hidden" aria-label="Score breakdown">
          {v.dimensions.map((d) => (
            <li key={d.dimension} className="rounded-xl border border-black/10 p-3.5">
              <p className="text-[15px] font-semibold text-ink">{d.label}</p>
              <p className="mt-0.5 text-[13px] text-ink-3">{d.note}</p>
              <p className="mt-2 text-[14px] text-ink-2">{dimText(d.score)} · weight {d.weight}%{d.score === null ? " · left out" : ` · counts for ${d.effectiveWeight}% · adds ${d.contribution}`}</p>
              {d.score !== null ? <div className="mt-1.5"><Bar pct={d.score} label={d.label} tone="teal" /></div> : null}
            </li>
          ))}
          <li className="rounded-xl border-2 border-black/20 p-3.5 text-[15px] font-semibold text-ink">Overall (provisional): {v.overall.score ?? "n/a"}</li>
        </ul>
        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full min-w-[34rem] text-[14px]">
            <thead><tr className="text-left text-ink-4"><th scope="col" className="py-2 pr-3 font-medium">Area</th><th scope="col" className="py-2 pr-3 font-medium">Score</th><th scope="col" className="py-2 pr-3 font-medium">Weight</th><th scope="col" className="py-2 pr-3 font-medium">Counts for</th><th scope="col" className="py-2 font-medium">Points added</th></tr></thead>
            <tbody>
              {v.dimensions.map((d) => (
                <tr key={d.dimension} className="border-t border-black/[0.07] align-top">
                  <th scope="row" className="py-2 pr-3 text-left font-medium text-ink">{d.label}<span className="block text-[12px] font-normal text-ink-3">{d.note}</span></th>
                  <td className="py-2 pr-3">{dimText(d.score)}{d.score !== null ? <Bar pct={d.score} label={d.label} tone="teal" /> : null}</td>
                  <td className="py-2 pr-3">{d.weight}%</td>
                  <td className="py-2 pr-3">{d.score === null ? "left out" : `${d.effectiveWeight}%`}</td>
                  <td className="py-2">{d.score === null ? "0" : d.contribution}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-black/20"><th scope="row" className="py-2 pr-3 text-left">Overall (provisional)</th><td colSpan={3} /><td className="py-2 font-semibold">{v.overall.score ?? "n/a"}</td></tr>
            </tbody>
          </table>
        </div>
      </Card>

      {/* Free summary: strongest and weakest */}
      <Card id="summary" title="What you are doing well, and what to build next">
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <h3 className="text-[15px] font-semibold text-ink">Going well</h3>
            {v.strongest.length ? <ul className="mt-2 space-y-1.5 text-[14.5px] text-ink-2">{v.strongest.map((s) => <li key={s.label}>{s.label}: {s.pct}% over {s.n} questions</li>)}</ul> : <p className="mt-2 text-[14.5px] text-ink-3">No skill has reached the “progressing” range with enough questions yet. That is a starting point, not a verdict.</p>}
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-ink">To build next</h3>
            {v.weakest.length ? <ul className="mt-2 space-y-1.5 text-[14.5px] text-ink-2">{v.weakest.map((s) => <li key={s.label}>{s.label}: {s.pct}% over {s.n} questions</li>)}</ul> : <p className="mt-2 text-[14.5px] text-ink-3">No skill stands out as needing work with the questions asked so far.</p>}
          </div>
        </div>
        {v.whyItMatters ? <p className="mt-4 max-w-prose rounded-lg bg-cream-2 p-3.5 text-[14.5px] leading-relaxed text-ink-2"><strong className="text-ink">Why it matters: </strong>{v.whyItMatters}</p> : null}
        <p className="mt-3 text-[12.5px] text-ink-4">Skills with only two or three questions are early signals. They become reliable as you practise.</p>
      </Card>

      {v.ai ? (
        <Card id="note" title="A note on your result" tone="soft">
          <p className="max-w-prose text-[14.5px] leading-relaxed text-ink-2">{v.ai.summary}</p>
          <p className="mt-2 max-w-prose text-[14.5px] leading-relaxed text-ink-2">{v.ai.focus}</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[14.5px] text-ink-2">{v.ai.tips.map((t) => <li key={t}>{t}</li>)}</ul>
          <p className="mt-3 text-[12px] text-ink-4">Written by an AI from the facts above. It cannot change your scores.</p>
        </Card>
      ) : null}

      {v.premium ? (
        <>
          {/* Section B: charts */}
          {v.charts ? (
            <Card id="charts" title="Your charts">
              <div className="grid gap-5 xl:grid-cols-2">
                {Object.values(v.charts).filter((x) => x !== null).map((ch) => <ChartCard key={ch!.id} chart={ch!} />)}
              </div>
              {!Object.values(v.charts).some((x) => x) ? <p className="text-[14.5px] text-ink-3">Not enough data for charts yet. They appear as soon as there are enough questions to mean something.</p> : <p className="mt-4 text-[13px] text-ink-3">Charts appear only where there is enough data. The trend and speed charts need at least three assessments, and nothing here compares you with other students.</p>}
            </Card>
          ) : null}

          {/* Section C: strengths */}
          <Card id="strengths" title="Your strengths">
            {v.strengths && v.strengths.length ? <ul className="space-y-2 text-[15px] leading-relaxed text-ink-2">{v.strengths.map((s) => <li key={s}>✓ {s}</li>)}</ul> : <p className="text-[14.5px] text-ink-3">No strength is confirmed yet. A skill needs enough questions at a good level before we call it one.</p>}
            {v.careful ? <p className="mt-3 text-[14.5px] text-ink-2">✓ {v.careful}</p> : null}
          </Card>

          {/* Section D: weaknesses */}
          <Card id="weaknesses" title="Where to focus">
            {v.weaknesses && v.weaknesses.length ? (
              <div className="space-y-5">
                {v.weaknesses.map((w, i) => (
                  <article key={w.skill} className="rounded-xl border border-black/10 p-4" aria-labelledby={`w-${w.skill}`}>
                    <h3 id={`w-${w.skill}`} className="text-[16.5px] font-semibold text-ink">{i + 1}. {w.label}</h3>
                    <p className="mt-1 text-[14.5px] leading-relaxed text-ink-2">{w.message}</p>
                    <dl className="mt-3 grid gap-x-6 gap-y-2 text-[14px] sm:grid-cols-3">
                      <div><dt className="text-ink-4">Current score</dt><dd className="font-semibold text-ink">{Math.round(w.accuracy)}%</dd></div>
                      <div><dt className="text-ink-4">Questions behind it</dt><dd className="font-semibold text-ink">{w.questions} ({w.confidence} confidence)</dd></div>
                      <div><dt className="text-ink-4">Aim for next time</dt><dd className="font-semibold text-ink">{w.target}% or more</dd></div>
                    </dl>
                    <p className="mt-3 text-[14.5px] text-ink-2"><strong className="text-ink">Why it matters: </strong>{w.why}</p>
                    <p className="mt-1.5 text-[14.5px] text-ink-2"><strong className="text-ink">Try this: </strong>{w.practice}</p>
                    {w.examples.length ? (
                      <div className="mt-3 space-y-2">
                        <p className="text-[13px] font-semibold uppercase tracking-wide text-ink-3">From your answers</p>
                        {w.examples.map((e) => (
                          <div key={e.stem} className="rounded-lg bg-cream-2 p-3 text-[14px] leading-relaxed text-ink-2">
                            <p className="font-medium text-ink">{e.stem}</p>
                            <p className="mt-1">You chose: {e.chosen}</p><p>Supported by the passage: {e.correct}</p><p className="mt-1">{e.explanation}</p>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    <div className="mt-3"><StartButton kind="practice" skill={w.skill} back={`/reading-studio/results/${v.id}`} className={btnLight}>Practise {w.label.toLowerCase()}</StartButton></div>
                  </article>
                ))}
              </div>
            ) : <p className="text-[14.5px] text-ink-3">No skill is confirmed as needing support. A skill is diagnosed only after enough questions; where evidence is thin the studio says so instead of guessing.</p>}
            {v.causes && v.causes.length ? (
              <div className="mt-5">
                <h3 className="text-[15px] font-semibold text-ink">What may be behind it</h3>
                <ul className="mt-2 space-y-3">{v.causes.map((x) => <li key={x.kind} className="text-[14.5px] leading-relaxed text-ink-2"><strong className="text-ink">{x.label}.</strong> {x.evidence} <em>{x.advice}</em></li>)}</ul>
              </div>
            ) : null}
            {v.skills ? (
              <div className="mt-5 overflow-x-auto">
                <h3 className="mb-2 text-[15px] font-semibold text-ink">Every skill assessed so far</h3>
                <table className="w-full min-w-[40rem] text-[14px]">
                  <thead><tr className="text-left text-ink-4"><th scope="col" className="py-2 pr-3 font-medium">Skill</th><th scope="col" className="py-2 pr-3 font-medium">Correct / asked</th><th scope="col" className="py-2 pr-3 font-medium">Accuracy</th><th scope="col" className="py-2 pr-3 font-medium">Easy / Medium / Difficult</th><th scope="col" className="py-2 pr-3 font-medium">Change</th><th scope="col" className="py-2 font-medium">Reading</th></tr></thead>
                  <tbody>{v.skills.map((s) => (
                    <tr key={s.skill} className="border-t border-black/[0.07] align-top">
                      <th scope="row" className="py-2 pr-3 text-left font-medium text-ink">{s.label}</th>
                      <td className="py-2 pr-3">{s.correct} / {s.attempted}</td>
                      <td className="py-2 pr-3">{s.accuracy === null ? "n/a" : `${Math.round(s.accuracy)}%`}</td>
                      <td className="py-2 pr-3">{([1, 2, 3] as const).map((d) => s.byDifficulty[d].n ? `${Math.round(s.byDifficulty[d].pct as number)}% (${s.byDifficulty[d].n})` : "–").join(" · ")}</td>
                      <td className="py-2 pr-3">{s.change === null ? "–" : `${s.change > 0 ? "+" : ""}${s.change}`}</td>
                      <td className="py-2 text-[13px] text-ink-3">{s.summary}</td>
                    </tr>))}</tbody>
                </table>
              </div>
            ) : null}
          </Card>

          {/* Section E: plan */}
          {v.plan ? (
            <Card id="plan" title="Your 7-day plan">
              <p className="mb-3 text-[14.5px] text-ink-2">{v.plan.note}</p>
              <ol className="space-y-3">
                {v.plan.days.map((d) => (
                  <li key={d.day} className="rounded-xl border border-black/10 p-4">
                    <p className="text-[12.5px] font-semibold uppercase tracking-wide text-ink-3">Day {d.day} · about {d.minutes} minutes</p>
                    <h3 className="mt-0.5 text-[16px] font-semibold text-ink">{d.title}</h3>
                    <p className="mt-1 text-[14.5px] leading-relaxed text-ink-2">{d.task}</p>
                    <div className="mt-2.5">
                      {d.action.kind === "practice" && d.action.skill ? <StartButton kind="practice" skill={d.action.skill} back={`/reading-studio/results/${v.id}`} className={btnLight}>{d.action.label}</StartButton>
                        : d.action.kind === "timed" ? <StartButton kind="timed" back={`/reading-studio/results/${v.id}`} className={btnLight}>{d.action.label}</StartButton>
                        : d.action.kind === "fresh" ? <StartButton kind="fresh" back={`/reading-studio/results/${v.id}`} className={btnLight}>{d.action.label}</StartButton>
                        : <Link href="#review" className={btnLight}>{d.action.label}</Link>}
                    </div>
                  </li>
                ))}
              </ol>
            </Card>
          ) : null}

          {/* Review of every question */}
          {v.review ? (
            <Card id="review" title="Every question, with explanations">
              <ol className="space-y-4">
                {v.review.map((r, i) => (
                  <li key={r.questionId} className={`rounded-xl border p-4 ${r.correct ? "border-[#0F766E]/40" : "border-[#B4410F]/50"}`}>
                    <p className="text-[12.5px] font-semibold uppercase tracking-wide text-ink-3">{i + 1}. {r.passageTitle} · {r.correct ? "Correct" : r.skipped ? "Not answered" : "Incorrect"}</p>
                    <p className="mt-1 text-[15px] font-medium text-ink">{r.stem}</p>
                    <p className="mt-1.5 text-[14px] text-ink-2">Your answer: {r.chosen}</p>
                    {!r.correct ? <p className="text-[14px] text-ink-2">Supported by the passage: <strong>{r.correctText}</strong></p> : null}
                    <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">{r.explanation}</p>
                    {r.ms !== null ? <p className="mt-1 text-[12.5px] text-ink-4">Took {Math.round(r.ms / 1000)} s (guide time {r.expectedSecs} s)</p> : null}
                  </li>
                ))}
              </ol>
            </Card>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <Link href={`/reading-studio/results/${v.id}/report`} className={btnLight}>Download report (CSV)</Link>
            <Link href="/reading-studio/progress" className={btnLight}>My progress</Link>
            {v.kind === "essay" ? <Link href="/reading-tests#library" className={btnLight}>More reading tests</Link> : null}
            <Link href={v.next.href} className={btnPrimary}>{v.next.label}</Link>
          </div>
        </>
      ) : v.locked ? (
        <>
          <Card id="unlock" title="Go deeper with the Reading Studio package" tone="soft">
            <ul className="grid gap-4 md:grid-cols-2">
              {[v.locked.pitches.results, v.locked.pitches.explanations, { ...v.locked.pitches.charts, body: `${v.locked.pitches.charts.body} ${v.locked.counts.charts ? `${v.locked.counts.charts} chart${v.locked.counts.charts === 1 ? " is" : "s are"} ready to draw from this result.` : ""}` }, v.locked.pitches.plan].map((x) => (
                <li key={x.key} className="rounded-xl border border-dashed border-orange/60 bg-white p-4">
                  <p className="text-[12px] font-semibold uppercase tracking-wide text-orange-deep">In the package</p>
                  <h3 className="mt-1 text-[16.5px] font-semibold text-ink">{x.headline}</h3>
                  <p className="mt-1.5 text-[14.5px] leading-relaxed text-ink-2">{x.body}</p>
                </li>
              ))}
            </ul>
            <Link href="/reading-studio/upgrade?from=results" className={`${btnPrimary} mt-5`}>See what is included and the price</Link>
            <p className="mt-4 text-[13px] text-ink-3">Nothing is hidden that would change your overall score above. The package adds the detail behind it.</p>
          </Card>
          <div className="flex flex-wrap gap-3"><Link href="/reading-studio/dashboard" className={btnLight}>Back to my dashboard</Link>{v.kind === "essay" ? <Link href="/reading-tests#library" className={btnLight}>More reading tests</Link> : null}</div>
        </>
      ) : null}
    </PortalPage>
  );
}
