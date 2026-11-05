"use client";

import type { ChartData, ChartSpec } from "@/lib/learn/sheet/engine";

const COLORS = ["#d95d2b", "#2563eb", "#059669", "#7c3aed", "#db2777", "#ca8a04", "#0891b2", "#475569"];
const nice = (n: number): string => (Math.abs(n) >= 1000 ? n.toLocaleString("en-IN") : String(parseFloat(n.toPrecision(4))));

/** Bar, line and pie charts drawn as plain SVG from calculated values (no chart library). */
export default function ChartView({ spec, data }: { spec: ChartSpec; data: ChartData }) {
  if (!data.ok) return <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-[13px] text-amber-900">{data.problem}</p>;
  const W = 420, H = 240, pad = { l: 48, r: 12, t: 28, b: 40 };
  const max = Math.max(...data.values, 0), min = Math.min(...data.values, 0);
  const span = max - min || 1;
  const y = (v: number) => pad.t + (1 - (v - min) / span) * (H - pad.t - pad.b);
  const bw = (W - pad.l - pad.r) / data.values.length;
  const summary = `${spec.type} chart: ${data.labels.map((l, i) => `${l} ${nice(data.values[i])}`).join(", ")}`;
  const title = spec.title || `${spec.labels} by ${spec.values}`;
  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary} className="h-auto w-full max-w-[460px] rounded-lg border border-black/[0.1] bg-white">
        <text x={W / 2} y="16" textAnchor="middle" className="fill-ink" fontSize="12" fontWeight="600">{title}</text>
        {spec.type !== "pie" ? (
          <>
            {[0, 0.25, 0.5, 0.75, 1].map((t) => { const v = min + span * t; return <g key={t}><line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="#e5e7eb" /><text x={pad.l - 6} y={y(v) + 4} textAnchor="end" fontSize="10" fill="#4b5563">{nice(v)}</text></g>; })}
            {spec.type === "bar"
              ? data.values.map((v, i) => <g key={i}><rect x={pad.l + i * bw + bw * 0.15} y={Math.min(y(v), y(0))} width={bw * 0.7} height={Math.abs(y(v) - y(0))} fill={COLORS[0]} rx="2" /><text x={pad.l + i * bw + bw / 2} y={H - pad.b + 14} textAnchor="middle" fontSize="10" fill="#374151">{data.labels[i].slice(0, 8)}</text></g>)
              : (
                <>
                  <polyline fill="none" stroke={COLORS[1]} strokeWidth="2.5" points={data.values.map((v, i) => `${pad.l + i * bw + bw / 2},${y(v)}`).join(" ")} />
                  {data.values.map((v, i) => <g key={i}><circle cx={pad.l + i * bw + bw / 2} cy={y(v)} r="3.5" fill={COLORS[1]} /><text x={pad.l + i * bw + bw / 2} y={H - pad.b + 14} textAnchor="middle" fontSize="10" fill="#374151">{data.labels[i].slice(0, 8)}</text></g>)}
                </>
              )}
          </>
        ) : (() => {
          const total = data.values.reduce((a, b) => a + Math.max(b, 0), 0) || 1;
          let a0 = -Math.PI / 2;
          const cx = 130, cy = 130, r = 80;
          return (
            <>
              {data.values.map((v, i) => {
                const frac = Math.max(v, 0) / total;
                const a1 = a0 + frac * Math.PI * 2;
                const large = frac > 0.5 ? 1 : 0;
                const d = frac >= 0.9999 ? `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r} Z` : `M ${cx} ${cy} L ${cx + r * Math.cos(a0)} ${cy + r * Math.sin(a0)} A ${r} ${r} 0 ${large} 1 ${cx + r * Math.cos(a1)} ${cy + r * Math.sin(a1)} Z`;
                a0 = a1;
                return <path key={i} d={d} fill={COLORS[i % COLORS.length]} stroke="#fff" strokeWidth="1.5" />;
              })}
              {data.labels.map((l, i) => <g key={i}><rect x="250" y={44 + i * 18} width="10" height="10" fill={COLORS[i % COLORS.length]} /><text x="266" y={53 + i * 18} fontSize="10.5" fill="#374151">{l.slice(0, 14)} ({Math.round((Math.max(data.values[i], 0) / total) * 100)}%)</text></g>)}
            </>
          );
        })()}
      </svg>
    </figure>
  );
}
