import type { Visual } from "@/lib/mathspeed/types";

/** Tables and charts for the data questions. Plain SVG and HTML, with the numbers also available as text for screen readers. */
const COLORS = ["#FF6A2F", "#7857ff", "#16a34a", "#0ea5e9", "#d946ef", "#eab308", "#64748b"];

function Bar({ v }: { v: Extract<Visual, { type: "bar" }> }) {
  const max = Math.max(...v.values, 1);
  const W = 360, H = 190, pad = 28, bw = (W - pad * 2) / v.values.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${v.title}: ${v.labels.map((l, i) => `${l} ${v.values[i]}`).join(", ")}`} className="w-full max-w-md">
      {[0, 0.25, 0.5, 0.75, 1].map((t) => <g key={t}><line x1={pad} x2={W - 8} y1={H - 28 - (H - 56) * t} y2={H - 28 - (H - 56) * t} stroke="#e5e5e0" /><text x={pad - 4} y={H - 25 - (H - 56) * t} fontSize="9" textAnchor="end" fill="#525252">{Math.round(max * t)}</text></g>)}
      {v.values.map((x, i) => {
        const h = ((H - 56) * x) / max;
        return <g key={i}><rect x={pad + i * bw + bw * 0.15} y={H - 28 - h} width={bw * 0.7} height={h} rx="3" fill={COLORS[i % COLORS.length]} /><text x={pad + i * bw + bw / 2} y={H - 28 - h - 4} fontSize="10" textAnchor="middle" fill="#1A1A1A" fontWeight="600">{x}</text><text x={pad + i * bw + bw / 2} y={H - 12} fontSize="10" textAnchor="middle" fill="#525252">{v.labels[i]}</text></g>;
      })}
    </svg>
  );
}

function Line({ v }: { v: Extract<Visual, { type: "line" }> }) {
  const max = Math.max(...v.values, 1), min = Math.min(...v.values, 0);
  const W = 360, H = 190, pad = 30;
  const x = (i: number) => pad + ((W - pad - 14) * i) / Math.max(1, v.values.length - 1);
  const y = (val: number) => H - 28 - ((H - 56) * (val - min)) / (max - min || 1);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${v.title}: ${v.labels.map((l, i) => `${l} ${v.values[i]}`).join(", ")}`} className="w-full max-w-md">
      {[0, 0.5, 1].map((t) => <g key={t}><line x1={pad} x2={W - 8} y1={H - 28 - (H - 56) * t} y2={H - 28 - (H - 56) * t} stroke="#e5e5e0" /><text x={pad - 4} y={H - 25 - (H - 56) * t} fontSize="9" textAnchor="end" fill="#525252">{Math.round(min + (max - min) * t)}</text></g>)}
      <polyline fill="none" stroke="#FF6A2F" strokeWidth="2.5" points={v.values.map((val, i) => `${x(i)},${y(val)}`).join(" ")} />
      {v.values.map((val, i) => <g key={i}><circle cx={x(i)} cy={y(val)} r="4" fill="#FF6A2F" /><text x={x(i)} y={y(val) - 8} fontSize="10" textAnchor="middle" fill="#1A1A1A" fontWeight="600">{val}</text><text x={x(i)} y={H - 12} fontSize="10" textAnchor="middle" fill="#525252">{v.labels[i]}</text></g>)}
    </svg>
  );
}

function Pie({ v }: { v: Extract<Visual, { type: "pie" }> }) {
  const total = v.values.reduce((a, b) => a + b, 0) || 1;
  let acc = 0;
  const arcs = v.values.map((val, i) => {
    const a0 = (acc / total) * 2 * Math.PI - Math.PI / 2;
    acc += val;
    const a1 = (acc / total) * 2 * Math.PI - Math.PI / 2;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const p = (a: number) => `${100 + 80 * Math.cos(a)},${100 + 80 * Math.sin(a)}`;
    const mid = (a0 + a1) / 2;
    return { d: `M100,100 L${p(a0)} A80,80 0 ${large} 1 ${p(a1)} Z`, c: COLORS[i % COLORS.length], tx: 100 + 52 * Math.cos(mid), ty: 100 + 52 * Math.sin(mid), val, label: v.labels[i] };
  });
  return (
    <div className="flex flex-wrap items-center gap-4">
      <svg viewBox="0 0 200 200" role="img" aria-label={`${v.title}: ${v.labels.map((l, i) => `${l} ${v.values[i]} percent`).join(", ")}`} className="h-44 w-44 shrink-0">
        {arcs.map((a, i) => <g key={i}><path d={a.d} fill={a.c} stroke="#fff" strokeWidth="2" /><text x={a.tx} y={a.ty} fontSize="11" textAnchor="middle" fill="#fff" fontWeight="700">{a.val}%</text></g>)}
      </svg>
      <ul className="text-[13px] text-ink-3">{arcs.map((a, i) => <li key={i} className="flex items-center gap-2"><span className="inline-block h-3 w-3 rounded-sm" style={{ background: a.c }} />{a.label}</li>)}</ul>
    </div>
  );
}

export default function DataVisual({ visual }: { visual: Visual }) {
  switch (visual.type) {
    case "table":
      return (
        <div className="overflow-x-auto">
          <table className="min-w-[14rem] border-collapse text-[14px]">
            <thead><tr>{visual.head.map((h) => <th key={h} scope="col" className="border border-black/10 bg-cream-2 px-3 py-1.5 text-left font-semibold text-ink">{h}</th>)}</tr></thead>
            <tbody>{visual.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="border border-black/10 px-3 py-1.5 tabular-nums text-ink-2">{c}</td>)}</tr>)}</tbody>
          </table>
        </div>
      );
    case "bar": return <Bar v={visual} />;
    case "line": return <Line v={visual} />;
    default: return <Pie v={visual} />;
  }
}
