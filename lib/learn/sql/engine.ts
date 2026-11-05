import { parseSql, SqlError, type Body, type Expr, type FromItem, type OrderItem, type Query, type Select, type Window } from "./parser";

/**
 * Runs one SELECT statement on a tiny in-memory database. It supports what analysts use every day: joins, WHERE, GROUP BY and HAVING, CASE, subqueries,
 * CTEs (WITH), UNION, and window functions (ranking, running totals, moving averages, LAG and LEAD). Evaluation is a walk over the parsed tree: no eval and
 * no dynamic code. Limits on rows and time keep a careless query from freezing the page.
 */
export type SqlValue = number | string | boolean | null;
export interface SqlTable { name: string; columns: string[]; rows: SqlValue[][] }
export interface SqlDb { tables: SqlTable[] }
export type SqlResult = { ok: true; columns: string[]; rows: SqlValue[][]; truncated: boolean } | { ok: false; error: string; hint?: string };

const MAX_ROWS = 60_000;
const MAX_OUT = 500;
const AGGS = new Set(["COUNT", "SUM", "AVG", "MIN", "MAX"]);
const RANKERS = new Set(["ROW_NUMBER", "RANK", "DENSE_RANK", "NTILE", "LAG", "LEAD", "FIRST_VALUE", "LAST_VALUE"]);

interface Col { t: string; n: string }
interface Rel { cols: Col[]; rows: SqlValue[][] }
interface Scope { cols: Col[]; vals: SqlValue[]; group?: SqlValue[][]; wv?: Map<object, SqlValue[]>; idx?: number; outer?: Scope }

const lc = (s: string) => s.toLowerCase();
const isNum = (v: SqlValue): v is number => typeof v === "number";

function norm(v: SqlValue): SqlValue { return typeof v === "number" && Number.isFinite(v) ? parseFloat(v.toPrecision(12)) : v; }
function toNum(v: SqlValue): number | null {
  if (v === null) return null;
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  const t = v.trim();
  return /^[-+]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(t) ? parseFloat(t) : null;
}
/** -1, 0 or 1; null when either side is NULL. Numbers compare as numbers, numeric text compares with a number as a number, text compares without regard to capitals. */
function cmp(a: SqlValue, b: SqlValue): number | null {
  if (a === null || b === null) return null;
  if (typeof a === "number" || typeof b === "number") { const x = toNum(a), y = toNum(b); if (x !== null && y !== null) return x < y ? -1 : x > y ? 1 : 0; }
  if (typeof a === "boolean" || typeof b === "boolean") { const x = toNum(a) ?? 0, y = toNum(b) ?? 0; return x < y ? -1 : x > y ? 1 : 0; }
  const x = String(a).toLowerCase(), y = String(b).toLowerCase();
  return x < y ? -1 : x > y ? 1 : 0;
}
/** Sort order: NULLs first, then numbers, then text. */
function order(a: SqlValue, b: SqlValue): number {
  if (a === null || b === null) return a === b ? 0 : a === null ? -1 : 1;
  return cmp(a, b) ?? 0;
}
const key = (v: SqlValue): string => (v === null ? "\u0000null" : typeof v === "number" ? `n${norm(v)}` : typeof v === "boolean" ? `n${v ? 1 : 0}` : `s${v.toLowerCase()}`);
const rowKey = (r: SqlValue[]): string => r.map(key).join("\u0001");
const truth = (v: SqlValue): boolean | null => (v === null ? null : typeof v === "boolean" ? v : typeof v === "number" ? v !== 0 : v.toLowerCase() === "true");

function like(s: string, p: string): boolean {
  let re = "^";
  for (const ch of p) re += ch === "%" ? "[\\s\\S]*" : ch === "_" ? "[\\s\\S]" : ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(re + "$", "i").test(s);
}

function hasAgg(e: Expr): boolean {
  switch (e.t) {
    case "fn": return (AGGS.has(e.name) && !e.over) || e.args.some(hasAgg);
    case "un": return hasAgg(e.a);
    case "bin": return hasAgg(e.a) || hasAgg(e.b);
    case "case": return (e.operand ? hasAgg(e.operand) : false) || e.whens.some((w) => hasAgg(w.w) || hasAgg(w.r)) || (e.else ? hasAgg(e.else) : false);
    case "between": return hasAgg(e.e) || hasAgg(e.lo) || hasAgg(e.hi);
    case "in": return hasAgg(e.e) || (e.list ?? []).some(hasAgg);
    case "like": return hasAgg(e.e) || hasAgg(e.p);
    case "isnull": return hasAgg(e.e);
    case "cast": return hasAgg(e.e);
    default: return false;
  }
}
function windows(e: Expr, out: Array<Extract<Expr, { t: "fn" }>> = []): Array<Extract<Expr, { t: "fn" }>> {
  switch (e.t) {
    case "fn": if (e.over) out.push(e); e.args.forEach((a) => windows(a, out)); break;
    case "un": windows(e.a, out); break;
    case "bin": windows(e.a, out); windows(e.b, out); break;
    case "case": if (e.operand) windows(e.operand, out); e.whens.forEach((w) => { windows(w.w, out); windows(w.r, out); }); if (e.else) windows(e.else, out); break;
    case "between": windows(e.e, out); windows(e.lo, out); windows(e.hi, out); break;
    case "in": windows(e.e, out); (e.list ?? []).forEach((x) => windows(x, out)); break;
    case "like": windows(e.e, out); windows(e.p, out); break;
    case "isnull": case "cast": windows(e.e, out); break;
    default: break;
  }
  return out;
}
const same = (a: Expr, b: Expr): boolean => JSON.stringify(a) === JSON.stringify(b);

class Runner {
  private ctes = new Map<string, Rel>();
  private budget = MAX_ROWS * 20;
  constructor(private db: SqlDb) {}

  private tick(n = 1): void { this.budget -= n; if (this.budget < 0) throw new SqlError("That query did too much work for the practice database.", "Add a WHERE condition or check that your JOIN has an ON condition."); }

  table(name: string): Rel {
    const c = this.ctes.get(lc(name));
    if (c) return c;
    const t = this.db.tables.find((x) => lc(x.name) === lc(name));
    if (!t) throw new SqlError(`There is no table called "${name}".`, `Tables you can use: ${[...this.ctes.keys(), ...this.db.tables.map((x) => x.name)].join(", ")}.`);
    return { cols: t.columns.map((n) => ({ t: t.name, n })), rows: t.rows };
  }

  run(q: Query, outer?: Scope): { cols: string[]; rows: SqlValue[][] } {
    const saved = new Map(this.ctes);
    for (const c of q.ctes) {
      const r = this.run(c.q, outer);
      const names = c.columns ?? r.cols;
      if (c.columns && c.columns.length !== r.cols.length) throw new SqlError(`The WITH query "${c.name}" lists ${c.columns.length} column names but returns ${r.cols.length} columns.`);
      this.ctes.set(lc(c.name), { cols: names.map((n) => ({ t: c.name, n })), rows: r.rows });
    }
    try {
      const body = this.body(q.body, q, outer);
      let rows = body.rows;
      if (q.order.length) rows = this.sortOutput(body, q.order);
      if (q.offset) rows = rows.slice(q.offset);
      if (q.limit !== undefined) rows = rows.slice(0, q.limit);
      return { cols: body.cols, rows };
    } finally { this.ctes = saved; }
  }

  private sortOutput(body: { cols: string[]; rows: SqlValue[][]; keys?: SqlValue[][] }, ord: OrderItem[]): SqlValue[][] {
    if (!body.keys) { // a set operation: ORDER BY may only name output columns or positions
      const idx = ord.map((o) => {
        if (o.e.t === "lit" && typeof o.e.v === "number") return o.e.v - 1;
        if (o.e.t === "col") { const i = body.cols.findIndex((c) => lc(c) === lc((o.e as { name: string }).name)); if (i >= 0) return i; }
        throw new SqlError("After UNION, ORDER BY can only use a column name from the result or its position, like ORDER BY 1.");
      });
      return [...body.rows].sort((a, b) => { for (let k = 0; k < idx.length; k++) { const c = order(a[idx[k]], b[idx[k]]); if (c) return ord[k].desc ? -c : c; } return 0; });
    }
    const keys = body.keys;
    const ixs = body.rows.map((_, i) => i);
    ixs.sort((a, b) => { for (let k = 0; k < ord.length; k++) { const c = order(keys[a][k], keys[b][k]); if (c) return ord[k].desc ? -c : c; } return a - b; });
    return ixs.map((i) => body.rows[i]);
  }

  private body(b: Body, q: Query, outer?: Scope): { cols: string[]; rows: SqlValue[][]; keys?: SqlValue[][] } {
    if (b.kind === "set") {
      const l = this.body(b.left, q, outer), r = this.body(b.right, q, outer);
      if (l.cols.length !== r.cols.length) throw new SqlError(`${b.op} needs both queries to return the same number of columns, but they return ${l.cols.length} and ${r.cols.length}.`);
      if (b.op === "INTERSECT" || b.op === "EXCEPT") {
        const rk = new Set(r.rows.map(rowKey)), seen = new Set<string>();
        const rows = l.rows.filter((x) => { const k = rowKey(x); if (seen.has(k) || rk.has(k) !== (b.op === "INTERSECT")) return false; seen.add(k); return true; });
        return { cols: l.cols, rows };
      }
      let rows = [...l.rows, ...r.rows];
      if (b.op === "UNION") { const seen = new Set<string>(); rows = rows.filter((x) => { const k = rowKey(x); if (seen.has(k)) return false; seen.add(k); return true; }); }
      return { cols: l.cols, rows };
    }
    return this.select(b, q, outer);
  }

  private fromRel(f: FromItem, outer?: Scope): Rel {
    if (f.sub) { const r = this.run(f.sub, outer); return { cols: r.cols.map((n) => ({ t: f.alias, n })), rows: r.rows }; }
    const r = this.table(f.table as string);
    return { cols: r.cols.map((c) => ({ t: f.alias, n: c.n })), rows: r.rows };
  }

  private select(s: Select, q: Query, outer?: Scope): { cols: string[]; rows: SqlValue[][]; keys: SqlValue[][] } {
    // 1. FROM and JOIN
    let rel: Rel = s.from ? this.fromRel(s.from, outer) : { cols: [], rows: [[]] };
    for (const j of s.joins) {
      const right = this.fromRel(j.item, outer);
      const cols = [...rel.cols, ...right.cols];
      const rows: SqlValue[][] = [];
      const nulls = (n: number): SqlValue[] => new Array<SqlValue>(n).fill(null);
      const matchedRight = new Set<number>();
      if (j.using) for (const u of j.using) if (!rel.cols.some((c) => lc(c.n) === lc(u))) throw new SqlError(`The column "${u}" in USING is not in the tables to the left.`);
      const joinOn: Expr | undefined = j.type === "CROSS" ? undefined : j.using ? this.usingExpr(rel, j.item.alias, j.using) : j.on;
      for (const lrow of rel.rows) {
        let any = false;
        for (let ri = 0; ri < right.rows.length; ri++) {
          this.tick();
          const vals = [...lrow, ...right.rows[ri]];
          const ok = !joinOn || truth(this.ev(joinOn, { cols, vals, outer })) === true;
          if (ok) { rows.push(vals); any = true; matchedRight.add(ri); }
          if (rows.length > MAX_ROWS) throw new SqlError("The join produced too many rows.", "Check that the ON condition links the tables.");
        }
        if (!any && (j.type === "LEFT" || j.type === "FULL")) rows.push([...lrow, ...nulls(right.cols.length)]);
      }
      if (j.type === "RIGHT" || j.type === "FULL") right.rows.forEach((rr, ri) => { if (!matchedRight.has(ri)) rows.push([...nulls(rel.cols.length), ...rr]); });
      rel = { cols, rows };
    }
    // 2. WHERE
    let rows = rel.rows;
    if (s.where) {
      if (hasAgg(s.where)) throw new SqlError("An aggregate function such as SUM or COUNT cannot be used in WHERE.", "WHERE filters rows before they are grouped. To filter on a total or a count, use HAVING after GROUP BY.");
      rows = rows.filter((vals) => { this.tick(); return truth(this.ev(s.where as Expr, { cols: rel.cols, vals, outer })) === true; });
    }
    // 3. expand * in the select list
    const items: Array<{ e: Expr; name: string; text: string }> = [];
    for (const it of s.items) {
      if (it.e.t === "star") {
        const tcols = rel.cols.filter((c) => !it.e || it.e.t !== "star" || !it.e.table || lc(c.t) === lc(it.e.table));
        if (it.e.t === "star" && it.e.table && !tcols.length) throw new SqlError(`There is no table called "${it.e.table}" in this query.`);
        for (const c of tcols) items.push({ e: { t: "col", table: c.t, name: c.n }, name: c.n, text: c.n });
      } else items.push({ e: it.e, name: it.alias ?? (it.e.t === "col" ? it.e.name : it.text), text: it.text });
    }
    // GROUP BY 1 and GROUP BY alias refer to the select list, as in MySQL and PostgreSQL
    const groupBy: Expr[] = s.groupBy.map((g) => {
      if (g.t === "lit" && typeof g.v === "number" && Number.isInteger(g.v)) {
        const it = items[g.v - 1];
        if (!it) throw new SqlError(`GROUP BY ${g.v} refers to column ${g.v} of the SELECT list, but there are only ${items.length}.`);
        if (hasAgg(it.e)) throw new SqlError(`GROUP BY ${g.v} points at an aggregate (${it.text}), which cannot be grouped on.`);
        return it.e;
      }
      if (g.t === "col" && !g.table && !rel.cols.some((c) => lc(c.n) === lc(g.name))) {
        const it = items.find((x) => lc(x.name) === lc(g.name));
        if (it && !hasAgg(it.e)) return it.e;
      }
      return g;
    });
    const grouped = groupBy.length > 0 || items.some((i) => hasAgg(i.e)) || (s.having !== undefined);
    // 4. build the "units" the select list is evaluated on (rows, or groups of rows)
    let units: Scope[];
    if (grouped) {
      const gmap = new Map<string, SqlValue[][]>();
      const keyOf = (vals: SqlValue[]) => groupBy.map((g) => key(this.ev(g, { cols: rel.cols, vals, outer }))).join("\u0001");
      for (const vals of rows) { const k = keyOf(vals); const g = gmap.get(k); if (g) g.push(vals); else gmap.set(k, [vals]); }
      if (!groupBy.length && !gmap.size) gmap.set("", []); // an aggregate over no rows still gives one row
      units = [...gmap.values()].map((g) => ({ cols: rel.cols, vals: g[0] ?? new Array<SqlValue>(rel.cols.length).fill(null), group: g, outer }));
      const checkGrouped = (e: Expr, where: string): void => {
        if (groupBy.some((g) => same(g, e))) return;
        switch (e.t) {
          case "col": {
            if (groupBy.some((g) => g.t === "col" && lc(g.name) === lc(e.name) && (!e.table || !g.table || lc(g.table) === lc(e.table)))) return;
            if (this.resolve(rel.cols, e.table, e.name, false) < 0) return; // a column from an outer query
            throw new SqlError(`The column "${e.name}" in ${where} must appear in GROUP BY or be used inside an aggregate function such as SUM or COUNT.`, `Either add ${e.name} to GROUP BY, or wrap it, for example MAX(${e.name}).`);
          }
          case "fn": if (AGGS.has(e.name) && !e.over) return; e.args.forEach((a) => checkGrouped(a, where)); return;
          case "un": checkGrouped(e.a, where); return;
          case "bin": checkGrouped(e.a, where); checkGrouped(e.b, where); return;
          case "case": if (e.operand) checkGrouped(e.operand, where); e.whens.forEach((w) => { checkGrouped(w.w, where); checkGrouped(w.r, where); }); if (e.else) checkGrouped(e.else, where); return;
          case "between": checkGrouped(e.e, where); checkGrouped(e.lo, where); checkGrouped(e.hi, where); return;
          case "in": checkGrouped(e.e, where); (e.list ?? []).forEach((x) => checkGrouped(x, where)); return;
          case "like": checkGrouped(e.e, where); checkGrouped(e.p, where); return;
          case "isnull": case "cast": checkGrouped(e.e, where); return;
          default: return;
        }
      };
      items.forEach((i) => checkGrouped(i.e, "the SELECT list"));
      if (s.having) checkGrouped(s.having, "HAVING");
      if (s.having) units = units.filter((u) => truth(this.ev(s.having as Expr, u)) === true);
    } else {
      units = rows.map((vals) => ({ cols: rel.cols, vals, outer }));
    }
    // 5. window functions
    const wins: Array<Extract<Expr, { t: "fn" }>> = [];
    items.forEach((i) => windows(i.e, wins));
    q.order.forEach((o) => windows(o.e, wins));
    if (wins.length) {
      const wv = new Map<object, SqlValue[]>();
      for (const w of wins) wv.set(w, this.window(w, units));
      units.forEach((u, idx) => { u.wv = wv; u.idx = idx; });
    }
    // 6. evaluate the select list, and the sort keys
    const outRows: SqlValue[][] = [];
    const keys: SqlValue[][] = [];
    for (const u of units) {
      this.tick();
      const out = items.map((i) => norm(this.ev(i.e, u)));
      outRows.push(out);
      keys.push(q.order.map((o) => {
        if (o.e.t === "lit" && typeof o.e.v === "number") { const k = o.e.v - 1; if (k < 0 || k >= out.length) throw new SqlError(`ORDER BY ${o.e.v} is outside the ${out.length} columns that are selected.`); return out[k]; }
        if (o.e.t === "col" && !o.e.table) { const k = items.findIndex((i) => lc(i.name) === lc((o.e as { name: string }).name)); if (k >= 0) return out[k]; }
        return norm(this.ev(o.e, u));
      }));
    }
    let finalRows = outRows, finalKeys = keys;
    if (s.distinct) {
      const seen = new Set<string>(); const r: SqlValue[][] = []; const kk: SqlValue[][] = [];
      outRows.forEach((row, i) => { const k = rowKey(row); if (!seen.has(k)) { seen.add(k); r.push(row); kk.push(keys[i]); } });
      finalRows = r; finalKeys = kk;
    }
    return { cols: items.map((i) => i.name), rows: finalRows, keys: finalKeys };
  }

  private usingExpr(left: Rel, rightAlias: string, using: string[]): Expr {
    return using.map((u) => {
      const lcol = left.cols.find((c) => lc(c.n) === lc(u)) as Col;
      return { t: "bin", op: "=", a: { t: "col", table: lcol.t, name: u }, b: { t: "col", table: rightAlias, name: u } } as Expr;
    }).reduce((a, b) => ({ t: "bin", op: "AND", a, b }));
  }

  /** The value of one window function for every unit, in unit order. */
  private window(fn: Extract<Expr, { t: "fn" }>, units: Scope[]): SqlValue[] {
    const w = fn.over as Window;
    const out = new Array<SqlValue>(units.length).fill(null);
    const parts = new Map<string, number[]>();
    units.forEach((u, i) => { const k = w.partition.map((p) => key(this.ev(p, u))).join("\u0001"); const a = parts.get(k); if (a) a.push(i); else parts.set(k, [i]); });
    const name = fn.name;
    if (!RANKERS.has(name) && !AGGS.has(name)) throw new SqlError(`"${name}" cannot be used with OVER.`, "Window functions available: ROW_NUMBER, RANK, DENSE_RANK, NTILE, LAG, LEAD, FIRST_VALUE, LAST_VALUE, and SUM, AVG, COUNT, MIN, MAX.");
    for (const idxs of parts.values()) {
      const ks = idxs.map((i) => w.order.map((o) => norm(this.ev(o.e, units[i]))));
      const pos = idxs.map((_, p) => p);
      pos.sort((a, b) => { for (let k = 0; k < w.order.length; k++) { const c = order(ks[a][k], ks[b][k]); if (c) return w.order[k].desc ? -c : c; } return a - b; });
      const sorted = pos.map((p) => idxs[p]);
      const sk = pos.map((p) => ks[p]);
      const peers = (a: number, b: number) => w.order.every((_, k) => order(sk[a][k], sk[b][k]) === 0);
      const n = sorted.length;
      const arg = (p: number): SqlValue => this.ev(fn.args[0], units[sorted[p]]);
      for (let p = 0; p < n; p++) {
        let v: SqlValue = null;
        if (name === "ROW_NUMBER") v = p + 1;
        else if (name === "RANK") { let f = p; while (f > 0 && peers(f - 1, p)) f--; v = f + 1; }
        else if (name === "DENSE_RANK") { let d = 1; for (let k = 1; k <= p; k++) if (!peers(k - 1, k)) d++; v = d; }
        else if (name === "NTILE") { const t = toNum(this.ev(fn.args[0], units[sorted[p]])) ?? 1; v = Math.floor((p * t) / n) + 1; }
        else if (name === "LAG" || name === "LEAD") {
          const off = fn.args[1] ? (toNum(this.ev(fn.args[1], units[sorted[p]])) ?? 1) : 1;
          const t = name === "LAG" ? p - off : p + off;
          v = t >= 0 && t < n ? arg(t) : (fn.args[2] ? this.ev(fn.args[2], units[sorted[p]]) : null);
        } else {
          let lo = 0, hi = n - 1;
          if (w.frame) {
            const fr = w.frame;
            const b = (fb: typeof fr.start, isStart: boolean): number => fb.kind === "unbounded" ? (isStart ? 0 : n - 1) : fb.kind === "current" ? p : (fb.dir === "preceding" ? p - fb.n : p + fb.n);
            lo = Math.max(0, b(fr.start, true)); hi = Math.min(n - 1, b(fr.end, false));
          } else if (w.order.length) { hi = p; while (hi + 1 < n && peers(hi + 1, p)) hi++; }
          if (name === "FIRST_VALUE") v = lo <= hi ? arg(lo) : null;
          else if (name === "LAST_VALUE") v = lo <= hi ? arg(hi) : null;
          else {
            const vals: SqlValue[] = [];
            for (let k = lo; k <= hi; k++) vals.push(fn.star ? 1 : arg(k));
            v = this.aggregate(name, vals, !!fn.distinct, !!fn.star);
          }
        }
        out[sorted[p]] = v;
      }
    }
    return out;
  }

  private aggregate(name: string, vals: SqlValue[], distinct: boolean, star: boolean): SqlValue {
    let xs = star ? vals : vals.filter((v) => v !== null);
    if (distinct) { const seen = new Set<string>(); xs = xs.filter((v) => { const k = key(v); if (seen.has(k)) return false; seen.add(k); return true; }); }
    if (name === "COUNT") return xs.length;
    if (!xs.length) return null;
    if (name === "MIN" || name === "MAX") return xs.reduce((a, b) => ((order(b, a) < 0) === (name === "MIN") ? b : a));
    const nums = xs.map((v) => toNum(v));
    if (nums.some((n) => n === null)) throw new SqlError(`${name} needs numbers, but some of the values are text.`, "Check that you are adding up a number column.");
    const sum = (nums as number[]).reduce((a, b) => a + b, 0);
    return name === "SUM" ? sum : sum / nums.length;
  }

  /** Index of a column in a relation, or -1 (or an error when ambiguous). */
  resolve(cols: Col[], table: string | undefined, name: string, strict = true): number {
    const m: number[] = [];
    cols.forEach((c, i) => { if (lc(c.n) === lc(name) && (!table || lc(c.t) === lc(table))) m.push(i); });
    if (m.length > 1 && strict) throw new SqlError(`The column "${name}" could belong to more than one table.`, `Write it with its table name, for example ${cols[m[0]].t}.${name}.`);
    return m.length ? m[0] : -1;
  }

  ev(e: Expr, sc: Scope): SqlValue {
    switch (e.t) {
      case "lit": return e.v;
      case "col": {
        for (let s: Scope | undefined = sc; s; s = s.outer) {
          const i = this.resolve(s.cols, e.table, e.name);
          if (i >= 0) return s.vals[i];
        }
        const avail = sc.cols.map((c) => c.n);
        throw new SqlError(`There is no column called "${e.table ? e.table + "." : ""}${e.name}".`, avail.length ? `Columns you can use here: ${[...new Set(avail)].join(", ")}.` : undefined);
      }
      case "star": throw new SqlError("* can only be used in the SELECT list or inside COUNT(*).");
      case "un": {
        const a = this.ev(e.a, sc);
        if (e.op === "NOT") { const t = truth(a); return t === null ? null : !t; }
        const x = toNum(a); return x === null ? null : -x;
      }
      case "bin": return this.bin(e, sc);
      case "case": {
        const op = e.operand ? this.ev(e.operand, sc) : undefined;
        for (const w of e.whens) {
          const hit = e.operand ? cmp(op as SqlValue, this.ev(w.w, sc)) === 0 : truth(this.ev(w.w, sc)) === true;
          if (hit) return this.ev(w.r, sc);
        }
        return e.else ? this.ev(e.else, sc) : null;
      }
      case "between": {
        const v = this.ev(e.e, sc), lo = this.ev(e.lo, sc), hi = this.ev(e.hi, sc);
        const a = cmp(v, lo), b = cmp(v, hi);
        if (a === null || b === null) return null;
        const r = a >= 0 && b <= 0;
        return e.not ? !r : r;
      }
      case "in": {
        const v = this.ev(e.e, sc);
        const list = e.q ? this.run(e.q, sc).rows.map((r) => r[0]) : (e.list ?? []).map((x) => this.ev(x, sc));
        if (v === null) return null;
        let unknown = false, found = false;
        for (const x of list) { const c = cmp(v, x); if (c === null) unknown = true; else if (c === 0) { found = true; break; } }
        if (found) return !e.not;
        return unknown ? null : e.not;
      }
      case "like": {
        const v = this.ev(e.e, sc), p = this.ev(e.p, sc);
        if (v === null || p === null) return null;
        const r = like(String(v), String(p));
        return e.not ? !r : r;
      }
      case "isnull": { const v = this.ev(e.e, sc); return e.not ? v !== null : v === null; }
      case "exists": { const r = this.run(e.q, sc); return e.not ? r.rows.length === 0 : r.rows.length > 0; }
      case "subq": {
        const r = this.run(e.q, sc);
        if (r.cols.length !== 1) throw new SqlError("A subquery used as a single value must return exactly one column.");
        if (r.rows.length > 1) throw new SqlError("A subquery used as a single value returned more than one row.", "Use IN instead of =, or add LIMIT 1, or aggregate it with MAX or MIN.");
        return r.rows[0]?.[0] ?? null;
      }
      case "cast": {
        const v = this.ev(e.e, sc);
        if (v === null) return null;
        if (["INT", "INTEGER", "BIGINT", "SMALLINT"].includes(e.to)) { const n = toNum(v); return n === null ? null : Math.trunc(n); }
        if (["REAL", "FLOAT", "DOUBLE", "DECIMAL", "NUMERIC"].includes(e.to)) return toNum(v);
        if (["TEXT", "VARCHAR", "CHAR", "STRING", "DATE"].includes(e.to)) return typeof v === "number" ? String(norm(v)) : String(v);
        throw new SqlError(`CAST to ${e.to} is not available here.`, "Use INTEGER, REAL, TEXT or DATE.");
      }
      case "fn": return this.fn(e, sc);
    }
  }

  private bin(e: Extract<Expr, { t: "bin" }>, sc: Scope): SqlValue {
    if (e.op === "AND" || e.op === "OR") {
      const a = truth(this.ev(e.a, sc)), b = truth(this.ev(e.b, sc));
      if (e.op === "AND") return a === false || b === false ? false : a === null || b === null ? null : true;
      return a === true || b === true ? true : a === null || b === null ? null : false;
    }
    const a = this.ev(e.a, sc), b = this.ev(e.b, sc);
    if (["=", "<>", "<", ">", "<=", ">="].includes(e.op)) {
      const c = cmp(a, b);
      if (c === null) return null;
      return e.op === "=" ? c === 0 : e.op === "<>" ? c !== 0 : e.op === "<" ? c < 0 : e.op === ">" ? c > 0 : e.op === "<=" ? c <= 0 : c >= 0;
    }
    if (e.op === "||") return a === null || b === null ? null : String(typeof a === "number" ? norm(a) : a) + String(typeof b === "number" ? norm(b) : b);
    const x = toNum(a), y = toNum(b);
    if (a === null || b === null) return null;
    if (x === null || y === null) throw new SqlError(`"${e.op}" needs numbers, but one side is text.`, "Check that you are doing arithmetic on number columns. Use || to join text.");
    switch (e.op) {
      case "+": return x + y;
      case "-": return x - y;
      case "*": return x * y;
      case "/": return y === 0 ? null : x / y;
      case "%": return y === 0 ? null : x % y;
      default: throw new SqlError(`The operator "${e.op}" is not supported.`);
    }
  }

  private fn(e: Extract<Expr, { t: "fn" }>, sc: Scope): SqlValue {
    if (e.over) { const v = sc.wv?.get(e); if (v === undefined || sc.idx === undefined) throw new SqlError("A window function (with OVER) can only be used in the SELECT list or ORDER BY."); return v[sc.idx]; }
    const name = e.name;
    if (AGGS.has(name)) {
      if (!sc.group) throw new SqlError(`${name}() is an aggregate function and cannot be used here.`, "Aggregate functions work on groups of rows: use them in SELECT or HAVING, with or without GROUP BY.");
      if (!e.star && e.args.length !== 1) throw new SqlError(`${name} needs exactly one value inside the brackets.`);
      if (e.star && name !== "COUNT") throw new SqlError(`Only COUNT can be written with *.`);
      const vals = e.star ? sc.group.map(() => 1 as SqlValue) : sc.group.map((vals) => this.ev(e.args[0], { cols: sc.cols, vals, outer: sc.outer }));
      return this.aggregate(name, vals, !!e.distinct, e.star === true);
    }
    const a = e.args.map((x) => this.ev(x, sc));
    const need = (min: number, max: number) => { if (a.length < min || a.length > max) throw new SqlError(`${name} needs ${min === max ? min : `${min} to ${max}`} value${max === 1 ? "" : "s"} inside the brackets, but has ${a.length}.`); };
    const s = (i: number): string | null => (a[i] === null ? null : String(typeof a[i] === "number" ? norm(a[i]) : a[i]));
    const n = (i: number): number | null => toNum(a[i]);
    switch (name) {
      case "ROUND": { need(1, 2); const x = n(0); if (x === null) return null; const d = a[1] === undefined ? 0 : (n(1) ?? 0); const f = Math.pow(10, Math.max(-6, Math.min(10, Math.trunc(d)))); return Math.round((x + Number.EPSILON * Math.sign(x)) * f) / f; }
      case "ABS": { need(1, 1); const x = n(0); return x === null ? null : Math.abs(x); }
      case "CEIL": case "CEILING": { need(1, 1); const x = n(0); return x === null ? null : Math.ceil(x); }
      case "FLOOR": { need(1, 1); const x = n(0); return x === null ? null : Math.floor(x); }
      case "SQRT": { need(1, 1); const x = n(0); return x === null || x < 0 ? null : Math.sqrt(x); }
      case "POWER": case "POW": { need(2, 2); const x = n(0), y = n(1); return x === null || y === null ? null : Math.pow(x, y); }
      case "MOD": { need(2, 2); const x = n(0), y = n(1); return x === null || y === null || y === 0 ? null : x % y; }
      case "UPPER": { need(1, 1); return s(0)?.toUpperCase() ?? null; }
      case "LOWER": { need(1, 1); return s(0)?.toLowerCase() ?? null; }
      case "LENGTH": case "LEN": { need(1, 1); return s(0)?.length ?? null; }
      case "TRIM": { need(1, 1); return s(0)?.trim() ?? null; }
      case "LTRIM": { need(1, 1); return s(0)?.replace(/^\s+/, "") ?? null; }
      case "RTRIM": { need(1, 1); return s(0)?.replace(/\s+$/, "") ?? null; }
      case "SUBSTR": case "SUBSTRING": { need(2, 3); const t = s(0), st = n(1); if (t === null || st === null) return null; const from = Math.max(0, Math.trunc(st) - 1); return a[2] === undefined ? t.slice(from) : t.slice(from, from + Math.max(0, Math.trunc(n(2) ?? 0))); }
      case "REPLACE": { need(3, 3); const t = s(0), f = s(1), r = s(2); return t === null || f === null || r === null || f === "" ? t : t.split(f).join(r); }
      case "CONCAT": { return a.some((x) => x === null) ? null : a.map((x) => String(typeof x === "number" ? norm(x) : x)).join(""); }
      case "COALESCE": { for (const x of a) if (x !== null) return x; return null; }
      case "IFNULL": { need(2, 2); return a[0] !== null ? a[0] : a[1]; }
      case "NULLIF": { need(2, 2); return cmp(a[0], a[1]) === 0 ? null : a[0]; }
      case "GREATEST": case "LEAST": { const xs = a.filter((x) => x !== null); if (xs.length < a.length) return null; return xs.reduce((p, q) => ((order(q, p) > 0) === (name === "GREATEST") ? q : p)); }
      case "YEAR": case "MONTH": case "DAY": {
        need(1, 1); const t = s(0); if (t === null) return null;
        const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
        if (!m) throw new SqlError(`${name} needs a date written as YYYY-MM-DD, but got "${t}".`);
        return name === "YEAR" ? +m[1] : name === "MONTH" ? +m[2] : +m[3];
      }
      case "DATEDIFF": {
        need(2, 2); const x = s(0), y = s(1); if (x === null || y === null) return null;
        const d = (t: string): number => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t); if (!m) throw new SqlError(`DATEDIFF needs dates written as YYYY-MM-DD, but got "${t}".`); return Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86_400_000; };
        return Math.round(d(x) - d(y));
      }
      case "LEFT": case "RIGHT": { need(2, 2); const t0 = s(0), k = n(1); if (t0 === null || k === null) return null; const m = Math.max(0, Math.trunc(k)); return name === "LEFT" ? t0.slice(0, m) : m === 0 ? "" : t0.slice(-m); }
      case "DATE_TRUNC": {
        need(2, 2); const unit = (s(0) ?? "").toLowerCase(), d0 = s(1); if (d0 === null) return null;
        const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d0);
        if (!m) throw new SqlError(`DATE_TRUNC needs a date written as YYYY-MM-DD, but got "${d0}".`);
        if (unit === "month") return `${m[1]}-${m[2]}-01`;
        if (unit === "year") return `${m[1]}-01-01`;
        if (unit === "quarter") return `${m[1]}-${String(Math.floor((+m[2] - 1) / 3) * 3 + 1).padStart(2, "0")}-01`;
        throw new SqlError(`DATE_TRUNC knows 'month', 'quarter' and 'year', not '${unit}'.`);
      }
      default: throw new SqlError(`"${name}" is not a function this practice database knows.`, "Try ROUND, UPPER, LOWER, LENGTH, SUBSTR, LEFT, COALESCE, NULLIF, YEAR, MONTH, DATE_TRUNC, DATEDIFF, or the aggregates SUM, AVG, COUNT, MIN, MAX.");
    }
  }
}

/** Run one query on a database. Never throws: every problem comes back as a plain explanation. */
export function runSql(db: SqlDb, query: string): SqlResult {
  try {
    const q = parseSql(query);
    const r = new Runner(db).run(q);
    const rows = r.rows;
    return { ok: true, columns: r.cols, rows: rows.slice(0, MAX_OUT).map((row) => row.map(norm)), truncated: rows.length > MAX_OUT };
  } catch (e) {
    if (e instanceof SqlError) return { ok: false, error: e.message, hint: e.hint };
    return { ok: false, error: "That query could not be run." };
  }
}

/** The full result (no row limit) for the checks, which compare every row. */
export function runSqlFull(db: SqlDb, query: string): SqlResult {
  try {
    const r = new Runner(db).run(parseSql(query));
    return { ok: true, columns: r.cols, rows: r.rows.map((row) => row.map(norm)), truncated: false };
  } catch (e) {
    return e instanceof SqlError ? { ok: false, error: e.message, hint: e.hint } : { ok: false, error: "That query could not be run." };
  }
}

export const SQL_KEYWORDS = ["SELECT", "FROM", "WHERE", "GROUP BY", "HAVING", "ORDER BY", "LIMIT", "JOIN", "LEFT JOIN", "INNER JOIN", "UNION", "INTERSECT", "EXCEPT", "WITH", "OVER", "PARTITION BY", "CASE", "DISTINCT"];
