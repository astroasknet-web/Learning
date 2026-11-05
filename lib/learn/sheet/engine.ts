import { MORE_FUNCS, formatDate, moreFn, parseIsoDate } from "./more-functions";
import { analyse, colName, FormulaError, MAX_COLS, MAX_ROWS, parseFormula, parseRef, refName, type Node } from "./formula";

/**
 * The spreadsheet model and calculator. A sheet is a plain object of raw cell text ("Math", "42", "=SUM(B2:B5)"); everything else
 * (values, errors, charts) is derived. Evaluation is a tree walk over the parsed formula: no eval, no Function, no dynamic code.
 */
export type CellFormat = { bold?: boolean; align?: "left" | "center" | "right"; num?: "auto" | "int" | "dec2" | "currency" | "percent" | "date"; bg?: string };
export type ChartSpec = { type: "bar" | "line" | "pie"; labels: string; values: string; title?: string };
export interface SheetState {
  cells: Record<string, string>;
  formats: Record<string, CellFormat>;
  charts: ChartSpec[];
  /** Row indexes (0-based) hidden by a filter; display only, never changes the data. */
  hidden?: number[];
}
export type ErrCode = "#DIV/0!" | "#VALUE!" | "#NAME?" | "#REF!" | "#CIRC!" | "#ERROR!" | "#N/A";
export type Value = number | string | boolean | null | { err: ErrCode; msg: string };
export const isErr = (v: Value): v is { err: ErrCode; msg: string } => typeof v === "object" && v !== null && "err" in v;

export const emptySheet = (): SheetState => ({ cells: {}, formats: {}, charts: [] });
export const cloneSheet = (s: SheetState): SheetState => ({ cells: { ...s.cells }, formats: Object.fromEntries(Object.entries(s.formats).map(([k, v]) => [k, { ...v }])), charts: s.charts.map((c) => ({ ...c })), hidden: s.hidden ? [...s.hidden] : undefined });

const err = (code: ErrCode, msg: string): Value => ({ err: code, msg });

const MSG: Record<string, string> = {
  "#DIV/0!": "The formula divides by zero or by an empty cell.",
  "#VALUE!": "The formula is trying to do maths with text. Check that the cells hold numbers.",
  "#NAME?": "The formula uses a name GrowQR does not know. Check the spelling.",
  "#REF!": "The formula points at a cell that is not on this sheet.",
  "#CIRC!": "The formula refers back to its own cell, directly or through other cells, so it can never finish.",
  "#N/A": "The value could not be found.",
};

const FUNCS = new Set(["SUM", "AVERAGE", "MIN", "MAX", "COUNT", "COUNTA", "IF", "ROUND", "ABS", "AND", "OR", "NOT", "COUNTIF", "SUMIF", "AVERAGEIF", "IFERROR", "SQRT", "INT", "MOD", "POWER", "ROUNDUP", "ROUNDDOWN", "MEDIAN", "STDEV", "VAR", "PMT", "FV", "CORREL", "SLOPE", "INTERCEPT", ...MORE_FUNCS]);
export const SUPPORTED_FUNCTIONS = [...FUNCS];

export class Calculator {
  private memo = new Map<string, Value>();
  private stack = new Set<string>();
  private trees = new Map<string, Node | FormulaError>();
  constructor(private cells: Record<string, string>) {}

  /** The calculated value of one cell. */
  value(ref: string): Value {
    const hit = this.memo.get(ref);
    if (hit !== undefined) return hit;
    if (this.stack.has(ref)) return err("#CIRC!", MSG["#CIRC!"]);
    this.stack.add(ref);
    let v: Value;
    try {
      v = this.compute(ref);
    } finally {
      this.stack.delete(ref);
    }
    this.memo.set(ref, v);
    return v;
  }

  private tree(ref: string, raw: string): Node | FormulaError {
    let t = this.trees.get(ref);
    if (!t) {
      try { t = parseFormula(raw); } catch (e) { t = e instanceof FormulaError ? e : new FormulaError("#ERROR!", "That formula could not be read."); }
      this.trees.set(ref, t);
    }
    return t;
  }

  private compute(ref: string): Value {
    const raw = this.cells[ref];
    if (raw === undefined || raw === "") return null;
    if (raw.startsWith("=")) {
      const t = this.tree(ref, raw);
      if (t instanceof FormulaError) return err(t.code as ErrCode, t.message);
      const v = this.ev(t);
      return Array.isArray(v) ? err("#VALUE!", MSG["#VALUE!"]) : (v as Value);
    }
    const n = parseNumber(raw);
    if (n !== null) return n;
    if (/^(true|false)$/i.test(raw.trim())) return raw.trim().toLowerCase() === "true";
    return raw;
  }

  /** Evaluate a node. Ranges evaluate to arrays of values (only functions accept them). */
  private ev(n: Node): Value | Value[] {
    switch (n.t) {
      case "num": return n.v;
      case "str": return n.v;
      case "bool": return n.v;
      case "err": return err(n.code as ErrCode, MSG[n.code] ?? n.code);
      case "ref": return this.value(refName(n.col, n.row));
      case "range": {
        const out: Value[] = [];
        for (let r = n.r1; r <= n.r2; r++) for (let c = n.c1; c <= n.c2; c++) out.push(this.value(refName(c, r)));
        return Object.assign(out, { rows: n.r2 - n.r1 + 1, cols: n.c2 - n.c1 + 1 }); // the shape lets lookups and INDEX read a table
      }
      case "un": {
        const a = this.num(this.ev(n.a));
        return isErr(a as Value) ? (a as Value) : n.op === "-" ? -(a as number) : (a as number);
      }
      case "pct": {
        const a = this.num(this.ev(n.a));
        return isErr(a as Value) ? (a as Value) : (a as number) / 100;
      }
      case "bin": return this.bin(n.op, this.ev(n.a), () => this.ev(n.b));
      case "fn": return this.fn(n.name, n.args);
      default: return err("#ERROR!", "Unknown formula part.");
    }
  }

  private scalar(v: Value | Value[]): Value { return Array.isArray(v) ? err("#VALUE!", "A range cannot be used here. Pick a single cell, or put the range inside a function such as SUM.") : v; }

  /** Value to number for arithmetic: empty is 0, numeric text is its number, other text is #VALUE!. */
  private num(v0: Value | Value[]): number | Value {
    const v = this.scalar(v0);
    if (isErr(v)) return v;
    if (v === null) return 0;
    if (typeof v === "number") return v;
    if (typeof v === "boolean") return v ? 1 : 0;
    const n = parseNumber(v) ?? parseIsoDate(v); // a date typed as 2026-01-31 works in sums and differences
    return n === null ? err("#VALUE!", MSG["#VALUE!"]) : n;
  }

  private bin(op: string, a0: Value | Value[], bf: () => Value | Value[]): Value {
    const a = this.scalar(a0);
    if (isErr(a)) return a;
    const b = this.scalar(bf());
    if (isErr(b)) return b;
    if (op === "&") return text(a) + text(b);
    if (["=", "<>", "<", ">", "<=", ">="].includes(op)) {
      const c = compare(a, b);
      return op === "=" ? c === 0 : op === "<>" ? c !== 0 : op === "<" ? c < 0 : op === ">" ? c > 0 : op === "<=" ? c <= 0 : c >= 0;
    }
    const x = this.num(a);
    if (typeof x !== "number") return x;
    const y = this.num(b);
    if (typeof y !== "number") return y;
    switch (op) {
      case "+": return x + y;
      case "-": return x - y;
      case "*": return x * y;
      case "/": return y === 0 ? err("#DIV/0!", MSG["#DIV/0!"]) : x / y;
      case "^": { const r = Math.pow(x, y); return Number.isFinite(r) ? r : err("#VALUE!", MSG["#VALUE!"]); }
      default: return err("#ERROR!", "Unknown operator.");
    }
  }

  /** Flatten function arguments. Range cells that are text/empty/boolean are skipped (as spreadsheets do); direct arguments must be numbers. */
  private numbers(args: Node[]): number[] | Value {
    const out: number[] = [];
    for (const a of args) {
      const v = this.ev(a);
      if (Array.isArray(v)) {
        for (const x of v) { if (isErr(x)) return x; if (typeof x === "number") out.push(x); }
      } else {
        if (isErr(v)) return v;
        const x = this.num(v);
        if (typeof x !== "number") return x;
        if (v !== null) out.push(x);
      }
    }
    return out;
  }

  private fn(name: string, args: Node[]): Value {
    if (!FUNCS.has(name)) return err("#NAME?", `"${name}" is not a function GrowQR knows yet. Check the spelling, or try SUM, AVERAGE, IF, COUNTIFS, SUMIFS, VLOOKUP, XLOOKUP, INDEX, MATCH or TEXT.`);
    const need = (min: number, max: number): Value | null => (args.length < min || args.length > max ? err("#VALUE!", `${name} needs ${min === max ? min : `${min} to ${max}`} value${max === 1 ? "" : "s"} inside the brackets, but it has ${args.length}.`) : null);
    switch (name) {
      case "SUM": { const n = this.numbers(args); return Array.isArray(n) ? n.reduce((a, b) => a + b, 0) : n; }
      case "AVERAGE": { const n = this.numbers(args); if (!Array.isArray(n)) return n; return n.length ? n.reduce((a, b) => a + b, 0) / n.length : err("#DIV/0!", "AVERAGE found no numbers to average."); }
      case "MIN": { const n = this.numbers(args); return Array.isArray(n) ? (n.length ? Math.min(...n) : 0) : n; }
      case "MAX": { const n = this.numbers(args); return Array.isArray(n) ? (n.length ? Math.max(...n) : 0) : n; }
      case "COUNT": { const n = this.numbers(args); return Array.isArray(n) ? n.length : n; }
      case "COUNTA": {
        let c = 0;
        for (const a of args) { const v = this.ev(a); if (Array.isArray(v)) { for (const x of v) if (x !== null) c++; } else if (v !== null) c++; }
        return c;
      }
      case "IF": {
        const bad = need(2, 3); if (bad) return bad;
        const c = this.scalar(this.ev(args[0]));
        if (isErr(c)) return c;
        const truth = typeof c === "boolean" ? c : typeof c === "number" ? c !== 0 : c === null ? false : null;
        if (truth === null) return err("#VALUE!", "IF needs a test that is true or false, like B2>=40. Text cannot be tested on its own.");
        if (truth) return this.scalar(this.ev(args[1]));
        return args[2] ? this.scalar(this.ev(args[2])) : false;
      }
      case "ROUND": {
        const bad = need(1, 2); if (bad) return bad;
        const x = this.num(this.ev(args[0])); if (typeof x !== "number") return x;
        const d = args[1] ? this.num(this.ev(args[1])) : 0; if (typeof d !== "number") return d;
        const f = Math.pow(10, Math.max(-6, Math.min(10, Math.trunc(d))));
        return Math.round((x + Number.EPSILON * Math.sign(x)) * f) / f;
      }
      case "ABS": { const bad = need(1, 1); if (bad) return bad; const x = this.num(this.ev(args[0])); return typeof x === "number" ? Math.abs(x) : x; }
      case "NOT": { const bad = need(1, 1); if (bad) return bad; const c = this.scalar(this.ev(args[0])); if (isErr(c)) return c; return !(typeof c === "boolean" ? c : typeof c === "number" ? c !== 0 : false); }
      case "AND": case "OR": {
        if (args.length < 1) return err("#VALUE!", `${name} needs at least one test inside the brackets.`);
        let acc = name === "AND";
        for (const a of args) {
          const c = this.scalar(this.ev(a));
          if (isErr(c)) return c;
          const t = typeof c === "boolean" ? c : typeof c === "number" ? c !== 0 : false;
          acc = name === "AND" ? acc && t : acc || t;
        }
        return acc;
      }
      case "COUNTIF": case "SUMIF": {
        const bad = need(name === "COUNTIF" ? 2 : 2, name === "COUNTIF" ? 2 : 3); if (bad) return bad;
        const range = this.ev(args[0]);
        if (!Array.isArray(range)) return err("#VALUE!", `${name} needs a range as its first value, like B2:B9.`);
        const crit = this.scalar(this.ev(args[1]));
        if (isErr(crit)) return crit;
        const sums = name === "SUMIF" ? (args[2] ? this.ev(args[2]) : range) : null;
        if (sums && !Array.isArray(sums)) return err("#VALUE!", "SUMIF needs a range to add up.");
        let total = 0;
        range.forEach((x, i) => {
          if (isErr(x) || !matches(x, crit)) return;
          if (name === "COUNTIF") total++;
          else { const s = (sums as Value[])[i]; if (typeof s === "number") total += s; }
        });
        return total;
      }
      case "IFERROR": {
        const bad = need(2, 2); if (bad) return bad;
        const v = this.scalar(this.ev(args[0]));
        return isErr(v) ? this.scalar(this.ev(args[1])) : v;
      }
      case "SQRT": { const bad = need(1, 1); if (bad) return bad; const x = this.num(this.ev(args[0])); if (typeof x !== "number") return x; return x < 0 ? err("#VALUE!", "SQRT needs a number that is zero or more.") : Math.sqrt(x); }
      case "INT": { const bad = need(1, 1); if (bad) return bad; const x = this.num(this.ev(args[0])); return typeof x === "number" ? Math.floor(x) : x; }
      case "MOD": {
        const bad = need(2, 2); if (bad) return bad;
        const x = this.num(this.ev(args[0])); if (typeof x !== "number") return x;
        const y = this.num(this.ev(args[1])); if (typeof y !== "number") return y;
        return y === 0 ? err("#DIV/0!", MSG["#DIV/0!"]) : ((x % y) + y) % y;
      }
      case "POWER": {
        const bad = need(2, 2); if (bad) return bad;
        const x = this.num(this.ev(args[0])); if (typeof x !== "number") return x;
        const y = this.num(this.ev(args[1])); if (typeof y !== "number") return y;
        const r = Math.pow(x, y);
        return Number.isFinite(r) ? r : err("#VALUE!", MSG["#VALUE!"]);
      }
      case "ROUNDUP": case "ROUNDDOWN": {
        const bad = need(1, 2); if (bad) return bad;
        const x = this.num(this.ev(args[0])); if (typeof x !== "number") return x;
        const d = args[1] ? this.num(this.ev(args[1])) : 0; if (typeof d !== "number") return d;
        const f = Math.pow(10, Math.max(-6, Math.min(10, Math.trunc(d))));
        const scaled = Math.abs(x) * f;
        const r = name === "ROUNDUP" ? Math.ceil(scaled - 1e-9) : Math.floor(scaled + 1e-9);
        return (Math.sign(x) * r) / f;
      }
      case "MEDIAN": {
        const n = this.numbers(args); if (!Array.isArray(n)) return n;
        if (!n.length) return err("#VALUE!", "MEDIAN found no numbers.");
        const a = [...n].sort((p, q) => p - q);
        const mid = Math.floor(a.length / 2);
        return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
      }
      case "STDEV": case "VAR": {
        const n = this.numbers(args); if (!Array.isArray(n)) return n;
        if (n.length < 2) return err("#DIV/0!", name + " needs at least two numbers.");
        const m = n.reduce((a, b) => a + b, 0) / n.length;
        const v = n.reduce((a, b) => a + (b - m) * (b - m), 0) / (n.length - 1);
        return name === "VAR" ? v : Math.sqrt(v);
      }
      case "AVERAGEIF": {
        const bad = need(2, 3); if (bad) return bad;
        const range = this.ev(args[0]);
        if (!Array.isArray(range)) return err("#VALUE!", "AVERAGEIF needs a range as its first value, like B2:B9.");
        const crit = this.scalar(this.ev(args[1]));
        if (isErr(crit)) return crit;
        const avg = args[2] ? this.ev(args[2]) : range;
        if (!Array.isArray(avg)) return err("#VALUE!", "AVERAGEIF needs a range to average.");
        let total = 0, count = 0;
        range.forEach((x, i) => {
          if (isErr(x) || !matches(x, crit)) return;
          const s = avg[i];
          if (typeof s === "number") { total += s; count++; }
        });
        return count ? total / count : err("#DIV/0!", "No cells matched, so there is nothing to average.");
      }
      case "CORREL": case "SLOPE": case "INTERCEPT": {
        // Two ranges of the same size: pairs are used only where both cells hold numbers.
        const bad = need(2, 2); if (bad) return bad;
        const a = this.ev(args[0]), b = this.ev(args[1]);
        if (!Array.isArray(a) || !Array.isArray(b)) return err("#VALUE!", name + " needs two ranges of numbers.");
        if (a.length !== b.length) return err("#N/A", name + " needs two ranges of the same size.");
        const xs: number[] = [], ys: number[] = [];
        for (let i = 0; i < a.length; i++) {
          const p = a[i], q = b[i];
          if (isErr(p)) return p;
          if (isErr(q)) return q;
          if (typeof p === "number" && typeof q === "number") { xs.push(p); ys.push(q); }
        }
        if (xs.length < 2) return err("#DIV/0!", name + " needs at least two pairs of numbers.");
        const mp = xs.reduce((u, v) => u + v, 0) / xs.length, mq = ys.reduce((u, v) => u + v, 0) / ys.length;
        let spq = 0, spp = 0, sqq = 0;
        for (let i = 0; i < xs.length; i++) { spq += (xs[i] - mp) * (ys[i] - mq); spp += (xs[i] - mp) ** 2; sqq += (ys[i] - mq) ** 2; }
        if (name === "CORREL") return spp === 0 || sqq === 0 ? err("#DIV/0!", "CORREL needs numbers that vary.") : spq / Math.sqrt(spp * sqq);
        // Excel's order is SLOPE(known_ys, known_xs): the first range is y, the second is x.
        if (sqq === 0) return err("#DIV/0!", name + " needs x values that vary.");
        const slope = spq / sqq;
        return name === "SLOPE" ? slope : mp - slope * mq;
      }
      case "PMT": case "FV": {
        const bad = need(3, 3); if (bad) return bad;
        const r = this.num(this.ev(args[0])); if (typeof r !== "number") return r;
        const n = this.num(this.ev(args[1])); if (typeof n !== "number") return n;
        const a = this.num(this.ev(args[2])); if (typeof a !== "number") return a;
        if (n <= 0) return err("#VALUE!", name + " needs a number of periods above zero.");
        if (name === "PMT") return r === 0 ? -a / n : (-a * r) / (1 - Math.pow(1 + r, -n));
        return r === 0 ? -a * n : -(a * (Math.pow(1 + r, n) - 1)) / r;
      }
      default: return moreFn(name, args, { ev: (n) => this.ev(n), scalar: (v) => this.scalar(v), num: (v) => this.num(v), numbers: (a) => this.numbers(a), err, isErr, compare, matches, text });
    }
  }
}

/** "42", "-3.5", "1,200" and "12%" are numbers; "12a" and "" are not. */
export function parseNumber(raw: string): number | null {
  const t = raw.trim().replace(/,/g, "");
  if (!/^[-+]?(\d+\.?\d*|\.\d+)%?$/.test(t)) return null;
  const n = parseFloat(t);
  return t.endsWith("%") ? n / 100 : n;
}

const text = (v: Value): string => (v === null ? "" : typeof v === "boolean" ? (v ? "TRUE" : "FALSE") : isErr(v) ? v.err : String(v));
function rank(v: Value): number { return typeof v === "number" ? 0 : typeof v === "string" ? 1 : typeof v === "boolean" ? 2 : -1; }
function compare(a: Value, b: Value): number {
  const x = a === null ? (typeof b === "string" ? "" : 0) : a;
  const y = b === null ? (typeof a === "string" ? "" : 0) : b;
  if (rank(x) !== rank(y)) return rank(x) - rank(y);
  if (typeof x === "string" && typeof y === "string") { const p = x.toLowerCase(), q = y.toLowerCase(); return p < q ? -1 : p > q ? 1 : 0; }
  return (x as number) < (y as number) ? -1 : (x as number) > (y as number) ? 1 : 0;
}
/** COUNTIF / SUMIF criteria: a plain value, or an operator then a value (">=40", "<>Pass"). */
function matches(cell: Value, crit: Value): boolean {
  if (typeof crit === "string") {
    const m = /^(<=|>=|<>|<|>|=)?(.*)$/.exec(crit);
    const op = m?.[1] ?? "=";
    const rhsRaw = (m?.[2] ?? "").trim();
    const n = parseNumber(rhsRaw);
    const rhs: Value = n !== null ? n : rhsRaw;
    if (cell === null) return op === "<>" ? rhs !== "" : rhs === "" && op === "=";
    if (typeof rhs === "number" && typeof cell !== "number") return op === "<>";
    if (typeof rhs === "string" && typeof cell !== "string") return op === "<>";
    const c = compare(cell, rhs);
    return op === "=" ? c === 0 : op === "<>" ? c !== 0 : op === "<" ? c < 0 : op === ">" ? c > 0 : op === "<=" ? c <= 0 : c >= 0;
  }
  if (cell === null) return false;
  return compare(cell, crit) === 0;
}

// ---- display ---------------------------------------------------------------------------------------------------------

export function formatValue(v: Value, fmt?: CellFormat): string {
  if (v === null) return "";
  if (isErr(v)) return v.err;
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (typeof v === "string") return v;
  switch (fmt?.num) {
    case "int": return String(Math.round(v));
    case "dec2": return v.toFixed(2);
    case "currency": return "₹" + v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    case "percent": return (v * 100).toFixed(1).replace(/\.0$/, "") + "%";
    case "date": return formatDate(v);
    default: return Number.isInteger(v) ? String(v) : String(parseFloat(v.toPrecision(10)));
  }
}

export function evaluateAll(state: SheetState): Calculator { return new Calculator(state.cells); }

/** Apply an edit: store the raw text typed into a cell (empty string clears it). Returns false if the reference is not on the sheet or the text is huge. */
export function setCell(state: SheetState, ref: string, raw: string): boolean {
  const p = parseRef(ref);
  if (!p || raw.length > 500) return false;
  const key = refName(p.col, p.row);
  if (raw === "") delete state.cells[key];
  else state.cells[key] = raw;
  return true;
}

export function setFormat(state: SheetState, ref: string, patch: CellFormat): void {
  const p = parseRef(ref);
  if (!p) return;
  const key = refName(p.col, p.row);
  state.formats[key] = { ...state.formats[key], ...patch };
}

// ---- ranges, sorting, filtering, charts, CSV -------------------------------------------------------------------------

export function expandRange(spec: string): string[] {
  const parts = spec.toUpperCase().split(":");
  const a = parseRef(parts[0] ?? "");
  const b = parseRef(parts[1] ?? parts[0] ?? "");
  if (!a || !b) return [];
  const out: string[] = [];
  for (let r = Math.min(a.row, b.row); r <= Math.max(a.row, b.row); r++) for (let c = Math.min(a.col, b.col); c <= Math.max(a.col, b.col); c++) out.push(refName(c, r));
  return out;
}

/** Sort whole rows of a block by one column. Cells move as typed; formulas that point at moved rows are NOT rewritten (a limit worth teaching). */
export function sortRows(state: SheetState, firstRow: number, lastRow: number, col: number, dir: "asc" | "desc", lastCol = MAX_COLS - 1): void {
  const calc = evaluateAll(state);
  const rows: Array<{ row: number; key: Value; cells: Record<number, string> }> = [];
  for (let r = firstRow; r <= lastRow; r++) {
    const cells: Record<number, string> = {};
    for (let c = 0; c <= lastCol; c++) { const raw = state.cells[refName(c, r)]; if (raw !== undefined) cells[c] = raw; }
    rows.push({ row: r, key: calc.value(refName(col, r)), cells });
  }
  rows.sort((p, q) => {
    if (p.key === null && q.key !== null) return 1; // blanks always last
    if (q.key === null && p.key !== null) return -1;
    const c = compare(p.key, q.key);
    return dir === "asc" ? c : -c;
  });
  rows.forEach((row, i) => {
    for (let c = 0; c <= lastCol; c++) delete state.cells[refName(c, firstRow + i)];
    for (const [c, raw] of Object.entries(row.cells)) state.cells[refName(Number(c), firstRow + i)] = raw;
  });
}

/** Rows (0-based) of a block whose column value passes the condition, for the filter control. */
export function filterRows(state: SheetState, firstRow: number, lastRow: number, col: number, condition: string): number[] {
  const calc = evaluateAll(state);
  const hidden: number[] = [];
  const crit = condition.trim();
  if (crit === "") return hidden;
  for (let r = firstRow; r <= lastRow; r++) {
    const v = calc.value(refName(col, r));
    const n = parseNumber(crit);
    const pass = /^(<=|>=|<>|<|>|=)/.test(crit) ? matches(v, crit) : n !== null ? matches(v, n) : typeof v === "string" ? v.toLowerCase().includes(crit.toLowerCase()) : false;
    if (!pass) hidden.push(r);
  }
  return hidden;
}

export interface ChartData { labels: string[]; values: number[]; ok: boolean; problem?: string }
export function chartData(state: SheetState, spec: ChartSpec): ChartData {
  const labels = expandRange(spec.labels);
  const vals = expandRange(spec.values);
  if (!labels.length || !vals.length) return { labels: [], values: [], ok: false, problem: "Choose the cells for the labels and the values, like A2:A6 and B2:B6." };
  if (labels.length !== vals.length) return { labels: [], values: [], ok: false, problem: "The labels and the values need the same number of cells." };
  const calc = evaluateAll(state);
  const values = vals.map((r) => { const v = calc.value(r); return typeof v === "number" ? v : NaN; });
  if (values.some((v) => Number.isNaN(v))) return { labels: [], values: [], ok: false, problem: "Some of the value cells are not numbers, so they cannot be charted." };
  return { labels: labels.map((r) => formatValue(calc.value(r))), values, ok: true };
}

export const MAX_CSV_BYTES = 100_000;
/** Parse CSV text into cells (row 1 = first row). Limits keep a hostile file from becoming a huge sheet. */
export function importCsv(text0: string): { cells: Record<string, string>; rows: number; cols: number; truncated: boolean } | { error: string } {
  if (text0.length > MAX_CSV_BYTES) return { error: "That file is too large for the practice sheet (limit 100 KB)." };
  const text1 = text0.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < text1.length; i++) {
    const ch = text1[i];
    if (q) { if (ch === '"') { if (text1[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cur); cur = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text1[i + 1] === "\n") i++; row.push(cur); cur = ""; rows.push(row); row = []; }
    else cur += ch;
  }
  if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
  if (!rows.length) return { error: "The file is empty." };
  const cells: Record<string, string> = {};
  let truncated = false;
  let maxC = 0;
  rows.slice(0, MAX_ROWS).forEach((r, ri) => r.slice(0, MAX_COLS).forEach((v, ci) => { if (v !== "") { cells[refName(ci, ri)] = v.slice(0, 500); maxC = Math.max(maxC, ci + 1); } }));
  if (rows.length > MAX_ROWS || rows.some((r) => r.length > MAX_COLS)) truncated = true;
  return { cells, rows: Math.min(rows.length, MAX_ROWS), cols: maxC, truncated };
}

/** Export calculated values as CSV. Text cells that start with = + - @ get a leading apostrophe so Excel cannot run them. */
export function exportCsv(state: SheetState): string {
  const keys = Object.keys(state.cells);
  let maxR = 0, maxC = 0;
  for (const k of keys) { const p = parseRef(k); if (p) { maxR = Math.max(maxR, p.row); maxC = Math.max(maxC, p.col); } }
  const calc = evaluateAll(state);
  const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const lines: string[] = [];
  for (let r = 0; r <= maxR; r++) {
    const line: string[] = [];
    for (let c = 0; c <= maxC; c++) {
      const v = calc.value(refName(c, r));
      let s = formatValue(v, state.formats[refName(c, r)]);
      if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
      line.push(q(s));
    }
    lines.push(line.join(","));
  }
  return lines.join("\r\n") + "\r\n";
}

export { analyse, colName, MAX_COLS, MAX_ROWS, parseFormula, parseRef, refName };
