import { CalcError, evalGroup, evalRow, isAggregate, makeEnv, parseCalc, type Cell, type CNode, type Env, type FieldInfo } from "./calc";

/**
 * The practice viz builder's engine. A view is described the way Tableau describes one: fields on the Columns and Rows shelves, and on the Marks card
 * (Color, Size, Label, Detail), plus filters, a sort and quick table calculations. This file turns that description and a small data table into the marks
 * (one per combination of the dimensions in the view) with their aggregated measures. It draws nothing; layout.ts turns the result into shapes.
 * Dimensions group the rows; measures are aggregated per group; calculated fields use calc.ts. No eval, no dynamic code.
 */
export type { Cell };
export type Agg = "sum" | "avg" | "min" | "max" | "count" | "countd" | "median";
export type DateLevel = "year" | "quarter" | "month" | "day";
export type QuickCalc = "running" | "pct" | "rank" | "diff";
export type MarkType = "auto" | "bar" | "line" | "area" | "circle" | "square" | "text" | "pie";
export interface Pill { field: string; agg?: Agg; date?: DateLevel; quick?: QuickCalc }
export interface VizFilter { field: string; values?: string[]; min?: number; max?: number }
export interface VizSpec {
  mark?: MarkType;
  columns: Pill[];
  rows: Pill[];
  color?: Pill;
  size?: Pill;
  label?: Pill;
  detail?: Pill[];
  filters?: VizFilter[];
  sort?: { dir: "asc" | "desc"; by?: string };
  top?: number;
}
export interface VizField { name: string; role: "dimension" | "measure"; type: "string" | "number" | "date" }
export interface VizData { fields: VizField[]; rows: Cell[][]; calcs?: Record<string, string> }
export type Shelf = "columns" | "rows" | "color" | "size" | "label" | "detail";
export type VizKind = "bar-v" | "bar-h" | "line" | "area" | "scatter" | "crosstab" | "heat" | "pie" | "text" | "empty";
export interface VizPoint { dims: Cell[]; meas: Cell[] }
export interface VizResult {
  ok: true;
  kind: VizKind;
  mark: MarkType;
  dimLabels: string[];
  dimShelves: Shelf[][];
  measLabels: string[];
  measShelves: Shelf[][];
  /** Index (into dimLabels) of the dimension that spreads the marks along the main axis, if there is one. */
  axisDim: number | null;
  /** Index (into dimLabels) of the dimension that splits the marks into colours or series, if there is one. */
  seriesDim: number | null;
  points: VizPoint[];
  note?: string;
}
export type VizOutcome = VizResult | { ok: false; error: string; hint?: string };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const lc = (s: string): string => s.toLowerCase();
const AGG_LABEL: Record<Agg, string> = { sum: "SUM", avg: "AVG", min: "MIN", max: "MAX", count: "COUNT", countd: "COUNTD", median: "MEDIAN" };
const QUICK_LABEL: Record<QuickCalc, string> = { running: "Running total of", pct: "% of total of", rank: "Rank of", diff: "Difference in" };
const norm = (n: number): number => Math.round(n * 1e9) / 1e9;

function dateKey(iso: string, level: DateLevel): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) throw new CalcError(`"${iso}" is not a date written as YYYY-MM-DD.`);
  if (level === "year") return m[1];
  if (level === "quarter") return `${m[1]} Q${Math.ceil(+m[2] / 3)}`;
  if (level === "month") return `${m[1]}-${m[2]}`;
  return iso.slice(0, 10);
}
function dateShow(key: string, level: DateLevel): string {
  if (level === "month") { const [y, mo] = key.split("-"); return `${MONTHS[+mo - 1]} ${y}`; }
  return key;
}

interface DimPill { kind: "dim"; label: string; key: (row: number) => Cell; show: (k: Cell) => Cell; shelves: Shelf[]; numeric: boolean; field: string; isDate: boolean }
interface MeasPill { kind: "meas"; label: string; compute: (rows: number[]) => Cell; shelves: Shelf[]; quick?: QuickCalc; field: string }
type Resolved = DimPill | MeasPill;

function buildEnv(data: VizData): { env: Env; fields: FieldInfo[]; calcErrors: Map<string, CalcError> } {
  const fields: FieldInfo[] = data.fields.map((f, idx) => ({ name: f.name, idx, role: f.role, type: f.type }));
  const calcs = new Map<string, { name: string; node: CNode; agg: boolean }>();
  const calcErrors = new Map<string, CalcError>();
  for (const [name, src] of Object.entries(data.calcs ?? {})) {
    try { const node = parseCalc(src); calcs.set(lc(name), { name, node, agg: isAggregate(node) }); }
    catch (e) { if (e instanceof CalcError) calcErrors.set(lc(name), new CalcError(`In the calculated field [${name}]: ${e.message}`, e.hint)); else throw e; }
  }
  return { env: makeEnv(fields, data.rows, calcs), fields, calcErrors };
}

function aggregateRows(agg: Agg, vals: Cell[]): Cell {
  const v = vals.filter((x) => x !== null);
  const nums = v.filter((x): x is number => typeof x === "number");
  switch (agg) {
    case "sum": return nums.length ? norm(nums.reduce((a, b) => a + b, 0)) : null;
    case "avg": return nums.length ? norm(nums.reduce((a, b) => a + b, 0) / nums.length) : null;
    case "min": return nums.length === v.length && nums.length ? Math.min(...nums) : v.length ? [...v].map(String).sort()[0] : null;
    case "max": return nums.length === v.length && nums.length ? Math.max(...nums) : v.length ? [...v].map(String).sort().slice(-1)[0] : null;
    case "count": return v.length;
    case "countd": return new Set(v).size;
    case "median": { if (!nums.length) return null; const s = [...nums].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : norm((s[m - 1] + s[m]) / 2); }
  }
}
const asCell = (v: Cell | boolean): Cell => (typeof v === "boolean" ? (v ? "TRUE" : "FALSE") : v);

function resolve(p: Pill, shelf: Shelf, data: VizData, env: Env, calcErrors: Map<string, CalcError>): Resolved {
  const base = data.fields.find((f) => lc(f.name) === lc(p.field));
  if (!base) {
    const calc = env.calcs.get(lc(p.field));
    const err = calcErrors.get(lc(p.field));
    if (err) throw err;
    if (!calc) {
      const names = [...data.fields.map((f) => f.name), ...Object.keys(data.calcs ?? {})];
      throw new CalcError(`There is no field called "${p.field}" in this data.`, `The fields are: ${names.join(", ")}.`);
    }
    if (calc.agg) {
      const label = calc.name;
      return { kind: "meas", label: p.quick ? `${QUICK_LABEL[p.quick]} ${label}` : label, compute: (rows) => asCell(evalGroup(calc.node, rows, env)), shelves: [shelf], quick: p.quick, field: calc.name };
    }
    // a row-level calculation: text results make a dimension, numbers make a measure
    let sample: Cell | boolean = null;
    for (let i = 0; i < env.rows.length && sample === null; i++) sample = evalRow(calc.node, i, env);
    if (typeof sample === "string" || typeof sample === "boolean") {
      return { kind: "dim", label: calc.name, key: (r) => asCell(evalRow(calc.node, r, env)), show: (k) => k, shelves: [shelf], numeric: false, field: calc.name, isDate: false };
    }
    const agg = p.agg ?? "sum";
    const label = `${AGG_LABEL[agg]}(${calc.name})`;
    return { kind: "meas", label: p.quick ? `${QUICK_LABEL[p.quick]} ${label}` : label, compute: (rows) => aggregateRows(agg, rows.map((r) => asCell(evalRow(calc.node, r, env)))), shelves: [shelf], quick: p.quick, field: calc.name };
  }
  const idx = data.fields.indexOf(base);
  if (base.role === "measure" || p.agg) {
    const agg: Agg = p.agg ?? "sum";
    if (base.role === "dimension" && agg !== "count" && agg !== "countd") throw new CalcError(`${AGG_LABEL[agg]} cannot be used on the dimension "${base.name}".`, "Dimensions can only be counted (COUNT or COUNTD).");
    const label = `${AGG_LABEL[agg]}(${base.name})`;
    return { kind: "meas", label: p.quick ? `${QUICK_LABEL[p.quick]} ${label}` : label, compute: (rows) => aggregateRows(agg, rows.map((r) => env.rows[r][idx])), shelves: [shelf], quick: p.quick, field: base.name };
  }
  if (base.type === "date") {
    const level: DateLevel = p.date ?? "year";
    const label = `${level.toUpperCase()}(${base.name})`;
    return { kind: "dim", label, key: (r) => { const v = env.rows[r][idx]; return v === null ? null : dateKey(String(v), level); }, show: (k) => (k === null ? null : dateShow(String(k), level)), shelves: [shelf], numeric: false, field: base.name, isDate: true };
  }
  return { kind: "dim", label: base.name, key: (r) => env.rows[r][idx], show: (k) => k, shelves: [shelf], numeric: base.type === "number", field: base.name, isDate: false };
}

const cmpCells = (a: Cell, b: Cell, numeric = false): number => {
  if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (numeric) return Number(a) - Number(b);
  return lc(String(a)) < lc(String(b)) ? -1 : lc(String(a)) > lc(String(b)) ? 1 : 0;
};

export function computeViz(data: VizData, spec: VizSpec): VizOutcome {
  try {
    return compute(data, spec);
  } catch (e) {
    if (e instanceof CalcError) return { ok: false, error: e.message, hint: e.hint };
    throw e;
  }
}

function compute(data: VizData, spec: VizSpec): VizOutcome {
  const { env, calcErrors } = buildEnv(data);
  const shelfPills: Array<{ p: Pill; shelf: Shelf }> = [
    ...spec.columns.map((p) => ({ p, shelf: "columns" as Shelf })), ...spec.rows.map((p) => ({ p, shelf: "rows" as Shelf })),
    ...(spec.color ? [{ p: spec.color, shelf: "color" as Shelf }] : []), ...(spec.size ? [{ p: spec.size, shelf: "size" as Shelf }] : []),
    ...(spec.label ? [{ p: spec.label, shelf: "label" as Shelf }] : []), ...(spec.detail ?? []).map((p) => ({ p, shelf: "detail" as Shelf })),
  ];
  const dims: DimPill[] = [], meas: MeasPill[] = [];
  const classify: Record<string, { cols: Resolved[]; rows: Resolved[] }> = { v: { cols: [], rows: [] } };
  for (const { p, shelf } of shelfPills) {
    const r = resolve(p, shelf, data, env, calcErrors);
    const list = (r.kind === "dim" ? dims : meas) as Resolved[];
    const dup = list.find((x) => x.label === r.label);
    if (dup) { dup.shelves.push(shelf); if (r.kind === "meas" && r.quick && !(dup as MeasPill).quick) (dup as MeasPill).quick = r.quick; continue; }
    list.push(r);
    if (shelf === "columns") classify.v.cols.push(r);
    if (shelf === "rows") classify.v.rows.push(r);
  }
  env.viewDims = dims.map((d) => d.field);

  // filters
  let rowsIdx = env.rows.map((_, i) => i);
  const measFilters: Array<{ label: string; min?: number; max?: number }> = [];
  for (const f of spec.filters ?? []) {
    const field = data.fields.find((x) => lc(x.name) === lc(f.field));
    const calc = env.calcs.get(lc(f.field));
    if (!field && !calc) throw new CalcError(`There is no field called "${f.field}" to filter on.`);
    const valueOf = (r: number): Cell => (field ? env.rows[r][data.fields.indexOf(field)] : asCell(calc && !calc.agg ? evalRow(calc.node, r, env) : null));
    if (f.values) { const set = new Set(f.values.map((v) => lc(v))); rowsIdx = rowsIdx.filter((r) => { const v = valueOf(r); return v !== null && set.has(lc(String(v))); }); }
    if (f.min !== undefined || f.max !== undefined) {
      const mp = meas.find((m) => m.field === (field?.name ?? calc?.name));
      if (mp) measFilters.push({ label: mp.label, min: f.min, max: f.max });
      else rowsIdx = rowsIdx.filter((r) => { const v = valueOf(r); return typeof v === "number" && (f.min === undefined || v >= f.min) && (f.max === undefined || v <= f.max); });
    }
  }

  env.scope = rowsIdx;
  // marks: one per combination of the dimensions
  const groups = new Map<string, { keys: Cell[]; rows: number[] }>();
  for (const r of rowsIdx) {
    const keys = dims.map((d) => d.key(r));
    const id = JSON.stringify(keys);
    const g = groups.get(id);
    if (g) g.rows.push(r); else groups.set(id, { keys, rows: [r] });
  }
  if (!dims.length && rowsIdx.length) groups.set("[]", { keys: [], rows: rowsIdx });
  let marks = [...groups.values()].map((g) => ({ keys: g.keys, meas: meas.map((m) => m.compute(g.rows)) as Cell[] }));
  for (const mf of measFilters) {
    const j = meas.findIndex((m) => m.label === mf.label);
    marks = marks.filter((m) => { const v = m.meas[j]; return typeof v === "number" && (mf.min === undefined || v >= mf.min) && (mf.max === undefined || v <= mf.max); });
  }

  // which dimension spreads marks along the axis, and which splits them into series
  const colDims = classify.v.cols.filter((x): x is DimPill => x.kind === "dim"), rowDims = classify.v.rows.filter((x): x is DimPill => x.kind === "dim");
  const colMeas = classify.v.cols.filter((x): x is MeasPill => x.kind === "meas"), rowMeas = classify.v.rows.filter((x): x is MeasPill => x.kind === "meas");
  const mark = spec.mark ?? "auto";
  let kind: VizKind;
  let axisDim: DimPill | undefined, seriesDim: DimPill | undefined;
  let note: string | undefined;
  if (mark === "pie") { kind = "pie"; seriesDim = dims.find((d) => d.shelves.includes("color")) ?? dims[0]; }
  else if (colMeas.length && rowMeas.length) { kind = "scatter"; }
  else if (rowMeas.length && colDims.length) { axisDim = colDims[0]; kind = mark === "line" ? "line" : mark === "area" ? "area" : mark === "bar" ? "bar-v" : axisDim.isDate ? "line" : "bar-v"; }
  else if (colMeas.length && rowDims.length) { axisDim = rowDims[0]; kind = "bar-h"; }
  else if (colDims.length && rowDims.length) { kind = mark === "square" || spec.color ? "heat" : "crosstab"; }
  else if (dims.length || meas.length) { kind = "text"; }
  else { return { ok: true, kind: "empty", mark, dimLabels: [], dimShelves: [], measLabels: [], measShelves: [], axisDim: null, seriesDim: null, points: [], note: "Drag fields onto Columns and Rows to build a view." }; }
  if (kind !== "pie") seriesDim = dims.find((d) => d !== axisDim && (d.shelves.includes("color") || d.shelves.includes("detail")) && (kind !== "heat" && kind !== "crosstab"));
  if ((kind === "bar-v" || kind === "bar-h") && mark !== "bar" && mark !== "auto") note = `The ${mark} mark does not apply to a bar layout here; showing bars.`;
  const axisIdx = axisDim ? dims.indexOf(axisDim) : -1, seriesIdx = seriesDim ? dims.indexOf(seriesDim) : -1;

  // quick table calculations: addressed along the axis (or the last dimension on Columns/Rows), partitioned by the other dimensions
  const addr = axisIdx >= 0 ? axisIdx : dims.indexOf(colDims[colDims.length - 1] ?? rowDims[rowDims.length - 1] ?? dims[dims.length - 1]);
  meas.forEach((m, j) => {
    if (!m.quick || addr < 0) return;
    const parts = new Map<string, typeof marks>();
    for (const mk of marks) { const id = JSON.stringify(mk.keys.filter((_, i) => i !== addr)); (parts.get(id) ?? parts.set(id, []).get(id)!).push(mk); }
    for (const part of parts.values()) {
      part.sort((a, b) => cmpCells(a.keys[addr], b.keys[addr], dims[addr].numeric));
      const vals = part.map((mk) => (typeof mk.meas[j] === "number" ? (mk.meas[j] as number) : 0));
      const total = vals.reduce((a, b) => a + b, 0);
      let run = 0;
      part.forEach((mk, i) => {
        if (m.quick === "running") { run += vals[i]; mk.meas[j] = norm(run); }
        else if (m.quick === "pct") mk.meas[j] = total === 0 ? null : norm(vals[i] / total);
        else if (m.quick === "rank") mk.meas[j] = 1 + vals.filter((x) => x > vals[i]).length;
        else mk.meas[j] = i === 0 ? null : norm(vals[i] - vals[i - 1]);
      });
    }
  });

  // order the marks: along the axis by sort (or naturally), then series
  const sortMeasIdx = (() => { if (!spec.sort?.by) return 0; const k = meas.findIndex((m) => lc(m.label) === lc(spec.sort!.by!) || lc(m.field) === lc(spec.sort!.by!)); return k < 0 ? 0 : k; })();
  if (axisIdx >= 0) {
    const totals = new Map<string, number>();
    for (const mk of marks) { const k = JSON.stringify(mk.keys[axisIdx]); totals.set(k, (totals.get(k) ?? 0) + (typeof mk.meas[sortMeasIdx] === "number" ? (mk.meas[sortMeasIdx] as number) : 0)); }
    const order = [...new Set(marks.map((m) => JSON.stringify(m.keys[axisIdx])))];
    if (spec.sort) order.sort((a, b) => (spec.sort!.dir === "desc" ? -1 : 1) * ((totals.get(a) ?? 0) - (totals.get(b) ?? 0)));
    else order.sort((a, b) => cmpCells(JSON.parse(a), JSON.parse(b), dims[axisIdx].numeric));
    const keep = new Set(spec.top && spec.top > 0 ? order.slice(0, spec.top) : order);
    marks = marks.filter((m) => keep.has(JSON.stringify(m.keys[axisIdx])));
    const pos = new Map(order.map((k, i) => [k, i]));
    marks.sort((a, b) => (pos.get(JSON.stringify(a.keys[axisIdx])) ?? 0) - (pos.get(JSON.stringify(b.keys[axisIdx])) ?? 0) || (seriesIdx >= 0 ? cmpCells(a.keys[seriesIdx], b.keys[seriesIdx]) : 0));
  } else {
    marks.sort((a, b) => { for (let i = 0; i < dims.length; i++) { const c = cmpCells(a.keys[i], b.keys[i], dims[i].numeric); if (c) return c; } return 0; });
    if (spec.sort) marks.sort((a, b) => (spec.sort!.dir === "desc" ? -1 : 1) * (Number(a.meas[sortMeasIdx] ?? 0) - Number(b.meas[sortMeasIdx] ?? 0)));
    if (spec.top && spec.top > 0) marks = marks.slice(0, spec.top);
  }

  return {
    ok: true, kind, mark, note,
    dimLabels: dims.map((d) => d.label), dimShelves: dims.map((d) => d.shelves),
    measLabels: meas.map((m) => m.label), measShelves: meas.map((m) => m.shelves),
    axisDim: axisIdx >= 0 ? axisIdx : null, seriesDim: seriesIdx >= 0 ? seriesIdx : null,
    points: marks.map((m) => ({ dims: m.keys.map((k, i) => dims[i].show(k)), meas: m.meas })),
  };
}

const AGG_SET = new Set<string>(["sum", "avg", "min", "max", "count", "countd", "median"]);
const DATE_SET = new Set<string>(["year", "quarter", "month", "day"]);
const QUICK_SET = new Set<string>(["running", "pct", "rank", "diff"]);
const MARK_SET = new Set<string>(["auto", "bar", "line", "area", "circle", "square", "text", "pie"]);
const str = (v: unknown, n = 60): string | null => (typeof v === "string" && v.trim() !== "" ? v.slice(0, n) : null);
function cleanPill(v: unknown): Pill | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const field = str(o.field);
  if (!field) return null;
  return { field, ...(typeof o.agg === "string" && AGG_SET.has(o.agg) ? { agg: o.agg as Agg } : {}), ...(typeof o.date === "string" && DATE_SET.has(o.date) ? { date: o.date as DateLevel } : {}), ...(typeof o.quick === "string" && QUICK_SET.has(o.quick) ? { quick: o.quick as QuickCalc } : {}) };
}
const cleanPills = (v: unknown): Pill[] => (Array.isArray(v) ? v.slice(0, 6).flatMap((x) => { const p = cleanPill(x); return p ? [p] : []; }) : []);
/** Accept whatever a client sends as a view and return a clean one (unknown shapes and long strings are cut away). */
export function sanitizeSpec(raw: unknown): VizSpec {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const filters: VizFilter[] = Array.isArray(o.filters) ? o.filters.slice(0, 6).flatMap((x) => {
    if (!x || typeof x !== "object") return [];
    const f = x as Record<string, unknown>;
    const field = str(f.field);
    if (!field) return [];
    return [{ field, ...(Array.isArray(f.values) ? { values: f.values.slice(0, 60).filter((s): s is string => typeof s === "string").map((s) => s.slice(0, 60)) } : {}), ...(typeof f.min === "number" && Number.isFinite(f.min) ? { min: f.min } : {}), ...(typeof f.max === "number" && Number.isFinite(f.max) ? { max: f.max } : {}) }];
  }) : [];
  const sort = o.sort && typeof o.sort === "object" ? (o.sort as Record<string, unknown>) : null;
  const color = cleanPill(o.color), size = cleanPill(o.size), label = cleanPill(o.label);
  const detail = cleanPills(o.detail);
  return {
    mark: typeof o.mark === "string" && MARK_SET.has(o.mark) ? (o.mark as MarkType) : "auto",
    columns: cleanPills(o.columns), rows: cleanPills(o.rows),
    ...(color ? { color } : {}), ...(size ? { size } : {}), ...(label ? { label } : {}), ...(detail.length ? { detail } : {}),
    ...(filters.length ? { filters } : {}),
    ...(sort && (sort.dir === "asc" || sort.dir === "desc") ? { sort: { dir: sort.dir as "asc" | "desc" } } : {}),
    ...(typeof o.top === "number" && o.top >= 1 && o.top <= 50 ? { top: Math.trunc(o.top) } : {}),
  };
}
export function sanitizeCalcs(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (raw && typeof raw === "object") for (const [k, v] of Object.entries(raw as Record<string, unknown>).slice(0, 8)) if (/^[A-Za-z][A-Za-z0-9 _%-]{0,38}$/.test(k) && typeof v === "string" && v.length <= 500) out[k] = v;
  return out;
}

/** The numeric fields and calculated fields of a data set, for the data pane. */
export function listFields(data: VizData): { dimensions: string[]; measures: string[]; calcs: string[] } {
  const calcs = Object.keys(data.calcs ?? {});
  return { dimensions: data.fields.filter((f) => f.role === "dimension").map((f) => f.name), measures: data.fields.filter((f) => f.role === "measure").map((f) => f.name), calcs };
}
