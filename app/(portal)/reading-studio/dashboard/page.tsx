import type { Metadata } from "next";
import Link from "next/link";
import { PortalPage } from "@/components/portal/shell";
import { Bar, Card, Flash, StartButton, btnDark, btnLight, btnPrimary, when } from "@/components/reading/ui";
import { studentPage } from "@/lib/reading/page";
import { buildDashboard, type TrackCard } from "@/lib/reading/views";
import { getStudyMinutes, openAssessment } from "@/lib/reading/store";
import { KIND_LABEL, type Kind } from "@/lib/reading/taxonomy";
import type { Track } from "@/lib/reading/access";
import { chooseTracksAction, studyMinutesAction } from "../actions";

export const metadata: Metadata = { title: "My English Reading Studio | GrowQR", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const HUE: Record<Track, string> = { skills: "#0F766E", indian: "#B4530F", international: "#1F4E79" };
const rupee = (n: number | null) => (n === null ? "" : `₹${n.toLocaleString("en-IN")}`);

function Chooser({ d, defaults, compact }: { d: { tracks: TrackCard[] }; defaults: Track[]; compact?: boolean }) {
  return (
    <form action={chooseTracksAction} className="grid gap-4">
      <input type="hidden" name="back" value="/reading-studio/dashboard" />
      <fieldset>
        <legend className={compact ? "sr-only" : "mb-2 text-[15px] font-semibold text-ink"}>Which reading do you want on your dashboard?</legend>
        <div className="grid gap-3 md:grid-cols-3">
          {d.tracks.map((t) => (
            <label key={t.id} className="relative flex cursor-pointer flex-col rounded-2xl border-2 border-black/15 bg-white p-4 transition hover:border-orange has-[:checked]:border-ink has-[:checked]:bg-cream-2 focus-within:outline focus-within:outline-2 focus-within:outline-orange-deep">
              <span aria-hidden className="absolute inset-x-0 top-0 h-1.5 rounded-t-2xl" style={{ background: HUE[t.id] }} />
              <span className="flex items-start gap-3 pt-1.5"><input type="checkbox" name="track" value={t.id} defaultChecked={defaults.includes(t.id)} className="mt-1 h-5 w-5" /><span><span className="block text-[16px] font-semibold text-ink">{t.name}</span><span className="block text-[12.5px] font-medium text-ink-3">{t.short}</span></span></span>
              <span className="mt-2 text-[13.5px] leading-snug text-ink-3">{t.blurb}</span>
              <span className="mt-2 text-[12.5px] font-semibold" style={{ color: t.owned ? "#0F766E" : "#8A8A8A" }}>{t.owned ? "✓ You have this package" : t.priceRupees ? `Package ${rupee(t.priceRupees)}` : "Package"}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div><button type="submit" className={btnDark}>{compact ? "Save my tracks" : "Show my dashboard"}</button></div>
    </form>
  );
}

function Badge({ t }: { t: TrackCard }) {
  return t.owned ? <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11.5px] font-semibold text-emerald-900">Your package</span> : <span className="rounded-full bg-cream-3 px-2.5 py-1 text-[11.5px] font-semibold text-ink-2">Free sample</span>;
}

export default async function Dashboard({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { me } = await studentPage("/reading-studio/dashboard");
  const [d, open, minutes] = await Promise.all([buildDashboard(me.id), openAssessment(me.id), getStudyMinutes(me.id)]);
  const mastered = d.levels.filter((l) => l.mastered).length;
  const shown = d.tracks.filter((t) => d.chosen.includes(t.id));
  const skills = d.tracks.find((t) => t.id === "skills")!;
  return (
    <PortalPage user={me} active="reading-studio" title="English Reading Studio" subtitle="One place for your reading: skills, Indian competitive exams and international exams, with one set of analytics." wide="full">
      <Flash text={sp.e} />
      {open ? (
        <Card tone="soft" title="You have an assessment in progress">
          <p className="text-[14.5px] text-ink-2">{KIND_LABEL[open.kind as Kind]} started {when(open.createdAt)}. Your saved answers are kept.</p>
          <Link href={`/reading-studio/assessment/${open.publicId}`} className={`${btnPrimary} mt-3`}>Continue</Link>
        </Card>
      ) : null}

      {!d.chosen.length ? (
        <Card title="Choose what you are preparing for" tone="soft">
          <p className="mb-4 max-w-prose text-[14.5px] text-ink-2">Pick one or more. Your dashboard then shows only those, and your analytics cover everything you read. You can change this any time, and choosing something never costs anything.</p>
          <Chooser d={d} defaults={d.suggested} />
        </Card>
      ) : (
        <>
          {/* shared analytics */}
          <section className="mb-5 grid gap-5 lg:grid-cols-[1.4fr_1fr]" aria-label="Your reading analytics">
            <Card title={d.latest ? "Your latest result" : "Start here"} className="!mb-0">
              {d.latest ? (
                <div>
                  <p className="text-[40px] font-semibold leading-none text-ink">{d.latest.overall === null ? "n/a" : d.latest.overall}<span className="text-[18px] font-normal text-ink-3"> / 100 · provisional</span></p>
                  <p className="mt-2 text-[14px] text-ink-3">{KIND_LABEL[d.latest.kind as Kind]} on {when(d.latest.at)}{d.latest.completion === "partial" ? " (partial)" : ""}</p>
                  {d.strongest.length || d.weakest.length ? (
                    <ul className="mt-3 space-y-1 text-[14.5px] text-ink-2">
                      {d.strongest.length ? <li><span className="font-semibold text-ink">Going well:</span> {d.strongest.join(", ")}</li> : null}
                      {d.weakest.length ? <li><span className="font-semibold text-ink">To build next:</span> {d.weakest.join(", ")}</li> : null}
                    </ul>
                  ) : null}
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Link href={`/reading-studio/results/${d.latest.id}`} className={btnPrimary}>See my results</Link>
                    <Link href="/reading-studio/progress" className={btnLight}>All my analytics</Link>
                    {d.analytics ? <Link href="/reading-studio/plan" className={btnLight}>My 7-day plan</Link> : null}
                  </div>
                </div>
              ) : (
                <div>
                  <p className="max-w-prose text-[15px] leading-relaxed text-ink-2">Take any test below and your analytics start here. The starting assessment (two short passages, about sixteen questions) is free and works for every track{d.freeLeft ? ` (${d.freeLeft} included)` : ""}.</p>
                  <div className="mt-4"><StartButton kind="diagnostic" back="/reading-studio/dashboard">Start the free starting assessment</StartButton></div>
                </div>
              )}
              {d.latest && d.freeLeft > 0 && !d.premium ? <div className="mt-4 border-t border-black/10 pt-4"><StartButton kind="diagnostic" back="/reading-studio/dashboard" className={btnLight}>Take another starting assessment ({d.freeLeft} free left)</StartButton></div> : null}
            </Card>
            <Card title="Study time" className="!mb-0">
              <form action={studyMinutesAction} className="flex flex-wrap items-end gap-3">
                <input type="hidden" name="back" value="/reading-studio/dashboard" />
                <div><label htmlFor="mins" className="block text-[13.5px] text-ink-3">Minutes a day you can study</label>
                  <select id="mins" name="minutes" defaultValue={minutes ?? 20} className="mt-1 min-h-[44px] rounded-lg border border-black/20 bg-white px-3 text-[15px]">{[10, 15, 20, 30, 45, 60].map((m) => <option key={m} value={m}>{m} minutes</option>)}</select></div>
                <button type="submit" className={btnLight}>Save</button>
              </form>
              <p className="mt-2 text-[13px] text-ink-3">Your 7-day plan is sized to this.</p>
            </Card>
          </section>

          {/* the chosen tracks */}
          {shown.map((t) => (
            <section key={t.id} className="relative mb-5 overflow-hidden rounded-2xl border border-black/[0.08] bg-white p-5 shadow-card sm:p-6" aria-labelledby={`t-${t.id}`}>
              <span aria-hidden className="absolute inset-x-0 top-0 h-1.5" style={{ background: HUE[t.id] }} />
              <div className="flex flex-wrap items-center justify-between gap-2"><h2 id={`t-${t.id}`} className="text-[19px] font-semibold text-ink">{t.name}</h2><Badge t={t} /></div>
              <p className="mt-1 text-[14.5px] text-ink-2">{t.progress}</p>
              {t.id === "skills" && t.owned ? (
                <div className="mt-4">
                  <p className="mb-3 text-[14px] text-ink-3">Each level opens when you show mastery of the one before it. {d.current ? <>You are on <strong className="text-ink">Level {d.current.key}: {d.current.name}</strong>.</> : null}</p>
                  <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {d.levels.map((l) => (
                      <li key={l.key} className={`rounded-xl border p-4 ${l.mastered ? "border-[#0F766E] bg-[#F0F8F6]" : l.unlocked ? "border-black/15 bg-white" : "border-black/10 bg-cream-2"}`}>
                        <p className="text-[12.5px] font-semibold uppercase tracking-wide text-ink-3">Level {l.key} · {l.mastered ? "Mastered" : l.unlocked ? "Open" : "Locked"}</p>
                        <h3 className="mt-0.5 text-[16px] font-semibold text-ink">{l.name}</h3>
                        <p className="mt-1 text-[13.5px] leading-snug text-ink-3">{l.message}</p>
                        {l.unlocked ? <Link href={`/reading-studio/levels/${l.key}`} className="mt-2 inline-block text-[14px] font-semibold text-orange-deep underline">Open level</Link> : null}
                      </li>
                    ))}
                  </ol>
                  <div className="mt-4"><Bar pct={(mastered / Math.max(1, d.levels.length)) * 100} label="Levels mastered" tone="teal" /></div>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <StartButton kind="fresh" back="/reading-studio/dashboard" className={btnLight}>Fresh assessment</StartButton>
                    <StartButton kind="timed" back="/reading-studio/dashboard" className={btnLight}>Timed reading</StartButton>
                    <StartButton kind="recall" back="/reading-studio/dashboard" className={btnLight}>Delayed recall</StartButton>
                  </div>
                </div>
              ) : null}
              <div className="mt-4 flex flex-wrap items-center gap-3">
                {t.next ? <Link href={t.next.href} className={t.owned || t.id !== "skills" ? btnPrimary : btnLight}>{t.next.label}</Link> : null}
                {t.id !== "skills" ? <Link href={t.href} className={btnLight}>{t.id === "indian" ? "All 30 essay tests" : "All IELTS Reading tests"}</Link> : null}
                {!t.owned ? <Link href={t.buyHref} className={btnLight}>{t.priceRupees ? `Get the package · ${rupee(t.priceRupees)}` : "See the package"}</Link> : null}
              </div>
              {!t.owned ? <p className="mt-3 text-[13px] text-ink-3">{t.id === "skills" ? "The Level A lesson and the starting assessment are free. The package opens all ten levels, practice, mastery checks, recall and timed reading." : t.id === "indian" ? "Three tests are free. The package opens all 30 tests and the full analytics." : "The first IELTS Reading tests are free. The package opens all 30."}</p> : null}
            </section>
          ))}
          {!shown.length ? <Card><p className="text-[14.5px] text-ink-2">You have not chosen any track yet.</p></Card> : null}

          {/* packages */}
          <Card title="Your packages" id="packages">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[34rem] text-[14px]">
                <thead><tr className="text-left text-ink-4"><th scope="col" className="py-2 pr-3 font-medium">Track</th><th scope="col" className="py-2 pr-3 font-medium">Status</th><th scope="col" className="py-2 pr-3 font-medium">Price</th><th scope="col" className="py-2 font-medium"><span className="sr-only">Action</span></th></tr></thead>
                <tbody>
                  {d.tracks.map((t) => (
                    <tr key={t.id} className="border-t border-black/[0.07] align-middle">
                      <th scope="row" className="py-2.5 pr-3 text-left font-medium text-ink">{t.name}<span className="block text-[12px] font-normal text-ink-3">{t.short}</span></th>
                      <td className="py-2.5 pr-3">{t.owned ? <span className="font-semibold text-emerald-800">✓ Active</span> : "Free sample only"}</td>
                      <td className="py-2.5 pr-3">{rupee(t.priceRupees) || "–"}</td>
                      <td className="py-2.5">{t.owned ? (d.chosen.includes(t.id) ? <span className="text-ink-4">On your dashboard</span> : null) : <Link href={t.buyHref} className="font-semibold text-orange-deep underline">Get it</Link>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[13px] text-ink-3">Detailed analytics (skill-by-skill analysis, charts, explanations, history and reports) open with any paid package and cover every result you have.{d.analytics ? " Yours are open." : ""} Payment goes through the secure checkout; a package opens only after the payment is verified.</p>
          </Card>

          <details className="mb-5 rounded-2xl border border-black/[0.08] bg-white p-5 shadow-card">
            <summary className="cursor-pointer text-[15px] font-semibold text-ink">Change the tracks on my dashboard</summary>
            <div className="mt-4"><Chooser d={d} defaults={d.chosen} compact /></div>
          </details>
        </>
      )}
      <p className="sr-only">{skills.name}</p>
    </PortalPage>
  );
}
