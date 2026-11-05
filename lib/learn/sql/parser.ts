/**
 * A small, safe SQL reader for the learning labs. It turns the text of one SELECT statement (with WITH, joins, grouping, window functions, set operations and
 * subqueries) into a plain data tree; lib/learn/sql/engine.ts runs the tree on a tiny in-memory database. Nothing here evaluates text as code, and only
 * reading statements exist: there is no INSERT, UPDATE, DELETE or DDL to reach for.
 */
export class SqlError extends Error {
  constructor(message: string, public hint?: string) { super(message); }
}

export type Lit = number | string | boolean | null;
export type Expr =
  | { t: "lit"; v: Lit }
  | { t: "col"; table?: string; name: string }
  | { t: "star"; table?: string }
  | { t: "un"; op: "-" | "+" | "NOT"; a: Expr }
  | { t: "bin"; op: string; a: Expr; b: Expr }
  | { t: "fn"; name: string; args: Expr[]; distinct?: boolean; star?: boolean; over?: Window }
  | { t: "case"; operand?: Expr; whens: Array<{ w: Expr; r: Expr }>; else?: Expr }
  | { t: "between"; e: Expr; lo: Expr; hi: Expr; not: boolean }
  | { t: "in"; e: Expr; list?: Expr[]; q?: Query; not: boolean }
  | { t: "like"; e: Expr; p: Expr; not: boolean }
  | { t: "isnull"; e: Expr; not: boolean }
  | { t: "exists"; q: Query; not: boolean }
  | { t: "subq"; q: Query }
  | { t: "cast"; e: Expr; to: string };

export interface OrderItem { e: Expr; desc: boolean }
export interface FrameBound { kind: "unbounded" | "current" | "offset"; n: number; dir: "preceding" | "following" }
export interface Window { partition: Expr[]; order: OrderItem[]; frame?: { start: FrameBound; end: FrameBound } }
export interface SelectItem { e: Expr; alias?: string; text: string }
export interface FromItem { table?: string; sub?: Query; alias: string }
export interface Join { type: "INNER" | "LEFT" | "RIGHT" | "FULL" | "CROSS"; item: FromItem; on?: Expr; using?: string[] }
export interface Select {
  kind: "select"; distinct: boolean; items: SelectItem[]; from?: FromItem; joins: Join[]; where?: Expr; groupBy: Expr[]; having?: Expr;
}
export interface SetOp { kind: "set"; op: "UNION" | "UNION ALL" | "INTERSECT" | "EXCEPT"; left: Body; right: Body }
export type Body = Select | SetOp;
export interface Query { ctes: Array<{ name: string; columns?: string[]; q: Query }>; body: Body; order: OrderItem[]; limit?: number; offset?: number }

/* ------------------------------------------------------------------------------------------------ tokens */
type Tok = { k: "num" | "str" | "id" | "qid" | "op" | "eof"; v: string; pos: number; end: number };
const MAX_LEN = 6000;

function tokenize(src: string): Tok[] {
  if (src.length > MAX_LEN) throw new SqlError(`That query is too long (the limit is ${MAX_LEN} characters).`);
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === "-" && src[i + 1] === "-") { while (i < src.length && src[i] !== "\n") i++; continue; }
    if (c === "/" && src[i + 1] === "*") { const e = src.indexOf("*/", i + 2); if (e < 0) throw new SqlError("A comment that starts with /* is never closed with */."); i = e + 2; continue; }
    const start = i;
    if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(src[i + 1] ?? ""))) {
      while (i < src.length && /[0-9.]/.test(src[i])) i++;
      if (/e/i.test(src[i] ?? "") && /[0-9+-]/.test(src[i + 1] ?? "")) { i += 2; while (i < src.length && /[0-9]/.test(src[i])) i++; }
      const v = src.slice(start, i);
      if (!/^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(v)) throw new SqlError(`"${v}" is not a number.`);
      out.push({ k: "num", v, pos: start, end: i }); continue;
    }
    if (/[A-Za-z_]/.test(c)) { while (i < src.length && /[A-Za-z0-9_]/.test(src[i])) i++; out.push({ k: "id", v: src.slice(start, i), pos: start, end: i }); continue; }
    if (c === "'") {
      i++; let s = "";
      for (;;) {
        if (i >= src.length) throw new SqlError("A piece of text that starts with ' is never closed.", "Text values go between single quotes, like 'Pune'.");
        if (src[i] === "'") { if (src[i + 1] === "'") { s += "'"; i += 2; continue; } i++; break; }
        s += src[i++];
      }
      out.push({ k: "str", v: s, pos: start, end: i }); continue;
    }
    if (c === '"' || c === "`") {
      const q = c; i++; let s = "";
      while (i < src.length && src[i] !== q) s += src[i++];
      if (i >= src.length) throw new SqlError("A name that starts with a quote mark is never closed.");
      i++; out.push({ k: "qid", v: s, pos: start, end: i }); continue;
    }
    const two = src.slice(i, i + 2);
    if (["<>", "!=", "<=", ">=", "||"].includes(two)) { out.push({ k: "op", v: two === "!=" ? "<>" : two, pos: start, end: i + 2 }); i += 2; continue; }
    if ("=<>+-*/%(),.;".includes(c)) { out.push({ k: "op", v: c, pos: start, end: i + 1 }); i++; continue; }
    throw new SqlError(`The character "${c}" cannot be used here.`);
  }
  out.push({ k: "eof", v: "", pos: src.length, end: src.length });
  return out;
}

const RESERVED = new Set(["SELECT", "FROM", "WHERE", "GROUP", "BY", "HAVING", "ORDER", "LIMIT", "OFFSET", "JOIN", "INNER", "LEFT", "RIGHT", "FULL", "OUTER", "CROSS", "ON", "USING", "UNION", "ALL", "AS", "AND", "OR", "NOT", "IN", "IS", "NULL", "LIKE", "BETWEEN", "CASE", "WHEN", "THEN", "ELSE", "END", "DISTINCT", "OVER", "PARTITION", "WITH", "INTERSECT", "EXCEPT", "EXISTS", "ASC", "DESC", "ROWS", "TRUE", "FALSE", "ILIKE"]);

/* ------------------------------------------------------------------------------------------------ parser */
class P {
  i = 0;
  depth = 0;
  constructor(public toks: Tok[], public src: string) {}
  get cur(): Tok { return this.toks[this.i]; }
  peek(n = 1): Tok { return this.toks[Math.min(this.i + n, this.toks.length - 1)]; }
  isKw(w: string, t: Tok = this.cur): boolean { return t.k === "id" && t.v.toUpperCase() === w; }
  isOp(o: string, t: Tok = this.cur): boolean { return t.k === "op" && t.v === o; }
  eatKw(w: string): boolean { if (this.isKw(w)) { this.i++; return true; } return false; }
  eatOp(o: string): boolean { if (this.isOp(o)) { this.i++; return true; } return false; }
  near(): string { const t = this.cur; return t.k === "eof" ? "the end of the query" : `"${this.src.slice(t.pos, t.end)}"`; }
  fail(msg: string, hint?: string): never { throw new SqlError(`${msg} (near ${this.near()}).`, hint); }
  expectKw(w: string, hint?: string): void { if (!this.eatKw(w)) this.fail(`Expected ${w}`, hint); }
  expectOp(o: string, hint?: string): void { if (!this.eatOp(o)) this.fail(`Expected "${o}"`, hint); }
  enter(): void { if (++this.depth > 40) throw new SqlError("That query is nested too deeply."); }
  leave(): void { this.depth--; }

  name(): string {
    const t = this.cur;
    if (t.k === "qid") { this.i++; return t.v; }
    if (t.k === "id" && !RESERVED.has(t.v.toUpperCase())) { this.i++; return t.v; }
    this.fail("Expected a name", t.k === "id" ? `"${t.v}" is a SQL keyword, so it cannot be used as a name. Put it in double quotes to use it anyway.` : undefined);
  }

  query(): Query {
    this.enter();
    const ctes: Query["ctes"] = [];
    if (this.eatKw("WITH")) {
      do {
        const name = this.name();
        let columns: string[] | undefined;
        if (this.eatOp("(")) { columns = []; do columns.push(this.name()); while (this.eatOp(",")); this.expectOp(")"); }
        this.expectKw("AS");
        this.expectOp("(");
        const q = this.query();
        this.expectOp(")");
        ctes.push({ name, columns, q });
      } while (this.eatOp(","));
    }
    let body: Body = this.selectCore();
    while (this.isKw("UNION") || this.isKw("INTERSECT") || this.isKw("EXCEPT")) {
      const word = (this.cur as { v: string }).v.toUpperCase();
      this.i++;
      const all = word === "UNION" && this.eatKw("ALL");
      body = { kind: "set", op: word === "UNION" ? (all ? "UNION ALL" : "UNION") : (word as "INTERSECT" | "EXCEPT"), left: body, right: this.selectCore() };
    }
    const order: OrderItem[] = [];
    if (this.eatKw("ORDER")) { this.expectKw("BY"); do order.push(this.orderItem()); while (this.eatOp(",")); }
    let limit: number | undefined, offset: number | undefined;
    if (this.eatKw("LIMIT")) { limit = this.intLit("LIMIT"); if (this.eatKw("OFFSET")) offset = this.intLit("OFFSET"); else if (this.eatOp(",")) { offset = limit; limit = this.intLit("LIMIT"); } }
    else if (this.eatKw("OFFSET")) offset = this.intLit("OFFSET");
    this.leave();
    return { ctes, body, order, limit, offset };
  }

  intLit(what: string): number {
    const t = this.cur;
    if (t.k !== "num" || !/^\d+$/.test(t.v)) this.fail(`${what} needs a whole number`);
    this.i++;
    return parseInt(t.v, 10);
  }

  orderItem(): OrderItem {
    const e = this.expr();
    let desc = false;
    if (this.eatKw("DESC")) desc = true; else this.eatKw("ASC");
    return { e, desc };
  }

  selectCore(): Select {
    if (this.isOp("(")) { // a parenthesised select in a set operation
      this.i++; const q = this.query(); this.expectOp(")");
      if (q.ctes.length || q.order.length || q.limit !== undefined) throw new SqlError("A bracketed query used with UNION cannot have its own WITH, ORDER BY or LIMIT here.");
      return q.body as Select;
    }
    if (!this.isKw("SELECT")) this.fail("A query must start with SELECT (or WITH)", this.isKw("FROM") ? "Start with SELECT and the columns you want, then FROM the table." : undefined);
    this.i++;
    const distinct = this.eatKw("DISTINCT");
    if (!distinct) this.eatKw("ALL");
    const items: SelectItem[] = [];
    do {
      const start = this.cur.pos;
      let e: Expr;
      if (this.isOp("*")) { this.i++; e = { t: "star" }; }
      else if ((this.cur.k === "id" || this.cur.k === "qid") && this.isOp(".", this.peek()) && this.isOp("*", this.peek(2))) { const table = this.cur.v; this.i += 3; e = { t: "star", table }; }
      else e = this.expr();
      const text = this.src.slice(start, this.toks[this.i - 1].end).trim();
      let alias: string | undefined;
      if (this.eatKw("AS")) alias = this.name();
      else if ((this.cur.k === "id" && !RESERVED.has(this.cur.v.toUpperCase())) || this.cur.k === "qid") alias = this.name();
      items.push({ e, alias, text });
    } while (this.eatOp(","));
    const s: Select = { kind: "select", distinct, items, joins: [], groupBy: [] };
    if (this.eatKw("FROM")) {
      s.from = this.fromItem();
      for (;;) {
        if (this.eatOp(",")) { s.joins.push({ type: "CROSS", item: this.fromItem() }); continue; }
        let type: Join["type"] | null = null;
        if (this.eatKw("INNER")) type = "INNER";
        else if (this.eatKw("LEFT")) { this.eatKw("OUTER"); type = "LEFT"; }
        else if (this.eatKw("RIGHT")) { this.eatKw("OUTER"); type = "RIGHT"; }
        else if (this.eatKw("FULL")) { this.eatKw("OUTER"); type = "FULL"; }
        else if (this.eatKw("CROSS")) type = "CROSS";
        if (type !== null || this.isKw("JOIN")) {
          this.expectKw("JOIN");
          const item = this.fromItem();
          const j: Join = { type: type ?? "INNER", item };
          if (j.type !== "CROSS") {
            if (this.eatKw("ON")) j.on = this.expr();
            else if (this.eatKw("USING")) { this.expectOp("("); j.using = []; do j.using.push(this.name()); while (this.eatOp(",")); this.expectOp(")"); }
            else this.fail("A JOIN needs ON or USING", "For example: JOIN customers c ON c.id = o.customer_id");
          }
          s.joins.push(j);
          continue;
        }
        break;
      }
    }
    if (this.eatKw("WHERE")) s.where = this.expr();
    if (this.eatKw("GROUP")) { this.expectKw("BY"); do s.groupBy.push(this.expr()); while (this.eatOp(",")); }
    if (this.eatKw("HAVING")) s.having = this.expr();
    return s;
  }

  fromItem(): FromItem {
    if (this.eatOp("(")) {
      const sub = this.query();
      this.expectOp(")");
      this.eatKw("AS");
      return { sub, alias: this.name() };
    }
    const table = this.name();
    let alias = table;
    if (this.eatKw("AS")) alias = this.name();
    else if ((this.cur.k === "id" && !RESERVED.has(this.cur.v.toUpperCase())) || this.cur.k === "qid") alias = this.name();
    return { table, alias };
  }

  /* expressions, lowest precedence first */
  expr(): Expr { this.enter(); const e = this.or(); this.leave(); return e; }
  or(): Expr { let a = this.and(); while (this.eatKw("OR")) a = { t: "bin", op: "OR", a, b: this.and() }; return a; }
  and(): Expr { let a = this.not(); while (this.eatKw("AND")) a = { t: "bin", op: "AND", a, b: this.not() }; return a; }
  not(): Expr { if (this.isKw("NOT") && !this.isKw("EXISTS", this.peek())) { this.i++; return { t: "un", op: "NOT", a: this.not() }; } return this.cmp(); }
  cmp(): Expr {
    const a = this.add();
    for (;;) {
      const t = this.cur;
      if (t.k === "op" && ["=", "<>", "<", ">", "<=", ">="].includes(t.v)) { this.i++; return { t: "bin", op: t.v, a, b: this.add() }; }
      if (this.isKw("IS")) {
        this.i++;
        const not = this.eatKw("NOT");
        if (!this.eatKw("NULL")) this.fail("After IS comes NULL or NOT NULL", "To test for missing values write: column IS NULL.");
        return { t: "isnull", e: a, not };
      }
      let not = false;
      if (this.isKw("NOT") && (this.isKw("IN", this.peek()) || this.isKw("LIKE", this.peek()) || this.isKw("BETWEEN", this.peek()) || this.isKw("ILIKE", this.peek()))) { this.i++; not = true; }
      if (this.eatKw("IN")) {
        this.expectOp("(");
        if (this.isKw("SELECT") || this.isKw("WITH")) { const q = this.query(); this.expectOp(")"); return { t: "in", e: a, q, not }; }
        const list: Expr[] = [];
        do list.push(this.expr()); while (this.eatOp(","));
        this.expectOp(")");
        return { t: "in", e: a, list, not };
      }
      if (this.eatKw("BETWEEN")) { const lo = this.add(); this.expectKw("AND"); const hi = this.add(); return { t: "between", e: a, lo, hi, not }; }
      if (this.eatKw("LIKE") || this.eatKw("ILIKE")) return { t: "like", e: a, p: this.add(), not };
      return a;
    }
  }
  add(): Expr {
    let a = this.mul();
    for (;;) {
      const t = this.cur;
      if (t.k === "op" && (t.v === "+" || t.v === "-" || t.v === "||")) { this.i++; a = { t: "bin", op: t.v, a, b: this.mul() }; } else return a;
    }
  }
  mul(): Expr {
    let a = this.unary();
    for (;;) {
      const t = this.cur;
      if (t.k === "op" && (t.v === "*" || t.v === "/" || t.v === "%")) { this.i++; a = { t: "bin", op: t.v, a, b: this.unary() }; } else return a;
    }
  }
  unary(): Expr {
    if (this.eatOp("-")) return { t: "un", op: "-", a: this.unary() };
    if (this.eatOp("+")) return this.unary();
    return this.primary();
  }

  primary(): Expr {
    const t = this.cur;
    if (t.k === "num") { this.i++; return { t: "lit", v: parseFloat(t.v) }; }
    if (t.k === "str") { this.i++; return { t: "lit", v: t.v }; }
    if (this.isOp("(")) {
      this.i++;
      if (this.isKw("SELECT") || this.isKw("WITH")) { const q = this.query(); this.expectOp(")"); return { t: "subq", q }; }
      const e = this.expr();
      this.expectOp(")");
      return e;
    }
    if (t.k === "id") {
      const up = t.v.toUpperCase();
      if (up === "NULL") { this.i++; return { t: "lit", v: null }; }
      if (up === "TRUE") { this.i++; return { t: "lit", v: true }; }
      if (up === "FALSE") { this.i++; return { t: "lit", v: false }; }
      if (up === "CASE") return this.caseExpr();
      if (up === "EXISTS" || (up === "NOT" && this.isKw("EXISTS", this.peek()))) {
        const not = up === "NOT"; this.i += not ? 2 : 1;
        this.expectOp("("); const q = this.query(); this.expectOp(")");
        return { t: "exists", q, not };
      }
      if (up === "CAST" && this.isOp("(", this.peek())) {
        this.i += 2; const e = this.expr(); this.expectKw("AS");
        const to = this.name().toUpperCase();
        if (this.eatOp("(")) { while (!this.isOp(")") && this.cur.k !== "eof") this.i++; this.expectOp(")"); }
        this.expectOp(")");
        return { t: "cast", e, to };
      }
      if (this.isOp("(", this.peek()) && (!RESERVED.has(up) || up === "LEFT" || up === "RIGHT")) return this.call();
    }
    if (t.k === "id" || t.k === "qid") {
      if (t.k === "id" && RESERVED.has(t.v.toUpperCase())) this.fail("This word cannot be used here", `${t.v.toUpperCase()} is a SQL keyword. Check the order of the clauses: SELECT, FROM, WHERE, GROUP BY, HAVING, ORDER BY, LIMIT.`);
      this.i++;
      if (this.isOp(".") && (this.peek().k === "id" || this.peek().k === "qid")) { this.i++; const name = this.name(); return { t: "col", table: t.v, name }; }
      return { t: "col", name: t.v };
    }
    this.fail("Expected a value, a column or a function");
  }

  caseExpr(): Expr {
    this.i++;
    let operand: Expr | undefined;
    if (!this.isKw("WHEN")) operand = this.expr();
    const whens: Array<{ w: Expr; r: Expr }> = [];
    while (this.eatKw("WHEN")) { const w = this.expr(); this.expectKw("THEN"); whens.push({ w, r: this.expr() }); }
    if (!whens.length) this.fail("CASE needs at least one WHEN ... THEN ...");
    let els: Expr | undefined;
    if (this.eatKw("ELSE")) els = this.expr();
    this.expectKw("END", "A CASE expression must finish with END.");
    return { t: "case", operand, whens, else: els };
  }

  call(): Expr {
    const name = this.cur.v.toUpperCase();
    this.i += 2;
    const fn: Extract<Expr, { t: "fn" }> = { t: "fn", name, args: [] };
    if (this.isOp("*")) { this.i++; fn.star = true; }
    else if (!this.isOp(")")) {
      if (this.eatKw("DISTINCT")) fn.distinct = true;
      do fn.args.push(this.expr()); while (this.eatOp(","));
    }
    this.expectOp(")");
    if (this.eatKw("OVER")) fn.over = this.window();
    return fn;
  }

  window(): Window {
    this.expectOp("(");
    const w: Window = { partition: [], order: [] };
    if (this.eatKw("PARTITION")) { this.expectKw("BY"); do w.partition.push(this.expr()); while (this.eatOp(",")); }
    if (this.eatKw("ORDER")) { this.expectKw("BY"); do w.order.push(this.orderItem()); while (this.eatOp(",")); }
    if (this.eatKw("ROWS")) {
      this.expectKw("BETWEEN");
      const start = this.bound();
      this.expectKw("AND");
      const end = this.bound();
      w.frame = { start, end };
    }
    this.expectOp(")");
    return w;
  }

  bound(): FrameBound {
    if (this.eatKw("UNBOUNDED")) { const dir = this.eatKw("PRECEDING") ? "preceding" : (this.expectKw("FOLLOWING"), "following"); return { kind: "unbounded", n: 0, dir }; }
    if (this.eatKw("CURRENT")) { this.expectKw("ROW"); return { kind: "current", n: 0, dir: "preceding" }; }
    const n = this.intLit("a window frame");
    const dir = this.eatKw("PRECEDING") ? "preceding" : (this.expectKw("FOLLOWING"), "following");
    return { kind: "offset", n, dir };
  }
}

export function parseSql(src: string): Query {
  const toks = tokenize(src);
  if (toks.length === 1) throw new SqlError("Type a query first, for example SELECT * FROM customers;");
  const p = new P(toks, src);
  const q = p.query();
  p.eatOp(";");
  if (p.cur.k !== "eof") {
    const w = p.cur.k === "id" ? p.cur.v.toUpperCase() : "";
    p.fail("The query should have ended before this", w === "FORM" || /\bform\b/i.test(src) ? "Did you mean FROM? (FORM is a typo.)" : p.isOp(",") ? "A comma is only used between columns or tables." : "Check the order of the clauses and for a missing comma.");
  }
  return q;
}
