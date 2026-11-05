import type { Node } from "./formula";
import type { ErrCode, Value } from "./engine";

/**
 * The second set of spreadsheet functions: multi-condition sums and counts, lookups, text, dates and finance. They run inside the same safe evaluator
 * as the first set (no eval, no dynamic code); the evaluator hands this file the few helpers it needs, so there is no import cycle.
 */
export interface Ctx {
  ev: (n: Node) => Value | Value[];
  scalar: (v: Value | Value[]) => Value;
  num: (v: Value | Value[]) => number | Value;
  numbers: (args: Node[]) => number[] | Value;
  err: (code: ErrCode, msg: string) => Value;
  isErr: (v: Value) => v is { err: ErrCode; msg: string };
  compare: (a: Value, b: Value) => number;
  matches: (cell: Value, crit: Value) => boolean;
  text: (v: Value) => string;
}
type Rng = Value[] & { rows?: number; cols?: number };
const shape = (v: Value | Value[]): { vals: Value[]; rows: number; cols: number } | null => (Array.isArray(v) ? { vals: v, rows: (v as Rng).rows ?? v.length, cols: (v as Rng).cols ?? 1 } : null);

export const MORE_FUNCS = [
  "SUMIFS", "COUNTIFS", "AVERAGEIFS", "MAXIFS", "MINIFS", "SUMPRODUCT", "VLOOKUP", "HLOOKUP", "XLOOKUP", "INDEX", "MATCH", "CHOOSE", "IFS", "SWITCH", "IFNA",
  "ISNUMBER", "ISTEXT", "ISBLANK", "ISERROR", "LEN", "LEFT", "RIGHT", "MID", "UPPER", "LOWER", "PROPER", "TRIM", "CONCAT", "CONCATENATE", "TEXTJOIN", "SUBSTITUTE",
  "FIND", "SEARCH", "TEXT", "VALUE", "REPT", "DATE", "YEAR", "MONTH", "DAY", "EDATE", "EOMONTH", "WEEKDAY", "DAYS", "DATEDIF", "NETWORKDAYS", "LARGE", "SMALL", "RANK",
  "PRODUCT", "COUNTBLANK", "ROWS", "COLUMNS", "CEILING", "FLOOR", "TRUNC", "NPV", "IRR", "PV", "NPER", "RATE",
  "PERCENTILE", "PERCENTILE.INC", "QUARTILE", "QUARTILE.INC", "MODE", "MODE.SNGL", "STDEV.S", "STDEV.P", "STDEVP", "VAR.S", "VAR.P", "VARP", "RSQ", "FORECAST", "FORECAST.LINEAR",
  "STANDARDIZE", "NORM.S.DIST", "NORM.DIST", "COVARIANCE.S", "COVARIANCE.P", "GEOMEAN", "SUMSQ", "AVERAGEA", "PERCENTRANK", "PERCENTRANK.INC",
];

/** Standard normal cumulative distribution (Abramowitz and Stegun 7.1.26 via erf; error below 1.5e-7, far below what a spreadsheet shows). */
const normCdf = (z: number): number => {
  const x = Math.abs(z) / Math.SQRT2, tt = 1 / (1 + 0.3275911 * x);
  const erf = 1 - (((((1.061405429 * tt - 1.453152027) * tt) + 1.421413741) * tt - 0.284496736) * tt + 0.254829592) * tt * Math.exp(-x * x);
  return z >= 0 ? 0.5 * (1 + erf) : 0.5 * (1 - erf);
};
const pairs = (a: Value[], b: Value[]): { xs: number[]; ys: number[] } => {
  const xs: number[] = [], ys: number[] = [];
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (typeof a[i] === "number" && typeof b[i] === "number") { xs.push(a[i] as number); ys.push(b[i] as number); }
  return { xs, ys };
};

/* ---- dates: serial numbers count days from 1899-12-30, as in Excel for every date after February 1900 ---- */
const EPOCH = Date.UTC(1899, 11, 30);
export const toSerial = (y: number, m: number, d: number): number => Math.round((Date.UTC(y, m - 1, d) - EPOCH) / 86_400_000);
export const fromSerial = (n: number): Date => new Date(EPOCH + Math.trunc(n) * 86_400_000);
export function parseIsoDate(s: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d ? toSerial(y, mo, d) : null;
}
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS_ = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const two = (n: number) => String(n).padStart(2, "0");

export function formatDate(serial: number, fmt = "dd-mmm-yyyy"): string {
  const d = fromSerial(serial);
  const y = d.getUTCFullYear(), m = d.getUTCMonth(), day = d.getUTCDate(), wd = d.getUTCDay();
  return fmt.replace(/yyyy|yy|mmmm|mmm|mm|m|dddd|ddd|dd|d/gi, (t) => {
    switch (t.toLowerCase()) {
      case "yyyy": return String(y);
      case "yy": return String(y).slice(-2);
      case "mmmm": return MONTHS[m];
      case "mmm": return MONTHS[m].slice(0, 3);
      case "mm": return two(m + 1);
      case "m": return String(m + 1);
      case "dddd": return DAYS_[wd];
      case "ddd": return DAYS_[wd].slice(0, 3);
      case "dd": return two(day);
      default: return String(day);
    }
  });
}

/** The TEXT function: whole numbers, decimals, thousands separators, percent, and dates. */
function formatText(v: number, fmt: string): string {
  if (/[dmy]/i.test(fmt) && !/[#0]/.test(fmt)) return formatDate(v, fmt);
  const pct = fmt.includes("%");
  const x = pct ? v * 100 : v;
  const dec = (fmt.split(".")[1] ?? "").replace(/[^0#]/g, "").length;
  const grouped = fmt.includes(",");
  const s = Math.abs(x).toFixed(dec);
  const [i0, f] = s.split(".");
  const minInt = ((fmt.split(".")[0] ?? "").match(/0/g) ?? []).length; // 0000 pads to four digits
  const i = i0.padStart(minInt, "0");
  const ig = grouped ? i.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : i;
  return (x < 0 ? "-" : "") + ig + (f ? "." + f : "") + (pct ? "%" : "");
}

export function moreFn(name: string, args: Node[], c: Ctx): Value {
  const { err, isErr } = c;
  const need = (min: number, max: number): Value | null => (args.length < min || args.length > max ? err("#VALUE!", `${name} needs ${min === max ? min : `${min} to ${max}`} value${max === 1 ? "" : "s"} inside the brackets, but it has ${args.length}.`) : null);
  const sc = (i: number): Value => c.scalar(c.ev(args[i]));
  const nm = (i: number): number | Value => c.num(c.ev(args[i]));
  const str = (i: number): string | Value => { const v = sc(i); return isErr(v) ? v : c.text(v); };
  const rangeOf = (i: number): { vals: Value[]; rows: number; cols: number } | Value => {
    const s = shape(c.ev(args[i]));
    return s ?? err("#VALUE!", `${name} needs a range here, like A2:A9.`);
  };
  const isRange = (r: unknown): r is { vals: Value[]; rows: number; cols: number } => typeof r === "object" && r !== null && "vals" in r;
  const dateArg = (i: number): number | Value => {
    const v = sc(i);
    if (isErr(v)) return v;
    if (typeof v === "number") return v;
    if (typeof v === "string") { const d = parseIsoDate(v); if (d !== null) return d; }
    return err("#VALUE!", `${name} needs a date. Use the DATE function, or type it as 2026-01-31.`);
  };

  switch (name) {
    case "SUMIFS": case "COUNTIFS": case "AVERAGEIFS": case "MAXIFS": case "MINIFS": {
      const lead = name === "COUNTIFS" ? 0 : 1;
      if (args.length < lead + 2 || (args.length - lead) % 2) return err("#VALUE!", `${name} needs ${lead ? "a range to work on, then " : ""}pairs of a range and a condition.`);
      let target: Value[] | null = null;
      if (lead) { const r = rangeOf(0); if (!isRange(r)) return r; target = r.vals; }
      const pairs: Array<{ vals: Value[]; crit: Value }> = [];
      for (let i = lead; i < args.length; i += 2) {
        const r = rangeOf(i); if (!isRange(r)) return r;
        const crit = sc(i + 1); if (isErr(crit)) return crit;
        pairs.push({ vals: r.vals, crit });
      }
      const n = pairs[0].vals.length;
      if (pairs.some((p) => p.vals.length !== n) || (target && target.length !== n)) return err("#VALUE!", `${name} needs every range to be the same size.`);
      const picked: number[] = [];
      let count = 0;
      for (let i = 0; i < n; i++) {
        if (!pairs.every((p) => !isErr(p.vals[i]) && c.matches(p.vals[i], p.crit))) continue;
        count++;
        if (target) { const t = target[i]; if (typeof t === "number") picked.push(t); }
      }
      if (name === "COUNTIFS") return count;
      if (name === "SUMIFS") return picked.reduce((a, b) => a + b, 0);
      if (name === "AVERAGEIFS") return picked.length ? picked.reduce((a, b) => a + b, 0) / picked.length : err("#DIV/0!", "No rows matched, so there is nothing to average.");
      return picked.length ? (name === "MAXIFS" ? Math.max(...picked) : Math.min(...picked)) : 0;
    }
    case "SUMPRODUCT": {
      if (!args.length) return err("#VALUE!", "SUMPRODUCT needs at least one range.");
      const rs: Value[][] = [];
      for (let i = 0; i < args.length; i++) { const r = rangeOf(i); if (!isRange(r)) return r; rs.push(r.vals); }
      if (rs.some((r) => r.length !== rs[0].length)) return err("#VALUE!", "SUMPRODUCT needs every range to be the same size.");
      let total = 0;
      for (let i = 0; i < rs[0].length; i++) { let p = 1; for (const r of rs) { const v = r[i]; if (isErr(v)) return v; p *= typeof v === "number" ? v : 0; } total += p; }
      return total;
    }
    case "VLOOKUP": case "HLOOKUP": {
      const bad = need(3, 4); if (bad) return bad;
      const key = sc(0); if (isErr(key)) return key;
      const t = rangeOf(1); if (!isRange(t)) return t;
      const idx = nm(2); if (typeof idx !== "number") return idx;
      const exactArg = args[3] ? sc(3) : true; if (isErr(exactArg)) return exactArg;
      const approx = exactArg === true || (typeof exactArg === "number" && exactArg !== 0);
      const v = name === "VLOOKUP";
      const along = v ? t.rows : t.cols, across = v ? t.cols : t.rows;
      if (idx < 1 || idx > across) return err("#REF!", `${name} was asked for ${v ? "column" : "row"} ${idx}, but the table only has ${across}.`);
      const at = (pos: number, k: number): Value => (v ? t.vals[pos * t.cols + (k - 1)] : t.vals[(k - 1) * t.cols + pos]);
      let hit = -1;
      for (let i = 0; i < along; i++) {
        const cand = at(i, 1);
        if (isErr(cand)) continue;
        const cmp = c.compare(cand, key);
        if (approx) { if (cmp <= 0 && (typeof cand === typeof key)) hit = i; else if (cmp > 0) break; }
        else if (cmp === 0 && cand !== null && typeof cand === typeof key) { hit = i; break; }
      }
      return hit < 0 ? err("#N/A", `${name} could not find ${c.text(key)} in the first ${v ? "column" : "row"}.`) : at(hit, idx);
    }
    case "XLOOKUP": {
      const bad = need(3, 4); if (bad) return bad;
      const key = sc(0); if (isErr(key)) return key;
      const look = rangeOf(1); if (!isRange(look)) return look;
      const ret = rangeOf(2); if (!isRange(ret)) return ret;
      if (look.vals.length !== ret.vals.length) return err("#VALUE!", "XLOOKUP needs the lookup range and the result range to be the same size.");
      for (let i = 0; i < look.vals.length; i++) { const cand = look.vals[i]; if (!isErr(cand) && cand !== null && typeof cand === typeof key && c.compare(cand, key) === 0) return ret.vals[i]; }
      return args[3] ? sc(3) : err("#N/A", `XLOOKUP could not find ${c.text(key)}.`);
    }
    case "INDEX": {
      const bad = need(2, 3); if (bad) return bad;
      const r = rangeOf(0); if (!isRange(r)) return r;
      const a = nm(1); if (typeof a !== "number") return a;
      const b = args[2] ? nm(2) : null; if (b !== null && typeof b !== "number") return b;
      let row = a, col = b ?? 1;
      if (b === null && r.rows === 1) { row = 1; col = a; }
      if (row < 1 || row > r.rows || col < 1 || col > r.cols) return err("#REF!", "INDEX was asked for a position outside the range.");
      return r.vals[(Math.trunc(row) - 1) * r.cols + (Math.trunc(col) - 1)];
    }
    case "MATCH": {
      const bad = need(2, 3); if (bad) return bad;
      const key = sc(0); if (isErr(key)) return key;
      const r = rangeOf(1); if (!isRange(r)) return r;
      const type = args[2] ? nm(2) : 1; if (typeof type !== "number") return type;
      let hit = -1;
      r.vals.forEach((cand, i) => {
        if (isErr(cand) || cand === null || typeof cand !== typeof key) return;
        const cmp = c.compare(cand, key);
        if (type === 0) { if (cmp === 0 && hit < 0) hit = i; }
        else if (type > 0) { if (cmp <= 0) hit = i; }
        else if (cmp >= 0) hit = i;
      });
      return hit < 0 ? err("#N/A", `MATCH could not find ${c.text(key)}.`) : hit + 1;
    }
    case "CHOOSE": {
      if (args.length < 2) return err("#VALUE!", "CHOOSE needs a position and at least one choice.");
      const i = nm(0); if (typeof i !== "number") return i;
      return i >= 1 && i < args.length ? sc(Math.trunc(i)) : err("#VALUE!", "CHOOSE was given a position with no choice behind it.");
    }
    case "IFS": {
      if (args.length < 2 || args.length % 2) return err("#VALUE!", "IFS needs pairs: a test, then the answer if it is true.");
      for (let i = 0; i < args.length; i += 2) {
        const t = sc(i); if (isErr(t)) return t;
        if (t === true || (typeof t === "number" && t !== 0)) return sc(i + 1);
      }
      return err("#N/A", "IFS found no test that was true. End with TRUE and a fallback answer.");
    }
    case "SWITCH": {
      if (args.length < 3) return err("#VALUE!", "SWITCH needs a value and at least one pair of a match and a result.");
      const v = sc(0); if (isErr(v)) return v;
      let i = 1;
      for (; i + 1 < args.length; i += 2) { const m = sc(i); if (isErr(m)) return m; if (c.compare(v, m) === 0 && typeof v === typeof m) return sc(i + 1); }
      return i < args.length ? sc(i) : err("#N/A", "SWITCH found no match and has no default.");
    }
    case "IFNA": { const bad = need(2, 2); if (bad) return bad; const v = sc(0); return isErr(v) && v.err === "#N/A" ? sc(1) : v; }
    case "ISNUMBER": { const bad = need(1, 1); if (bad) return bad; const v = sc(0); return typeof v === "number"; }
    case "ISTEXT": { const bad = need(1, 1); if (bad) return bad; const v = sc(0); return typeof v === "string"; }
    case "ISBLANK": { const bad = need(1, 1); if (bad) return bad; return sc(0) === null; }
    case "ISERROR": { const bad = need(1, 1); if (bad) return bad; return isErr(sc(0)); }

    /* ---- text ---- */
    case "LEN": { const bad = need(1, 1); if (bad) return bad; const s = str(0); return typeof s === "string" ? s.length : s; }
    case "LEFT": case "RIGHT": {
      const bad = need(1, 2); if (bad) return bad;
      const s = str(0); if (typeof s !== "string") return s;
      const n = args[1] ? nm(1) : 1; if (typeof n !== "number") return n;
      if (n < 0) return err("#VALUE!", `${name} needs a length of zero or more.`);
      return name === "LEFT" ? s.slice(0, Math.trunc(n)) : Math.trunc(n) === 0 ? "" : s.slice(-Math.trunc(n));
    }
    case "MID": {
      const bad = need(3, 3); if (bad) return bad;
      const s = str(0); if (typeof s !== "string") return s;
      const a = nm(1); if (typeof a !== "number") return a;
      const b = nm(2); if (typeof b !== "number") return b;
      if (a < 1 || b < 0) return err("#VALUE!", "MID needs a start of 1 or more and a length of zero or more.");
      return s.slice(Math.trunc(a) - 1, Math.trunc(a) - 1 + Math.trunc(b));
    }
    case "UPPER": case "LOWER": case "PROPER": case "TRIM": {
      const bad = need(1, 1); if (bad) return bad;
      const s = str(0); if (typeof s !== "string") return s;
      if (name === "UPPER") return s.toUpperCase();
      if (name === "LOWER") return s.toLowerCase();
      if (name === "TRIM") return s.trim().replace(/\s+/g, " ");
      return s.toLowerCase().replace(/(^|[^a-z])([a-z])/g, (_m, p, ch) => p + ch.toUpperCase());
    }
    case "CONCAT": case "CONCATENATE": case "TEXTJOIN": {
      const join = name === "TEXTJOIN";
      if (join && args.length < 3) return err("#VALUE!", "TEXTJOIN needs a separator, whether to skip blanks, and then the text to join.");
      const sep = join ? str(0) : ""; if (typeof sep !== "string") return sep;
      const skip = join ? sc(1) : false; if (isErr(skip)) return skip;
      const parts: string[] = [];
      for (let i = join ? 2 : 0; i < args.length; i++) {
        const v = c.ev(args[i]);
        for (const x of Array.isArray(v) ? v : [v]) { if (isErr(x)) return x; if (join && skip === true && (x === null || x === "")) continue; parts.push(c.text(x)); }
      }
      return parts.join(sep);
    }
    case "SUBSTITUTE": {
      const bad = need(3, 4); if (bad) return bad;
      const s = str(0), a = str(1), b = str(2);
      if (typeof s !== "string") return s; if (typeof a !== "string") return a; if (typeof b !== "string") return b;
      if (a === "") return s;
      if (!args[3]) return s.split(a).join(b);
      const k = nm(3); if (typeof k !== "number") return k;
      let seen = 0, at = -1;
      for (;;) { at = s.indexOf(a, at + 1); if (at < 0) return s; if (++seen === Math.trunc(k)) return s.slice(0, at) + b + s.slice(at + a.length); }
    }
    case "FIND": case "SEARCH": {
      const bad = need(2, 3); if (bad) return bad;
      let a = str(0), s = str(1);
      if (typeof a !== "string") return a; if (typeof s !== "string") return s;
      const start = args[2] ? nm(2) : 1; if (typeof start !== "number") return start;
      if (name === "SEARCH") { a = a.toLowerCase(); s = s.toLowerCase(); }
      const at = s.indexOf(a, Math.max(0, Math.trunc(start) - 1));
      return at < 0 ? err("#VALUE!", `${name} did not find "${a}" in the text.`) : at + 1;
    }
    case "TEXT": {
      const bad = need(2, 2); if (bad) return bad;
      const v = sc(0); if (isErr(v)) return v;
      const f = str(1); if (typeof f !== "string") return f;
      const n = typeof v === "number" ? v : typeof v === "string" ? parseIsoDate(v) ?? Number(v) : NaN;
      return Number.isFinite(n) ? formatText(n, f) : c.text(v);
    }
    case "VALUE": {
      const bad = need(1, 1); if (bad) return bad;
      const v = sc(0); if (isErr(v)) return v;
      if (typeof v === "number") return v;
      const t = c.text(v).trim().replace(/,/g, "");
      if (/^[-+]?(\d+\.?\d*|\.\d+)%?$/.test(t)) return t.endsWith("%") ? parseFloat(t) / 100 : parseFloat(t);
      const d = parseIsoDate(t);
      return d !== null ? d : err("#VALUE!", "VALUE could not turn that text into a number.");
    }
    case "REPT": {
      const bad = need(2, 2); if (bad) return bad;
      const s = str(0); if (typeof s !== "string") return s;
      const n = nm(1); if (typeof n !== "number") return n;
      return n < 0 || n * s.length > 2000 ? err("#VALUE!", "REPT needs a count between 0 and a small number.") : s.repeat(Math.trunc(n));
    }

    /* ---- dates ---- */
    case "DATE": {
      const bad = need(3, 3); if (bad) return bad;
      const y = nm(0), m = nm(1), d = nm(2);
      if (typeof y !== "number") return y; if (typeof m !== "number") return m; if (typeof d !== "number") return d;
      return toSerial(Math.trunc(y), Math.trunc(m), Math.trunc(d));
    }
    case "YEAR": case "MONTH": case "DAY": {
      const bad = need(1, 1); if (bad) return bad;
      const s = dateArg(0); if (typeof s !== "number") return s;
      const d = fromSerial(s);
      return name === "YEAR" ? d.getUTCFullYear() : name === "MONTH" ? d.getUTCMonth() + 1 : d.getUTCDate();
    }
    case "EDATE": case "EOMONTH": {
      const bad = need(2, 2); if (bad) return bad;
      const s = dateArg(0); if (typeof s !== "number") return s;
      const m = nm(1); if (typeof m !== "number") return m;
      const d = fromSerial(s);
      const y = d.getUTCFullYear(), mo = d.getUTCMonth() + Math.trunc(m);
      if (name === "EOMONTH") return toSerial(y, mo + 2, 0);
      const last = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
      return toSerial(y, mo + 1, Math.min(d.getUTCDate(), last));
    }
    case "WEEKDAY": {
      const bad = need(1, 2); if (bad) return bad;
      const s = dateArg(0); if (typeof s !== "number") return s;
      const t = args[1] ? nm(1) : 1; if (typeof t !== "number") return t;
      const w = fromSerial(s).getUTCDay();
      return t === 2 ? (w === 0 ? 7 : w) : t === 3 ? (w + 6) % 7 : w + 1;
    }
    case "DAYS": { const bad = need(2, 2); if (bad) return bad; const e = dateArg(0), s = dateArg(1); if (typeof e !== "number") return e; if (typeof s !== "number") return s; return e - s; }
    case "DATEDIF": {
      const bad = need(3, 3); if (bad) return bad;
      const s = dateArg(0), e = dateArg(1); if (typeof s !== "number") return s; if (typeof e !== "number") return e;
      const u = str(2); if (typeof u !== "string") return u;
      if (e < s) return err("#VALUE!", "DATEDIF needs the end date to be after the start date.");
      const a = fromSerial(s), b = fromSerial(e);
      let months = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
      if (b.getUTCDate() < a.getUTCDate()) months--;
      switch (u.toUpperCase()) { case "Y": return Math.floor(months / 12); case "M": return months; case "D": return e - s; default: return err("#VALUE!", 'DATEDIF unit must be "Y", "M" or "D".'); }
    }
    case "NETWORKDAYS": {
      const bad = need(2, 2); if (bad) return bad;
      const s = dateArg(0), e = dateArg(1); if (typeof s !== "number") return s; if (typeof e !== "number") return e;
      let n = 0; const lo = Math.min(s, e), hi = Math.max(s, e);
      if (hi - lo > 20_000) return err("#VALUE!", "That date range is too long.");
      for (let d = lo; d <= hi; d++) { const w = fromSerial(d).getUTCDay(); if (w !== 0 && w !== 6) n++; }
      return s <= e ? n : -n;
    }

    /* ---- statistics and rounding ---- */
    case "LARGE": case "SMALL": {
      const bad = need(2, 2); if (bad) return bad;
      const r = rangeOf(0); if (!isRange(r)) return r;
      const k = nm(1); if (typeof k !== "number") return k;
      const ns = r.vals.filter((x): x is number => typeof x === "number").sort((p, q) => (name === "LARGE" ? q - p : p - q));
      return k >= 1 && k <= ns.length ? ns[Math.trunc(k) - 1] : err("#VALUE!", `${name} was asked for position ${k}, but there are only ${ns.length} numbers.`);
    }
    case "RANK": {
      const bad = need(2, 3); if (bad) return bad;
      const x = nm(0); if (typeof x !== "number") return x;
      const r = rangeOf(1); if (!isRange(r)) return r;
      const order = args[2] ? nm(2) : 0; if (typeof order !== "number") return order;
      const ns = r.vals.filter((v): v is number => typeof v === "number");
      if (!ns.includes(x)) return err("#N/A", "RANK could not find that number in the range.");
      return 1 + ns.filter((v) => (order === 0 ? v > x : v < x)).length;
    }
    case "PRODUCT": { const n = c.numbers(args); return Array.isArray(n) ? n.reduce((a, b) => a * b, 1) : n; }
    case "COUNTBLANK": { const bad = need(1, 1); if (bad) return bad; const r = rangeOf(0); if (!isRange(r)) return r; return r.vals.filter((v) => v === null || v === "").length; }
    case "ROWS": case "COLUMNS": { const bad = need(1, 1); if (bad) return bad; const r = rangeOf(0); if (!isRange(r)) return r; return name === "ROWS" ? r.rows : r.cols; }
    case "CEILING": case "FLOOR": {
      const bad = need(2, 2); if (bad) return bad;
      const x = nm(0), s = nm(1); if (typeof x !== "number") return x; if (typeof s !== "number") return s;
      if (s === 0) return 0;
      return (name === "CEILING" ? Math.ceil(x / s - 1e-9) : Math.floor(x / s + 1e-9)) * s;
    }
    case "TRUNC": { const bad = need(1, 2); if (bad) return bad; const x = nm(0); if (typeof x !== "number") return x; const d = args[1] ? nm(1) : 0; if (typeof d !== "number") return d; const f = Math.pow(10, Math.trunc(d)); return Math.trunc(x * f) / f; }

    /* ---- finance ---- */
    case "NPV": {
      if (args.length < 2) return err("#VALUE!", "NPV needs a rate and at least one cash flow.");
      const r = nm(0); if (typeof r !== "number") return r;
      const flows = c.numbers(args.slice(1)); if (!Array.isArray(flows)) return flows;
      return flows.reduce((a, v, i) => a + v / Math.pow(1 + r, i + 1), 0);
    }
    case "IRR": {
      const bad = need(1, 2); if (bad) return bad;
      const r = rangeOf(0); if (!isRange(r)) return r;
      const cf = r.vals.filter((v): v is number => typeof v === "number");
      if (!cf.some((v) => v > 0) || !cf.some((v) => v < 0)) return err("#VALUE!", "IRR needs at least one negative and one positive cash flow.");
      const f = (x: number) => cf.reduce((a, v, i) => a + v / Math.pow(1 + x, i), 0);
      let lo = -0.99, hi = 10;
      if (f(lo) * f(hi) > 0) return err("#VALUE!", "IRR could not find a rate for these cash flows.");
      for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2; if (f(lo) * f(mid) <= 0) hi = mid; else lo = mid; }
      return (lo + hi) / 2;
    }
    case "PV": {
      const bad = need(3, 3); if (bad) return bad;
      const r = nm(0), n = nm(1), p = nm(2);
      if (typeof r !== "number") return r; if (typeof n !== "number") return n; if (typeof p !== "number") return p;
      return r === 0 ? -p * n : (-p * (1 - Math.pow(1 + r, -n))) / r;
    }
    case "NPER": {
      const bad = need(3, 3); if (bad) return bad;
      const r = nm(0), p = nm(1), pv = nm(2);
      if (typeof r !== "number") return r; if (typeof p !== "number") return p; if (typeof pv !== "number") return pv;
      if (r === 0) return p === 0 ? err("#DIV/0!", "NPER needs a payment.") : -pv / p;
      const x = p / (p + pv * r);
      return x <= 0 ? err("#VALUE!", "NPER cannot reach zero with these numbers: the payment is too small.") : Math.log(x) / Math.log(1 + r);
    }
    case "RATE": {
      const bad = need(3, 3); if (bad) return bad;
      const n = nm(0), p = nm(1), pv = nm(2);
      if (typeof n !== "number") return n; if (typeof p !== "number") return p; if (typeof pv !== "number") return pv;
      const f = (x: number) => pv + (x === 0 ? p * n : (p * (1 - Math.pow(1 + x, -n))) / x);
      let lo = 1e-9, hi = 5;
      if (f(lo) * f(hi) > 0) return err("#VALUE!", "RATE could not find a rate for these numbers.");
      for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2; if (f(lo) * f(mid) <= 0) hi = mid; else lo = mid; }
      return (lo + hi) / 2;
    }
    /* ---- statistics for data analysis ---- */
    case "PERCENTILE": case "PERCENTILE.INC": case "QUARTILE": case "QUARTILE.INC": {
      const bad = need(2, 2); if (bad) return bad;
      const r = rangeOf(0); if (!isRange(r)) return r;
      const k0 = nm(1); if (typeof k0 !== "number") return k0;
      const quart = name.startsWith("QUARTILE");
      if (quart && (k0 < 0 || k0 > 4 || !Number.isInteger(k0))) return err("#VALUE!", "QUARTILE needs a whole number from 0 to 4: 0 is the minimum, 1 the first quartile, 2 the median, 3 the third quartile, 4 the maximum.");
      const k = quart ? k0 / 4 : k0;
      if (k < 0 || k > 1) return err("#VALUE!", "PERCENTILE needs a value from 0 to 1, for example 0.9 for the 90th percentile.");
      const ns = r.vals.filter((x): x is number => typeof x === "number").sort((p, q) => p - q);
      if (!ns.length) return err("#VALUE!", `${name} found no numbers.`);
      const pos = k * (ns.length - 1), lo = Math.floor(pos), hi = Math.ceil(pos);
      return ns[lo] + (ns[hi] - ns[lo]) * (pos - lo);
    }
    case "PERCENTRANK": case "PERCENTRANK.INC": {
      const bad = need(2, 3); if (bad) return bad;
      const r = rangeOf(0); if (!isRange(r)) return r;
      const x = nm(1); if (typeof x !== "number") return x;
      const ns = r.vals.filter((v): v is number => typeof v === "number").sort((p, q) => p - q);
      if (ns.length < 2 || x < ns[0] || x > ns[ns.length - 1]) return err("#N/A", "PERCENTRANK needs a value inside the range of the data.");
      const below = ns.filter((v) => v < x).length, same = ns.filter((v) => v === x).length;
      const rank = same ? below / (ns.length - 1) : (() => { const i = below - 1; return (i + (x - ns[i]) / (ns[i + 1] - ns[i])) / (ns.length - 1); })();
      const d = args[2] ? nm(2) : 3; if (typeof d !== "number") return d;
      const f = Math.pow(10, d);
      return Math.floor(rank * f + 1e-9) / f;
    }
    case "MODE": case "MODE.SNGL": {
      const ns = c.numbers(args); if (!Array.isArray(ns)) return ns;
      const count = new Map<number, number>();
      for (const v of ns) count.set(v, (count.get(v) ?? 0) + 1);
      let best: number | null = null, bc = 1;
      for (const v of ns) if ((count.get(v) ?? 0) > bc) { best = v; bc = count.get(v) ?? 0; }
      return best === null ? err("#N/A", "MODE found no value that appears more than once.") : best;
    }
    case "STDEV.S": case "STDEV.P": case "STDEVP": case "VAR.S": case "VAR.P": case "VARP": {
      const ns = c.numbers(args); if (!Array.isArray(ns)) return ns;
      const pop = name.endsWith(".P") || name === "STDEVP" || name === "VARP";
      if (ns.length < (pop ? 1 : 2)) return err("#DIV/0!", `${name} needs at least ${pop ? "one number" : "two numbers"}.`);
      const m = ns.reduce((a, b) => a + b, 0) / ns.length;
      const v = ns.reduce((a, b) => a + (b - m) * (b - m), 0) / (ns.length - (pop ? 0 : 1));
      return name.startsWith("STDEV") ? Math.sqrt(v) : v;
    }
    case "SUMSQ": { const ns = c.numbers(args); return Array.isArray(ns) ? ns.reduce((a, b) => a + b * b, 0) : ns; }
    case "AVERAGEA": { const ns = c.numbers(args); return Array.isArray(ns) ? (ns.length ? ns.reduce((a, b) => a + b, 0) / ns.length : err("#DIV/0!", "AVERAGEA found no numbers.")) : ns; }
    case "GEOMEAN": {
      const ns = c.numbers(args); if (!Array.isArray(ns)) return ns;
      if (!ns.length || ns.some((v) => v <= 0)) return err("#VALUE!", "GEOMEAN needs numbers that are all above zero.");
      return Math.exp(ns.reduce((a, b) => a + Math.log(b), 0) / ns.length);
    }
    case "RSQ": case "COVARIANCE.S": case "COVARIANCE.P": {
      const bad = need(2, 2); if (bad) return bad;
      const a = rangeOf(0), b = rangeOf(1); if (!isRange(a)) return a; if (!isRange(b)) return b;
      if (a.vals.length !== b.vals.length) return err("#N/A", `${name} needs two ranges of the same size.`);
      const { xs, ys } = pairs(a.vals, b.vals);
      const pop = name === "COVARIANCE.P";
      if (xs.length < (pop ? 1 : 2)) return err("#DIV/0!", `${name} needs at least two pairs of numbers.`);
      const mx = xs.reduce((u, v) => u + v, 0) / xs.length, my = ys.reduce((u, v) => u + v, 0) / ys.length;
      let sxy = 0, sxx = 0, syy = 0;
      for (let i = 0; i < xs.length; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; }
      if (name === "RSQ") return sxx === 0 || syy === 0 ? err("#DIV/0!", "RSQ needs numbers that vary.") : (sxy * sxy) / (sxx * syy);
      return sxy / (xs.length - (pop ? 0 : 1));
    }
    case "FORECAST": case "FORECAST.LINEAR": {
      const bad = need(3, 3); if (bad) return bad;
      const x = nm(0); if (typeof x !== "number") return x;
      const ky = rangeOf(1), kx = rangeOf(2); if (!isRange(ky)) return ky; if (!isRange(kx)) return kx;
      if (ky.vals.length !== kx.vals.length) return err("#N/A", `${name} needs the known y values and the known x values to be the same size.`);
      const { xs, ys } = pairs(kx.vals, ky.vals);
      if (xs.length < 2) return err("#DIV/0!", `${name} needs at least two pairs of numbers.`);
      const mx = xs.reduce((u, v) => u + v, 0) / xs.length, my = ys.reduce((u, v) => u + v, 0) / ys.length;
      let sxy = 0, sxx = 0;
      for (let i = 0; i < xs.length; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; }
      if (sxx === 0) return err("#DIV/0!", "FORECAST needs x values that vary.");
      return my + (sxy / sxx) * (x - mx);
    }
    case "STANDARDIZE": {
      const bad = need(3, 3); if (bad) return bad;
      const x = nm(0), m = nm(1), s = nm(2); if (typeof x !== "number") return x; if (typeof m !== "number") return m; if (typeof s !== "number") return s;
      return s <= 0 ? err("#VALUE!", "STANDARDIZE needs a standard deviation above zero.") : (x - m) / s;
    }
    case "NORM.S.DIST": {
      const bad = need(1, 2); if (bad) return bad;
      const z = nm(0); if (typeof z !== "number") return z;
      const cum = args[1] ? c.scalar(c.ev(args[1])) : true;
      return cum === false || cum === 0 ? Math.exp(-z * z / 2) / Math.sqrt(2 * Math.PI) : normCdf(z);
    }
    case "NORM.DIST": {
      const bad = need(4, 4); if (bad) return bad;
      const x = nm(0), m = nm(1), s = nm(2); if (typeof x !== "number") return x; if (typeof m !== "number") return m; if (typeof s !== "number") return s;
      if (s <= 0) return err("#VALUE!", "NORM.DIST needs a standard deviation above zero.");
      const cum = c.scalar(c.ev(args[3])), z = (x - m) / s;
      return cum === false || cum === 0 ? Math.exp(-z * z / 2) / (s * Math.sqrt(2 * Math.PI)) : normCdf(z);
    }
    default: return err("#NAME?", `"${name}" is not a function GrowQR knows yet.`);
  }
}
