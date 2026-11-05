"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import ChartView from "./ChartView";
import {
  Calculator, chartData, cloneSheet, colName, exportCsv, filterRows, formatValue, importCsv, isErr, parseRef, refName, setCell, setFormat, sortRows,
  MAX_COLS, MAX_ROWS, type CellFormat, type ChartSpec, type SheetState,
} from "@/lib/learn/sheet/engine";

/**
 * A spreadsheet that runs in the browser: a real grid you can click, type into and navigate with the keyboard, with formulas
 * (calculated by the safe engine in lib/learn/sheet, never by eval), formatting, sort, filter, charts, CSV import/export and undo/redo.
 */
type Pt = { c: number; r: number };
const base = "inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded-md border border-black/[0.14] px-2 text-[13px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-orange-deep disabled:opacity-40";
const btn = `${base} bg-white text-ink hover:bg-cream-2`;
const btnOn = `${base} bg-ink text-white hover:bg-ink`;
const FILLS = ["#fff7d6", "#dcfce7", "#dbeafe", "#fde2e2"];

export default function SheetGrid({ sheet, onChange, view, label }: { sheet: SheetState; onChange: (s: SheetState) => void; view?: { cols: number; rows: number }; label: string }) {
  const [cols, setCols] = useState(Math.min(MAX_COLS, view?.cols ?? 7));
  const [rows, setRows] = useState(Math.min(MAX_ROWS, view?.rows ?? 12));
  const [anchor, setAnchor] = useState<Pt>({ c: 0, r: 0 });
  const [focus, setFocus] = useState<Pt>({ c: 0, r: 0 });
  const [edit, setEdit] = useState<{ c: number; r: number; v: string } | null>(null);
  const [hist, setHist] = useState<{ stack: SheetState[]; i: number }>({ stack: [cloneSheet(sheet)], i: 0 });
  const [msg, setMsg] = useState("");
  const [sortCol, setSortCol] = useState(0);
  const [filt, setFilt] = useState({ col: 0, text: "" });
  const [chartForm, setChartForm] = useState<ChartSpec & { open: boolean }>({ open: false, type: "bar", labels: "", values: "", title: "" });
  const dragging = useRef(false);
  const gridRef = useRef<HTMLTableElement>(null);

  const calc = useMemo(() => new Calculator(sheet.cells), [sheet.cells]);
  const sel = { c1: Math.min(anchor.c, focus.c), c2: Math.max(anchor.c, focus.c), r1: Math.min(anchor.r, focus.r), r2: Math.max(anchor.r, focus.r) };
  const selRef = refName(focus.c, focus.r);
  const selRange = sel.c1 === sel.c2 && sel.r1 === sel.r2 ? selRef : `${refName(sel.c1, sel.r1)}:${refName(sel.c2, sel.r2)}`;
  const hidden = useMemo(() => new Set(sheet.hidden ?? []), [sheet.hidden]);

  const commit = useCallback((next: SheetState) => {
    setHist((h) => { const stack = [...h.stack.slice(0, h.i + 1), cloneSheet(next)].slice(-100); return { stack, i: stack.length - 1 }; });
    onChange(next);
  }, [onChange]);
  const mutate = (fn: (s: SheetState) => void) => { const n = cloneSheet(sheet); fn(n); commit(n); };
  const undo = () => setHist((h) => { if (h.i === 0) return h; onChange(cloneSheet(h.stack[h.i - 1])); return { ...h, i: h.i - 1 }; });
  const redo = () => setHist((h) => { if (h.i >= h.stack.length - 1) return h; onChange(cloneSheet(h.stack[h.i + 1])); return { ...h, i: h.i + 1 }; });

  const move = (dc: number, dr: number, extend = false) => {
    const f = { c: Math.max(0, Math.min(cols - 1, focus.c + dc)), r: Math.max(0, Math.min(rows - 1, focus.r + dr)) };
    setFocus(f);
    if (!extend) setAnchor(f);
  };
  const finish = (dc: number, dr: number) => {
    if (!edit) return;
    mutate((s) => { setCell(s, refName(edit.c, edit.r), edit.v); });
    setEdit(null);
    move(dc, dr);
    gridRef.current?.focus();
  };
  const startEdit = (v?: string) => setEdit({ c: focus.c, r: focus.r, v: v ?? sheet.cells[selRef] ?? "" });

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (edit) return;
    const k = e.key;
    if (k === "ArrowUp") { e.preventDefault(); move(0, -1, e.shiftKey); }
    else if (k === "ArrowDown") { e.preventDefault(); move(0, 1, e.shiftKey); }
    else if (k === "ArrowLeft") { e.preventDefault(); move(-1, 0, e.shiftKey); }
    else if (k === "ArrowRight" || (k === "Tab" && !e.shiftKey)) { e.preventDefault(); move(1, 0, e.shiftKey && k !== "Tab"); }
    else if (k === "Tab" && e.shiftKey) { e.preventDefault(); move(-1, 0); }
    else if (k === "Enter" || k === "F2") { e.preventDefault(); startEdit(); }
    else if (k === "Delete" || k === "Backspace") { e.preventDefault(); mutate((s) => { for (let r = sel.r1; r <= sel.r2; r++) for (let c = sel.c1; c <= sel.c2; c++) setCell(s, refName(c, r), ""); }); }
    else if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    else if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === "y") { e.preventDefault(); redo(); }
    else if (k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); startEdit(k); }
  };

  const fmt = (patch: CellFormat) => mutate((s) => { for (let r = sel.r1; r <= sel.r2; r++) for (let c = sel.c1; c <= sel.c2; c++) setFormat(s, refName(c, r), patch); });
  const curFmt = sheet.formats[selRef] ?? {};

  const dataRows = (): number => { // last row of the block that starts under the header row
    let last = 0;
    for (let r = 1; r < MAX_ROWS; r++) { let any = false; for (let c = 0; c < cols; c++) if ((sheet.cells[refName(c, r)] ?? "") !== "") any = true; if (!any) break; last = r; }
    return last;
  };
  const doSort = (dir: "asc" | "desc") => {
    const last = dataRows();
    if (last < 2) { setMsg("There is not enough data under the header row to sort."); return; }
    mutate((s) => { sortRows(s, 1, last, sortCol, dir, cols - 1); s.hidden = undefined; });
    setMsg(`Sorted rows 2 to ${last + 1} by column ${colName(sortCol)}, ${dir === "asc" ? "smallest first" : "largest first"}. Formulas are not rewritten when rows move, so check them.`);
  };
  const doFilter = () => {
    const last = dataRows();
    const h = filterRows(sheet, 1, Math.max(last, 1), filt.col, filt.text);
    mutate((s) => { s.hidden = h.length ? h : undefined; });
    setMsg(filt.text.trim() ? `Showing rows where column ${colName(filt.col)} matches "${filt.text.trim()}". The hidden rows are still in your data.` : "Filter cleared.");
  };
  const addChart = () => {
    const spec: ChartSpec = { type: chartForm.type, labels: chartForm.labels.trim().toUpperCase(), values: chartForm.values.trim().toUpperCase(), title: chartForm.title?.trim() || undefined };
    const d = chartData(sheet, spec);
    if (!d.ok) { setMsg(d.problem ?? "That chart cannot be made."); return; }
    if (sheet.charts.length >= 5) { setMsg("A practice sheet can hold up to 5 charts."); return; }
    mutate((s) => { s.charts.push(spec); });
    setChartForm({ ...chartForm, open: false });
    setMsg("Chart added below the grid.");
  };
  const openChart = () => {
    const sameCols = sel.c1 !== sel.c2;
    setChartForm({ open: !chartForm.open, type: chartForm.type, title: "", labels: sameCols ? `${refName(sel.c1, sel.r1)}:${refName(sel.c1, sel.r2)}`.replace(/^([A-Z])\d+:/, (m) => m) : chartForm.labels, values: sameCols ? `${refName(sel.c1 + 1, sel.r1)}:${refName(sel.c1 + 1, sel.r2)}` : chartForm.values });
  };
  const download = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([exportCsv(sheet)], { type: "text/csv" }));
    a.download = `${label.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "sheet"}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  const onImport = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 100_000) { setMsg("That file is too large for the practice sheet (limit 100 KB)."); return; }
    const r = importCsv(await file.text());
    if ("error" in r) { setMsg(r.error); return; }
    mutate((s) => { s.cells = r.cells; s.hidden = undefined; });
    setCols((c) => Math.max(c, Math.min(MAX_COLS, r.cols)));
    setRows((x) => Math.max(x, Math.min(MAX_ROWS, r.rows + 2)));
    setMsg(`Imported ${r.rows} rows and ${r.cols} columns${r.truncated ? " (the file was larger than the sheet, so the extra part was left out)" : ""}.`);
  };

  const selVal = calc.value(selRef);
  const help = isErr(selVal) ? `${selRef}: ${selVal.err}. ${selVal.msg}` : sheet.cells[selRef]?.startsWith("=") ? `${selRef} is a formula. It shows the result; the formula bar shows what you typed.` : `${selRef} selected. Type to enter something, or start with = to write a formula.`;

  return (
    <div>
      <div role="toolbar" aria-label="Spreadsheet tools" className="flex flex-wrap items-center gap-1.5 rounded-t-xl border border-black/[0.12] bg-cream-2 p-2">
        <button type="button" className={btn} aria-label="Undo" onClick={undo} disabled={hist.i === 0}>&#8630;</button>
        <button type="button" className={btn} aria-label="Redo" onClick={redo} disabled={hist.i >= hist.stack.length - 1}>&#8631;</button>
        <span className="mx-1 h-6 w-px bg-black/[0.15]" aria-hidden="true" />
        <button type="button" className={`${curFmt.bold ? btnOn : btn} font-bold`} aria-label="Bold" aria-pressed={Boolean(curFmt.bold)} onClick={() => fmt({ bold: !curFmt.bold })}>B</button>
        <button type="button" className={btn} aria-label="Align left" onClick={() => fmt({ align: "left" })}>&#8676;</button>
        <button type="button" className={btn} aria-label="Centre" onClick={() => fmt({ align: "center" })}>&#8596;</button>
        <button type="button" className={btn} aria-label="Align right" onClick={() => fmt({ align: "right" })}>&#8677;</button>
        <label className="sr-only" htmlFor="sg-num">Number format</label>
        <select id="sg-num" className={`${btn} pr-6`} value={curFmt.num ?? "auto"} onChange={(e) => fmt({ num: e.target.value as CellFormat["num"] })}>
          <option value="auto">General</option><option value="int">Whole number</option><option value="dec2">2 decimals</option><option value="currency">Currency (&#8377;)</option><option value="date">Date (31-Jan-2026)</option><option value="percent">Percent</option>
        </select>
        {FILLS.map((f) => <button key={f} type="button" className="h-8 w-8 rounded-md border border-black/[0.2]" style={{ background: f }} aria-label={`Fill colour ${f}`} onClick={() => fmt({ bg: f })} />)}
        <button type="button" className={btn} onClick={() => fmt({ bg: undefined })}>No fill</button>
        <span className="mx-1 h-6 w-px bg-black/[0.15]" aria-hidden="true" />
        <label className="sr-only" htmlFor="sg-sortcol">Sort by column</label>
        <select id="sg-sortcol" className={`${btn} pr-6`} value={sortCol} onChange={(e) => setSortCol(Number(e.target.value))}>{Array.from({ length: cols }, (_, c) => <option key={c} value={c}>Column {colName(c)}</option>)}</select>
        <button type="button" className={btn} onClick={() => doSort("asc")}>Sort A&#8594;Z</button>
        <button type="button" className={btn} onClick={() => doSort("desc")}>Sort Z&#8594;A</button>
        <span className="mx-1 h-6 w-px bg-black/[0.15]" aria-hidden="true" />
        <label className="sr-only" htmlFor="sg-fcol">Filter column</label>
        <select id="sg-fcol" className={`${btn} pr-6`} value={filt.col} onChange={(e) => setFilt({ ...filt, col: Number(e.target.value) })}>{Array.from({ length: cols }, (_, c) => <option key={c} value={c}>Filter {colName(c)}</option>)}</select>
        <label className="sr-only" htmlFor="sg-ftext">Filter condition</label>
        <input id="sg-ftext" className="min-h-[36px] w-28 rounded-md border border-black/[0.2] px-2 text-[13px]" placeholder="e.g. >=50" value={filt.text} onChange={(e) => setFilt({ ...filt, text: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") doFilter(); }} />
        <button type="button" className={btn} onClick={doFilter}>Filter</button>
        <button type="button" className={btn} onClick={() => { setFilt({ ...filt, text: "" }); mutate((s) => { s.hidden = undefined; }); setMsg("Filter cleared."); }}>Clear</button>
        <span className="mx-1 h-6 w-px bg-black/[0.15]" aria-hidden="true" />
        <button type="button" className={btn} aria-expanded={chartForm.open} onClick={openChart}>Chart</button>
        <label className={`${btn} cursor-pointer`}>Import CSV<input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => { void onImport(e.target.files?.[0]); e.target.value = ""; }} /></label>
        <button type="button" className={btn} onClick={download}>Download CSV</button>
      </div>

      {chartForm.open ? (
        <div className="flex flex-wrap items-end gap-3 border-x border-black/[0.12] bg-white p-3">
          <div><label htmlFor="sg-ctype" className="block text-[12px] text-ink-3">Chart type</label><select id="sg-ctype" className="min-h-[40px] rounded-md border border-black/[0.2] px-2 text-[14px]" value={chartForm.type} onChange={(e) => setChartForm({ ...chartForm, type: e.target.value as ChartSpec["type"] })}><option value="bar">Bar</option><option value="line">Line</option><option value="pie">Pie</option></select></div>
          <div><label htmlFor="sg-clab" className="block text-[12px] text-ink-3">Labels (e.g. A2:A7)</label><input id="sg-clab" className="min-h-[40px] w-28 rounded-md border border-black/[0.2] px-2 text-[14px]" value={chartForm.labels} onChange={(e) => setChartForm({ ...chartForm, labels: e.target.value })} /></div>
          <div><label htmlFor="sg-cval" className="block text-[12px] text-ink-3">Values (e.g. B2:B7)</label><input id="sg-cval" className="min-h-[40px] w-28 rounded-md border border-black/[0.2] px-2 text-[14px]" value={chartForm.values} onChange={(e) => setChartForm({ ...chartForm, values: e.target.value })} /></div>
          <div><label htmlFor="sg-ctitle" className="block text-[12px] text-ink-3">Title (optional)</label><input id="sg-ctitle" maxLength={80} className="min-h-[40px] w-44 rounded-md border border-black/[0.2] px-2 text-[14px]" value={chartForm.title} onChange={(e) => setChartForm({ ...chartForm, title: e.target.value })} /></div>
          <button type="button" className="min-h-[40px] rounded-md bg-orange-deep px-4 text-[14px] font-semibold text-white hover:bg-ink" onClick={addChart}>Add chart</button>
        </div>
      ) : null}

      <div className="flex items-center gap-2 border-x border-black/[0.12] bg-white px-2 py-1.5">
        <span className="w-14 shrink-0 rounded bg-cream-3 px-2 py-1 text-center text-[13px] font-semibold text-ink" aria-label="Selected cell">{selRange}</span>
        <span className="text-[13px] text-ink-3" aria-hidden="true">fx</span>
        <input
          aria-label="Formula bar"
          className="min-h-[36px] flex-1 rounded border border-black/[0.14] px-2 font-mono text-[14px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-deep"
          value={edit ? edit.v : sheet.cells[selRef] ?? ""}
          onFocus={() => { if (!edit) startEdit(); }}
          onChange={(e) => setEdit({ c: focus.c, r: focus.r, v: e.target.value })}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); finish(0, 1); } else if (e.key === "Escape") { setEdit(null); gridRef.current?.focus(); } }}
          onBlur={() => { if (edit) finish(0, 0); }}
          maxLength={500}
        />
      </div>

      <div className="max-h-[420px] overflow-auto border border-black/[0.12] bg-white">
        <table
          ref={gridRef}
          role="grid"
          aria-label={`${label}: spreadsheet. Use the arrow keys to move, Enter to edit.`}
          aria-rowcount={rows}
          aria-colcount={cols}
          tabIndex={0}
          className="w-full min-w-[420px] select-none border-collapse text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-orange-deep"
          onKeyDown={onKeyDown}
          onMouseUp={() => { dragging.current = false; }}
        >
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-20 h-8 w-10 border border-black/[0.12] bg-cream-3"><span className="sr-only">Row number</span></th>
              {Array.from({ length: cols }, (_, c) => <th key={c} scope="col" className={`sticky top-0 z-10 h-8 min-w-[84px] border border-black/[0.12] text-[12px] font-semibold ${c >= sel.c1 && c <= sel.c2 ? "bg-orange-light text-orange-deep" : "bg-cream-3 text-ink-2"}`}>{colName(c)}</th>)}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }, (_, r) => hidden.has(r) ? null : (
              <tr key={r}>
                <th scope="row" className={`sticky left-0 z-10 w-10 border border-black/[0.12] text-center text-[12px] font-semibold ${r >= sel.r1 && r <= sel.r2 ? "bg-orange-light text-orange-deep" : "bg-cream-3 text-ink-2"}`}>{r + 1}</th>
                {Array.from({ length: cols }, (_, c) => {
                  const ref = refName(c, r);
                  const v = calc.value(ref);
                  const f = sheet.formats[ref] ?? {};
                  const inSel = c >= sel.c1 && c <= sel.c2 && r >= sel.r1 && r <= sel.r2;
                  const isFocus = c === focus.c && r === focus.r;
                  const bad = isErr(v);
                  return (
                    <td
                      key={c}
                      role="gridcell"
                      aria-selected={inSel}
                      aria-label={`${ref}${bad ? `, error ${v.err}` : ""}`}
                      title={bad ? v.msg : undefined}
                      className={`h-8 min-w-[84px] max-w-[220px] cursor-cell truncate border border-black/[0.1] px-1.5 ${inSel ? "bg-orange-light/60" : ""} ${isFocus ? "outline outline-2 -outline-offset-2 outline-orange-deep" : ""} ${bad ? "text-red-700" : ""} ${f.bold ? "font-bold" : ""}`}
                      style={{ textAlign: f.align ?? (typeof v === "number" ? "right" : "left"), background: !inSel && f.bg ? f.bg : undefined }}
                      onMouseDown={(e) => { if (edit) finish(0, 0); const p = { c, r }; setFocus(p); if (!e.shiftKey) setAnchor(p); dragging.current = true; gridRef.current?.focus(); }}
                      onMouseEnter={() => { if (dragging.current) setFocus({ c, r }); }}
                      onDoubleClick={() => startEdit()}
                    >
                      {edit && edit.c === c && edit.r === r ? (
                        <input
                          autoFocus
                          aria-label={`Edit ${ref}`}
                          className="h-full w-full bg-white px-1 font-mono text-[14px] outline-none"
                          value={edit.v}
                          maxLength={500}
                          onChange={(e) => setEdit({ ...edit, v: e.target.value })}
                          onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") { e.preventDefault(); finish(0, 1); } else if (e.key === "Tab") { e.preventDefault(); finish(e.shiftKey ? -1 : 1, 0); } else if (e.key === "Escape") { setEdit(null); gridRef.current?.focus(); } }}
                          onBlur={() => { if (edit) finish(0, 0); }}
                        />
                      ) : formatValue(v, f)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-2 rounded-b-xl border border-t-0 border-black/[0.12] bg-cream-2 px-2 py-1.5">
        <button type="button" className={btn} onClick={() => setRows((r) => Math.min(MAX_ROWS, r + 5))} disabled={rows >= MAX_ROWS}>+ 5 rows</button>
        <button type="button" className={btn} onClick={() => setCols((c) => Math.min(MAX_COLS, c + 1))} disabled={cols >= MAX_COLS}>+ column</button>
        <p className="flex-1 text-[12.5px] text-ink-3" aria-live="polite">{msg || help}</p>
      </div>
      {sheet.charts.length ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {sheet.charts.map((c, i) => (
            <div key={i}>
              <ChartView spec={c} data={chartData(sheet, c)} />
              <button type="button" className="mt-1 min-h-[36px] text-[12.5px] text-ink-3 underline" onClick={() => mutate((s) => { s.charts.splice(i, 1); })}>Remove this chart</button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export { parseRef };
