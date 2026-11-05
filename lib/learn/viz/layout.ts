import type { Cell, VizResult } from "./engine";

/**
 * Turns a computed view into simple drawing shapes (rectangles, lines, paths, circles and text) that the practice viz builder draws as SVG.
 * Pure functions, no DOM. Bars start at zero; series get a fixed, colour-blind-friendly palette; a text table is returned for text layouts.
 */
export const PALETTE = ["#2563eb", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#0891b2", "#db2777", "#6b7280"];

export type Shape =
  | { t: "rect"; x: number; y: number; w: number; h: number; fill: string; title?: string }
  | { t: "line"; x1: number; y1: number; x2: number; y2: number; stroke: string; width?: number; dash?: boolean }
  | { t: "path"; d: string; stroke: string; fill?: string; width?: number; title?: string }
  | { t: "circle"; cx: number; cy: number; r: number; fill: string; title?: string }
  | { t: "text"; x: number; y: number; text: string; anchor?: "start" | "middle" | "end"; size?: number; weight?: number; rotate?: number; fill?: string };
export interface Drawing {
  width: number;
  height: number;
  shapes: Shape[];
  legend: Array<{ label: string; color: string }>;
  legendTitle: string;
  table?: { headers: string[]; rows: Cell[][] };
  caption: string;
}

const W = 640, H = 360, M = { l: 64, r: 16, t: 20, b: 56 };

export function niceTicks(min: number, max: number, count = 5): number[] {
  if (max === min) return [min, min + 1];
  const span = max - min;
  const raw = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= count + 0.5) ?? 10 * mag;
  const out: number[] = [];
  for (let v = Math.floor(min / step) * step; out.length < 40; v += step) {
    out.push(Math.round(v * 1e9) / 1e9);
    if (v >= max - step * 1e-6) break; // the last tick must reach the largest value, or a bar would stick out of the chart
  }
  return out;
}
export function formatValue(v: Cell, label = ""): string {
  if (v === null) return "";
  if (typeof v === "string") return v;
  if (/^% of total/i.test(label)) return `${Math.round(v * 1000) / 10}%`;
  if (Math.abs(v) >= 1000 || Number.isInteger(v)) return Math.round(v).toLocaleString("en-IN");
  return String(Math.round(v * 100) / 100);
}
const short = (v: number): string => (Math.abs(v) >= 1_000_000 ? `${Math.round(v / 1e5) / 10}M` : Math.abs(v) >= 1000 ? `${Math.round(v / 100) / 10}K` : String(Math.round(v * 100) / 100));
const cut = (s: string, n: number): string => (s.length > n ? s.slice(0, n - 1) + "…" : s);

function mix(a: string, b: string, t: number): string {
  const p = (h: string, i: number): number => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  const c = (i: number): string => Math.round(p(a, i) + (p(b, i) - p(a, i)) * t).toString(16).padStart(2, "0");
  return `#${c(0)}${c(1)}${c(2)}`;
}

export function layoutViz(r: VizResult): Drawing {
  const base = { width: W, height: H, shapes: [] as Shape[], legend: [] as Array<{ label: string; color: string }>, legendTitle: "", caption: "" };
  const m0 = r.measLabels[0] ?? "";
  const dimsOf = (i: number): string[] => [...new Set(r.points.map((p) => String(p.dims[i] ?? "")))];
  const seriesIdx = r.seriesDim;
  const seriesVals = seriesIdx !== null ? dimsOf(seriesIdx) : [];
  const colorOf = (s: string): string => PALETTE[Math.max(0, seriesVals.indexOf(s)) % PALETTE.length];
  const shapes = base.shapes;
  // for a grid, which dimension sits on Rows (down the side) and which on Columns (across the top)
  const ri0 = r.dimShelves.findIndex((s) => s.includes("rows")), ci0 = r.dimShelves.findIndex((s) => s.includes("columns"));
  const ri = ri0 >= 0 && ri0 !== ci0 ? ri0 : 0, ci = ci0 >= 0 && ci0 !== ri ? ci0 : ri === 0 ? 1 : 0;

  if (r.kind === "empty") return { ...base, caption: r.note ?? "" };
  if (r.kind === "crosstab" || r.kind === "text") {
    const headers = [...r.dimLabels, ...r.measLabels];
    if (r.kind === "crosstab" && r.dimLabels.length === 2 && r.measLabels.length >= 1) {
      const rowsV = dimsOf(ri), colsV = dimsOf(ci);
      const lookup = new Map(r.points.map((p) => [`${p.dims[ri]}|${p.dims[ci]}`, p.meas[0]]));
      return { ...base, table: { headers: [`${r.dimLabels[ri]} / ${r.dimLabels[ci]}`, ...colsV], rows: rowsV.map((rv) => [rv, ...colsV.map((cv) => lookup.get(`${rv}|${cv}`) ?? null)]) }, caption: `A text table of ${m0} by ${r.dimLabels[ri]} (down) and ${r.dimLabels[ci]} (across).` };
    }
    return { ...base, table: { headers, rows: r.points.map((p) => [...p.dims, ...p.meas]) }, caption: `A text table of ${r.measLabels.join(", ") || "the data"}.` };
  }

  if (r.kind === "pie") {
    const vals = r.points.map((p) => Number(p.meas[0] ?? 0));
    const total = vals.reduce((a, b) => a + Math.max(0, b), 0) || 1;
    const cx = 220, cy = 180, rad = 130;
    let ang = -Math.PI / 2;
    r.points.forEach((p, i) => {
      const frac = Math.max(0, vals[i]) / total, a2 = ang + frac * Math.PI * 2;
      const x1 = cx + rad * Math.cos(ang), y1 = cy + rad * Math.sin(ang), x2 = cx + rad * Math.cos(a2), y2 = cy + rad * Math.sin(a2);
      const label = String(p.dims[r.seriesDim ?? 0] ?? "");
      if (frac > 0) shapes.push({ t: "path", d: frac >= 0.9999 ? `M ${cx - rad} ${cy} A ${rad} ${rad} 0 1 1 ${cx + rad} ${cy} A ${rad} ${rad} 0 1 1 ${cx - rad} ${cy}` : `M ${cx} ${cy} L ${x1} ${y1} A ${rad} ${rad} 0 ${frac > 0.5 ? 1 : 0} 1 ${x2} ${y2} Z`, stroke: "#ffffff", fill: PALETTE[i % PALETTE.length], width: 2, title: `${label}: ${formatValue(p.meas[0], m0)} (${Math.round(frac * 1000) / 10}%)` });
      base.legend.push({ label: `${label} (${Math.round(frac * 1000) / 10}%)`, color: PALETTE[i % PALETTE.length] });
      ang = a2;
    });
    return { ...base, legendTitle: r.dimLabels[r.seriesDim ?? 0] ?? "", caption: `A pie chart of ${m0} by ${r.dimLabels[r.seriesDim ?? 0] ?? ""}.` };
  }

  if (r.kind === "scatter") {
    const xs = r.points.map((p) => Number(p.meas[0] ?? 0)), ys = r.points.map((p) => Number(p.meas[1] ?? 0));
    const xt = niceTicks(Math.min(0, ...xs), Math.max(...xs, 1)), yt = niceTicks(Math.min(0, ...ys), Math.max(...ys, 1));
    const sx = (v: number): number => M.l + ((v - xt[0]) / (xt[xt.length - 1] - xt[0] || 1)) * (W - M.l - M.r), sy = (v: number): number => H - M.b - ((v - yt[0]) / (yt[yt.length - 1] - yt[0] || 1)) * (H - M.t - M.b);
    axes(shapes, xt, yt, sx, sy, r.measLabels[0], r.measLabels[1]);
    r.points.forEach((p) => {
      const s = seriesIdx !== null ? String(p.dims[seriesIdx]) : "";
      shapes.push({ t: "circle", cx: sx(Number(p.meas[0] ?? 0)), cy: sy(Number(p.meas[1] ?? 0)), r: 6, fill: seriesIdx !== null ? colorOf(s) : PALETTE[0], title: `${p.dims.join(" / ")}: ${formatValue(p.meas[0])}, ${formatValue(p.meas[1])}` });
      if (r.points.length <= 14 && p.dims.length) shapes.push({ t: "text", x: sx(Number(p.meas[0] ?? 0)) + 9, y: sy(Number(p.meas[1] ?? 0)) + 4, text: cut(String(p.dims[p.dims.length === 1 ? 0 : Math.max(0, r.dimShelves.findIndex((sh) => sh.includes("detail")))] ?? ""), 14), size: 10, fill: "#374151" });
    });
    seriesVals.forEach((s) => base.legend.push({ label: s, color: colorOf(s) }));
    return { ...base, legendTitle: seriesIdx !== null ? r.dimLabels[seriesIdx] : "", caption: `A scatter plot of ${r.measLabels[1]} against ${r.measLabels[0]}, one point per ${r.dimLabels.join(" / ") || "mark"}.` };
  }

  if (r.kind === "heat") {
    const rowsV = dimsOf(ri), colsV = dimsOf(ci);
    const j = r.measShelves.findIndex((s) => s.includes("color")) >= 0 ? r.measShelves.findIndex((s) => s.includes("color")) : 0;
    const vals = r.points.map((p) => Number(p.meas[j] ?? 0));
    const lo = Math.min(...vals, 0), hi = Math.max(...vals, 1);
    const lookup = new Map(r.points.map((p) => [`${p.dims[ri]}|${p.dims[ci]}`, p.meas[j]]));
    const cw = Math.min(110, (W - 140) / Math.max(1, colsV.length)), ch = Math.min(40, (H - 80) / Math.max(1, rowsV.length));
    rowsV.forEach((rv, i) => {
      shapes.push({ t: "text", x: 118, y: 40 + i * ch + ch / 2 + 4, text: cut(rv, 16), anchor: "end", size: 12 });
      colsV.forEach((cv, k) => {
        const v = lookup.get(`${rv}|${cv}`);
        const t = typeof v === "number" ? (v - lo) / (hi - lo || 1) : 0;
        shapes.push({ t: "rect", x: 124 + k * cw, y: 40 + i * ch, w: cw - 2, h: ch - 2, fill: typeof v === "number" ? mix("#dbeafe", "#1e3a8a", t) : "#f3f4f6", title: `${rv} / ${cv}: ${formatValue(v ?? null, r.measLabels[j])}` });
        if (typeof v === "number") shapes.push({ t: "text", x: 124 + k * cw + cw / 2, y: 40 + i * ch + ch / 2 + 4, text: short(v), anchor: "middle", size: 11, fill: t > 0.55 ? "#ffffff" : "#111827" });
      });
    });
    colsV.forEach((cv, k) => shapes.push({ t: "text", x: 124 + k * cw + cw / 2, y: 30, text: cut(cv, 12), anchor: "middle", size: 12, weight: 600 }));
    return { ...base, caption: `A heat map of ${r.measLabels[j]} by ${r.dimLabels[ri]} (rows) and ${r.dimLabels[ci]} (columns): darker means larger.` };
  }

  // charts with a category axis: bar-v, bar-h, line, area
  const ai = r.axisDim ?? 0;
  const cats = dimsOf(ai);
  const series = seriesIdx !== null ? seriesVals : [""];
  const val = (cat: string, s: string): number | null => {
    const hit = r.points.find((p) => String(p.dims[ai]) === cat && (seriesIdx === null || String(p.dims[seriesIdx]) === s));
    const v = hit?.meas[0];
    return typeof v === "number" ? v : null;
  };
  const horizontal = r.kind === "bar-h";
  const stacked = r.kind === "bar-v" || r.kind === "bar-h";
  const sums = cats.map((c) => series.reduce((a, s) => a + (val(c, s) ?? 0), 0));
  const posTop = stacked ? Math.max(...cats.map((c) => series.reduce((a, s) => a + Math.max(0, val(c, s) ?? 0), 0)), 0) : Math.max(...series.flatMap((s) => cats.map((c) => val(c, s) ?? 0)), 0);
  const negBot = stacked ? Math.min(...cats.map((c) => series.reduce((a, s) => a + Math.min(0, val(c, s) ?? 0), 0)), 0) : Math.min(...series.flatMap((s) => cats.map((c) => val(c, s) ?? 0)), 0);
  void sums;
  const vt = niceTicks(negBot, Math.max(posTop, negBot + 1));
  const lo = vt[0], hi = vt[vt.length - 1];
  if (!horizontal) {
    const sy = (v: number): number => H - M.b - ((v - lo) / (hi - lo || 1)) * (H - M.t - M.b);
    const bw = (W - M.l - M.r) / Math.max(1, cats.length);
    const sx = (i: number): number => M.l + bw * i + bw / 2;
    axes(shapes, null, vt, null, sy, r.dimLabels[ai], r.measLabels[0]);
    const stride = Math.max(1, Math.ceil(cats.length / Math.max(1, Math.floor((W - M.l - M.r) / 62)))); // thin the labels so they never overlap
    cats.forEach((c, i) => { if (i % stride === 0) shapes.push({ t: "text", x: sx(i), y: H - M.b + 18, text: cut(c, bw * stride > 70 ? 14 : 8), anchor: "middle", size: 11 }); });
    if (r.kind === "bar-v") {
      cats.forEach((c, i) => {
        let up = 0, down = 0;
        series.forEach((s) => {
          const v = val(c, s); if (v === null) return;
          const fill = seriesIdx !== null ? colorOf(s) : PALETTE[0];
          const from = v >= 0 ? up : down, to = from + v;
          if (v >= 0) up = to; else down = to;
          const y1 = sy(Math.max(from, to)), y2 = sy(Math.min(from, to));
          shapes.push({ t: "rect", x: sx(i) - bw * 0.35, y: y1, w: bw * 0.7, h: Math.max(1, y2 - y1), fill, title: `${c}${seriesIdx !== null ? " / " + s : ""}: ${formatValue(v, m0)}` });
        });
        if (seriesIdx === null) { const v = val(c, ""); if (v !== null) shapes.push({ t: "text", x: sx(i), y: sy(Math.max(v, 0)) - 5, text: short(v), anchor: "middle", size: 11 }); }
      });
    } else {
      series.forEach((s) => {
        const color = seriesIdx !== null ? colorOf(s) : PALETTE[0];
        const pts = cats.map((c, i) => ({ x: sx(i), v: val(c, s) })).filter((p): p is { x: number; v: number } => p.v !== null);
        if (!pts.length) return;
        const d = pts.map((p, i) => `${i ? "L" : "M"} ${p.x} ${sy(p.v)}`).join(" ");
        if (r.kind === "area") shapes.push({ t: "path", d: `${d} L ${pts[pts.length - 1].x} ${sy(Math.max(lo, 0))} L ${pts[0].x} ${sy(Math.max(lo, 0))} Z`, stroke: color, fill: color + "55", width: 2 });
        else shapes.push({ t: "path", d, stroke: color, width: 2.5 });
        pts.forEach((p) => shapes.push({ t: "circle", cx: p.x, cy: sy(p.v), r: 4, fill: color, title: `${s ? s + " / " : ""}${formatValue(p.v, m0)}` }));
      });
    }
  } else {
    const sx = (v: number): number => M.l + 40 + ((v - lo) / (hi - lo || 1)) * (W - M.l - M.r - 40);
    const bh = (H - M.t - M.b) / Math.max(1, cats.length);
    const sy = (i: number): number => M.t + bh * i + bh / 2;
    horizAxes(shapes, vt, sx, r.measLabels[0], r.dimLabels[ai]);
    cats.forEach((c, i) => {
      shapes.push({ t: "text", x: M.l + 34, y: sy(i) + 4, text: cut(c, 14), anchor: "end", size: 11 });
      let up = 0, down = 0;
      series.forEach((s) => {
        const v = val(c, s); if (v === null) return;
        const from = v >= 0 ? up : down, to = from + v;
        if (v >= 0) up = to; else down = to;
        shapes.push({ t: "rect", x: sx(Math.min(from, to)), y: sy(i) - bh * 0.35, w: Math.max(1, sx(Math.max(from, to)) - sx(Math.min(from, to))), h: bh * 0.7, fill: seriesIdx !== null ? colorOf(s) : PALETTE[0], title: `${c}${seriesIdx !== null ? " / " + s : ""}: ${formatValue(v, m0)}` });
      });
      if (seriesIdx === null) { const v = val(c, ""); if (v !== null) shapes.push({ t: "text", x: sx(Math.max(v, 0)) + 5, y: sy(i) + 4, text: short(v), size: 11 }); }
    });
  }
  series.filter(Boolean).forEach((s) => base.legend.push({ label: s, color: colorOf(s) }));
  const what = { "bar-v": "A bar chart", "bar-h": "A horizontal bar chart", line: "A line chart", area: "An area chart" }[r.kind];
  return { ...base, legendTitle: seriesIdx !== null ? r.dimLabels[seriesIdx] : "", caption: `${what} of ${m0} by ${r.dimLabels[ai]}${seriesIdx !== null ? `, split by ${r.dimLabels[seriesIdx]}` : ""}.` };
}

function axes(shapes: Shape[], xt: number[] | null, yt: number[], sx: ((v: number) => number) | null, sy: (v: number) => number, xLabel = "", yLabel = ""): void {
  yt.forEach((v) => {
    shapes.push({ t: "line", x1: M.l, y1: sy(v), x2: W - M.r, y2: sy(v), stroke: v === 0 ? "#6b7280" : "#e5e7eb", width: v === 0 ? 1.5 : 1 });
    shapes.push({ t: "text", x: M.l - 8, y: sy(v) + 4, text: short(v), anchor: "end", size: 11, fill: "#4b5563" });
  });
  if (xt && sx) xt.forEach((v) => {
    shapes.push({ t: "line", x1: sx(v), y1: H - M.b, x2: sx(v), y2: M.t, stroke: "#f3f4f6" });
    shapes.push({ t: "text", x: sx(v), y: H - M.b + 18, text: short(v), anchor: "middle", size: 11, fill: "#4b5563" });
  });
  shapes.push({ t: "text", x: (M.l + W - M.r) / 2, y: H - 8, text: xLabel, anchor: "middle", size: 12, weight: 600 });
  shapes.push({ t: "text", x: 14, y: (M.t + H - M.b) / 2, text: yLabel, anchor: "middle", size: 12, weight: 600, rotate: -90 });
}
function horizAxes(shapes: Shape[], vt: number[], sx: (v: number) => number, xLabel: string, yLabel: string): void {
  vt.forEach((v) => {
    shapes.push({ t: "line", x1: sx(v), y1: M.t, x2: sx(v), y2: H - M.b, stroke: v === 0 ? "#6b7280" : "#e5e7eb", width: v === 0 ? 1.5 : 1 });
    shapes.push({ t: "text", x: sx(v), y: H - M.b + 18, text: short(v), anchor: "middle", size: 11, fill: "#4b5563" });
  });
  shapes.push({ t: "text", x: (M.l + 40 + W - M.r) / 2, y: H - 8, text: xLabel, anchor: "middle", size: 12, weight: 600 });
  shapes.push({ t: "text", x: 14, y: (M.t + H - M.b) / 2, text: yLabel, anchor: "middle", size: 12, weight: 600, rotate: -90 });
}
