import Link from "next/link";
import type { ReactNode } from "react";
import { CsvButton } from "./csv-button";
import { Spark, delta as dl } from "./charts";

/** Building blocks for the analytics tabs: KPI tile, card and a data table that can be exported as CSV. */
export function DeltaBadge({ d }: { d: number | null }) {
  if (d === null) return <span className="text-[12px] text-ink-4" title="No earlier data to compare">new</span>;
  const cls = d > 0 ? "text-emerald-700" : d < 0 ? "text-red-700" : "text-ink-3";
  return <span className={`text-[12px] font-semibold ${cls}`}><span aria-hidden="true">{d > 0 ? "▲" : d < 0 ? "▼" : "▬"}</span> {Math.abs(d)}%<span className="sr-only"> {d > 0 ? "up" : d < 0 ? "down" : "unchanged"} compared with the previous period</span></span>;
}

const TONES: Record<string, string> = { "": "", hl: "ring-1 ring-orange/40 bg-orange-light/40", warn: "ring-1 ring-amber-300 bg-amber-50", bad: "ring-1 ring-red-300 bg-red-50" };

export function Kpi({ label, value, href, now, prev, note, spark, tone = "" }: { label: string; value: ReactNode; href?: string | null; now?: number; prev?: number; note?: string; spark?: number[]; tone?: "" | "hl" | "warn" | "bad" }) {
  const inner = (
    <>
      <span className="block text-[13px] text-ink-3">{label}</span>
      <span className="block text-[24px] font-bold text-ink leading-tight">{value}</span>
      <span className="flex flex-wrap items-center gap-x-2 text-[12px] text-ink-4">{now !== undefined && prev !== undefined ? <DeltaBadge d={dl(now, prev)} /> : null}{note ? <small>{note}</small> : null}</span>
      {spark ? <Spark values={spark} /> : null}
    </>
  );
  const cls = `block bg-white rounded-2xl border border-black/[0.08] shadow-card p-4 ${TONES[tone]}`;
  return href ? <Link href={href} className={`${cls} hover:shadow-md`}>{inner}</Link> : <div className={cls}>{inner}</div>;
}

export const KpiGrid = ({ children }: { children: ReactNode }) => <div role="list" className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">{children}</div>;
export const Grid = ({ children }: { children: ReactNode }) => <div className="grid xl:grid-cols-2 gap-5 mb-5">{children}</div>;

export function Card({ title, children, wide = false, link, linkLabel, hint, tools }: { title: string; children: ReactNode; wide?: boolean; link?: string; linkLabel?: string; hint?: string; tools?: ReactNode }) {
  return (
    <section className={`bg-white rounded-2xl border border-black/[0.08] shadow-card p-5 ${wide ? "xl:col-span-2" : ""}`}>
      <header className="flex flex-wrap items-center justify-between gap-2 mb-3"><h2 className="text-[17px] font-semibold text-ink">{title}</h2>
        <span className="flex items-center gap-3">{tools}{link ? <Link className="text-[13px] underline" href={link}>{linkLabel ?? "Open"} &rarr;</Link> : null}</span></header>
      {hint ? <p className="text-[13px] text-ink-4 -mt-1 mb-3">{hint}</p> : null}
      {children}
    </section>
  );
}

export type Cell = string | number | { text: string; href: string; ext?: boolean };

export function DTable({ id, title, headers, rows, empty = "Nothing to show yet.", link, linkLabel }: { id: string; title: string; headers: string[]; rows: Cell[][]; empty?: string; link?: string; linkLabel?: string }) {
  const left = (i: number) => i === 0 || headers[i].startsWith("~");
  const label = (h: string) => h.replace(/^~/, "");
  return (
    <Card title={title} wide link={link} linkLabel={linkLabel} tools={rows.length ? <CsvButton tableId={id} name={id} /> : null}>
      <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={title}>
        <table id={id} className="w-full text-[14px] min-w-[28rem]">
          <thead><tr>{headers.map((h, i) => <th key={h} scope="col" className={`py-2 pr-3 font-medium text-ink-4 ${left(i) ? "text-left" : "text-right"}`}>{label(h)}</th>)}</tr></thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={ri} className="border-t border-black/[0.07]">
                {r.map((cell, i) => {
                  const body = typeof cell === "object" ? (cell.ext ? <a className="underline" href={cell.href} target="_blank" rel="noopener noreferrer">{cell.text}</a> : <Link className="underline" href={cell.href}>{cell.text}</Link>) : typeof cell === "number" ? cell.toLocaleString("en-IN") : cell;
                  return i === 0 ? <th key={i} scope="row" className="py-2 pr-3 text-left font-medium">{body}</th> : <td key={i} className={`py-2 pr-3 ${left(i) ? "text-left" : "text-right"}`}>{body}</td>;
                })}
              </tr>
            ))}
            {!rows.length ? <tr><td colSpan={headers.length} className="py-4 text-ink-4">{empty}</td></tr> : null}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
