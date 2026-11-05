"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import type { BarChart, Chart, HeatChart, LineChart, RadarChart, ScatterChart, StackedChart } from "@/lib/reading/charts";

/**
 * Accessible SVG charts. Each one has a title, labelled axes, a text reading of the data, hover and keyboard-focus detail, and a table of the same
 * numbers for screen-reader and small-screen use. Colour is never the only cue: correct and incorrect also differ by marker shape and label.
 */
const TEAL = "#0F766E";
const RUST = "#B4410F";
const INK = "#1A1A1A";
const GREY = "#8A8A8A";

const clip = (s: string, n: number): string => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
type Tip = (t: string) => { onMouseEnter: () => void; onFocus: () => void; onMouseLeave: () => void; onBlur: () => void; tabIndex: number };

function Frame({ chart, children, table, svgLabel }: { chart: Chart; children: (tip: Tip) => ReactNode; table: ReactNode; svgLabel: string }) {
  const [tip, setTip] = useState("");
  const mk: Tip = (t) => ({ onMouseEnter: () => setTip(t), onFocus: () => setTip(t), onMouseLeave: () => setTip(""), onBlur: () => setTip(""), tabIndex: 0 });
  return (
    <figure className="rounded-xl border border-black/[0.08] bg-white p-4 sm:p-5" aria-labelledby={`${chart.id}-t`}>
      <figcaption id={`${chart.id}-t`} className="text-[16px] font-semibold text-ink">{chart.title}</figcaption>
      <div className="mt-3 overflow-x-auto">{children(mk)}</div>
      <p className="mt-1 min-h-[22px] text-[13.5px] font-medium text-ink-2" aria-live="polite">{tip || "Hover over or tab to a point for its value."}</p>
      <p className="mt-2 text-[14.5px] leading-relaxed text-ink-2"><span className="font-semibold text-ink">What this shows: </span>{chart.interpretation}</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[14px]">
        <Link href={chart.practice.href} className="font-semibold text-orange-deep underline">{chart.practice.label}</Link>
      </div>
      <details className="mt-3 text-[13.5px]">
        <summary className="cursor-pointer font-medium text-ink-3">View as a table ({svgLabel})</summary>
        <div className="mt-2 overflow-x-auto">{table}</div>
      </details>
    </figure>
  );
}

const Th = ({ children }: { children: ReactNode }) => <th scope="col" className="py-1.5 pr-3 text-left font-medium text-ink-4">{children}</th>;

// ---- radar ------------------------------------------------------------------------------------------------------------------

function Radar({ c }: { c: RadarChart }) {
  const W = 360, H = 330, cx = W / 2, cy = 165, R = 108;
  const n = c.axes.length;
  const pt = (i: number, v: number): [number, number] => { const a = -Math.PI / 2 + (2 * Math.PI * i) / n; return [cx + Math.cos(a) * R * (v / 100), cy + Math.sin(a) * R * (v / 100)]; };
  const have = c.axes.map((a, i) => ({ a, i })).filter((x) => x.a.value !== null);
  const poly = have.map(({ a, i }) => pt(i, a.value as number).join(",")).join(" ");
  return (
    <Frame chart={c} svgLabel="values per area" table={<table className="w-full min-w-[18rem]"><thead><tr><Th>Area</Th><Th>Score</Th><Th>Questions</Th></tr></thead><tbody>{c.axes.map((a) => <tr key={a.key} className="border-t border-black/[0.07]"><th scope="row" className="py-1.5 pr-3 text-left font-medium">{a.label}</th><td className="pr-3">{a.value === null ? "Not assessed" : Math.round(a.value)}</td><td>{a.n}</td></tr>)}</tbody></table>}>
      {(tip) => (
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${c.title}. ${c.xLabel}. ${c.yLabel}.`} className="mx-auto h-auto w-full max-w-[420px]">
          {[25, 50, 75, 100].map((g) => <polygon key={g} points={c.axes.map((_, i) => pt(i, g).join(",")).join(" ")} fill="none" stroke="#D9D9D3" strokeWidth={g === 100 ? 1.4 : 1} />)}
          {c.axes.map((a, i) => { const [x, y] = pt(i, 100); const [lx, ly] = pt(i, 126); return (<g key={a.key}><line x1={cx} y1={cy} x2={x} y2={y} stroke="#D9D9D3" /><text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize="12" fill={a.value === null ? GREY : INK}>{a.label}{a.value === null ? " (n/a)" : ""}</text></g>); })}
          {[50, 100].map((g) => <text key={g} x={cx + 4} y={cy - R * (g / 100) - 3} fontSize="10" fill={GREY}>{g}</text>)}
          <polygon points={poly} fill={TEAL} fillOpacity={0.18} stroke={TEAL} strokeWidth={2.4} />
          {have.map(({ a, i }) => { const [x, y] = pt(i, a.value as number); return <circle key={a.key} cx={x} cy={y} r={6} fill={TEAL} stroke="#fff" strokeWidth={1.5} {...tip(`${a.label}: ${Math.round(a.value as number)} out of 100 (${a.n} question${a.n === 1 ? "" : "s"})`)} />; })}
        </svg>
      )}
    </Frame>
  );
}

// ---- horizontal bars --------------------------------------------------------------------------------------------------------

function Bars({ c }: { c: BarChart }) {
  const rowH = 34, left = 236, W = 640, RIGHT = 70, H = c.rows.length * rowH + 44;
  return (
    <Frame chart={c} svgLabel="accuracy per skill" table={<table className="w-full min-w-[22rem]"><thead><tr><Th>Skill</Th><Th>Accuracy</Th><Th>Questions</Th></tr></thead><tbody>{c.rows.map((r) => <tr key={r.key} className="border-t border-black/[0.07]"><th scope="row" className="py-1.5 pr-3 text-left font-medium">{r.label}</th><td className="pr-3">{r.value === null ? "n/a" : `${Math.round(r.value)}%`}</td><td>{r.n}{r.n < 4 ? " (early signal)" : ""}</td></tr>)}</tbody></table>}>
      {(tip) => (
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${c.title}. ${c.xLabel}. ${c.yLabel}.`} className="h-auto w-full min-w-[460px]">
          {[0, 25, 50, 75, 100].map((g) => { const x = left + ((W - left - RIGHT) * g) / 100; return (<g key={g}><line x1={x} y1={4} x2={x} y2={H - 30} stroke="#E4E4DE" /><text x={x} y={H - 14} textAnchor="middle" fontSize="11" fill={GREY}>{g}</text></g>); })}
          <text x={left + (W - left - RIGHT) / 2} y={H - 1} textAnchor="middle" fontSize="11.5" fill={INK}>{c.xLabel}</text>
          {c.rows.map((r, i) => { const y = 6 + i * rowH; const w = ((W - left - RIGHT) * (r.value ?? 0)) / 100; const early = r.n < 4; return (
            <g key={r.key}>
              <text x={left - 8} y={y + 16} textAnchor="end" fontSize="12" fill={INK}>{clip(r.label, 36)}</text>
              <rect x={left} y={y + 3} width={Math.max(2, w)} height={20} rx={3} fill={early ? "#7FB5AE" : TEAL} stroke={early ? TEAL : "none"} strokeDasharray={early ? "4 3" : undefined} {...tip(`${r.label}: ${Math.round(r.value ?? 0)}% over ${r.n} question${r.n === 1 ? "" : "s"}${early ? " (early signal)" : ""}`)} />
              <text x={left + Math.max(2, w) + 6} y={y + 17} fontSize="12" fill={INK} fontWeight={600}>{Math.round(r.value ?? 0)}%{early ? ` · n=${r.n}` : ""}</text>
            </g>); })}
        </svg>
      )}
    </Frame>
  );
}

// ---- lines ------------------------------------------------------------------------------------------------------------------

function Lines({ c }: { c: LineChart }) {
  const W = 560, H = 300, l = 54, r = c.dualAxis ? 54 : 18, t = 18, b = 62;
  const pw = W - l - r, ph = H - t - b;
  const n = c.series[0].points.length;
  const xs = (i: number) => l + (n === 1 ? pw / 2 : (pw * i) / (n - 1));
  const maxA = c.dualAxis ? Math.max(100, Math.ceil(Math.max(...c.series[0].points.map((p) => p.y ?? 0)) * 1.15 / 50) * 50) : 100;
  const scale = (si: number, v: number) => t + ph - (ph * v) / (si === 0 ? maxA : 100);
  const colors = [TEAL, RUST];
  return (
    <Frame chart={c} svgLabel="values per assessment" table={<table className="w-full min-w-[20rem]"><thead><tr><Th>Assessment date</Th>{c.series.map((s) => <Th key={s.name}>{s.name}</Th>)}</tr></thead><tbody>{c.series[0].points.map((p, i) => <tr key={p.x} className="border-t border-black/[0.07]"><th scope="row" className="py-1.5 pr-3 text-left font-medium">{p.label}</th>{c.series.map((s) => <td key={s.name} className="pr-3">{s.points[i].y === null ? "n/a" : `${Math.round(s.points[i].y as number)} ${s.unit}`}</td>)}</tr>)}</tbody></table>}>
      {(tip) => (
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${c.title}. ${c.xLabel}. ${c.yLabel}.`} className="h-auto w-full min-w-[420px]">
          {[0, 25, 50, 75, 100].map((g) => { const y = t + ph - (ph * g) / 100; return (<g key={g}><line x1={l} y1={y} x2={W - r} y2={y} stroke="#E4E4DE" /><text x={l - 6} y={y + 4} textAnchor="end" fontSize="11" fill={colors[0]}>{c.dualAxis ? Math.round((maxA * g) / 100) : g}</text>{c.dualAxis ? <text x={W - r + 6} y={y + 4} fontSize="11" fill={colors[1]}>{g}</text> : null}</g>); })}
          {c.series[0].points.map((p, i) => <text key={p.x} x={xs(i)} y={H - b + 16} textAnchor="middle" fontSize="11" fill={INK}>{p.label.slice(5)}</text>)}
          <text x={l + pw / 2} y={H - 28} textAnchor="middle" fontSize="11.5" fill={INK}>{c.xLabel}</text>
          <text x={14} y={t + ph / 2} transform={`rotate(-90 14 ${t + ph / 2})`} textAnchor="middle" fontSize="11.5" fill={INK}>{c.dualAxis ? c.series[0].unit === "wpm" ? "Words per minute (estimate)" : c.series[0].name : "Overall score (provisional)"}</text>
          {c.dualAxis ? <text x={W - 12} y={t + ph / 2} transform={`rotate(90 ${W - 12} ${t + ph / 2})`} textAnchor="middle" fontSize="11.5" fill={INK}>Comprehension (%)</text> : null}
          {c.series.map((s, si) => (
            <g key={s.name}>
              <polyline fill="none" stroke={colors[si]} strokeWidth={2.4} strokeDasharray={si === 1 ? "6 4" : undefined} points={s.points.filter((p) => p.y !== null).map((p, i) => `${xs(s.points.indexOf(p))},${scale(si, p.y as number)}`).join(" ")} />
              {s.points.map((p, i) => p.y === null ? null : si === 0
                ? <circle key={p.x} cx={xs(i)} cy={scale(si, p.y)} r={6} fill={colors[si]} stroke="#fff" strokeWidth={1.5} {...tip(`${s.name} on ${p.label}: ${Math.round(p.y)} ${s.unit}`)} />
                : <rect key={p.x} x={xs(i) - 5.5} y={scale(si, p.y) - 5.5} width={11} height={11} fill={colors[si]} stroke="#fff" strokeWidth={1.5} {...tip(`${s.name} on ${p.label}: ${Math.round(p.y)} ${s.unit}`)} />)}
            </g>
          ))}
          <g fontSize="11.5" fill={INK}>{c.series.map((s, si) => <g key={s.name} transform={`translate(${l + si * 250},${H - 8})`}>{si === 0 ? <circle cx={5} cy={-4} r={5} fill={colors[0]} /> : <rect x={0} y={-9} width={10} height={10} fill={colors[1]} />}<text x={16} y={0}>{clip(s.name, 38)}</text></g>)}</g>
        </svg>
      )}
    </Frame>
  );
}

// ---- stacked ---------------------------------------------------------------------------------------------------------------

function Stacked({ c }: { c: StackedChart }) {
  const W = 480, H = 290, l = 54, t = 16, b = 78, pw = W - l - 16, ph = H - t - b;
  const maxV = Math.max(...c.rows.map((r) => r.correct + r.incorrect), 1);
  const bw = Math.min(90, pw / c.rows.length - 24);
  return (
    <Frame chart={c} svgLabel="correct and incorrect counts" table={<table className="w-full min-w-[18rem]"><thead><tr><Th>Difficulty</Th><Th>Correct</Th><Th>Incorrect</Th></tr></thead><tbody>{c.rows.map((r) => <tr key={r.key} className="border-t border-black/[0.07]"><th scope="row" className="py-1.5 pr-3 text-left font-medium">{r.label}</th><td className="pr-3">{r.correct}</td><td>{r.incorrect}</td></tr>)}</tbody></table>}>
      {(tip) => (
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${c.title}. ${c.xLabel}. ${c.yLabel}.`} className="mx-auto h-auto w-full max-w-[520px]">
          <defs><pattern id="rd-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill={RUST} /><line x1="0" y1="0" x2="0" y2="6" stroke="#fff" strokeWidth="2" /></pattern></defs>
          {Array.from({ length: maxV + 1 }, (_, g) => g).filter((g) => maxV <= 8 || g % 2 === 0).map((g) => { const y = t + ph - (ph * g) / maxV; return (<g key={g}><line x1={l} y1={y} x2={W - 16} y2={y} stroke="#E4E4DE" /><text x={l - 6} y={y + 4} textAnchor="end" fontSize="11" fill={GREY}>{g}</text></g>); })}
          <text x={14} y={t + ph / 2} transform={`rotate(-90 14 ${t + ph / 2})`} textAnchor="middle" fontSize="11.5" fill={INK}>{c.yLabel}</text>
          {c.rows.map((r, i) => { const x = l + (pw / c.rows.length) * (i + 0.5) - bw / 2; const hc = (ph * r.correct) / maxV, hi = (ph * r.incorrect) / maxV; return (
            <g key={r.key}>
              <rect x={x} y={t + ph - hc} width={bw} height={hc} fill={TEAL} {...tip(`${r.label}: ${r.correct} correct`)} />
              <rect x={x} y={t + ph - hc - hi} width={bw} height={hi} fill="url(#rd-hatch)" {...tip(`${r.label}: ${r.incorrect} incorrect`)} />
              <text x={x + bw / 2} y={H - b + 18} textAnchor="middle" fontSize="12" fill={INK}>{r.label}</text>
            </g>); })}
          <text x={l + pw / 2} y={H - b + 38} textAnchor="middle" fontSize="11.5" fill={INK}>{c.xLabel}</text>
          <g fontSize="12" fill={INK}><rect x={l} y={H - 24} width={12} height={12} fill={TEAL} /><text x={l + 18} y={H - 14}>Correct</text><rect x={l + 100} y={H - 24} width={12} height={12} fill="url(#rd-hatch)" /><text x={l + 118} y={H - 14}>Incorrect</text></g>
        </svg>
      )}
    </Frame>
  );
}

// ---- scatter ---------------------------------------------------------------------------------------------------------------

function Scatter({ c }: { c: ScatterChart }) {
  const W = 560, H = 290, l = 70, t = 14, b = 70, pw = W - l - 16, ph = H - t - b;
  const maxX = Math.max(2.5, Math.ceil(Math.max(...c.points.map((p) => p.ratio)) * 2) / 2);
  const x = (v: number) => l + (pw * Math.min(v, maxX)) / maxX;
  const yRow = (ok: boolean, i: number) => t + (ok ? ph * 0.22 : ph * 0.78) + (((i * 37) % 21) - 10) * 1.6;
  return (
    <Frame chart={c} svgLabel="each question's time and result" table={<table className="w-full min-w-[22rem]"><thead><tr><Th>Skill</Th><Th>Seconds</Th><Th>Times the guide time</Th><Th>Result</Th></tr></thead><tbody>{c.points.map((p, i) => <tr key={i} className="border-t border-black/[0.07]"><th scope="row" className="py-1.5 pr-3 text-left font-medium">{p.label}</th><td className="pr-3">{p.seconds}</td><td className="pr-3">{p.ratio}</td><td>{p.correct ? "Correct" : "Incorrect"}</td></tr>)}</tbody></table>}>
      {(tip) => (
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${c.title}. ${c.xLabel}. ${c.yLabel}.`} className="h-auto w-full min-w-[460px]">
          <rect x={l} y={t} width={pw} height={ph / 2} fill="#F0F7F5" /><rect x={l} y={t + ph / 2} width={pw} height={ph / 2} fill="#FBF1EC" />
          <text x={l - 8} y={t + ph * 0.25 + 4} textAnchor="end" fontSize="12" fill={INK}>Correct</text><text x={l - 8} y={t + ph * 0.75 + 4} textAnchor="end" fontSize="12" fill={INK}>Incorrect</text>
          {Array.from({ length: Math.floor(maxX * 2) + 1 }, (_, i) => i / 2).map((g) => <g key={g}><line x1={x(g)} y1={t} x2={x(g)} y2={t + ph} stroke={g === 1 ? INK : "#E4E4DE"} strokeDasharray={g === 1 ? "5 4" : undefined} /><text x={x(g)} y={t + ph + 16} textAnchor="middle" fontSize="11" fill={GREY}>{g}</text></g>)}
          <text x={l + pw / 2} y={H - 34} textAnchor="middle" fontSize="11.5" fill={INK}>{c.xLabel}</text>
          <text x={x(1) + 4} y={t + 12} fontSize="10.5" fill={INK}>guide time</text>
          {c.points.map((p, i) => p.correct
            ? <circle key={i} cx={x(p.ratio)} cy={yRow(true, i)} r={6} fill={TEAL} stroke="#fff" {...tip(`${p.label}: ${p.seconds} s (${p.ratio}× guide time), correct`)} />
            : <polygon key={i} points={`${x(p.ratio)},${yRow(false, i) - 7} ${x(p.ratio) + 7},${yRow(false, i)} ${x(p.ratio)},${yRow(false, i) + 7} ${x(p.ratio) - 7},${yRow(false, i)}`} fill={RUST} stroke="#fff" {...tip(`${p.label}: ${p.seconds} s (${p.ratio}× guide time), incorrect`)} />)}
          <g fontSize="12" fill={INK}><circle cx={l + 6} cy={H - 10} r={5} fill={TEAL} /><text x={l + 16} y={H - 6}>Correct</text><polygon points={`${l + 106},${H - 17} ${l + 113},${H - 10} ${l + 106},${H - 3} ${l + 99},${H - 10}`} fill={RUST} /><text x={l + 120} y={H - 6}>Incorrect</text></g>
        </svg>
      )}
    </Frame>
  );
}

// ---- heatmap ---------------------------------------------------------------------------------------------------------------

const heat = (pct: number): { bg: string; fg: string } => {
  if (pct >= 85) return { bg: "#0F766E", fg: "#fff" };
  if (pct >= 70) return { bg: "#6FB3AB", fg: "#102a27" };
  if (pct >= 50) return { bg: "#F3D2A8", fg: "#3b2208" };
  return { bg: "#C2410C", fg: "#fff" };
};
const D_LABEL = { 1: "Easy", 2: "Medium", 3: "Difficult" } as const;

function Heat({ c }: { c: HeatChart }) {
  return (
    <Frame chart={c} svgLabel="accuracy per skill and difficulty" table={<table className="w-full min-w-[22rem]"><thead><tr><Th>Skill</Th>{c.cols.map((d) => <Th key={d}>{D_LABEL[d]}</Th>)}</tr></thead><tbody>{c.rows.map((r) => <tr key={r.key} className="border-t border-black/[0.07]"><th scope="row" className="py-1.5 pr-3 text-left font-medium">{r.label}</th>{r.cells.map((x) => <td key={x.difficulty} className="pr-3">{x.n ? `${Math.round(x.pct as number)}% (${x.n})` : "no questions"}</td>)}</tr>)}</tbody></table>}>
      {(tip) => (
        <div className="min-w-[440px]" role="group" aria-label={`${c.title}. ${c.xLabel}. ${c.yLabel}.`}>
          <div className="grid items-end gap-1.5" style={{ gridTemplateColumns: "minmax(150px,1.4fr) repeat(3,1fr)" }}>
            <span className="text-[12px] text-ink-3">{c.yLabel} ↓ · {c.xLabel} →</span>
            {c.cols.map((d) => <span key={d} className="text-center text-[12.5px] font-medium text-ink-2">{D_LABEL[d]}</span>)}
            {c.rows.map((r) => (
              <div key={r.key} className="contents">
                <span className="self-center pr-2 text-[13px] leading-tight text-ink">{r.label}</span>
                {r.cells.map((x) => {
                  if (!x.n) return <span key={x.difficulty} className="flex h-11 items-center justify-center rounded-md border border-dashed border-black/20 text-[11.5px] text-ink-4" aria-label={`${r.label}, ${D_LABEL[x.difficulty]}: no questions yet`}>no data</span>;
                  const h = heat(x.pct as number);
                  return <span key={x.difficulty} className="flex h-11 flex-col items-center justify-center rounded-md text-[13px] font-semibold leading-tight" style={{ background: h.bg, color: h.fg }} {...tip(`${r.label}, ${D_LABEL[x.difficulty]}: ${Math.round(x.pct as number)}% over ${x.n} question${x.n === 1 ? "" : "s"}`)}>{Math.round(x.pct as number)}%<span className="text-[10.5px] font-normal opacity-90">{x.n} q</span></span>;
                })}
              </div>
            ))}
          </div>
          <p className="mt-2 text-[12px] text-ink-3">Darker teal is stronger; rust is below 50%. The number shows how many questions stand behind each cell.</p>
        </div>
      )}
    </Frame>
  );
}

export default function ChartCard({ chart }: { chart: Chart }) {
  switch (chart.kind) {
    case "radar": return <Radar c={chart} />;
    case "bar": return <Bars c={chart} />;
    case "line": return <Lines c={chart} />;
    case "stacked": return <Stacked c={chart} />;
    case "scatter": return <Scatter c={chart} />;
    case "heat": return <Heat c={chart} />;
  }
}
