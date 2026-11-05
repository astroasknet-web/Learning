import type { Metadata } from "next";
import { box, btnDark, btnLine, ConsolePage, field } from "@/components/admin/console-page";
import { SCORING_VERSION } from "@/lib/reading/config";
import { ensureSeed, getConfig, loadLevels } from "@/lib/reading/store";
import { DIMENSION_LABEL } from "@/lib/reading/taxonomy";
import { adminGate } from "../../gate";
import { configAction, levelAction } from "../actions";

export const metadata: Metadata = { title: "Reading settings | Console | GrowQR", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const num = `${field} w-28`;

export default async function ReadingSettings() {
  const me = await adminGate("/console/reading/settings");
  await ensureSeed();
  const [c, levels] = await Promise.all([getConfig(), loadLevels(undefined, true)]);
  const nextPos = Math.max(0, ...levels.map((l) => l.position)) + 1;
  return (
    <ConsolePage me={me} tab="reading" title="Scoring settings and levels" subtitle={`Scoring model ${SCORING_VERSION}. Every change is recorded in the audit log. These starting values are provisional and not validated against real student data.`}>
      <form action={configAction}>
        <section className={box} aria-labelledby="w-h">
          <h2 id="w-h" className="mb-1 text-[18px] font-semibold text-ink">Score weights (must add up to 100)</h2>
          <p className="mb-3 text-[13px] text-ink-3">An area that is not assessed is left out and the others are rescaled, so these are relative weights.</p>
          <div className="flex flex-wrap gap-4">
            {(Object.keys(c.weights) as Array<keyof typeof c.weights>).map((k) => <label key={k} className="text-[13.5px] font-medium">{DIMENSION_LABEL[k]}<input name={`w_${k}`} type="number" min={0} max={100} step="any" defaultValue={c.weights[k]} className={`${num} mt-1 block`} /></label>)}
          </div>
        </section>
        <section className={box} aria-labelledby="b-h">
          <h2 id="b-h" className="mb-1 text-[18px] font-semibold text-ink">Diagnostic bands and evidence</h2>
          <p className="mb-3 text-[13px] text-ink-3">Below the first line: significant support may be needed. Then developing, progressing, and at or above the last: strong on assessed material.</p>
          <div className="flex flex-wrap gap-4">
            <label className="text-[13.5px] font-medium">Support below (%)<input name="b_support" type="number" defaultValue={c.bands.support} className={`${num} mt-1 block`} /></label>
            <label className="text-[13.5px] font-medium">Developing below (%)<input name="b_developing" type="number" defaultValue={c.bands.developing} className={`${num} mt-1 block`} /></label>
            <label className="text-[13.5px] font-medium">Progressing below (%)<input name="b_progressing" type="number" defaultValue={c.bands.progressing} className={`${num} mt-1 block`} /></label>
            <label className="text-[13.5px] font-medium">Minimum questions to diagnose a skill<input name="minSample" type="number" defaultValue={c.minSample} className={`${num} mt-1 block`} /></label>
            <label className="text-[13.5px] font-medium">Questions for high confidence<input name="highSample" type="number" defaultValue={c.highSample} className={`${num} mt-1 block`} /></label>
            <label className="text-[13.5px] font-medium">Passages for high confidence<input name="highPassages" type="number" defaultValue={c.highPassages} className={`${num} mt-1 block`} /></label>
            <label className="text-[13.5px] font-medium">Comprehension safeguard below (%)<input name="safeguardBelow" type="number" defaultValue={c.safeguardBelow} className={`${num} mt-1 block`} /></label>
            <label className="text-[13.5px] font-medium">Overall capped at<input name="safeguardCap" type="number" defaultValue={c.safeguardCap} className={`${num} mt-1 block`} /></label>
          </div>
        </section>
        <section className={box} aria-labelledby="e-h">
          <h2 id="e-h" className="mb-1 text-[18px] font-semibold text-ink">Free access and privacy</h2>
          <p className="mb-3 text-[13px] text-ink-3">The package price, currency and who holds it are managed in Payments; premium access is granted only by a verified payment.</p>
          <div className="flex flex-wrap gap-4">
            <label className="text-[13.5px] font-medium">Free starting assessments per student<input name="freeDiagnostics" type="number" min={0} defaultValue={c.freeDiagnostics} className={`${num} mt-1 block`} /></label>
            <label className="text-[13.5px] font-medium">Hours before delayed recall opens<input name="recallDelayHours" type="number" min={0} defaultValue={c.recallDelayHours} className={`${num} mt-1 block`} /></label>
            <label className="text-[13.5px] font-medium">Smallest group in reports (students)<input name="minCohort" type="number" min={1} defaultValue={c.minCohort} className={`${num} mt-1 block`} /></label>
            <label className="text-[13.5px] font-medium">Default study minutes a day<input name="defaultStudyMinutes" type="number" min={5} defaultValue={c.defaultStudyMinutes} className={`${num} mt-1 block`} /></label>
          </div>
          <div className="mt-4 flex flex-wrap gap-3"><button type="submit" className={btnDark}>Save settings</button><button type="submit" name="reset" value="1" className={btnLine}>Restore starting values</button></div>
        </section>
      </form>

      <section className={box} aria-labelledby="l-h">
        <h2 id="l-h" className="mb-1 text-[18px] font-semibold text-ink">Levels</h2>
        <p className="mb-4 text-[13px] text-ink-3">Rename, reorder, change the pass mark or switch a level off. The scoring algorithm never refers to a level by name. A new level needs passages assigned to it (import with its key).</p>
        <div className="space-y-4">
          {levels.map((l) => (
            <details key={l.key} className="rounded-xl border border-black/10 p-4">
              <summary className="cursor-pointer text-[14.5px] font-medium text-ink">{l.position}. Level {l.key}: {l.name}{l.active ? "" : " (off)"} · pass {l.passPct}%</summary>
              <form action={levelAction} className="mt-3 grid gap-3">
                <input type="hidden" name="key" value={l.key} />
                <label className="text-[13.5px] font-medium">Name<input name="name" defaultValue={l.name} className={`${field} mt-1 block w-full`} /></label>
                <label className="text-[13.5px] font-medium">Objective<input name="objective" defaultValue={l.objective} className={`${field} mt-1 block w-full`} /></label>
                <div className="flex flex-wrap gap-4">
                  <label className="text-[13.5px] font-medium">Order<input name="position" type="number" defaultValue={l.position} className={`${num} mt-1 block`} /></label>
                  <label className="text-[13.5px] font-medium">Pass mark (%)<input name="passPct" type="number" defaultValue={l.passPct} className={`${num} mt-1 block`} /></label>
                  <label className="text-[13.5px] font-medium">Minimum questions<input name="minQuestions" type="number" defaultValue={l.minQuestions} className={`${num} mt-1 block`} /></label>
                  <label className="text-[13.5px] font-medium">Mastery check size<input name="masterySize" type="number" defaultValue={l.masterySize} className={`${num} mt-1 block`} /></label>
                  <label className="flex items-center gap-2 pt-6 text-[13.5px]"><input type="checkbox" name="active" value="1" defaultChecked={l.active} /> Active</label>
                  <label className="flex items-center gap-2 pt-6 text-[13.5px]"><input type="checkbox" name="timed" value="1" defaultChecked={l.timed} /> Timed level</label>
                </div>
                <label className="text-[13.5px] font-medium">Learning objectives (one per line)<textarea name="objectives" rows={3} defaultValue={l.lesson.objectives.join("\n")} className={`${field} mt-1 block w-full`} /></label>
                <label className="text-[13.5px] font-medium">Guided lesson (separate paragraphs with a blank line)<textarea name="lesson" rows={6} defaultValue={l.lesson.lesson.join("\n\n")} className={`${field} mt-1 block w-full`} /></label>
                <label className="text-[13.5px] font-medium">Tips (one per line)<textarea name="tips" rows={3} defaultValue={l.lesson.tips.join("\n")} className={`${field} mt-1 block w-full`} /></label>
                <div><button type="submit" className={btnDark}>Save level {l.key}</button></div>
              </form>
            </details>
          ))}
        </div>
        <h3 className="mb-2 mt-6 text-[16px] font-semibold text-ink">Add a level</h3>
        <form action={levelAction} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="create" value="1" /><input type="hidden" name="active" value="1" />
          <label className="text-[13.5px] font-medium">Key (1 to 2 letters)<input name="key" maxLength={2} required className={`${num} mt-1 block`} placeholder="K" /></label>
          <label className="text-[13.5px] font-medium">Name<input name="name" required className={`${field} mt-1 block w-72`} placeholder="Reading for Research" /></label>
          <label className="text-[13.5px] font-medium">Objective<input name="objective" className={`${field} mt-1 block w-72`} /></label>
          <label className="text-[13.5px] font-medium">Order<input name="position" type="number" defaultValue={nextPos} className={`${num} mt-1 block`} /></label>
          <input type="hidden" name="passPct" value="75" /><input type="hidden" name="minQuestions" value="4" /><input type="hidden" name="masterySize" value="6" />
          <button type="submit" className={btnDark}>Add level</button>
        </form>
      </section>
    </ConsolePage>
  );
}
