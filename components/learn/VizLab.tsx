"use client";

import { useMemo, useState } from "react";
import { CalcError, parseCalc } from "@/lib/learn/viz/calc";
import { computeViz, type Agg, type DateLevel, type MarkType, type Pill, type QuickCalc, type Shelf, type VizData, type VizFilter, type VizSpec } from "@/lib/learn/viz/engine";
import { formatValue, layoutViz } from "@/lib/learn/viz/layout";

/**
 * A practice viz builder that runs in the browser, in the way Tableau works: a data pane with dimensions and measures, shelves for Columns and Rows, a
 * Marks card (mark type, Color, Size, Label, Detail), filters, sorting and quick table calculations, calculated fields, and a chart that redraws as you
 * change anything. Everything is a normal form control, so it works with a keyboard and a screen reader (there is no drag and drop to learn).
 */
const sel = "min-h-[36px] rounded-md border border-black/[0.18] bg-white px-2 text-[13px] text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-orange-deep";
const chip = "inline-flex flex-wrap items-center gap-1.5 rounded-lg border px-2 py-1 text-[12.5px]";
const AGGS: Array<[Agg, string]> = [["sum", "Sum"], ["avg", "Average"], ["min", "Minimum"], ["max", "Maximum"], ["count", "Count"], ["countd", "Count (distinct)"], ["median", "Median"]];
const DATES: Array<[DateLevel, string]> = [["year", "Year"], ["quarter", "Quarter"], ["month", "Month"], ["day", "Day"]];
const QUICK: Array<[QuickCalc | "", string]> = [["", "No table calculation"], ["running", "Running total"], ["pct", "Percent of total"], ["rank", "Rank"], ["diff", "Difference"]];
const MARKS: Array<[MarkType, string]> = [["auto", "Automatic"], ["bar", "Bar"], ["line", "Line"], ["area", "Area"], ["circle", "Circle"], ["square", "Square"], ["text", "Text"], ["pie", "Pie"]];

export interface VizState { spec: VizSpec; calcs: Record<string, string> }

export default function VizLab({ data, value, label, onChange, allowCalcs = true }: { data: VizData; value: VizState; label: string; onChange: (v: VizState) => void; allowCalcs?: boolean }) {
  const { spec, calcs } = value;
  const [calcText, setCalcText] = useState("");
  const [calcErr, setCalcErr] = useState("");
  const allCalcs = useMemo(() => ({ ...(data.calcs ?? {}), ...calcs }), [data.calcs, calcs]);
  const vdata = useMemo<VizData>(() => ({ ...data, calcs: allCalcs }), [data, allCalcs]);
  const result = useMemo(() => computeViz(vdata, spec), [vdata, spec]);
  const drawing = useMemo(() => (result.ok ? layoutViz(result) : null), [result]);
  const set = (patch: Partial<VizSpec>): void => onChange({ spec: { ...spec, ...patch }, calcs });

  const byName = new Map(data.fields.map((f) => [f.name.toLowerCase(), f]));
  const calcInfo = (name: string): "dimension" | "measure" => { const c = allCalcs[name]; return c && /\b(sum|avg|min|max|count|countd|median|attr)\s*\(|\{/i.test(c) ? "measure" : c && /\bthen\b|"|'|upper\(|lower\(|left\(|right\(/i.test(c) ? "dimension" : "measure"; };
  const roleOf = (name: string): "dimension" | "measure" => byName.get(name.toLowerCase())?.role ?? calcInfo(name);
  const typeOf = (name: string) => byName.get(name.toLowerCase())?.type;
  const fieldOptions = (
    <>
      <optgroup label="Dimensions">{data.fields.filter((f) => f.role === "dimension").map((f) => <option key={f.name} value={f.name}>{f.name}</option>)}</optgroup>
      <optgroup label="Measures">{data.fields.filter((f) => f.role === "measure").map((f) => <option key={f.name} value={f.name}>{f.name}</option>)}</optgroup>
      {Object.keys(allCalcs).length ? <optgroup label="Calculated fields">{Object.keys(allCalcs).map((n) => <option key={n} value={n}>{n}</option>)}</optgroup> : null}
    </>
  );

  const editPill = (p: Pill, next: Pill | null, shelf: Shelf, i: number | null): void => {
    const s = { ...spec };
    if (shelf === "columns" || shelf === "rows") { const arr = [...s[shelf]]; if (next === null) arr.splice(i ?? 0, 1); else arr[i ?? 0] = next; s[shelf] = arr; }
    else if (shelf === "detail") { const arr = [...(s.detail ?? [])]; if (next === null) arr.splice(i ?? 0, 1); else arr[i ?? 0] = next; s.detail = arr.length ? arr : undefined; }
    else { if (next === null) delete s[shelf]; else s[shelf] = next; }
    onChange({ spec: s, calcs });
    void p;
  };
  const addPill = (shelf: Shelf, field: string): void => {
    if (!field) return;
    const s = { ...spec };
    const pill: Pill = { field };
    if (shelf === "columns" || shelf === "rows") s[shelf] = [...s[shelf], pill];
    else if (shelf === "detail") s.detail = [...(s.detail ?? []), pill];
    else s[shelf] = pill;
    onChange({ spec: s, calcs });
  };

  const pillView = (p: Pill, shelf: Shelf, i: number | null) => {
    const role = roleOf(p.field), type = typeOf(p.field);
    const isMeasure = role === "measure" || !!p.agg;
    const aggVal = p.agg ?? "sum";
    return (
      <span key={`${shelf}-${p.field}-${i}`} className={`${chip} ${isMeasure ? "border-emerald-300 bg-emerald-50" : "border-sky-300 bg-sky-50"}`}>
        <b className="text-ink">{p.field}</b>
        {isMeasure && !(allCalcs[p.field] && calcInfo(p.field) === "measure" && !byName.has(p.field.toLowerCase()) && /\b(sum|avg|min|max|count|countd|median|attr)\s*\(|\{/i.test(allCalcs[p.field])) ? (
          <select aria-label={`Aggregation for ${p.field}`} className={sel} value={aggVal} onChange={(e) => editPill(p, { ...p, agg: e.target.value as Agg }, shelf, i)}>{AGGS.filter(([a]) => role === "measure" || a === "count" || a === "countd").map(([a, l]) => <option key={a} value={a}>{l}</option>)}</select>
        ) : null}
        {role === "dimension" && type === "date" && !p.agg ? (
          <select aria-label={`Date level for ${p.field}`} className={sel} value={p.date ?? "year"} onChange={(e) => editPill(p, { ...p, date: e.target.value as DateLevel }, shelf, i)}>{DATES.map(([d, l]) => <option key={d} value={d}>{l}</option>)}</select>
        ) : null}
        {isMeasure ? (
          <select aria-label={`Table calculation for ${p.field}`} className={sel} value={p.quick ?? ""} onChange={(e) => editPill(p, { ...p, quick: (e.target.value || undefined) as QuickCalc | undefined }, shelf, i)}>{QUICK.map(([q, l]) => <option key={q} value={q}>{l}</option>)}</select>
        ) : null}
        <button type="button" aria-label={`Remove ${p.field}`} className="grid h-6 w-6 place-items-center rounded-full text-[15px] leading-none text-ink-3 hover:bg-white hover:text-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-deep" onClick={() => editPill(p, null, shelf, i)}>×</button>
      </span>
    );
  };
  const adder = (shelf: Shelf, name: string) => (
    <select key={`add-${shelf}`} aria-label={`Add a field to ${name}`} className={sel} value="" onChange={(e) => { addPill(shelf, e.target.value); e.currentTarget.value = ""; }}>
      <option value="">+ Add field</option>
      {fieldOptions}
    </select>
  );
  const shelfView = (shelf: "columns" | "rows", name: string) => (
    <div key={shelf} className="flex flex-wrap items-center gap-2 rounded-lg border border-black/[0.1] bg-white p-2">
      <span className="w-16 shrink-0 text-[12.5px] font-semibold uppercase tracking-wide text-ink-3">{name}</span>
      {spec[shelf].map((p, i) => pillView(p, shelf, i))}
      {adder(shelf, name)}
    </div>
  );
  const slot = (shelf: "color" | "size" | "label", name: string) => (
    <div key={shelf} className="flex flex-wrap items-center gap-2">
      <span className="w-14 shrink-0 text-[12.5px] font-semibold text-ink-3">{name}</span>
      {spec[shelf] ? pillView(spec[shelf]!, shelf, null) : adder(shelf, name)}
    </div>
  );

  const filters = spec.filters ?? [];
  const setFilters = (f: VizFilter[]): void => set({ filters: f.length ? f : undefined });
  const distinct = (field: string): string[] => { const f = byName.get(field.toLowerCase()); if (!f) return []; const i = data.fields.indexOf(f); return [...new Set(data.rows.map((r) => String(r[i])))].sort(); };

  const createCalc = (): void => {
    const m = /^\s*([^=]+?)\s*=\s*([\s\S]+)$/.exec(calcText);
    if (!m) { setCalcErr("Write the calculation as Name = formula, for example Profit Ratio = SUM([Profit]) / SUM([Sales])."); return; }
    const name = m[1].trim();
    if (!/^[A-Za-z][A-Za-z0-9 _%-]{0,38}$/.test(name)) { setCalcErr("The name should start with a letter and use only letters, numbers, spaces and _ % -."); return; }
    if (byName.has(name.toLowerCase())) { setCalcErr(`A field called ${name} already exists. Choose another name.`); return; }
    try { parseCalc(m[2]); } catch (e) { setCalcErr(e instanceof CalcError ? `${e.message}${e.hint ? " " + e.hint : ""}` : "That calculation could not be read."); return; }
    setCalcErr("");
    setCalcText("");
    onChange({ spec, calcs: { ...calcs, [name]: m[2].trim() } });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
      <aside aria-label="Data pane" className="rounded-2xl border border-black/[0.1] bg-white p-3">
        <h3 className="px-1 text-[12.5px] font-semibold uppercase tracking-wide text-ink-3">Data ({data.rows.length} rows)</h3>
        <p className="mt-2 px-1 text-[12px] font-semibold text-sky-800">Dimensions</p>
        <ul className="mt-1 flex flex-wrap gap-1 px-1">{data.fields.filter((f) => f.role === "dimension").map((f) => <li key={f.name} className="rounded border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[12px] text-ink">{f.name}</li>)}</ul>
        <p className="mt-3 px-1 text-[12px] font-semibold text-emerald-800">Measures</p>
        <ul className="mt-1 flex flex-wrap gap-1 px-1">{data.fields.filter((f) => f.role === "measure").map((f) => <li key={f.name} className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[12px] text-ink">{f.name}</li>)}</ul>
        {Object.keys(allCalcs).length ? (
          <>
            <p className="mt-3 px-1 text-[12px] font-semibold text-ink-2">Calculated fields</p>
            <ul className="mt-1 space-y-1 px-1">
              {Object.entries(allCalcs).map(([n, f]) => (
                <li key={n} className="rounded bg-cream-2 px-1.5 py-1 text-[12px] text-ink"><b>{n}</b> = <code className="text-[11.5px]">{f}</code>
                  {calcs[n] !== undefined ? <button type="button" aria-label={`Delete calculated field ${n}`} className="ml-1 text-red-700 underline" onClick={() => { const c = { ...calcs }; delete c[n]; onChange({ spec, calcs: c }); }}>delete</button> : null}
                </li>
              ))}
            </ul>
          </>
        ) : null}
        {allowCalcs ? (
          <div className="mt-3 border-t border-black/[0.08] pt-3">
            <label htmlFor="calc-text" className="px-1 text-[12px] font-semibold text-ink-2">Create a calculated field</label>
            <textarea id="calc-text" value={calcText} onChange={(e) => setCalcText(e.target.value)} rows={3} spellCheck={false} placeholder="Name = SUM([Profit]) / SUM([Sales])" className="mt-1 block w-full rounded-lg border border-black/[0.18] bg-white p-2 font-mono text-[12.5px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-deep" />
            <button type="button" onClick={createCalc} className="mt-1 inline-flex min-h-[36px] items-center rounded-md bg-ink px-3 text-[13px] font-semibold text-white hover:bg-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep">Create field</button>
            {calcErr ? <p role="alert" className="mt-1 text-[12.5px] text-red-800">{calcErr}</p> : null}
          </div>
        ) : null}
      </aside>

      <div className="min-w-0 space-y-2">
        {shelfView("columns", "Columns")}
        {shelfView("rows", "Rows")}
        <div className="grid gap-2 rounded-lg border border-black/[0.1] bg-white p-2 sm:grid-cols-2">
          <div className="flex items-center gap-2">
            <label htmlFor="mark-type" className="w-14 shrink-0 text-[12.5px] font-semibold text-ink-3">Marks</label>
            <select id="mark-type" className={sel} value={spec.mark ?? "auto"} onChange={(e) => set({ mark: e.target.value as MarkType })}>{MARKS.map(([m, l]) => <option key={m} value={m}>{l}</option>)}</select>
          </div>
          {slot("color", "Color")}
          {slot("size", "Size")}
          {slot("label", "Label")}
          <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
            <span className="w-14 shrink-0 text-[12.5px] font-semibold text-ink-3">Detail</span>
            {(spec.detail ?? []).map((p, i) => pillView(p, "detail", i))}
            {adder("detail", "Detail")}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-black/[0.1] bg-white p-2">
          <span className="text-[12.5px] font-semibold uppercase tracking-wide text-ink-3">Sort and filter</span>
          <label className="text-[12.5px] text-ink-2">Sort <select className={`${sel} ml-1`} value={spec.sort?.dir ?? ""} onChange={(e) => set({ sort: e.target.value ? { dir: e.target.value as "asc" | "desc" } : undefined })}><option value="">Natural order</option><option value="desc">High to low</option><option value="asc">Low to high</option></select></label>
          <label className="text-[12.5px] text-ink-2">Show <select className={`${sel} ml-1`} value={spec.top ?? 0} onChange={(e) => set({ top: Number(e.target.value) || undefined })}><option value={0}>All</option><option value={3}>Top 3</option><option value={5}>Top 5</option><option value={10}>Top 10</option></select></label>
          <select aria-label="Add a filter" className={sel} value="" onChange={(e) => { if (e.target.value) setFilters([...filters, roleOf(e.target.value) === "measure" ? { field: e.target.value } : { field: e.target.value, values: distinct(e.target.value) }]); e.currentTarget.value = ""; }}>
            <option value="">+ Add filter</option>
            {fieldOptions}
          </select>
        </div>
        {filters.map((f, i) => (
          <div key={`${f.field}${i}`} className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 p-2 text-[13px]">
            <b className="text-ink">Filter: {f.field}</b>
            {f.values ? (
              <details>
                <summary className="cursor-pointer text-ink-2">{f.values.length} selected</summary>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                  {distinct(f.field).map((v) => (
                    <label key={v} className="inline-flex items-center gap-1 text-[12.5px]"><input type="checkbox" checked={f.values!.includes(v)} onChange={(e) => setFilters(filters.map((x, k) => (k === i ? { ...x, values: e.target.checked ? [...(x.values ?? []), v] : (x.values ?? []).filter((y) => y !== v) } : x)))} />{v}</label>
                  ))}
                </div>
              </details>
            ) : (
              <>
                <label className="text-[12.5px]">at least <input type="number" className={`${sel} w-24`} value={f.min ?? ""} onChange={(e) => setFilters(filters.map((x, k) => (k === i ? { ...x, min: e.target.value === "" ? undefined : Number(e.target.value) } : x)))} /></label>
                <label className="text-[12.5px]">at most <input type="number" className={`${sel} w-24`} value={f.max ?? ""} onChange={(e) => setFilters(filters.map((x, k) => (k === i ? { ...x, max: e.target.value === "" ? undefined : Number(e.target.value) } : x)))} /></label>
              </>
            )}
            <button type="button" className="ml-auto text-[12.5px] text-red-800 underline" onClick={() => setFilters(filters.filter((_, k) => k !== i))}>Remove filter</button>
          </div>
        ))}

        <div role="region" aria-label={`${label}: the view`} aria-live="polite" className="rounded-xl border border-black/[0.1] bg-white p-3">
          {!result.ok ? (
            <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-red-950"><p className="text-[14px] font-semibold">That view cannot be drawn</p><p className="mt-1 text-[13.5px]">{result.error}</p>{result.hint ? <p className="mt-1 text-[13px] text-red-900/90">{result.hint}</p> : null}</div>
          ) : drawing && drawing.shapes.length ? (
            <>
              <svg viewBox={`0 0 ${drawing.width} ${drawing.height}`} role="img" aria-label={drawing.caption} className="h-auto w-full max-w-[720px]">
                {drawing.shapes.map((s, i) => {
                  if (s.t === "rect") return <rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} fill={s.fill} rx={2}>{s.title ? <title>{s.title}</title> : null}</rect>;
                  if (s.t === "line") return <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={s.stroke} strokeWidth={s.width ?? 1} />;
                  if (s.t === "path") return <path key={i} d={s.d} stroke={s.stroke} fill={s.fill ?? "none"} strokeWidth={s.width ?? 1} strokeLinejoin="round">{s.title ? <title>{s.title}</title> : null}</path>;
                  if (s.t === "circle") return <circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill={s.fill} fillOpacity={0.85}>{s.title ? <title>{s.title}</title> : null}</circle>;
                  return <text key={i} x={s.x} y={s.y} textAnchor={s.anchor ?? "start"} fontSize={s.size ?? 12} fontWeight={s.weight ?? 400} fill={s.fill ?? "#1f2937"} transform={s.rotate ? `rotate(${s.rotate} ${s.x} ${s.y})` : undefined}>{s.text}</text>;
                })}
              </svg>
              {drawing.legend.length ? <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-ink-2" aria-label={`Legend: ${drawing.legendTitle}`}><li className="font-semibold">{drawing.legendTitle}</li>{drawing.legend.map((l) => <li key={l.label} className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="inline-block h-3 w-3 rounded-sm" style={{ background: l.color }} />{l.label}</li>)}</ul> : null}
              <p className="mt-1 text-[12.5px] text-ink-3">{drawing.caption}{result.note ? ` ${result.note}` : ""}</p>
            </>
          ) : drawing?.table ? (
            <div className="overflow-x-auto" tabIndex={0}>
              <table className="w-full border-collapse text-[13.5px]">
                <thead><tr>{drawing.table.headers.map((h, i) => <th key={i} scope="col" className="whitespace-nowrap border-b border-black/[0.12] bg-cream-2 px-3 py-2 text-left font-semibold">{h}</th>)}</tr></thead>
                <tbody>{drawing.table.rows.map((r, i) => <tr key={i} className="odd:bg-white even:bg-cream-2/50">{r.map((c, j) => <td key={j} className={`whitespace-nowrap border-b border-black/[0.05] px-3 py-1.5 ${typeof c === "number" ? "text-right tabular-nums" : ""}`}>{formatValue(c, result.ok ? result.measLabels[j - result.dimLabels.length] ?? "" : "")}</td>)}</tr>)}</tbody>
              </table>
              <p className="mt-1 text-[12.5px] text-ink-3">{drawing.caption}</p>
            </div>
          ) : <p className="p-3 text-[14px] text-ink-3">{drawing?.caption || "Add fields to Columns and Rows to build a view."}</p>}
          {result.ok && result.points.length ? (
            <details className="mt-2">
              <summary className="cursor-pointer text-[13px] font-medium text-ink-2">View data ({result.points.length} marks)</summary>
              <div className="mt-1 max-h-56 overflow-auto" tabIndex={0}>
                <table className="w-full border-collapse text-[12.5px]">
                  <thead><tr>{[...result.dimLabels, ...result.measLabels].map((h, i) => <th key={i} scope="col" className="whitespace-nowrap border-b border-black/[0.12] bg-cream-2 px-2 py-1 text-left font-semibold">{h}</th>)}</tr></thead>
                  <tbody>{result.points.map((p, i) => <tr key={i}>{[...p.dims, ...p.meas].map((c, j) => <td key={j} className={`whitespace-nowrap border-b border-black/[0.05] px-2 py-1 ${typeof c === "number" ? "text-right tabular-nums" : ""}`}>{formatValue(c, result.measLabels[j - result.dimLabels.length] ?? "")}</td>)}</tr>)}</tbody>
                </table>
              </div>
            </details>
          ) : null}
        </div>
      </div>
    </div>
  );
}
