/**
 * A parser for a practical subset of DAX (the formula language of Power BI): measure definitions made of numbers, text, TRUE/FALSE, column references like
 * Sales[Amount] or 'Sales Table'[Amount], measure references like [Total Sales], function calls, VAR ... RETURN, set literals { 1, 2 }, and the usual operators.
 * Pure functions, no eval and no dynamic code. Every problem is reported as a DaxError with a plain-language message.
 */
export class DaxError extends Error {
  constructor(message: string, public hint?: string) {
    super(message);
  }
}

export type Node =
  | { t: "num"; v: number }
  | { t: "str"; v: string }
  | { t: "bool"; v: boolean }
  | { t: "col"; table: string; name: string }
  | { t: "measure"; name: string }
  | { t: "table"; name: string }
  | { t: "call"; name: string; args: Node[] }
  | { t: "bin"; op: string; a: Node; b: Node }
  | { t: "neg"; a: Node }
  | { t: "not"; a: Node }
  | { t: "in"; a: Node; set: Node }
  | { t: "set"; items: Node[] }
  | { t: "let"; vars: Array<{ name: string; e: Node }>; ret: Node };

export interface Definition { name: string; source: string; expr: Node }

type Tok = { k: "num" | "str" | "id" | "qid" | "br" | "op" | "eof"; v: string; pos: number };

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === "/" && src[i + 1] === "/") { while (i < n && src[i] !== "\n") i++; continue; }
    if (c === "-" && src[i + 1] === "-") { while (i < n && src[i] !== "\n") i++; continue; }
    if (c === "/" && src[i + 1] === "*") { const e = src.indexOf("*/", i + 2); if (e < 0) throw new DaxError("A comment that starts with /* is never closed."); i = e + 2; continue; }
    if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(src[i + 1] ?? ""))) {
      let j = i;
      while (j < n && /[0-9]/.test(src[j])) j++;
      if (src[j] === ".") { j++; while (j < n && /[0-9]/.test(src[j])) j++; }
      out.push({ k: "num", v: src.slice(i, j), pos: i }); i = j; continue;
    }
    if (c === '"') {
      let j = i + 1, s = "";
      while (j < n) { if (src[j] === '"') { if (src[j + 1] === '"') { s += '"'; j += 2; continue; } break; } s += src[j++]; }
      if (j >= n) throw new DaxError("A text value that starts with a double quote is never closed.", 'Text in DAX goes in double quotes, like "North".');
      out.push({ k: "str", v: s, pos: i }); i = j + 1; continue;
    }
    if (c === "'") {
      const e = src.indexOf("'", i + 1);
      if (e < 0) throw new DaxError("A table name that starts with a single quote is never closed.");
      out.push({ k: "qid", v: src.slice(i + 1, e), pos: i }); i = e + 1; continue;
    }
    if (c === "[") {
      const e = src.indexOf("]", i + 1);
      if (e < 0) throw new DaxError("A column or measure name that starts with [ is never closed.", "Square brackets surround a column or measure name, like [Total Sales] or Sales[Amount].");
      out.push({ k: "br", v: src.slice(i + 1, e).trim(), pos: i }); i = e + 1; continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < n && /[A-Za-z0-9_.]/.test(src[j])) j++;
      out.push({ k: "id", v: src.slice(i, j), pos: i }); i = j; continue;
    }
    const two = src.slice(i, i + 2);
    if (["<>", "<=", ">=", "&&", "||"].includes(two)) { out.push({ k: "op", v: two, pos: i }); i += 2; continue; }
    if ("+-*/^=<>&(),{}".includes(c)) { out.push({ k: "op", v: c, pos: i }); i++; continue; }
    throw new DaxError(`The character "${c}" cannot be used in a DAX formula here.`);
  }
  out.push({ k: "eof", v: "", pos: n });
  return out;
}

const KEYWORDS = new Set(["VAR", "RETURN", "IN", "NOT"]);

class P {
  i = 0;
  constructor(public toks: Tok[], public src: string) {}
  get cur(): Tok { return this.toks[this.i]; }
  peek(d = 1): Tok { return this.toks[Math.min(this.i + d, this.toks.length - 1)]; }
  isOp(v: string, t: Tok = this.cur): boolean { return t.k === "op" && t.v === v; }
  isKw(v: string, t: Tok = this.cur): boolean { return t.k === "id" && t.v.toUpperCase() === v; }
  fail(msg: string, hint?: string): never { throw new DaxError(msg, hint); }
  expectOp(v: string): void { if (!this.isOp(v)) this.fail(v === ")" ? "A closing bracket ) is missing." : `Expected "${v}" here.`, v === ")" ? "Every ( needs a matching ). Check the function you were writing." : undefined); this.i++; }

  expr(): Node { return this.or(); }
  or(): Node { let a = this.and(); while (this.isOp("||")) { this.i++; a = { t: "bin", op: "||", a, b: this.and() }; } return a; }
  and(): Node { let a = this.cmp(); while (this.isOp("&&")) { this.i++; a = { t: "bin", op: "&&", a, b: this.cmp() }; } return a; }
  cmp(): Node {
    let a = this.concat();
    for (;;) {
      const t = this.cur;
      if (t.k === "op" && ["=", "<>", "<", "<=", ">", ">="].includes(t.v)) { this.i++; a = { t: "bin", op: t.v, a, b: this.concat() }; }
      else if (this.isKw("IN")) { this.i++; a = { t: "in", a, set: this.concat() }; }
      else return a;
    }
  }
  concat(): Node { let a = this.add(); while (this.isOp("&")) { this.i++; a = { t: "bin", op: "&", a, b: this.add() }; } return a; }
  add(): Node { let a = this.mul(); while (this.isOp("+") || this.isOp("-")) { const op = this.cur.v; this.i++; a = { t: "bin", op, a, b: this.mul() }; } return a; }
  mul(): Node { let a = this.pow(); while (this.isOp("*") || this.isOp("/")) { const op = this.cur.v; this.i++; a = { t: "bin", op, a, b: this.pow() }; } return a; }
  pow(): Node { const a = this.unary(); if (this.isOp("^")) { this.i++; return { t: "bin", op: "^", a, b: this.pow() }; } return a; }
  unary(): Node {
    if (this.isOp("-")) { this.i++; return { t: "neg", a: this.unary() }; }
    if (this.isOp("+")) { this.i++; return this.unary(); }
    return this.primary();
  }
  primary(): Node {
    const t = this.cur;
    if (t.k === "num") { this.i++; return { t: "num", v: parseFloat(t.v) }; }
    if (t.k === "str") { this.i++; return { t: "str", v: t.v }; }
    if (t.k === "br") { this.i++; return { t: "measure", name: t.v }; }
    if (t.k === "qid") {
      this.i++;
      if (this.cur.k !== "br") this.fail(`After the table name '${t.v}' write a column name in square brackets, like '${t.v}'[Column].`);
      const c = this.cur; this.i++;
      return { t: "col", table: t.v, name: c.v };
    }
    if (this.isOp("(")) { this.i++; const e = this.expr(); this.expectOp(")"); return e; }
    if (this.isOp("{")) {
      this.i++;
      const items: Node[] = [];
      if (!this.isOp("}")) do items.push(this.expr()); while (this.isOp(",") && (this.i++, true));
      if (!this.isOp("}")) this.fail("A closing brace } is missing at the end of the list of values.");
      this.i++;
      return { t: "set", items };
    }
    if (t.k === "id") {
      const up = t.v.toUpperCase();
      if (up === "VAR") return this.letExpr();
      if (up === "RETURN") this.fail("RETURN must come after at least one VAR, like VAR x = 5 RETURN x * 2.");
      if (up === "TRUE" && !this.isOp("(", this.peek())) { this.i++; return { t: "bool", v: true }; }
      if (up === "FALSE" && !this.isOp("(", this.peek())) { this.i++; return { t: "bool", v: false }; }
      if (up === "NOT") { this.i++; return { t: "not", a: this.unary() }; }
      if (this.isOp("(", this.peek())) return this.call();
      if (this.peek().k === "br") { this.i += 2; return { t: "col", table: t.v, name: this.toks[this.i - 1].v }; }
      if (KEYWORDS.has(up)) this.fail(`"${t.v}" cannot be used here.`);
      this.i++;
      return { t: "table", name: t.v };
    }
    if (t.k === "eof") this.fail("The formula stops too soon: a value is missing at the end.", "Check for an operator or a comma with nothing after it.");
    if (t.k === "op") this.fail(`Unexpected "${t.v}". A value, column or function was expected here.`);
    return this.fail("Unexpected input.");
  }
  call(): Node {
    const name = this.cur.v.toUpperCase();
    this.i += 2; // name and "("
    const args: Node[] = [];
    if (!this.isOp(")")) {
      for (;;) {
        if (this.isOp(",") || this.isOp(")")) { args.push({ t: "call", name: "BLANK", args: [] }); } else args.push(this.expr());
        if (this.isOp(",")) { this.i++; continue; }
        break;
      }
    }
    this.expectOp(")");
    return { t: "call", name, args };
  }
  letExpr(): Node {
    const vars: Array<{ name: string; e: Node }> = [];
    while (this.isKw("VAR")) {
      this.i++;
      const nm = this.cur;
      if (nm.k !== "id") this.fail("VAR must be followed by a name, like VAR total = SUM(Sales[Amount]).");
      this.i++;
      if (!this.isOp("=")) this.fail(`VAR ${nm.v} needs an equals sign and a value.`);
      this.i++;
      vars.push({ name: nm.v, e: this.expr() });
    }
    if (!this.isKw("RETURN")) this.fail("A VAR must be followed by RETURN and the result.", "For example: VAR total = SUM(Sales[Amount]) RETURN total * 2");
    this.i++;
    return { t: "let", vars, ret: this.expr() };
  }
}

export function parseExpr(src: string): Node {
  const toks = tokenize(src);
  if (toks.length === 1) throw new DaxError("The formula is empty.");
  const p = new P(toks, src);
  const e = p.expr();
  if (p.cur.k !== "eof") p.fail("Something extra was found after the end of the formula.", "Check for a missing comma or operator between two values.");
  return e;
}

/**
 * A DAX code window holds one or more measure definitions. A definition starts at the beginning of a line with `Name = formula`; lines that are
 * indented, or blank, continue the formula above. Returns the definitions in order.
 */
export function parseDefinitions(code: string): Definition[] {
  const lines = code.replace(/\r\n/g, "\n").split("\n");
  const out: Definition[] = [];
  let cur: { name: string; lines: string[] } | null = null;
  const head = /^([A-Za-z_][A-Za-z0-9_ %.]*?)\s*:?=\s*(.*)$/;
  for (const raw of lines) {
    const trimmed = raw.trim();
    if (trimmed === "" || trimmed.startsWith("//") || trimmed.startsWith("--")) { if (cur) cur.lines.push(raw); continue; }
    const startsFresh = !/^\s/.test(raw);
    const m = startsFresh ? head.exec(raw) : null;
    if (m && !/^(VAR|RETURN)\b/i.test(raw)) { if (cur) out.push(finish(cur)); cur = { name: m[1].trim(), lines: [m[2]] }; continue; }
    if (!cur) throw new DaxError("A measure starts with its name and an equals sign, like Total Sales = SUM(Sales[Amount]).", `The line "${trimmed.slice(0, 40)}" does not start a measure.`);
    cur.lines.push(raw);
  }
  if (cur) out.push(finish(cur));
  return out;
}
function finish(c: { name: string; lines: string[] }): Definition {
  const source = c.lines.join("\n").trim();
  if (!source) throw new DaxError(`The measure "${c.name}" has no formula after the equals sign.`);
  try { return { name: c.name, source, expr: parseExpr(source) }; }
  catch (e) { if (e instanceof DaxError) throw new DaxError(`In the measure "${c.name}": ${e.message}`, e.hint); throw e; }
}
