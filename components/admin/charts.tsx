import Link from "next/link";
import type { ReactNode } from "react";

/** Server-rendered SVG charts for the admin dashboards (port of Portal\Charts): no client JavaScript, readable by screen readers through titles and text. */
export const COLORS = ["#ea580c", "#2563eb", "#059669", "#7c3aed", "#d97706", "#db2777", "#0891b2", "#64748b"];
const c = (i: number) => COLORS[i % COLORS.length];

export const num = (v: number | string | null | undefined, dec = 0): string => Number(v ?? 0).toLocaleString("en-IN", { minimumFractionDigits: dec, maximumFractionDigits: dec });
/** 12,400 -> 12.4K, 3,200,000 -> 32L, 1e7 -> 1Cr (Indian grouping, as the PHP dashboard did). */
export function short(v: number): string {
  const a = Math.abs(v);
  const f = (x: number, s: string) => `${Number(x.toFixed(1))}${s}`;
  if (a >= 1e7) return f(v / 1e7, "Cr");
  if (a >= 1e5) return f(v / 1e5, "L");
  if (a >= 1e3) return f(v / 1e3, "K");
  return num(v);
}
export const delta = (now: number, prev: number): number | null => (prev > 0 ? Math.round(((now - prev) / prev) * 1000) / 10 : null);
export const pct = (part: number, whole: number, dec = 0): string => (whole > 0 ? `${((part / whole) * 100).toFixed(dec)}%` : "n/a");
export const inr = (v: number): string => `₹${short(v)}`;

export function Spark({ values, w = 120, h = 34 }: { values: number[]; w?: number; h?: number }) {
  const max = Math.max(0, ...values);
  if (values.length < 2 || max <= 0) return <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-8" aria-hidden="true" focusable="false"><line x1="0" y1={h - 2} x2={w} y2={h - 2} stroke="#cbd5e1" strokeWidth="1.5" /></svg>;
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * w).toFixed(1)},${(h - 3 - (v / max) * (h - 6)).toFixed(1)}`).join(" ");
  return <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-8" aria-hidden="true" focusable="false"><polyline points={pts} fill="none" stroke="#ea580c" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" /></svg>;
}

function niceMax(m: number): number {
  if (m <= 4) return 4;
  const mag = 10 ** Math.floor(Math.log10(m));
  for (const k of [1, 2, 2.5, 5, 10]) if (m <= k * mag) return k * mag;
  return 10 * mag;
}
const dlabel = (d: string, long: boolean) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", long ? { month: "short", year: "2-digit", timeZone: "UTC" } : { day: "numeric", month: "short", timeZone: "UTC" });

export function Empty({ children = "Nothing to show yet." }: { children?: ReactNode }) {
  return <p className="text-[14px] text-ink-4 py-4">{children}</p>;
}

export function LineChart({ labels, series, title, compact = false }: { labels: string[]; series: Record<string, number[]>; title: string; compact?: boolean }) {
  const n = labels.length;
  const names = Object.keys(series);
  if (!n || !names.length) return <Empty>No data in this period.</Empty>;
  const W = compact ? 360 : 640, H = compact ? 230 : 250, L = 44, R = 12, T = 12, B = 30;
  const max = niceMax(Math.max(0, ...names.flatMap((k) => series[k])));
  const px = (i: number) => L + (n > 1 ? i / (n - 1) : 0.5) * (W - L - R);
  const py = (v: number) => T + (1 - (max > 0 ? v / max : 0)) * (H - T - B);
  const step = Math.max(1, Math.ceil(n / (compact ? 4 : 7)));
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title} preserveAspectRatio="xMidYMid meet" className="w-full h-auto"><title>{title}</title>
        {[0, 1, 2, 3, 4].map((g) => { const v = (max * g) / 4; const y = py(v); return <g key={g}><line x1={L} x2={W - R} y1={y} y2={y} stroke="#e5e7eb" /><text x={L - 6} y={y + 4} textAnchor="end" fontSize="10" fill="#64748b">{short(v)}</text></g>; })}
        {labels.map((d, i) => (i % step === 0 ? <text key={d} x={px(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="#64748b">{dlabel(d, n > 120)}</text> : null))}
        {names.map((name, k) => {
          const vals = series[name];
          const pts = vals.map((v, i) => `${px(i).toFixed(1)},${py(v).toFixed(1)}`);
          return (
            <g key={name}>
              {k === 0 && n > 1 ? <polygon points={`${px(0).toFixed(1)},${py(0).toFixed(1)} ${pts.join(" ")} ${px(n - 1).toFixed(1)},${py(0).toFixed(1)}`} fill={c(0)} opacity="0.08" /> : null}
              <polyline points={pts.join(" ")} fill="none" stroke={c(k)} strokeWidth="2" strokeLinejoin="round" />
              {n <= 45 ? vals.map((v, i) => <circle key={i} cx={px(i)} cy={py(v)} r="2.6" fill={c(k)}><title>{`${dlabel(labels[i], false)}: ${num(v)} (${name})`}</title></circle>) : null}
            </g>
          );
        })}
      </svg>
      <figcaption className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-3 mt-1">{names.map((name, k) => <span key={name} className="inline-flex items-center gap-1.5"><i className="w-3 h-3 rounded-sm inline-block" style={{ background: c(k) }} />{name} <b className="text-ink">{num(series[name].reduce((a, b) => a + b, 0))}</b></span>)}</figcaption>
    </figure>
  );
}

/** Horizontal bar list. rows = [label, value, href?, sub?] */
export function HBars({ rows, title = "" }: { rows: Array<[string, number, string?, string?]>; title?: string }) {
  if (!rows.length) return <Empty />;
  const max = Math.max(1, ...rows.map((r) => r[1]));
  const total = rows.reduce((a, r) => a + r[1], 0);
  return (
    <ul aria-label={title || undefined} className="space-y-2">
      {rows.map((r, i) => (
        <li key={`${r[0]}-${i}`} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] sm:grid-cols-[minmax(0,12rem)_1fr_auto] items-center gap-3 text-[14px]">
          <span className="truncate">{r[2] ? <Link className="underline" href={r[2]}>{r[0]}</Link> : r[0]}{r[3] ? <small className="block text-ink-4 text-[12px]">{r[3]}</small> : null}</span>
          <span aria-hidden="true" className="h-2.5 rounded bg-cream-3"><i className="block h-2.5 rounded" style={{ width: `${Math.max(1.5, (r[1] / max) * 100).toFixed(1)}%`, background: c(i) }} /></span>
          <span className="font-semibold text-ink whitespace-nowrap">{num(r[1])}{total > 0 ? <small className="text-ink-4 font-normal ml-1">{Math.round((r[1] / total) * 100)}%</small> : null}</span>
        </li>
      ))}
    </ul>
  );
}

export function Donut({ parts, title, centre = "" }: { parts: Record<string, number>; title: string; centre?: string }) {
  const entries = Object.entries(parts).filter(([, v]) => v > 0);
  const total = entries.reduce((a, [, v]) => a + v, 0);
  if (total <= 0) return <Empty />;
  let off = 0;
  const r = 15.9155;
  return (
    <div className="flex flex-wrap items-center gap-5">
      <svg viewBox="0 0 42 42" role="img" aria-label={title} className="w-36 h-36 shrink-0"><title>{title}</title>
        <circle cx="21" cy="21" r={r} fill="none" stroke="#eef0f3" strokeWidth="5" />
        {entries.map(([label, v], k) => {
          const p = (v / total) * 100;
          const el = <circle key={label} cx="21" cy="21" r={r} fill="none" stroke={c(k)} strokeWidth="5" strokeDasharray={`${p.toFixed(2)} ${(100 - p).toFixed(2)}`} strokeDashoffset={(25 - off).toFixed(2)}><title>{`${label}: ${num(v)}`}</title></circle>;
          off += p;
          return el;
        })}
        <text x="21" y="21.8" textAnchor="middle" fontSize="5.5" fontWeight="700" fill="#111827">{centre || short(total)}</text>
      </svg>
      <ul className="text-[14px] space-y-1">{entries.map(([label, v], k) => <li key={label} className="flex items-center gap-2"><i className="w-3 h-3 rounded-sm inline-block" style={{ background: c(k) }} />{label} <b>{num(v)}</b> <small className="text-ink-4">{Math.round((v / total) * 100)}%</small></li>)}</ul>
    </div>
  );
}

/** Steps with conversion from the first step. steps = [label, value, href?] */
export function Funnel({ steps }: { steps: Array<[string, number, string?]> }) {
  if (!steps.length) return <Empty />;
  const base = Math.max(1, steps[0][1]);
  return (
    <ol className="space-y-2.5">
      {steps.map((s, i) => (
        <li key={s[0]} className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3 text-[14px]">
          <span className="truncate">{s[2] ? <Link className="underline" href={s[2]}>{s[0]}</Link> : s[0]}</span>
          <span aria-hidden="true" className="h-2.5 rounded bg-cream-3"><i className="block h-2.5 rounded" style={{ width: `${Math.max(2, Math.min(100, (s[1] / base) * 100)).toFixed(1)}%`, background: c(i) }} /></span>
          <span className="font-semibold text-ink whitespace-nowrap">{num(s[1])}<small className="text-ink-4 font-normal ml-1">{i === 0 ? "base" : `${pct(s[1], base)} of ${steps[0][0]}`}</small></span>
        </li>
      ))}
    </ol>
  );
}
