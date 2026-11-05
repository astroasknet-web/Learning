import type { Metadata } from "next";
import { box, btnDark, btnLine, ConsolePage, field } from "@/components/admin/console-page";
import { ENGINE_VERSION } from "@/lib/mathstudio/config";
import { getConfig, ensureSeed } from "@/lib/mathstudio/store";
import { listTopics } from "@/lib/mathstudio/admin";
import { AREAS } from "@/lib/mathstudio/taxonomy";
import { adminGate } from "../../gate";
import { configAction, topicAction } from "../actions";

export const metadata: Metadata = { title: "Maths scoring settings | Console | GrowQR", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
const num = `${field} w-28`;

export default async function MathSettings() {
  const me = await adminGate("/console/math/settings");
  await ensureSeed();
  const [c, topics] = await Promise.all([getConfig(), listTopics()]);
  return (
    <ConsolePage me={me} tab="math" title="Scoring settings and taxonomy" subtitle={`Engine ${ENGINE_VERSION}. Every change is audited. These starting values are provisional and not validated against real outcomes.`}>
      <form action={configAction}>
        <section className={box} aria-labelledby="w-h">
          <h2 id="w-h" className="mb-1 text-[18px] font-semibold text-ink">Performance score weights (must add up to 100)</h2>
          <div className="flex flex-wrap gap-4">
            {(["mastery", "accuracy", "efficiency", "consistency"] as const).map((k) => <label key={k} className="text-[13.5px] font-medium capitalize">{k}<input name={`w_${k}`} type="number" min={0} max={100} step="any" defaultValue={c.weights[k]} className={`${num} mt-1 block`} /></label>)}
          </div>
          <p className="mt-2 text-[13px] text-ink-3">A component with no data is left out and the others rescaled, so these are relative weights.</p>
        </section>
        <section className={box} aria-labelledby="m-h">
          <h2 id="m-h" className="mb-1 text-[18px] font-semibold text-ink">Mastery estimate and evidence</h2>
          <div className="flex flex-wrap gap-4">
            <label className="text-[13.5px] font-medium">Prior strength<input name="priorStrength" type="number" step="any" defaultValue={c.priorStrength} className={`${num} mt-1 block`} /></label>
            <label className="text-[13.5px] font-medium">Prior mean (0–1)<input name="priorMean" type="number" step="any" defaultValue={c.priorMean} className={`${num} mt-1 block`} /></label>
            <label className="text-[13.5px] font-medium">Recency half-life (days)<input name="recencyHalfLifeDays" type="number" defaultValue={c.recencyHalfLifeDays} className={`${num} mt-1 block`} /></label>
            <label className="text-[13.5px] font-medium">Preliminary at (items)<input name="ev_preliminary" type="number" defaultValue={c.evidence.preliminary} className={`${num} mt-1 block`} /></label>
            <label className="text-[13.5px] font-medium">Developing at<input name="ev_developing" type="number" defaultValue={c.evidence.developing} className={`${num} mt-1 block`} /></label>
            <label className="text-[13.5px] font-medium">Strong at<input name="ev_strong" type="number" defaultValue={c.evidence.strong} className={`${num} mt-1 block`} /></label>
            <label className="text-[13.5px] font-medium">Support band below<input name="b_support" type="number" defaultValue={c.bands.support} className={`${num} mt-1 block`} /></label>
            <label className="text-[13.5px] font-medium">Developing below<input name="b_developing" type="number" defaultValue={c.bands.developing} className={`${num} mt-1 block`} /></label>
            <label className="text-[13.5px] font-medium">Secure at<input name="b_secure" type="number" defaultValue={c.bands.secure} className={`${num} mt-1 block`} /></label>
          </div>
        </section>
        <section className={box} aria-labelledby="f-h">
          <h2 id="f-h" className="mb-1 text-[18px] font-semibold text-ink">Diagnosis, free tier and privacy</h2>
          <div className="flex flex-wrap gap-4">
            <label className="text-[13.5px] font-medium">Weaknesses shown<input name="maxWeaknesses" type="number" defaultValue={c.maxWeaknesses} className={`${num} mt-1 block`} /></label>
            <label className="text-[13.5px] font-medium">Free topics in detail<input name="freeTopics" type="number" defaultValue={c.freeTopics} className={`${num} mt-1 block`} /></label>
            <label className="text-[13.5px] font-medium">Smallest group in reports<input name="minCohort" type="number" min={1} defaultValue={c.minCohort} className={`${num} mt-1 block`} /></label>
            <label className="text-[13.5px] font-medium">Default study minutes<input name="defaultStudyMinutes" type="number" defaultValue={c.defaultStudyMinutes} className={`${num} mt-1 block`} /></label>
          </div>
          <div className="mt-4 flex flex-wrap gap-3"><button type="submit" className={btnDark}>Save settings</button><button type="submit" name="reset" value="1" className={btnLine}>Restore starting values</button></div>
          <p className="mt-2 text-[13px] text-ink-3">After changing these, run &ldquo;Reprocess all&rdquo; on the overview to apply them to stored scores.</p>
        </section>
      </form>

      <section className={box} aria-labelledby="t-h">
        <h2 id="t-h" className="mb-1 text-[18px] font-semibold text-ink">Taxonomy ({topics.length} topics)</h2>
        <p className="mb-3 text-[13px] text-ink-3">Rename a topic, move it to another area, reorder it or switch it off. The engine refers to a topic only by its id, so renaming is safe. Adding a brand-new topic needs an adapter change so tests can map to it.</p>
        <div className="space-y-2">
          {topics.map((t) => (
            <details key={t.id} className="rounded-lg border border-black/10 p-3">
              <summary className="cursor-pointer text-[14px] font-medium text-ink">{t.position}. {t.name} <span className="text-[12px] font-normal text-ink-4">({t.id} · {t.area} · {t.items} questions{t.active ? "" : " · off"})</span></summary>
              <form action={topicAction} className="mt-3 flex flex-wrap items-end gap-3">
                <input type="hidden" name="id" value={t.id} />
                <label className="text-[13px] font-medium">Name<input name="name" defaultValue={t.name} className={`${field} mt-1 block w-64`} /></label>
                <label className="text-[13px] font-medium">Area<select name="area" defaultValue={t.area} className={`${field} mt-1 block`}>{AREAS.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
                <label className="text-[13px] font-medium">Order<input name="position" type="number" defaultValue={t.position} className={`${num} mt-1 block`} /></label>
                <label className="flex items-center gap-2 pt-6 text-[13px]"><input type="checkbox" name="active" value="1" defaultChecked={t.active} /> Active</label>
                <button type="submit" className={btnDark}>Save</button>
              </form>
            </details>
          ))}
        </div>
      </section>
    </ConsolePage>
  );
}
