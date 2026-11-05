"use client";

import { useMemo, useState } from "react";
import { definedMeasures, expandCalendar, runDax, type DaxMatrix, type DaxModel, type DaxResult, type DaxValue, type DaxVisual } from "@/lib/learn/dax/engine";

/**
 * A DAX practice window that runs in the browser: the model on the left (tables, columns, relationships and ready-made measures), an editor for your
 * measures, and a matrix like Power BI's that shows the measure you pick for the visual you pick. Nothing here touches a server.
 */
const show = (v: DaxValue): string => (v === null ? "" : typeof v === "boolean" ? (v ? "TRUE" : "FALSE") : typeof v === "number" ? (Number.isInteger(v) ? v.toLocaleString("en-IN") : String(Math.round(v * 10000) / 10000)) : v);
const btn = "inline-flex min-h-[44px] items-center justify-center rounded-lg px-5 text-[14.5px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep";
const sel = "min-h-[40px] rounded-lg border border-black/[0.18] bg-white px-2.5 text-[14px] text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep";

export default function DaxLab({ model, visuals, show: showMeasure, code, label, onChange, onRun }: { model: DaxModel; visuals: DaxVisual[]; show: string; code: string; label: string; onChange: (c: string) => void; onRun?: (r: DaxResult) => void }) {
  const [vi, setVi] = useState(0);
  const [pick, setPick] = useState<string>("");
  const [res, setRes] = useState<DaxResult | null>(null);
  const [ran, setRan] = useState(0);
  const tables = useMemo(() => model.tables.map(expandCalendar), [model]);
  const defined = definedMeasures(code);
  const measureOptions = useMemo(() => [...new Set([...defined, ...Object.keys(model.measures)])], [defined, model.measures]);
  const chosen = pick && measureOptions.includes(pick) ? pick : defined.find((d) => d.toLowerCase() === showMeasure.toLowerCase()) ?? defined[defined.length - 1] ?? showMeasure;
  const run = () => { const r = runDax(model, code, [visuals[vi] ?? visuals[0]], chosen); setRes(r); setRan((n) => n + 1); onRun?.(r); };
  const mx: DaxMatrix | null = res && res.ok ? res.matrices[0] : null;

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <aside aria-label="The data model" className="rounded-2xl border border-black/[0.1] bg-white p-3">
        <h3 className="px-1 text-[12.5px] font-semibold uppercase tracking-wide text-ink-3">Model</h3>
        <ul className="mt-2 space-y-2">
          {tables.map((t) => (
            <li key={t.name} className="rounded-lg bg-cream-2 p-2">
              <p className="flex items-baseline justify-between text-[13.5px] font-semibold text-ink"><span className="font-mono">{t.name}</span><span className="text-[11.5px] font-normal text-ink-3">{t.rows.length} rows</span></p>
              <p className="mt-1 flex flex-wrap gap-1">{t.columns.map((c) => <code key={c} className="rounded bg-white px-1.5 py-0.5 text-[11.5px] text-ink">{c}</code>)}</p>
            </li>
          ))}
        </ul>
        {model.relationships.length ? (
          <div className="mt-3">
            <p className="px-1 text-[12.5px] font-semibold text-ink-2">Relationships (many → one)</p>
            <ul className="mt-1 space-y-1 px-1 text-[12px] text-ink-2">{model.relationships.map((r) => <li key={r.many + r.one}><code>{r.many}</code> → <code>{r.one}</code></li>)}</ul>
            <p className="mt-1 px-1 text-[11.5px] text-ink-3">Filters flow from the “one” side to the “many” side.</p>
          </div>
        ) : null}
        {Object.keys(model.measures).length ? (
          <div className="mt-3">
            <p className="px-1 text-[12.5px] font-semibold text-ink-2">Ready-made measures</p>
            <ul className="mt-1 space-y-1 px-1 text-[12px] text-ink-2">{Object.entries(model.measures).map(([n, f]) => <li key={n}><code className="font-semibold">[{n}]</code> = <code>{f}</code></li>)}</ul>
          </div>
        ) : null}
      </aside>

      <div className="min-w-0">
        <label htmlFor="dax-editor" className="text-[13px] font-semibold text-ink-2">Your measures <span className="font-normal text-ink-3">(start each measure with Name = formula; indent continuation lines; Ctrl + Enter to run)</span></label>
        <textarea
          id="dax-editor"
          value={code}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          aria-label={`${label}: DAX measures`}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); run(); }
            if (e.key === "Tab" && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
              e.preventDefault();
              const el = e.currentTarget, s = el.selectionStart, en = el.selectionEnd;
              onChange(code.slice(0, s) + "    " + code.slice(en));
              requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = s + 4; });
            }
          }}
          rows={9}
          className="mt-1 block w-full resize-y rounded-xl border border-black/[0.18] bg-[#14181f] p-3.5 font-mono text-[14px] leading-relaxed text-[#e8edf5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep"
        />
        <p className="mt-1 text-[12px] text-ink-3">Tab inserts spaces. Press Esc, then Tab, to move on to the next control.</p>

        <div className="mt-2 flex flex-wrap items-end gap-3">
          <button type="button" onClick={run} className={`${btn} bg-ink text-white hover:bg-black`}>Run</button>
          <label className="text-[12.5px] font-semibold text-ink-2">Visual
            <select value={vi} onChange={(e) => { setVi(Number(e.target.value)); setRes(null); }} className={`${sel} mt-0.5 block`}>{visuals.map((v, i) => <option key={v.label} value={i}>{v.label}</option>)}</select>
          </label>
          <label className="text-[12.5px] font-semibold text-ink-2">Show measure
            <select value={chosen} onChange={(e) => { setPick(e.target.value); setRes(null); }} className={`${sel} mt-0.5 block`}>{measureOptions.map((m) => <option key={m} value={m}>[{m}]</option>)}</select>
          </label>
        </div>

        <div className="mt-3" role="region" aria-label="Visual result" aria-live="polite" key={ran}>
          {!res ? <p className="rounded-xl border border-dashed border-black/[0.18] p-4 text-[14px] text-ink-3">Your visual appears here. Press Run to calculate your measure.</p> : null}
          {res && !res.ok ? (
            <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-950">
              <p className="text-[14.5px] font-semibold">That formula did not run</p>
              <p className="mt-1 text-[14px]">{res.error}</p>
              {res.hint ? <p className="mt-1 text-[13.5px] text-red-900/90">{res.hint}</p> : null}
            </div>
          ) : null}
          {mx ? (
            <div className="rounded-xl border border-black/[0.1] bg-white">
              <p className="border-b border-black/[0.08] px-3.5 py-2 text-[13px] text-ink-2">Showing <b>[{chosen}]</b> by {mx.rowFields.join(", ")}{mx.headers.length > 1 ? " across the columns" : ""}. Rows with no value are hidden, as in Power BI.</p>
              {mx.rows.length === 0 ? <p className="p-4 text-[14px] text-ink-3">The measure has no value for any row of this visual (every cell is blank).</p> : (
                <div className="max-h-[360px] overflow-auto" tabIndex={0}>
                  <table className="w-full border-collapse text-[13.5px]">
                    <thead className="sticky top-0"><tr>{mx.rowFields.map((f) => <th key={f} scope="col" className="whitespace-nowrap border-b border-black/[0.12] bg-cream-2 px-3 py-2 text-left font-semibold text-ink">{f.replace(/^.*\[|\]$/g, "")}</th>)}{mx.headers.map((h, i) => <th key={i} scope="col" className="whitespace-nowrap border-b border-black/[0.12] bg-cream-2 px-3 py-2 text-right font-semibold text-ink">{h}</th>)}</tr></thead>
                    <tbody>
                      {mx.rows.map((r, i) => <tr key={i} className="odd:bg-white even:bg-cream-2/50">{r.header.map((v, j) => <th key={j} scope="row" className="whitespace-nowrap border-b border-black/[0.05] px-3 py-1.5 text-left font-medium text-ink">{v === null ? "(blank)" : String(v)}</th>)}{r.cells.map((v, j) => <td key={j} className="whitespace-nowrap border-b border-black/[0.05] px-3 py-1.5 text-right tabular-nums text-ink">{show(v)}</td>)}</tr>)}
                      <tr className="bg-cream-3 font-semibold"><th scope="row" colSpan={mx.rowFields.length} className="px-3 py-1.5 text-left text-ink">Total</th>{mx.total.map((v, j) => <td key={j} className="px-3 py-1.5 text-right tabular-nums text-ink">{show(v)}</td>)}</tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
