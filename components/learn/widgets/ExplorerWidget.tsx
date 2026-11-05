"use client";

import { useRef, useState } from "react";
import { explorerOutputs, explorerSeries, formatValue } from "@/lib/learn/widgets/engine";
import type { ExplorerSpec } from "@/lib/learn/widgets/types";
import { awardXp } from "./store";
import { btnGhost, Shell } from "./ui";

const COLORS = { orange: "#FF6A2F", blue: "#1D4ED8", green: "#15803D" } as const;
const unitText = (v: number, u?: string) => (u === "rs" ? "₹" + Math.round(v).toLocaleString("en-IN") : u === "pct" ? `${v}%` : u === "yrs" ? `${v} yr${v === 1 ? "" : "s"}` : v.toLocaleString("en-IN"));

/** Sliders drive formulas; results and an optional chart update instantly. A safe parser evaluates the author's expressions (no eval). */
export function ExplorerWidget({ spec, slug }: { spec: ExplorerSpec; slug: string }) {
  const initial = Object.fromEntries(spec.inputs.map((i) => [i.id, i.value]));
  const [vals, setVals] = useState<Record<string, number>>(initial);
  const moves = useRef(0);
  const outs = explorerOutputs(spec, vals);
  const ser = explorerSeries(spec, vals);

  const set = (id: string, v: number) => {
    setVals((s) => ({ ...s, [id]: v }));
    moves.current += 1;
    if (moves.current === 4) awardXp(slug, spec.id, 15, "Explored");
  };

  let chart: React.ReactNode = null;
  if (ser) {
    const all = ser.series.flatMap((s) => s.y).filter(Number.isFinite);
    const max = Math.max(1, ...all), min = Math.min(0, ...all);
    const W = 560, H = 230, L = 62, R = 18, T = 14, B = 34;
    const px = (k: number) => L + ((W - L - R) * k) / Math.max(1, ser.x.length - 1);
    const py = (v: number) => H - B - ((H - T - B) * (v - min)) / (max - min || 1);
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => min + (max - min) * f);
    chart = (
      <figure className="mt-4">
        <div className="overflow-x-auto rounded-xl border border-black/[0.1] bg-white p-2" tabIndex={0} aria-label="Chart (scrolls sideways on small screens)">
          <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full min-w-[460px]" role="img" aria-label={`Line chart: ${ser.series.map((s) => s.label).join(" and ")} over ${spec.chart!.xlabel.toLowerCase()}s`}>
            {ticks.map((t, i) => (<g key={i}><line x1={L} x2={W - R} y1={py(t)} y2={py(t)} stroke="#E4E1D8" /><text x={L - 8} y={py(t) + 4} textAnchor="end" fontSize="12" fill="#525252">{t >= 100000 ? `${Math.round(t / 1000) / 100}L` : Math.round(t).toLocaleString("en-IN")}</text></g>))}
            {ser.x.map((k) => <text key={k} x={px(k)} y={H - 12} textAnchor="middle" fontSize="12" fill="#525252">{spec.chart!.xlabel} {k}</text>)}
            {ser.series.map((s) => (
              <g key={s.label}>
                <polyline fill="none" stroke={COLORS[s.color as keyof typeof COLORS] ?? COLORS.orange} strokeWidth="3" points={s.y.map((v, k) => (Number.isFinite(v) ? `${px(k)},${py(v)}` : "")).filter(Boolean).join(" ")} className="cw-line" />
                {s.y.map((v, k) => (Number.isFinite(v) ? <circle key={k} cx={px(k)} cy={py(v)} r="4" fill={COLORS[s.color as keyof typeof COLORS] ?? COLORS.orange} /> : null))}
              </g>
            ))}
          </svg>
        </div>
        <figcaption className="mt-2 flex flex-wrap justify-center gap-x-5 gap-y-1 text-[13px] text-ink-2">
          {ser.series.map((s) => <span key={s.label} className="inline-flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded" style={{ background: COLORS[s.color as keyof typeof COLORS] ?? COLORS.orange }} />{s.label}</span>)}
        </figcaption>
      </figure>
    );
  }

  return (
    <Shell kind="Explore" title={spec.title} intro={spec.intro} xp={15}>
      <div className="grid gap-4 md:grid-cols-2">
        {spec.inputs.map((i) => (
          <div key={i.id} className="rounded-xl bg-cream-2 px-4 py-3">
            <label htmlFor={`${spec.id}-${i.id}`} className="flex items-baseline justify-between gap-2 text-[14px] font-semibold text-ink"><span>{i.label}</span><output htmlFor={`${spec.id}-${i.id}`} className="text-[16px] font-extrabold tabular-nums text-orange-deep">{unitText(vals[i.id], i.unit)}</output></label>
            <input id={`${spec.id}-${i.id}`} type="range" min={i.min} max={i.max} step={i.step} value={vals[i.id]} onChange={(e) => set(i.id, Number(e.target.value))} aria-valuetext={unitText(vals[i.id], i.unit)} className="cw-range mt-2 w-full" />
            <div className="flex justify-between text-[11.5px] text-ink-3"><span>{unitText(i.min, i.unit)}</span><span>{unitText(i.max, i.unit)}</span></div>
          </div>
        ))}
      </div>
      <ul className="mt-4 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3" aria-live="polite">
        {outs.map((o) => (
          <li key={o.label} className="rounded-xl border border-orange/30 bg-orange-lighter px-4 py-3">
            <span className="block text-[12.5px] font-semibold text-ink-3">{o.label}</span>
            <b className="cw-num block text-[22px] font-extrabold tabular-nums text-ink">{formatValue(o.value, o.unit)}</b>
            {o.hint ? <span className="block text-[12.5px] text-ink-3">{o.hint}</span> : null}
          </li>
        ))}
      </ul>
      {chart}
      <button type="button" onClick={() => { setVals(initial); }} className={`${btnGhost} mt-4`}>Reset</button>
    </Shell>
  );
}
