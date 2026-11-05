"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import type { BarChart, Chart, HeatChart, LineChart, RadarChart, ScatterChart, StackedChart } from "@/lib/mathstudio/charts";

/** Accessible SVG charts: each has a title, labelled axes, a plain-language reading, hover/focus detail, a link to act on it, and a table of the same numbers. Colour is never the only cue. */
const TEAL = "#0F766E", RUST = "#B4410F", INK = "#1A1A1A", GREY = "#8A8A8A";
const clip = (s: string, n: number): string => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
type Tip = (t: string) => { onMouseEnter: () => void; onFocus: () => void; onMouseLeave: () => void; onBlur: () => void; tabIndex: number };

function Frame({ chart, children, table }: { chart: Chart; children: (tip: Tip) => ReactNode; table: ReactNode }) {
  const [tip, setTip] = useState("");
  const mk: Tip = (t) => ({ onMouseEnter: () => setTip(t), onFocus: () => setTip(t), onMouseLeave: () => setTip(""), onBlur: () => setTip(""), tabIndex: 0 });
  return (
    <figure className="rounded-xl border border-black/[0.08] bg-white p-4 sm:p-5" aria-labelledby={`${chart.id}-t`}>
      <figcaption id={`${chart.id}-t`} className="text-[16px] font-semibold text-ink">{chart.title}</figcaption>
      <div className="mt-3 overflow-x-auto">{children(mk)}</div>
      <p className="mt-1 min-h-[22px] text-[13.5px] font-medium text-ink-2" aria-live="polite">{tip || "Hover or tab to a point for its value."}</p>
      <p className="mt-2 text-[14.5px] leading-relaxed text-ink-2"><span className="font-semibold text-ink">What this shows: </span>{chart.interpretation}</p>
      <Link href={chart.link.href} className="mt-2 inline-block text-[14px] font-semibold text-orange-deep underline">{chart.link.label}</Link>
      <details className="mt-3 text-[13.5px]"><summary className="cursor-pointer font-medium text-ink-3">View as a table</summary><div className="mt-2 overflow-x-auto">{table}</div></details>
    </figure>
  );
}
const Th = ({ children }: { children: ReactNode }) => <th scope="col" className="py-1.5 pr-3 text-left font-medium text-ink-4">{children}</th>;
const D = { 1: "Foundational", 2: "Easy", 3: "Medium", 4: "Hard", 5: "Advanced" } as const;

function Radar({ c }: { c: RadarChart }) {
  const W = 360, H = 330, cx = 180, cy = 165, R = 108, n = c.axes.length;
  const pt = (i: number, v: number): [number, number] => { const a = -Math.PI / 2 + (2 * Math.PI * i) / n; return [cx + Math.cos(a) * R * (v / 100), cy + Math.sin(a) * R * (v / 100)]; };
  const have = c.axes.map((a, i) => ({ a, i })).filter((x) => x.a.value !== null);
  return (
    <Frame chart={c} table={<table className="w-full min-w-[18rem]"><thead><tr><Th>Area</Th><Th>Mastery</Th><Th>Questions</Th></tr></thead><tbody>{c.axes.map((a) => <tr key={a.key} className="border-t border-black/[0.07]"><th scope="row" className="py-1.5 pr-3 text-left font-medium">{a.label}</th><td className="pr-3">{a.value === null ? "–" : Math.round(a.value)}</td><td>{a.items}</td></tr>)}</tbody></table>}>
      {(tip) => (
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${c.title}. ${c.yLabel}.`} className="mx-auto h-auto w-full max-w-[420px]">
          {[25, 50, 75, 100].map((g) => <polygon key={g} points={c.axes.map((_, i) => pt(i, g).join(",")).join(" ")} fill="none" stroke="#D9D9D3" strokeWidth={g === 100 ? 1.4 : 1} />)}
          {c.axes.map((a, i) => { const [x, y] = pt(i, 100); const [lx, ly] = pt(i, 128); return <g key={a.key}><line x1={cx} y1={cy} x2={x} y2={y} stroke="#D9D9D3" /><text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize="11" fill={a.value === null ? GREY : INK}>{clip(a.label, 16)}</text></g>; })}
          <polygon points={have.map(({ a, i }) => pt(i, a.value as number).join(",")).join(" ")} fill={TEAL} fillOpacity={0.18} stroke={TEAL} strokeWidth={2.4} />
          {have.map(({ a, i }) => { const [x, y] = pt(i, a.value as number); return <circle key={a.key} cx={x} cy={y} r={6} fill={TEAL} stroke="#fff" strokeWidth={1.5} {...tip(`${a.label}: ${Math.round(a.value as number)}/100 (${a.items} questions)`)} />; })}
        </svg>
      )}
    </Frame>
  );
}

function Bars({ c }: { c: BarChart }) {
  const rowH = 34, left = 210, W = 620, RIGHT = 56, H = c.rows.length * rowH + 42;
  return (
    <Frame chart={c} table={<table className="w-full min-w-[22rem]"><thead><tr><Th>Topic</Th><Th>Mastery</Th><Th>Band</Th><Th>Questions</Th></tr></thead><tbody>{c.rows.map((r) => <tr key={r.key} className="border-t border-black/[0.07]"><th scope="row" className="py-1.5 pr-3 text-left font-medium">{r.label}</th><td className="pr-3">{Math.round(r.value ?? 0)} ({Math.round(r.low)}–{Math.round(r.high)})</td><td className="pr-3">{r.evidence}</td><td>{r.items}</td></tr>)}</tbody></table>}>
      {(tip) => (
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${c.title}. ${c.xLabel}.`} className="h-auto w-full min-w-[460px]">
          {[0, 25, 50, 75, 100].map((g) => { const x = left + ((W - left - RIGHT) * g) / 100; return <g key={g}><line x1={x} y1={4} x2={x} y2={H - 28} stroke="#E4E4DE" /><text x={x} y={H - 12} textAnchor="middle" fontSize="11" fill={GREY}>{g}</text></g>; })}
          {c.rows.map((r, i) => { const y = 6 + i * rowH; const bw = (W - left - RIGHT) / 100; const w = (r.value ?? 0) * bw; return (
            <g key={r.key}>
              <text x={left - 8} y={y + 16} textAnchor="end" fontSize="12" fill={INK}>{clip(r.label, 30)}</text>
              <rect x={left + r.low * bw} y={y + 10} width={Math.max(2, (r.high - r.low) * bw)} height={6} rx={3} fill="#C9C9C2" {...tip(`${r.label}: confidence ${Math.round(r.low)}–${Math.round(r.high)}`)} />
              <rect x={left} y={y + 3} width={Math.max(2, w)} height={20} rx={3} fill={TEAL} {...tip(`${r.label}: ${Math.round(r.value ?? 0)}/100 over ${r.items} questions (${r.evidence})`)} />
              <text x={left + Math.max(2, w) + 6} y={y + 17} fontSize="12" fontWeight={600} fill={INK}>{Math.round(r.value ?? 0)}</text>
            </g>); })}
        </svg>
      )}
    </Frame>
  );
}

function Lines({ c }: { c: LineChart }) {
  const W = 560, H = 280, l = 48, t = 16, b = 54, pw = W - l - 18, ph = H - t - b, n = c.points.length;
  const xs = (i: number) => l + (n === 1 ? pw / 2 : (pw * i) / (n - 1));
  const y = (v: number) => t + ph - (ph * v) / 100;
  return (
    <Frame chart={c} table={<table className="w-full min-w-[18rem]"><thead><tr><Th>Date</Th><Th>Overall</Th></tr></thead><tbody>{c.points.map((p) => <tr key={p.x} className="border-t border-black/[0.07]"><th scope="row" className="py-1.5 pr-3 text-left font-medium">{p.label}</th><td>{p.y === null ? "–" : Math.round(p.y)}</td></tr>)}</tbody></table>}>
      {(tip) => (
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${c.title}. ${c.yLabel}.`} className="h-auto w-full min-w-[420px]">
          {[0, 25, 50, 75, 100].map((g) => <g key={g}><line x1={l} y1={y(g)} x2={W - 18} y2={y(g)} stroke="#E4E4DE" /><text x={l - 6} y={y(g) + 4} textAnchor="end" fontSize="11" fill={GREY}>{g}</text></g>)}
          {c.points.map((p, i) => <text key={p.x} x={xs(i)} y={H - b + 16} textAnchor="middle" fontSize="10.5" fill={INK}>{p.label.slice(5)}</text>)}
          <polyline fill="none" stroke={TEAL} strokeWidth={2.4} points={c.points.filter((p) => p.y !== null).map((p) => `${xs(c.points.indexOf(p))},${y(p.y as number)}`).join(" ")} />
          {c.points.map((p, i) => p.y === null ? null : <circle key={p.x} cx={xs(i)} cy={y(p.y)} r={6} fill={TEAL} stroke="#fff" strokeWidth={1.5} {...tip(`${p.label}: ${Math.round(p.y)}/100`)} />)}
        </svg>
      )}
    </Frame>
  );
}

function Scatter({ c }: { c: ScatterChart }) {
  const W = 560, H = 280, l = 70, t = 14, b = 56, pw = W - l - 16, ph = H - t - b;
  const maxX = Math.max(2.5, Math.ceil(Math.max(...c.points.map((p) => p.ratio)) * 2) / 2);
  const x = (v: number) => l + (pw * Math.min(v, maxX)) / maxX;
  const yRow = (ok: boolean, i: number) => t + (ok ? ph * 0.25 : ph * 0.75) + (((i * 29) % 19) - 9) * 1.5;
  return (
    <Frame chart={c} table={<table className="w-full min-w-[22rem]"><thead><tr><Th>Topic</Th><Th>Seconds</Th><Th>× expected</Th><Th>Result</Th></tr></thead><tbody>{c.points.map((p, i) => <tr key={i} className="border-t border-black/[0.07]"><th scope="row" className="py-1.5 pr-3 text-left font-medium">{p.label}</th><td className="pr-3">{p.seconds}</td><td className="pr-3">{p.ratio}</td><td>{p.correct ? "Correct" : "Incorrect"}</td></tr>)}</tbody></table>}>
      {(tip) => (
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${c.title}. ${c.xLabel}.`} className="h-auto w-full min-w-[460px]">
          <rect x={l} y={t} width={pw} height={ph / 2} fill="#F0F7F5" /><rect x={l} y={t + ph / 2} width={pw} height={ph / 2} fill="#FBF1EC" />
          <text x={l - 8} y={t + ph * 0.28} textAnchor="end" fontSize="12" fill={INK}>Correct</text><text x={l - 8} y={t + ph * 0.78} textAnchor="end" fontSize="12" fill={INK}>Incorrect</text>
          {Array.from({ length: Math.floor(maxX * 2) + 1 }, (_, i) => i / 2).map((g) => <g key={g}><line x1={x(g)} y1={t} x2={x(g)} y2={t + ph} stroke={g === 1 ? INK : "#E4E4DE"} strokeDasharray={g === 1 ? "5 4" : undefined} /><text x={x(g)} y={t + ph + 16} textAnchor="middle" fontSize="11" fill={GREY}>{g}</text></g>)}
          <text x={x(1) + 4} y={t + 12} fontSize="10.5" fill={INK}>expected</text>
          {c.points.map((p, i) => p.correct ? <circle key={i} cx={x(p.ratio)} cy={yRow(true, i)} r={6} fill={TEAL} stroke="#fff" {...tip(`${p.label}: ${p.seconds}s (${p.ratio}× expected), correct`)} /> : <polygon key={i} points={`${x(p.ratio)},${yRow(false, i) - 7} ${x(p.ratio) + 7},${yRow(false, i)} ${x(p.ratio)},${yRow(false, i) + 7} ${x(p.ratio) - 7},${yRow(false, i)}`} fill={RUST} stroke="#fff" {...tip(`${p.label}: ${p.seconds}s (${p.ratio}× expected), incorrect`)} />)}
        </svg>
      )}
    </Frame>
  );
}

const heatColor = (pct: number) => (pct >= 80 ? { bg: "#0F766E", fg: "#fff" } : pct >= 60 ? { bg: "#6FB3AB", fg: "#102a27" } : pct >= 40 ? { bg: "#F3D2A8", fg: "#3b2208" } : { bg: "#C2410C", fg: "#fff" });
function Heat({ c }: { c: HeatChart }) {
  return (
    <Frame chart={c} table={<table className="w-full min-w-[24rem]"><thead><tr><Th>Area</Th>{c.cols.map((d) => <Th key={d}>{D[d]}</Th>)}</tr></thead><tbody>{c.rows.map((r) => <tr key={r.key} className="border-t border-black/[0.07]"><th scope="row" className="py-1.5 pr-3 text-left font-medium">{r.label}</th>{r.cells.map((x) => <td key={x.difficulty} className="pr-3">{x.n ? `${Math.round(x.pct as number)}% (${x.n})` : "–"}</td>)}</tr>)}</tbody></table>}>
      {(tip) => (
        <div className="min-w-[460px]" role="group" aria-label={`${c.title}`}>
          <div className="grid items-end gap-1.5" style={{ gridTemplateColumns: "minmax(140px,1.3fr) repeat(5,1fr)" }}>
            <span className="text-[12px] text-ink-3">Area ↓ · difficulty →</span>
            {c.cols.map((d) => <span key={d} className="text-center text-[12px] font-medium text-ink-2">{D[d]}</span>)}
            {c.rows.map((r) => <div key={r.key} className="contents"><span className="self-center pr-2 text-[13px] leading-tight text-ink">{r.label}</span>{r.cells.map((x) => x.n ? (() => { const h = heatColor(x.pct as number); return <span key={x.difficulty} className="flex h-11 flex-col items-center justify-center rounded-md text-[12.5px] font-semibold leading-tight" style={{ background: h.bg, color: h.fg }} {...tip(`${r.label}, ${D[x.difficulty]}: ${Math.round(x.pct as number)}% over ${x.n} question${x.n === 1 ? "" : "s"}`)}>{Math.round(x.pct as number)}%<span className="text-[10px] font-normal opacity-90">{x.n}q</span></span>; })() : <span key={x.difficulty} className="flex h-11 items-center justify-center rounded-md border border-dashed border-black/20 text-[11px] text-ink-4" aria-label={`${r.label}, ${D[x.difficulty]}: no data`}>–</span>)}</div>)}
          </div>
        </div>
      )}
    </Frame>
  );
}

function Stacked({ c }: { c: StackedChart }) {
  const W = 480, H = 280, l = 48, t = 16, b = 60, pw = W - l - 16, ph = H - t - b;
  const maxV = Math.max(...c.rows.map((r) => r.correct + r.incorrect + r.skipped), 1);
  const bw = Math.min(70, pw / c.rows.length - 20);
  const scale = (v: number) => (ph * v) / maxV;
  return (
    <Frame chart={c} table={<table className="w-full min-w-[20rem]"><thead><tr><Th>Difficulty</Th><Th>Correct</Th><Th>Incorrect</Th><Th>Skipped</Th></tr></thead><tbody>{c.rows.map((r) => <tr key={r.key} className="border-t border-black/[0.07]"><th scope="row" className="py-1.5 pr-3 text-left font-medium">{r.label}</th><td className="pr-3">{r.correct}</td><td className="pr-3">{r.incorrect}</td><td>{r.skipped}</td></tr>)}</tbody></table>}>
      {(tip) => (
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${c.title}.`} className="mx-auto h-auto w-full max-w-[520px]">
          <defs><pattern id="mx-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill={RUST} /><line x1="0" y1="0" x2="0" y2="6" stroke="#fff" strokeWidth="2" /></pattern></defs>
          {c.rows.map((r, i) => { const x = l + (pw / c.rows.length) * (i + 0.5) - bw / 2; const hc = scale(r.correct), hi = scale(r.incorrect), hs = scale(r.skipped); let yy = t + ph; return (
            <g key={r.key}>
              <rect x={x} y={yy - hc} width={bw} height={hc} fill={TEAL} {...tip(`${r.label}: ${r.correct} correct`)} />
              <rect x={x} y={(yy -= hc) - hi} width={bw} height={hi} fill="url(#mx-hatch)" {...tip(`${r.label}: ${r.incorrect} incorrect`)} />
              <rect x={x} y={(yy -= hi) - hs} width={bw} height={hs} fill="#C9C9C2" {...tip(`${r.label}: ${r.skipped} skipped`)} />
              <text x={x + bw / 2} y={H - b + 18} textAnchor="middle" fontSize="11.5" fill={INK}>{r.label}</text>
            </g>); })}
          <g fontSize="11.5" fill={INK}><rect x={l} y={H - 22} width={11} height={11} fill={TEAL} /><text x={l + 16} y={H - 13}>Correct</text><rect x={l + 84} y={H - 22} width={11} height={11} fill="url(#mx-hatch)" /><text x={l + 100} y={H - 13}>Incorrect</text><rect x={l + 180} y={H - 22} width={11} height={11} fill="#C9C9C2" /><text x={l + 196} y={H - 13}>Skipped</text></g>
        </svg>
      )}
    </Frame>
  );
}

export default function ChartCard({ chart }: { chart: Chart }) {
  switch (chart.kind) {
    case "radar": return <Radar c={chart} />;
    case "bar": return <Bars c={chart} />;
    case "line": return <Lines c={chart} />;
    case "scatter": return <Scatter c={chart} />;
    case "heat": return <Heat c={chart} />;
    case "stacked": return <Stacked c={chart} />;
  }
}
