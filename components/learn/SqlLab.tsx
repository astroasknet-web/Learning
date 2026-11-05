"use client";

import { useMemo, useRef, useState } from "react";
import { runSql, type SqlResult, type SqlTable, type SqlValue } from "@/lib/learn/sql/engine";

/**
 * A real SQL practice window that runs in the browser: the tables on the left (click a name to see its columns and a few rows), an editor, a Run
 * button (Ctrl or Cmd + Enter) and a result grid. Queries only read; nothing here touches a server or a database.
 */
const show = (v: SqlValue): string => (v === null ? "NULL" : typeof v === "boolean" ? (v ? "TRUE" : "FALSE") : String(v));
const btn = "inline-flex min-h-[44px] items-center justify-center rounded-lg px-5 text-[14.5px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep";

export default function SqlLab({ tables, query, label, onChange, onRun }: { tables: SqlTable[]; query: string; label: string; onChange: (q: string) => void; onRun?: (r: SqlResult) => void }) {
  const [res, setRes] = useState<SqlResult | null>(null);
  const [open, setOpen] = useState<string>(tables[0]?.name ?? "");
  const [ran, setRan] = useState(0);
  const area = useRef<HTMLTextAreaElement>(null);
  const db = useMemo(() => ({ tables }), [tables]);
  const run = () => { const r = runSql(db, query); setRes(r); setRan((n) => n + 1); onRun?.(r); };
  const t = tables.find((x) => x.name === open);

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      <aside aria-label="Tables you can query" className="rounded-2xl border border-black/[0.1] bg-white p-3">
        <h3 className="px-1 text-[12.5px] font-semibold uppercase tracking-wide text-ink-3">Tables</h3>
        <ul className="mt-2 space-y-1">
          {tables.map((x) => (
            <li key={x.name}>
              <button type="button" aria-pressed={open === x.name} onClick={() => setOpen(x.name)} className={`flex w-full items-baseline justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-[14px] font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-deep ${open === x.name ? "bg-orange-deep text-white" : "bg-cream-2 text-ink hover:bg-cream-3"}`}>
                <span className="font-mono">{x.name}</span><span className={`text-[12px] ${open === x.name ? "text-white/85" : "text-ink-3"}`}>{x.rows.length} rows</span>
              </button>
            </li>
          ))}
        </ul>
        {t ? (
          <div className="mt-3">
            <p className="px-1 text-[12.5px] font-semibold text-ink-2">Columns in <span className="font-mono">{t.name}</span></p>
            <p className="mt-1 flex flex-wrap gap-1.5 px-1">{t.columns.map((c) => <code key={c} className="rounded bg-cream-3 px-1.5 py-0.5 text-[12.5px] text-ink">{c}</code>)}</p>
            <div className="mt-2 overflow-x-auto rounded-lg border border-black/[0.08]" role="region" aria-label={`First rows of ${t.name}`} tabIndex={0}>
              <table className="w-full border-collapse text-[12px]">
                <thead><tr>{t.columns.map((c) => <th key={c} scope="col" className="whitespace-nowrap border-b border-black/[0.1] bg-cream-2 px-2 py-1 text-left font-semibold text-ink-2">{c}</th>)}</tr></thead>
                <tbody>{t.rows.slice(0, 4).map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j} className={`whitespace-nowrap border-b border-black/[0.05] px-2 py-1 ${v === null ? "italic text-ink-3" : "text-ink"}`}>{show(v)}</td>)}</tr>)}</tbody>
              </table>
            </div>
          </div>
        ) : null}
      </aside>

      <div className="min-w-0">
        <label htmlFor="sql-editor" className="text-[13px] font-semibold text-ink-2">Your query <span className="font-normal text-ink-3">(press Ctrl + Enter to run)</span></label>
        <textarea
          id="sql-editor"
          ref={area}
          value={query}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          aria-label={`${label}: SQL query`}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); run(); }
            if (e.key === "Tab" && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) { // keep Tab for indenting; Esc then Tab leaves the box
              e.preventDefault();
              const el = e.currentTarget, s = el.selectionStart, en = el.selectionEnd;
              onChange(query.slice(0, s) + "  " + query.slice(en));
              requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = s + 2; });
            }
          }}
          rows={9}
          className="mt-1 block w-full resize-y rounded-xl border border-black/[0.18] bg-[#14181f] p-3.5 font-mono text-[14px] leading-relaxed text-[#e8edf5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep"
        />
        <p className="mt-1 text-[12px] text-ink-3">Tab inserts spaces. Press Esc, then Tab, to move on to the next control.</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button type="button" onClick={run} className={`${btn} bg-ink text-white hover:bg-black`}>Run query</button>
          <button type="button" onClick={() => { onChange(""); setRes(null); area.current?.focus(); }} className={`${btn} border border-black/[0.18] bg-white text-ink hover:bg-cream-2`}>Clear</button>
        </div>

        <div className="mt-3" role="region" aria-label="Query result" aria-live="polite" key={ran}>
          {!res ? <p className="rounded-xl border border-dashed border-black/[0.18] p-4 text-[14px] text-ink-3">Your result appears here. Run a query to see it.</p> : null}
          {res && !res.ok ? (
            <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-950">
              <p className="text-[14.5px] font-semibold">That did not run</p>
              <p className="mt-1 text-[14px]">{res.error}</p>
              {res.hint ? <p className="mt-1 text-[13.5px] text-red-900/90">{res.hint}</p> : null}
            </div>
          ) : null}
          {res && res.ok ? (
            <div className="rounded-xl border border-black/[0.1] bg-white">
              <p className="border-b border-black/[0.08] px-3.5 py-2 text-[13px] text-ink-2"><b>{res.rows.length}</b> row{res.rows.length === 1 ? "" : "s"}, <b>{res.columns.length}</b> column{res.columns.length === 1 ? "" : "s"}{res.truncated ? " (showing the first 500)" : ""}</p>
              {res.rows.length === 0 ? <p className="p-4 text-[14px] text-ink-3">The query ran, but no rows matched.</p> : (
                <div className="max-h-[360px] overflow-auto" tabIndex={0}>
                  <table className="w-full border-collapse text-[13.5px]">
                    <thead className="sticky top-0"><tr>{res.columns.map((c, i) => <th key={i} scope="col" className="whitespace-nowrap border-b border-black/[0.12] bg-cream-2 px-3 py-2 text-left font-semibold text-ink">{c}</th>)}</tr></thead>
                    <tbody>{res.rows.map((r, i) => <tr key={i} className="odd:bg-white even:bg-cream-2/50">{r.map((v, j) => <td key={j} className={`whitespace-nowrap border-b border-black/[0.05] px-3 py-1.5 ${typeof v === "number" ? "text-right tabular-nums" : ""} ${v === null ? "italic text-ink-3" : "text-ink"}`}>{show(v)}</td>)}</tr>)}</tbody>
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
