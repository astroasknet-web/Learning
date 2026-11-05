import { DaxError, parseDefinitions, type Definition, type Node } from "./parser";

/**
 * A small DAX engine for practice. A model is a few tables, many-to-one relationships (filters flow from the "one" side to the "many" side, as in a
 * star schema), a few ready-made measures and optionally a date table. A measure is evaluated in a FILTER CONTEXT (which rows each table currently shows)
 * and, inside iterators, a ROW CONTEXT (which row we are on). CALCULATE changes the filter context and turns a row context into a filter, as in Power BI.
 *
 * Supported: SUM, AVERAGE, MIN, MAX, COUNT, COUNTROWS, DISTINCTCOUNT, SUMX, AVERAGEX, MINX, MAXX, COUNTX, CALCULATE, FILTER, ALL, ALLEXCEPT, REMOVEFILTERS,
 * KEEPFILTERS, VALUES, DISTINCT, RELATED, DIVIDE, IF, SWITCH, AND/OR/NOT, ISBLANK, BLANK, COALESCE, SELECTEDVALUE, HASONEVALUE, ROUND, ABS, INT, text functions,
 * YEAR, MONTH, DAY, VAR/RETURN, and time intelligence (SAMEPERIODLASTYEAR, DATEADD, DATESYTD, DATESMTD, TOTALYTD, TOTALMTD, PREVIOUSMONTH, PREVIOUSYEAR).
 * Not supported (and said so in the error): bidirectional filters, ALLSELECTED, calculated tables, RANKX, TOPN. Evaluation is a tree walk: no eval.
 */
export type DaxValue = number | string | boolean | null;
/** A table is given as rows, or as a calendar (every date from..to with Year, MonthNum, Month and Quarter), so a date table does not have to be written out. */
export interface DaxTable { name: string; columns: string[]; rows: DaxValue[][]; calendar?: { from: string; to: string } }
export interface DaxRelationship { many: string; one: string } // "Sales[ProductID]" -> "Products[ProductID]"
export interface DaxModel { tables: DaxTable[]; relationships: DaxRelationship[]; measures: Record<string, string>; dateTable?: string }
export interface DaxVisual { label: string; rows: string[]; cols?: string[] }
export interface DaxMatrix { label: string; rowFields: string[]; headers: string[]; rows: Array<{ header: DaxValue[]; cells: DaxValue[] }>; total: DaxValue[] }
export type DaxResult = { ok: true; matrices: DaxMatrix[] } | { ok: false; error: string; hint?: string };

interface Filters { cols: Map<string, Set<DaxValue>>; rows: Map<string, Set<number>> }
type Frame = { k: "row"; table: string; row: number } | { k: "val"; ref: string; value: DaxValue };
interface Ctx { f: Filters; frames: Frame[]; vars: Map<string, V>; depth: number }
interface TableVal { t: "table"; table: string; rows: number[] }
interface ColVal { t: "col"; ref: string; values: DaxValue[] }
interface DatesVal { t: "dates"; table: string; dates: string[] }
interface KeepVal { t: "keep"; inner: ColVal | TableVal }
type V = DaxValue | TableVal | ColVal | DatesVal | KeepVal;

const MAX_WORK = 4_000_000;
const lc = (s: string): string => s.toLowerCase();
const isTable = (v: V): v is TableVal => typeof v === "object" && v !== null && (v as { t?: string }).t === "table";
const isCol = (v: V): v is ColVal => typeof v === "object" && v !== null && (v as { t?: string }).t === "col";
const isDates = (v: V): v is DatesVal => typeof v === "object" && v !== null && (v as { t?: string }).t === "dates";
const isKeep = (v: V): v is KeepVal => typeof v === "object" && v !== null && (v as { t?: string }).t === "keep";
const isObj = (v: V): v is TableVal | ColVal | DatesVal | KeepVal => typeof v === "object" && v !== null;
const norm = (n: number): number => Math.round(n * 1e9) / 1e9;
const emptyF = (): Filters => ({ cols: new Map(), rows: new Map() });
const cloneF = (f: Filters): Filters => ({ cols: new Map(f.cols), rows: new Map(f.rows) });

const AGG_ONE = new Set(["SUM", "AVERAGE", "MIN", "MAX", "COUNT", "DISTINCTCOUNT"]);
const ITER = new Set(["SUMX", "AVERAGEX", "MINX", "MAXX", "COUNTX"]);

/** Closest names, for "did you mean" hints. */
function suggest(name: string, options: string[]): string | null {
  const a = lc(name);
  let best: string | null = null, bd = 99;
  for (const o of options) {
    const b = lc(o);
    const d = lev(a, b);
    if (d < bd && d <= Math.max(2, Math.floor(b.length / 3))) { bd = d; best = o; }
  }
  return best;
}
function lev(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[m][n];
}

const ymd = (s: string): [number, number, number] | null => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); return m ? [+m[1], +m[2], +m[3]] : null; };
const iso = (y: number, m: number, d: number): string => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const dim = (y: number, m: number): number => new Date(Date.UTC(y, m, 0)).getUTCDate();

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function expandCalendar(t: DaxTable): DaxTable {
  if (!t.calendar) return t;
  const a = ymd(t.calendar.from), b = ymd(t.calendar.to);
  if (!a || !b) throw new DaxError("A calendar table needs from and to dates written as YYYY-MM-DD.");
  const rows: DaxValue[][] = [];
  const end = Date.UTC(b[0], b[1] - 1, b[2]);
  for (let ms = Date.UTC(a[0], a[1] - 1, a[2]); ms <= end && rows.length < 4000; ms += 86_400_000) {
    const d = new Date(ms), y = d.getUTCFullYear(), m = d.getUTCMonth() + 1;
    rows.push([iso(y, m, d.getUTCDate()), y, m, MONTHS[m - 1], "Q" + Math.ceil(m / 3)]);
  }
  return { name: t.name, columns: ["Date", "Year", "MonthNum", "Month", "Quarter"], rows };
}

export class Dax {
  private tabs = new Map<string, DaxTable>();
  private colIdx = new Map<string, Map<string, number>>();
  private rels: Array<{ manyT: string; manyC: number; oneT: string; oneC: number; oneIdx: Map<DaxValue, number[]> }> = [];
  private measures = new Map<string, { name: string; expr: Node }>();
  private cache = new WeakMap<Filters, Map<string, number[]>>();
  private work = 0;
  readonly dateTable: string | undefined;

  constructor(public model: DaxModel, extra: Definition[] = []) {
    model = { ...model, tables: model.tables.map(expandCalendar) };
    this.model = model;
    for (const t of model.tables) {
      if (this.tabs.has(lc(t.name))) throw new DaxError(`The model has two tables called ${t.name}.`);
      this.tabs.set(lc(t.name), t);
      this.colIdx.set(lc(t.name), new Map(t.columns.map((c, i) => [lc(c), i])));
    }
    for (const r of model.relationships) {
      const a = this.refParts(r.many), b = this.refParts(r.one);
      const manyT = this.table(a.table), oneT = this.table(b.table);
      const manyC = this.col(manyT.name, a.name), oneC = this.col(oneT.name, b.name);
      const oneIdx = new Map<DaxValue, number[]>();
      oneT.rows.forEach((row, i) => { const k = row[oneC]; (oneIdx.get(k) ?? oneIdx.set(k, []).get(k)!).push(i); });
      this.rels.push({ manyT: manyT.name, manyC, oneT: oneT.name, oneC, oneIdx });
    }
    this.dateTable = model.dateTable ? this.table(model.dateTable).name : undefined;
    for (const [name, src] of Object.entries(model.measures)) {
      for (const d of parseDefinitions(`${name} = ${src}`)) this.measures.set(lc(d.name), { name: d.name, expr: d.expr });
    }
    for (const d of extra) this.measures.set(lc(d.name), { name: d.name, expr: d.expr });
  }

  /* -------------------------------------------------------------------- model lookups */
  private refParts(ref: string): { table: string; name: string } {
    const m = /^'?([^'\[]+?)'?\[([^\]]+)\]$/.exec(ref.trim());
    if (!m) throw new DaxError(`"${ref}" is not a column reference like Sales[Amount].`);
    return { table: m[1], name: m[2] };
  }
  private table(name: string): DaxTable {
    const t = this.tabs.get(lc(name));
    if (!t) {
      const s = suggest(name, this.model.tables.map((x) => x.name));
      throw new DaxError(`There is no table called "${name}" in this model.`, s ? `Did you mean ${s}? The tables are: ${this.model.tables.map((x) => x.name).join(", ")}.` : `The tables are: ${this.model.tables.map((x) => x.name).join(", ")}.`);
    }
    return t;
  }
  private col(table: string, name: string): number {
    const t = this.table(table);
    const i = this.colIdx.get(lc(t.name))!.get(lc(name));
    if (i === undefined) {
      const s = suggest(name, t.columns);
      throw new DaxError(`The table ${t.name} has no column called "${name}".`, s ? `Did you mean ${t.name}[${s}]?` : `The columns of ${t.name} are: ${t.columns.join(", ")}.`);
    }
    return i;
  }
  private key(table: string, name: string): string { const t = this.table(table); return `${t.name}[${t.columns[this.col(t.name, name)]}]`; }
  private refKey(ref: string): { table: string; col: number; key: string } { const p = this.refParts(ref); const t = this.table(p.table); const c = this.col(t.name, p.name); return { table: t.name, col: c, key: `${t.name}[${t.columns[c]}]` }; }

  /* -------------------------------------------------------------------- the filter context */
  private tick(n = 1): void { this.work += n; if (this.work > MAX_WORK) throw new DaxError("That measure is too expensive to calculate in the practice window.", "Try fewer iterators, or a smaller table inside the iterator."); }

  /** The rows of a table that survive the current filters, including filters that flow in from related one-side tables. */
  private visible(tableName: string, f: Filters, seen: Set<string> = new Set()): number[] {
    const tn = this.table(tableName).name;
    let memo = this.cache.get(f);
    if (!memo) { memo = new Map(); this.cache.set(f, memo); }
    if (seen.size === 0) { const hit = memo.get(tn); if (hit) return hit; }
    const t = this.table(tn);
    let rows: number[] = [];
    const own = f.rows.get(tn);
    const colFilters: Array<{ c: number; set: Set<DaxValue> }> = [];
    for (const [k, set] of f.cols) { const p = this.refParts(k); if (lc(p.table) === lc(tn)) colFilters.push({ c: this.col(tn, p.name), set }); }
    for (let i = 0; i < t.rows.length; i++) {
      if (own && !own.has(i)) continue;
      let ok = true;
      for (const cf of colFilters) if (!cf.set.has(t.rows[i][cf.c])) { ok = false; break; }
      if (ok) rows.push(i);
    }
    this.tick(t.rows.length);
    const nextSeen = new Set(seen).add(tn);
    for (const r of this.rels) {
      if (r.manyT !== tn || nextSeen.has(r.oneT) || !this.isFiltered(r.oneT, f, new Set(nextSeen))) continue;
      const oneRows = this.visible(r.oneT, f, nextSeen);
      const keys = new Set(oneRows.map((i) => this.table(r.oneT).rows[i][r.oneC]));
      rows = rows.filter((i) => keys.has(t.rows[i][r.manyC]));
    }
    if (seen.size === 0) memo.set(tn, rows);
    return rows;
  }
  private isFiltered(tn: string, f: Filters, seen: Set<string>): boolean {
    if (f.rows.has(tn)) return true;
    for (const k of f.cols.keys()) if (lc(this.refParts(k).table) === lc(tn)) return true;
    seen.add(tn);
    return this.rels.some((r) => r.manyT === tn && !seen.has(r.oneT) && this.isFiltered(r.oneT, f, seen));
  }
  private distinct(table: string, c: number, rows: number[]): DaxValue[] {
    const t = this.table(table), seen = new Set<DaxValue>(), out: DaxValue[] = [];
    for (const i of rows) { const v = t.rows[i][c]; if (!seen.has(v)) { seen.add(v); out.push(v); } }
    return out;
  }
  private allRows(table: string): number[] { return this.table(table).rows.map((_, i) => i); }

  /* -------------------------------------------------------------------- evaluation */
  evaluate(expr: Node, ctx: Ctx): V {
    switch (expr.t) {
      case "num": return expr.v;
      case "str": return expr.v;
      case "bool": return expr.v;
      case "neg": { const v = this.scalar(this.evaluate(expr.a, ctx), "the value after the minus sign"); return v === null ? null : -this.num(v); }
      case "not": return !this.truth(this.scalar(this.evaluate(expr.a, ctx), "NOT"));
      case "set": return { t: "col", ref: "{}", values: expr.items.map((x) => this.scalar(this.evaluate(x, ctx), "a value in the list")) };
      case "in": {
        const a = this.scalar(this.evaluate(expr.a, ctx), "the value before IN");
        const s = this.evaluate(expr.set, ctx);
        if (!isCol(s)) throw new DaxError("IN needs a list of values on its right, like { \"North\", \"South\" }.");
        return s.values.some((v) => this.eq(v, a));
      }
      case "bin": return this.binary(expr, ctx);
      case "let": {
        const vars = new Map(ctx.vars);
        const c2: Ctx = { ...ctx, vars };
        for (const v of expr.vars) vars.set(lc(v.name), this.evaluate(v.e, c2));
        return this.evaluate(expr.ret, c2);
      }
      case "table": {
        const v = ctx.vars.get(lc(expr.name));
        if (v !== undefined) return v;
        const t = this.table(expr.name);
        return { t: "table", table: t.name, rows: this.visible(t.name, ctx.f) };
      }
      case "measure": return this.measure(expr.name, ctx);
      case "col": return this.column(expr, ctx);
      case "call": return this.call(expr.name, expr.args, ctx);
    }
  }

  private measure(name: string, ctx: Ctx): V {
    const m = this.measures.get(lc(name));
    if (!m) {
      const s = suggest(name, [...this.measures.values()].map((x) => x.name));
      throw new DaxError(`There is no measure called [${name}].`, s ? `Did you mean [${s}]? If you meant a column, write the table name first, like Sales[${name}].` : `If you meant a column, write the table name first, like Sales[${name}].`);
    }
    if (ctx.depth > 40) throw new DaxError(`The measure [${name}] refers back to itself, directly or through other measures.`, "A measure cannot be defined using itself.");
    // a measure used inside a row context is evaluated with that row context turned into a filter
    const c2: Ctx = { f: this.transition(ctx), frames: [], vars: new Map(), depth: ctx.depth + 1 };
    return this.evaluate(m.expr, c2);
  }

  /** Turn every active row context into a filter (the "context transition" that CALCULATE and measure references perform). */
  private transition(ctx: Ctx): Filters {
    if (ctx.frames.length === 0) return ctx.f;
    const f = cloneF(ctx.f);
    for (const fr of ctx.frames) {
      if (fr.k === "row") { f.rows.set(fr.table, new Set([fr.row])); }
      else f.cols.set(fr.ref, new Set([fr.value]));
    }
    return f;
  }

  private column(e: { table: string; name: string }, ctx: Ctx): V {
    const t = this.table(e.table);
    const c = this.col(t.name, e.name);
    const k = `${t.name}[${t.columns[c]}]`;
    for (let i = ctx.frames.length - 1; i >= 0; i--) {
      const fr = ctx.frames[i];
      if (fr.k === "row" && fr.table === t.name) return t.rows[fr.row][c];
      if (fr.k === "val" && fr.ref === k) return fr.value;
    }
    // no row context for this table: a column on its own means "the values currently visible", which must be a single value to be used as one
    return { t: "col", ref: k, values: this.distinct(t.name, c, this.visible(t.name, ctx.f)) };
  }

  /* ---- type helpers */
  private scalar(v: V, what: string): DaxValue {
    if (!isObj(v)) return v;
    if (isCol(v)) {
      if (v.values.length === 1) return v.values[0];
      if (v.values.length === 0) return null;
      throw new DaxError(`A table of multiple values was supplied where a single value was expected (${what}).`, `${v.ref} has ${v.values.length} values here. Wrap it in an aggregator such as SUM or MAX, use SELECTEDVALUE, use an iterator such as SUMX, or use RELATED to read a column of a related table from inside a row.`);
    }
    if (isTable(v)) throw new DaxError(`A table was supplied where a single value was expected (${what}).`, "Use an aggregator such as COUNTROWS, or an iterator such as SUMX.");
    throw new DaxError(`A list of dates was supplied where a single value was expected (${what}).`);
  }
  private num(v: DaxValue): number {
    if (typeof v === "number") return v;
    if (typeof v === "boolean") return v ? 1 : 0;
    if (v === null) return 0;
    const n = Number(v);
    if (v.trim() !== "" && Number.isFinite(n)) return n;
    throw new DaxError(`"${v}" is text, but a number was needed here.`, "Check that the column holds numbers, not text.");
  }
  private truth(v: DaxValue): boolean {
    if (typeof v === "boolean") return v;
    if (v === null) return false;
    if (typeof v === "number") return v !== 0;
    throw new DaxError("A true or false value was needed here, but text was found.");
  }
  private eq(a: DaxValue, b: DaxValue): boolean {
    if (a === null || b === null) return a === b;
    if (typeof a === "string" && typeof b === "string") return lc(a) === lc(b);
    return a === b;
  }
  private cmp(a: DaxValue, b: DaxValue): number {
    const x = a ?? (typeof b === "string" ? "" : 0), y = b ?? (typeof a === "string" ? "" : 0);
    if (typeof x === "string" && typeof y === "string") return lc(x) < lc(y) ? -1 : lc(x) > lc(y) ? 1 : 0;
    const nx = typeof x === "number" ? x : typeof x === "boolean" ? +x : NaN, ny = typeof y === "number" ? y : typeof y === "boolean" ? +y : NaN;
    if (Number.isNaN(nx) || Number.isNaN(ny)) throw new DaxError("A number and a piece of text cannot be compared with < or >.");
    return nx < ny ? -1 : nx > ny ? 1 : 0;
  }
  private text(v: DaxValue): string { return v === null ? "" : typeof v === "number" ? String(norm(v)) : typeof v === "boolean" ? (v ? "TRUE" : "FALSE") : v; }

  private binary(e: Extract<Node, { t: "bin" }>, ctx: Ctx): V {
    if (e.op === "&&" || e.op === "||") {
      const a = this.truth(this.scalar(this.evaluate(e.a, ctx), e.op));
      if (e.op === "&&" ? !a : a) return a;
      return this.truth(this.scalar(this.evaluate(e.b, ctx), e.op));
    }
    const a = this.scalar(this.evaluate(e.a, ctx), `the left side of ${e.op}`), b = this.scalar(this.evaluate(e.b, ctx), `the right side of ${e.op}`);
    switch (e.op) {
      case "=": return this.eq(a, b);
      case "<>": return !this.eq(a, b);
      case "<": return this.cmp(a, b) < 0;
      case "<=": return this.cmp(a, b) <= 0;
      case ">": return this.cmp(a, b) > 0;
      case ">=": return this.cmp(a, b) >= 0;
      case "&": return this.text(a) + this.text(b);
      case "+": return a === null && b === null ? null : norm(this.num(a) + this.num(b));
      case "-": return a === null && b === null ? null : norm(this.num(a) - this.num(b));
      case "*": return a === null || b === null ? null : norm(this.num(a) * this.num(b));
      case "/": {
        if (a === null || b === null) return null;
        const d = this.num(b);
        if (d === 0) throw new DaxError("A division by zero was attempted.", "Use DIVIDE(numerator, denominator) instead of /: it returns BLANK when the denominator is zero.");
        return norm(this.num(a) / d);
      }
      case "^": return norm(Math.pow(this.num(a), this.num(b)));
    }
    throw new DaxError(`The operator ${e.op} is not supported.`);
  }

  /* ---- functions */
  private need(name: string, args: Node[], min: number, max = min): void {
    if (args.length < min || args.length > max) throw new DaxError(`${name} needs ${min === max ? min : `${min} to ${max}`} argument${max === 1 ? "" : "s"}, but you gave ${args.length}.`);
  }
  private colArg(name: string, a: Node, ctx: Ctx): { table: string; col: number; key: string } {
    if (a.t !== "col") throw new DaxError(`${name} needs a column such as Sales[Amount].`);
    const t = this.table(a.table);
    const c = this.col(t.name, a.name);
    void ctx;
    return { table: t.name, col: c, key: `${t.name}[${t.columns[c]}]` };
  }
  private tableOf(v: V, name: string): TableVal | ColVal {
    if (isKeep(v)) return v.inner;
    if (isTable(v) || isCol(v)) return v;
    throw new DaxError(`${name} needs a table (such as Sales, ALL(Sales) or VALUES(Products[Category])) as its first argument.`);
  }

  private call(name: string, args: Node[], ctx: Ctx): V {
    this.tick(5);
    if (AGG_ONE.has(name)) {
      if ((name === "MIN" || name === "MAX") && args.length === 2) {
        const a = this.scalar(this.evaluate(args[0], ctx), name), b = this.scalar(this.evaluate(args[1], ctx), name);
        if (a === null) return b;
        if (b === null) return a;
        return (this.cmp(a, b) >= 0) === (name === "MAX") ? a : b;
      }
      this.need(name, args, 1);
      const c = this.colArg(name, args[0], ctx);
      const t = this.table(c.table);
      const rows = this.visible(c.table, ctx.f);
      const nums: number[] = [], all: DaxValue[] = [];
      for (const i of rows) { const v = t.rows[i][c.col]; if (v !== null) { all.push(v); if (typeof v === "number") nums.push(v); } }
      switch (name) {
        case "SUM": return nums.length ? norm(nums.reduce((p, q) => p + q, 0)) : null;
        case "AVERAGE": return nums.length ? norm(nums.reduce((p, q) => p + q, 0) / nums.length) : null;
        case "MIN": return nums.length ? Math.min(...nums) : all.length ? (all.sort() as string[])[0] : null;
        case "MAX": return nums.length ? Math.max(...nums) : all.length ? (all.sort() as string[])[all.length - 1] : null;
        case "COUNT": return nums.length;
        default: return new Set(all).size;
      }
    }
    if (ITER.has(name)) {
      this.need(name, args, 2);
      const src = this.tableOf(this.evaluate(args[0], ctx), name);
      const vals: DaxValue[] = [];
      const run = (frame: Frame) => this.scalar(this.evaluate(args[1], { ...ctx, frames: [...ctx.frames, frame] }), `the expression inside ${name}`);
      if (isTable(src)) for (const r of src.rows) { this.tick(); vals.push(run({ k: "row", table: src.table, row: r })); }
      else for (const v of src.values) { this.tick(); vals.push(run({ k: "val", ref: src.ref, value: v })); }
      const nums = vals.filter((v): v is number => typeof v === "number");
      switch (name) {
        case "SUMX": return nums.length ? norm(nums.reduce((p, q) => p + q, 0)) : null;
        case "AVERAGEX": return nums.length ? norm(nums.reduce((p, q) => p + q, 0) / nums.length) : null;
        case "MINX": return nums.length ? Math.min(...nums) : null;
        case "MAXX": return nums.length ? Math.max(...nums) : null;
        default: return vals.filter((v) => v !== null).length;
      }
    }
    switch (name) {
      case "COUNTROWS": {
        this.need(name, args, 1);
        const t = this.tableOf(this.evaluate(args[0], ctx), name);
        return isTable(t) ? t.rows.length : t.values.length;
      }
      case "CALCULATE": case "CALCULATETABLE": {
        if (args.length < 1) throw new DaxError(`${name} needs at least an expression to calculate.`, "For example: CALCULATE([Total Sales], Products[Category] = \"Home\")");
        const f = this.applyFilters(args.slice(1), { ...ctx, f: this.transition(ctx), frames: [] }, ctx);
        const c2: Ctx = { f, frames: [], vars: ctx.vars, depth: ctx.depth };
        return this.evaluate(args[0], c2);
      }
      case "FILTER": {
        this.need(name, args, 2);
        const src = this.tableOf(this.evaluate(args[0], ctx), name);
        if (isTable(src)) {
          const rows = src.rows.filter((r) => { this.tick(); return this.truth(this.scalar(this.evaluate(args[1], { ...ctx, frames: [...ctx.frames, { k: "row", table: src.table, row: r }] }), "the FILTER condition")); });
          return { t: "table", table: src.table, rows };
        }
        const values = src.values.filter((v) => this.truth(this.scalar(this.evaluate(args[1], { ...ctx, frames: [...ctx.frames, { k: "val", ref: src.ref, value: v }] }), "the FILTER condition")));
        return { t: "col", ref: src.ref, values };
      }
      case "ALL": case "REMOVEFILTERS": case "ALLNOBLANKROW": {
        if (args.length === 0) throw new DaxError(`${name} needs a table or column, like ${name}(Products) or ${name}(Products[Category]).`);
        if (args[0].t === "table") { const t = this.table(args[0].name); return { t: "table", table: t.name, rows: this.allRows(t.name) }; }
        const cols = args.map((a) => this.colArg(name, a, ctx));
        return { t: "col", ref: cols[0].key, values: this.distinct(cols[0].table, cols[0].col, this.allRows(cols[0].table)) };
      }
      case "ALLEXCEPT": {
        if (args.length < 2 || args[0].t !== "table") throw new DaxError("ALLEXCEPT needs a table and then the columns to keep filtered, like ALLEXCEPT(Products, Products[Category]).");
        return { t: "table", table: this.table(args[0].name).name, rows: this.allRows(args[0].name) };
      }
      case "VALUES": case "DISTINCT": {
        this.need(name, args, 1);
        if (args[0].t !== "col") return this.tableOf(this.evaluate(args[0], ctx), name);
        const c = this.colArg(name, args[0], ctx);
        return { t: "col", ref: c.key, values: this.distinct(c.table, c.col, this.visible(c.table, ctx.f)) };
      }
      case "KEEPFILTERS": {
        this.need(name, args, 1);
        const v = this.evaluate(args[0], ctx);
        return { t: "keep", inner: this.tableOf(v, name) };
      }
      case "RELATED": {
        this.need(name, args, 1);
        const target = this.colArg(name, args[0], ctx);
        for (let i = ctx.frames.length - 1; i >= 0; i--) {
          const fr = ctx.frames[i];
          if (fr.k !== "row") continue;
          if (fr.table === target.table) return this.table(target.table).rows[fr.row][target.col];
          const hit = this.followRelationship(fr.table, fr.row, target.table);
          if (hit !== undefined) return hit === null ? null : this.table(target.table).rows[hit][target.col];
        }
        throw new DaxError(`RELATED(${target.key}) needs a row of a table that is related to ${target.table}.`, "Use RELATED inside an iterator such as SUMX over the many-side table, for example SUMX(Sales, Sales[Qty] * RELATED(Products[Price])).");
      }
      case "SELECTEDVALUE": {
        this.need(name, args, 1, 2);
        const v = this.evaluate(args[0], ctx);
        if (!isCol(v)) return this.scalar(v, "SELECTEDVALUE");
        if (v.values.length === 1) return v.values[0];
        return args[1] ? this.scalar(this.evaluate(args[1], ctx), "the alternate result") : null;
      }
      case "HASONEVALUE": {
        this.need(name, args, 1);
        const v = this.evaluate(args[0], ctx);
        return isCol(v) ? v.values.length === 1 : false;
      }
      case "DIVIDE": {
        this.need(name, args, 2, 3);
        const a = this.scalar(this.evaluate(args[0], ctx), "the numerator"), b = this.scalar(this.evaluate(args[1], ctx), "the denominator");
        if (a === null || b === null || this.num(b) === 0) return args[2] ? this.scalar(this.evaluate(args[2], ctx), "the alternate result") : null;
        return norm(this.num(a) / this.num(b));
      }
      case "IF": {
        this.need(name, args, 2, 3);
        const c = this.truth(this.scalar(this.evaluate(args[0], ctx), "the IF condition"));
        if (c) return this.evaluate(args[1], ctx);
        return args[2] ? this.evaluate(args[2], ctx) : null;
      }
      case "SWITCH": {
        if (args.length < 3) throw new DaxError("SWITCH needs an expression and at least one value and result, like SWITCH(x, 1, \"one\", \"other\").");
        const first = this.evaluate(args[0], ctx);
        const target = this.scalar(first, "the SWITCH expression");
        const isTrue = args[0].t === "bool" || (args[0].t === "call" && args[0].name === "TRUE");
        let i = 1;
        for (; i + 1 < args.length; i += 2) {
          const k = this.scalar(this.evaluate(args[i], ctx), "a SWITCH value");
          if (isTrue ? this.truth(k) : this.eq(k, target)) return this.evaluate(args[i + 1], ctx);
        }
        return i < args.length ? this.evaluate(args[i], ctx) : null;
      }
      case "TRUE": return true;
      case "FALSE": return false;
      case "BLANK": return null;
      case "AND": case "OR": {
        this.need(name, args, 2);
        const a = this.truth(this.scalar(this.evaluate(args[0], ctx), name)), b = this.truth(this.scalar(this.evaluate(args[1], ctx), name));
        return name === "AND" ? a && b : a || b;
      }
      case "NOT": { this.need(name, args, 1); return !this.truth(this.scalar(this.evaluate(args[0], ctx), name)); }
      case "ISBLANK": { this.need(name, args, 1); return this.scalar(this.evaluate(args[0], ctx), name) === null; }
      case "COALESCE": {
        for (const a of args) { const v = this.scalar(this.evaluate(a, ctx), name); if (v !== null) return v; }
        return null;
      }
      case "ROUND": case "ROUNDUP": case "ROUNDDOWN": {
        this.need(name, args, 2);
        const x = this.scalar(this.evaluate(args[0], ctx), name), d = this.scalar(this.evaluate(args[1], ctx), name);
        if (x === null) return null;
        const f = Math.pow(10, Math.trunc(this.num(d)));
        const v = this.num(x) * f;
        return (name === "ROUND" ? Math.round(v + Math.sign(v) * 1e-9) : name === "ROUNDUP" ? Math.sign(v) * Math.ceil(Math.abs(v) - 1e-9) : Math.sign(v) * Math.floor(Math.abs(v) + 1e-9)) / f;
      }
      case "ABS": case "INT": case "SQRT": {
        this.need(name, args, 1);
        const x = this.scalar(this.evaluate(args[0], ctx), name);
        if (x === null) return null;
        const n = this.num(x);
        if (name === "SQRT" && n < 0) throw new DaxError("SQRT needs a number that is zero or more.");
        return name === "ABS" ? Math.abs(n) : name === "INT" ? Math.floor(n) : Math.sqrt(n);
      }
      case "UPPER": case "LOWER": case "LEN": case "TRIM": {
        this.need(name, args, 1);
        const s = this.text(this.scalar(this.evaluate(args[0], ctx), name));
        return name === "UPPER" ? s.toUpperCase() : name === "LOWER" ? s.toLowerCase() : name === "LEN" ? s.length : s.trim();
      }
      case "CONCATENATE": { this.need(name, args, 2); return this.text(this.scalar(this.evaluate(args[0], ctx), name)) + this.text(this.scalar(this.evaluate(args[1], ctx), name)); }
      case "YEAR": case "MONTH": case "DAY": {
        this.need(name, args, 1);
        const s = this.scalar(this.evaluate(args[0], ctx), name);
        if (s === null) return null;
        const p = ymd(String(s));
        if (!p) throw new DaxError(`${name} needs a date written as YYYY-MM-DD, but got "${s}".`);
        return name === "YEAR" ? p[0] : name === "MONTH" ? p[1] : p[2];
      }
      case "SAMEPERIODLASTYEAR": case "DATEADD": case "DATESYTD": case "DATESMTD": case "TOTALYTD": case "TOTALMTD": case "PREVIOUSMONTH": case "PREVIOUSYEAR": case "PARALLELPERIOD":
        return this.timeIntel(name, args, ctx);
      case "LASTDATE": case "FIRSTDATE": {
        this.need(name, args, 1);
        const d = this.visibleDates(args[0], ctx);
        const sorted = [...d.dates].sort();
        return { t: "dates", table: d.table, dates: sorted.length ? [name === "LASTDATE" ? sorted[sorted.length - 1] : sorted[0]] : [] };
      }
      default: {
        const known = ["SUM", "AVERAGE", "MIN", "MAX", "COUNT", "COUNTROWS", "DISTINCTCOUNT", "SUMX", "AVERAGEX", "CALCULATE", "FILTER", "ALL", "ALLEXCEPT", "VALUES", "DIVIDE", "IF", "SWITCH", "RELATED", "SELECTEDVALUE", "SAMEPERIODLASTYEAR", "DATEADD", "DATESYTD", "TOTALYTD", "ROUND", "COALESCE", "KEEPFILTERS", "REMOVEFILTERS"];
        const s = suggest(name, known);
        const unsupported = ["ALLSELECTED", "RANKX", "TOPN", "SUMMARIZE", "ADDCOLUMNS", "USERELATIONSHIP", "CROSSFILTER", "EARLIER", "GENERATE", "NATURALINNERJOIN"];
        if (unsupported.includes(name)) throw new DaxError(`${name} is a real DAX function, but this practice window does not support it.`, "The practice engine covers the core functions: SUM, SUMX, CALCULATE, FILTER, ALL, VALUES, RELATED, DIVIDE, IF, SWITCH and the common time-intelligence functions.");
        throw new DaxError(`"${name}" is not a function this practice engine knows.`, s ? `Did you mean ${s}?` : "Check the spelling, or use a core function such as SUM, SUMX, CALCULATE, FILTER or DIVIDE.");
      }
    }
  }

  private followRelationship(fromTable: string, row: number, toTable: string): number | null | undefined {
    const seen = new Set<string>();
    const walk = (t: string, r: number): number | null | undefined => {
      if (t === toTable) return r;
      if (seen.has(t)) return undefined;
      seen.add(t);
      for (const rel of this.rels) {
        if (rel.manyT !== t) continue;
        const key = this.table(t).rows[r][rel.manyC];
        const hit = rel.oneIdx.get(key);
        const next = hit?.[0];
        if (next === undefined) { if (rel.oneT === toTable) return null; continue; }
        const got = walk(rel.oneT, next);
        if (got !== undefined) return got;
      }
      return undefined;
    };
    return walk(fromTable, row);
  }

  /** Apply the filter arguments of CALCULATE to a copy of the filter context. */
  private applyFilters(args: Node[], base: Ctx, outer: Ctx): Filters {
    const f = cloneF(base.f);
    const run = (n: Node): V => this.evaluate(n, { ...base, f: base.f });
    for (const a0 of args) {
      const keep = a0.t === "call" && a0.name === "KEEPFILTERS" && a0.args.length === 1;
      const a: Node = keep && a0.t === "call" ? a0.args[0] : a0;
      // ALLEXCEPT / ALL / REMOVEFILTERS remove filters instead of adding them
      if (a.t === "call" && (a.name === "ALL" || a.name === "REMOVEFILTERS" || a.name === "ALLNOBLANKROW")) {
        if (a.args.length === 0) { f.cols.clear(); f.rows.clear(); continue; }
        if (a.args[0].t === "table") { this.clearTable(f, this.table(a.args[0].name).name); continue; }
        for (const c of a.args) { const k = this.colArg(a.name, c, outer); f.cols.delete(k.key); }
        continue;
      }
      if (a.t === "call" && a.name === "ALLEXCEPT") {
        if (a.args.length < 2 || a.args[0].t !== "table") throw new DaxError("ALLEXCEPT needs a table and then the columns to keep filtered, like ALLEXCEPT(Products, Products[Category]).");
        const tn = this.table(a.args[0].name).name;
        const keep = new Set(a.args.slice(1).map((c) => this.colArg("ALLEXCEPT", c, outer).key));
        f.rows.delete(tn);
        for (const k of [...f.cols.keys()]) if (lc(this.refParts(k).table) === lc(tn) && !keep.has(k)) f.cols.delete(k);
        continue;
      }
      // a true/false expression that uses one column is a filter on that column
      if (this.isBoolean(a)) {
        const cols = this.columnsIn(a);
        const keys = new Set(cols.map((c) => `${this.table(c.table).name}[${this.table(c.table).columns[this.col(c.table, c.name)]}]`));
        const tables = new Set(cols.map((c) => this.table(c.table).name));
        if (tables.size !== 1) throw new DaxError("A true/false filter inside CALCULATE can use columns of only one table.", "For several tables, use FILTER(ALL(Table), condition) or separate filters.");
        const tn = [...tables][0];
        if (keys.size === 1) {
          const key = [...keys][0];
          const c = this.col(tn, cols[0].name);
          const t = this.table(tn);
          const values = this.distinct(tn, c, this.allRows(tn)).filter((v) => this.truth(this.scalar(this.evaluate(a, { ...base, frames: [{ k: "val", ref: key, value: v }] }), "a filter condition")));
          const cur = f.cols.get(key);
          f.cols.set(key, keep && cur ? new Set(values.filter((v) => cur.has(v))) : new Set(values));
          void t;
        } else {
          const rows = this.allRows(tn).filter((r) => this.truth(this.scalar(this.evaluate(a, { ...base, frames: [{ k: "row", table: tn, row: r }] }), "a filter condition")));
          this.setRows(f, tn, rows, keep);
        }
        continue;
      }
      const v = run(a);
      this.addFilterValue(f, keep && !isKeep(v) && (isCol(v) || isTable(v)) ? { t: "keep", inner: v } : v, base);
    }
    return f;
  }
  private clearTable(f: Filters, tn: string): void {
    f.rows.delete(tn);
    for (const k of [...f.cols.keys()]) if (lc(this.refParts(k).table) === lc(tn)) f.cols.delete(k);
  }
  private setRows(f: Filters, tn: string, rows: number[], keep: boolean): void {
    if (keep) { const cur = f.rows.get(tn); const set = new Set(rows); f.rows.set(tn, cur ? new Set([...set].filter((i) => cur.has(i))) : set); return; }
    this.clearTable(f, tn);
    f.rows.set(tn, new Set(rows));
  }
  private addFilterValue(f: Filters, v: V, base: Ctx): void {
    let keep = false;
    if (isKeep(v)) { keep = true; v = v.inner; }
    if (isDates(v)) { this.clearTable(f, v.table); f.cols.set(`${v.table}[${this.table(v.table).columns[this.dateCol(v.table)]}]`, new Set(v.dates)); return; }
    if (isTable(v)) { this.setRows(f, v.table, v.rows, keep); return; }
    if (isCol(v)) {
      if (v.ref === "{}") throw new DaxError("A list of values like { 1, 2 } cannot be used as a filter on its own.", "Use a column filter such as Products[Category] IN { \"Home\", \"Stationery\" }.");
      const cur = f.cols.get(v.ref);
      f.cols.set(v.ref, keep && cur ? new Set(v.values.filter((x) => cur.has(x))) : new Set(v.values));
      return;
    }
    void base;
    throw new DaxError("A filter inside CALCULATE must be a true/false condition on a column, or a table such as FILTER(...), ALL(...) or VALUES(...).", "For example: CALCULATE([Total Sales], Products[Category] = \"Home\")");
  }
  private isBoolean(n: Node): boolean {
    if (n.t === "bin") return ["=", "<>", "<", "<=", ">", ">=", "&&", "||"].includes(n.op);
    if (n.t === "in" || n.t === "not") return true;
    if (n.t === "call") return ["AND", "OR", "NOT"].includes(n.name);
    return false;
  }
  private columnsIn(n: Node): Array<{ table: string; name: string }> {
    const out: Array<{ table: string; name: string }> = [];
    const walk = (x: Node): void => {
      switch (x.t) {
        case "col": out.push({ table: x.table, name: x.name }); break;
        case "bin": walk(x.a); walk(x.b); break;
        case "neg": case "not": walk(x.a); break;
        case "in": walk(x.a); walk(x.set); break;
        case "set": x.items.forEach(walk); break;
        case "call": x.args.forEach(walk); break;
        case "let": x.vars.forEach((v) => walk(v.e)); walk(x.ret); break;
        default: break;
      }
    };
    walk(n);
    return out;
  }

  /* ---- time intelligence */
  private dateCol(table: string): number {
    const t = this.table(table);
    const i = t.columns.findIndex((c) => lc(c) === "date");
    if (i < 0) throw new DaxError(`The date table ${table} needs a column called Date.`);
    return i;
  }
  private visibleDates(arg: Node, ctx: Ctx): { table: string; dates: string[] } {
    if (arg.t !== "col") throw new DaxError("Time-intelligence functions need the date column of your date table, like Dates[Date].");
    const t = this.table(arg.table);
    if (!this.dateTable || t.name !== this.dateTable) throw new DaxError(`${t.name} is not marked as the date table of this model.`, this.dateTable ? `Use the Date column of ${this.dateTable}.` : "This model has no date table.");
    const c = this.dateCol(t.name);
    const f = this.transition(ctx);
    return { table: t.name, dates: this.visible(t.name, f).map((i) => String(t.rows[i][c])) };
  }
  private timeIntel(name: string, args: Node[], ctx: Ctx): V {
    const total = name === "TOTALYTD" || name === "TOTALMTD";
    if (total) {
      if (args.length < 2) throw new DaxError(`${name} needs an expression and the date column, like ${name}([Total Sales], Dates[Date]).`);
      const dates = this.timeIntel(name === "TOTALYTD" ? "DATESYTD" : "DATESMTD", [args[1]], ctx);
      const f = this.transition(ctx);
      const f2 = cloneF(f);
      this.addFilterValue(f2, dates, ctx);
      return this.evaluate(args[0], { f: f2, frames: [], vars: ctx.vars, depth: ctx.depth });
    }
    const unitArg = (n: Node | undefined): string => (n && n.t === "table" ? n.name.toUpperCase() : n && n.t === "col" ? n.name.toUpperCase() : "");
    const { table, dates } = this.visibleDates(args[0], ctx);
    const have = new Set(this.table(table).rows.map((r) => String(r[this.dateCol(table)])));
    const out = new Set<string>();
    const shiftMonths = (s: string, n: number): string | null => {
      const p = ymd(s); if (!p) return null;
      const total = p[0] * 12 + (p[1] - 1) + n;
      const y = Math.floor(total / 12), m = (total % 12 + 12) % 12 + 1;
      return iso(y, m, Math.min(p[2], dim(y, m)));
    };
    switch (name) {
      case "SAMEPERIODLASTYEAR": this.need(name, args, 1); for (const d of dates) { const s = shiftMonths(d, -12); if (s && have.has(s)) out.add(s); } break;
      case "DATEADD": case "PARALLELPERIOD": {
        this.need(name, args, 3);
        const n = Math.trunc(this.num(this.scalar(this.evaluate(args[1], ctx), "the number of periods")));
        const unit = unitArg(args[2]);
        for (const d of dates) {
          let s: string | null = null;
          if (unit === "YEAR") s = shiftMonths(d, 12 * n);
          else if (unit === "QUARTER") s = shiftMonths(d, 3 * n);
          else if (unit === "MONTH") s = shiftMonths(d, n);
          else if (unit === "DAY") { const p = ymd(d); if (p) { const t = new Date(Date.UTC(p[0], p[1] - 1, p[2] + n)); s = iso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()); } }
          else throw new DaxError("DATEADD needs YEAR, QUARTER, MONTH or DAY as its third argument.");
          if (s && have.has(s)) out.add(s);
        }
        break;
      }
      case "DATESYTD": case "DATESMTD": {
        const sorted = [...dates].sort();
        if (!sorted.length) break;
        const last = ymd(sorted[sorted.length - 1])!;
        for (const d of have) { const p = ymd(d)!; if (p[0] === last[0] && (name === "DATESYTD" || p[1] === last[1]) && d <= sorted[sorted.length - 1]) out.add(d); }
        break;
      }
      case "PREVIOUSMONTH": case "PREVIOUSYEAR": {
        const sorted = [...dates].sort();
        if (!sorted.length) break;
        const first = ymd(sorted[0])!;
        for (const d of have) {
          const p = ymd(d)!;
          if (name === "PREVIOUSMONTH") { const y = first[1] === 1 ? first[0] - 1 : first[0], m = first[1] === 1 ? 12 : first[1] - 1; if (p[0] === y && p[1] === m) out.add(d); }
          else if (p[0] === first[0] - 1) out.add(d);
        }
        break;
      }
    }
    return { t: "dates", table, dates: [...out].sort() };
  }

  /* -------------------------------------------------------------------- public evaluation of a measure over a visual */
  measureNames(): string[] { return [...this.measures.values()].map((m) => m.name); }

  /** The value of one measure with the given column filters applied (each key is a column like Products[Category]). */
  cell(measure: string, filters: Record<string, DaxValue[]> = {}): DaxValue {
    this.work = 0;
    const f = emptyF();
    for (const [k, vals] of Object.entries(filters)) f.cols.set(this.refKey(k).key, new Set(vals));
    const m = this.measures.get(lc(measure));
    if (!m) throw new DaxError(`There is no measure called [${measure}].`);
    const r = this.evaluate(m.expr, { f, frames: [], vars: new Map(), depth: 1 });
    const s = this.scalar(r, `the measure [${measure}]`);
    return typeof s === "number" ? norm(s) : s;
  }

  /** A matrix like Power BI's: row fields down the side, optional column fields across the top, one measure in the cells, with totals. */
  matrix(visual: DaxVisual, measure: string): DaxMatrix {
    const rowKeys = visual.rows.map((r) => this.refKey(r));
    const colKeys = (visual.cols ?? []).map((r) => this.refKey(r));
    const combos = (keys: Array<{ table: string; col: number; key: string }>): DaxValue[][] => {
      if (!keys.length) return [[]];
      // distinct combinations that exist together in the model (first-appearance order), as Power BI shows them
      const seen = new Set<string>(), out: DaxValue[][] = [];
      const byTable = new Map<string, number>();
      for (const k of keys) byTable.set(k.table, (byTable.get(k.table) ?? 0) + 1);
      const first = this.table(keys[0].table);
      if (byTable.size === 1) {
        for (const row of first.rows) { const vals = keys.map((k) => row[k.col]); const id = JSON.stringify(vals); if (!seen.has(id)) { seen.add(id); out.push(vals); } }
        return out;
      }
      let cart: DaxValue[][] = [[]];
      for (const k of keys) { const vals = this.distinct(k.table, k.col, this.allRows(k.table)); cart = cart.flatMap((p) => vals.map((v) => [...p, v])); }
      return cart;
    };
    const rowCombos = combos(rowKeys), colCombos = combos(colKeys);
    const mk = (keys: Array<{ key: string }>, vals: DaxValue[]): Record<string, DaxValue[]> => Object.fromEntries(keys.map((k, i) => [k.key, [vals[i]]]));
    const hasCols = colKeys.length > 0;
    const headers = hasCols ? [...colCombos.map((c) => c.map((v) => (v === null ? "(blank)" : String(v))).join(" / ")), "Total"] : [measure];
    const line = (rowFilter: Record<string, DaxValue[]>): DaxValue[] => (hasCols ? [...colCombos.map((cc) => this.cell(measure, { ...rowFilter, ...mk(colKeys, cc) })), this.cell(measure, rowFilter)] : [this.cell(measure, rowFilter)]);
    const rows = rowCombos.map((rc) => ({ header: rc, cells: line(mk(rowKeys, rc)) }));
    const shown = rows.filter((r) => r.cells.some((c) => c !== null));
    return { label: visual.label, rowFields: visual.rows, headers, rows: shown, total: line({}) };
  }
}

/** Evaluate a student's definitions on a model and build the matrices for the visuals, one per visual, showing the chosen measure. */
export function runDax(model: DaxModel, code: string, visuals: DaxVisual[], show: string): DaxResult {
  try {
    const defs = parseDefinitions(code);
    const dax = new Dax(model, defs);
    const matrices = visuals.map((v) => dax.matrix(v, show));
    return { ok: true, matrices };
  } catch (e) {
    if (e instanceof DaxError) return { ok: false, error: e.message, hint: e.hint };
    return { ok: false, error: "That formula could not be calculated." };
  }
}

/** The names of the measures a code window defines (used to choose which one to display). */
export function definedMeasures(code: string): string[] {
  try { return parseDefinitions(code).map((d) => d.name); } catch { return []; }
}

export { DaxError, parseDefinitions };
