/**
 * A small, safe spreadsheet formula language: tokenizer and recursive-descent parser. Formulas are parsed into a plain data tree and
 * evaluated by lib/learn/sheet/engine.ts. Nothing here (or anywhere in the sheet) uses eval, Function, or any other way to run
 * text as code: a formula can only ever be the operators, cell references and functions listed below.
 */
export const MAX_COLS = 26; // A..Z
export const MAX_ROWS = 100;
export const MAX_RANGE_CELLS = 2600;

export type Node =
  | { t: "num"; v: number }
  | { t: "str"; v: string }
  | { t: "bool"; v: boolean }
  | { t: "ref"; col: number; row: number }
  | { t: "range"; c1: number; r1: number; c2: number; r2: number }
  | { t: "un"; op: "-" | "+"; a: Node }
  | { t: "pct"; a: Node }
  | { t: "bin"; op: string; a: Node; b: Node }
  | { t: "fn"; name: string; args: Node[] }
  | { t: "err"; code: string };

export class FormulaError extends Error {
  constructor(public code: string, msg = code) {
    super(msg);
  }
}

export const colName = (c: number): string => String.fromCharCode(65 + c);
export const refName = (c: number, r: number): string => `${colName(c)}${r + 1}`;

/** "B12" -> { col: 1, row: 11 }, or null when it is not a valid in-grid reference. */
export function parseRef(s: string): { col: number; row: number } | null {
  const m = /^\$?([A-Z])\$?(\d{1,3})$/.exec(s.toUpperCase());
  if (!m) return null;
  const col = m[1].charCodeAt(0) - 65;
  const row = parseInt(m[2], 10) - 1;
  return col >= 0 && col < MAX_COLS && row >= 0 && row < MAX_ROWS ? { col, row } : null;
}

type Tok = { k: "num" | "str" | "id" | "op" | "lp" | "rp" | "comma" | "colon"; v: string };

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === " " || c === "\t") { i++; continue; }
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      if (/^[0-9]*\.?[0-9]*$/.test(src.slice(i, j)) && src.slice(i, j) !== ".") { out.push({ k: "num", v: src.slice(i, j) }); i = j; continue; }
      throw new FormulaError("#ERROR!", "That number does not look right.");
    }
    if (c === '"') {
      let j = i + 1;
      let s = "";
      while (j < src.length) {
        if (src[j] === '"') { if (src[j + 1] === '"') { s += '"'; j += 2; continue; } break; }
        s += src[j++];
      }
      if (j >= src.length) throw new FormulaError("#ERROR!", "A piece of text is missing its closing quote mark.");
      out.push({ k: "str", v: s });
      i = j + 1;
      continue;
    }
    if (/[A-Za-z$_]/.test(c)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9$_.]/.test(src[j])) j++;
      out.push({ k: "id", v: src.slice(i, j) });
      i = j;
      continue;
    }
    const two = src.slice(i, i + 2);
    if (two === "<>" || two === "<=" || two === ">=") { out.push({ k: "op", v: two }); i += 2; continue; }
    if ("+-*/^&=<>%".includes(c)) { out.push({ k: "op", v: c }); i++; continue; }
    if (c === "(") { out.push({ k: "lp", v: c }); i++; continue; }
    if (c === ")") { out.push({ k: "rp", v: c }); i++; continue; }
    if (c === ",") { out.push({ k: "comma", v: c }); i++; continue; }
    if (c === ":") { out.push({ k: "colon", v: c }); i++; continue; }
    throw new FormulaError("#ERROR!", `The character "${c}" cannot be used in a formula.`);
  }
  return out;
}

const MAX_DEPTH = 40;

/** Parse "=SUM(B2:B5)*2" (the leading = is optional) into a syntax tree. Throws FormulaError with a beginner-friendly message. */
export function parseFormula(input: string): Node {
  const src = input.startsWith("=") ? input.slice(1) : input;
  if (src.trim() === "") throw new FormulaError("#ERROR!", "The formula is empty.");
  if (src.length > 500) throw new FormulaError("#ERROR!", "That formula is too long.");
  const toks = tokenize(src);
  let p = 0;
  const peek = () => toks[p];
  const eat = () => toks[p++];

  const expr = (d: number): Node => {
    if (d > MAX_DEPTH) throw new FormulaError("#ERROR!", "That formula is nested too deeply.");
    return comparison(d + 1);
  };
  const comparison = (d: number): Node => {
    let a = concat(d);
    while (peek() && peek().k === "op" && ["=", "<>", "<", ">", "<=", ">="].includes(peek().v)) a = { t: "bin", op: eat().v, a, b: concat(d) };
    return a;
  };
  const concat = (d: number): Node => {
    let a = add(d);
    while (peek() && peek().k === "op" && peek().v === "&") { eat(); a = { t: "bin", op: "&", a, b: add(d) }; }
    return a;
  };
  const add = (d: number): Node => {
    let a = mul(d);
    while (peek() && peek().k === "op" && (peek().v === "+" || peek().v === "-")) a = { t: "bin", op: eat().v, a, b: mul(d) };
    return a;
  };
  const mul = (d: number): Node => {
    let a = pow(d);
    while (peek() && peek().k === "op" && (peek().v === "*" || peek().v === "/")) a = { t: "bin", op: eat().v, a, b: pow(d) };
    return a;
  };
  const pow = (d: number): Node => {
    const a = unary(d);
    if (peek() && peek().k === "op" && peek().v === "^") { eat(); return { t: "bin", op: "^", a, b: pow(d) }; }
    return a;
  };
  const unary = (d: number): Node => {
    if (peek() && peek().k === "op" && (peek().v === "-" || peek().v === "+")) return { t: "un", op: eat().v as "-" | "+", a: unary(d + 1) };
    return postfix(d);
  };
  const postfix = (d: number): Node => {
    let a = primary(d);
    while (peek() && peek().k === "op" && peek().v === "%") { eat(); a = { t: "pct", a }; }
    return a;
  };
  const primary = (d: number): Node => {
    const t = eat();
    if (!t) throw new FormulaError("#ERROR!", "The formula ends too early. Something is missing after the last symbol.");
    if (t.k === "num") return { t: "num", v: parseFloat(t.v) };
    if (t.k === "str") return { t: "str", v: t.v };
    if (t.k === "lp") {
      const e = expr(d);
      if (!peek() || peek().k !== "rp") throw new FormulaError("#ERROR!", "A bracket is not closed. Add a closing ) at the end.");
      eat();
      return e;
    }
    if (t.k === "id") {
      const up = t.v.toUpperCase();
      if (peek() && peek().k === "lp") {
        eat();
        const args: Node[] = [];
        if (peek() && peek().k === "rp") { eat(); return { t: "fn", name: up, args }; }
        for (;;) {
          args.push(expr(d));
          const n = eat();
          if (!n) throw new FormulaError("#ERROR!", `The ${up} function is missing its closing bracket.`);
          if (n.k === "rp") break;
          if (n.k !== "comma") throw new FormulaError("#ERROR!", `Inside ${up}( ) values must be separated by commas.`);
        }
        return { t: "fn", name: up, args };
      }
      if (up === "TRUE" || up === "FALSE") return { t: "bool", v: up === "TRUE" };
      const a = parseRef(up);
      if (!a) {
        if (/^\$?[A-Z]{1,3}\$?\d+$/.test(up)) throw new FormulaError("#REF!", `${up} is outside this sheet. The sheet runs from A1 to ${colName(MAX_COLS - 1)}${MAX_ROWS}.`);
        throw new FormulaError("#NAME?", `"${t.v}" is not a cell or a function GrowQR knows. Check the spelling.`);
      }
      if (peek() && peek().k === "colon") {
        eat();
        const e = eat();
        const b = e && e.k === "id" ? parseRef(e.v.toUpperCase()) : null;
        if (!b) throw new FormulaError("#REF!", "A range needs a cell on both sides of the colon, like B2:B5.");
        const c1 = Math.min(a.col, b.col), c2 = Math.max(a.col, b.col), r1 = Math.min(a.row, b.row), r2 = Math.max(a.row, b.row);
        if ((c2 - c1 + 1) * (r2 - r1 + 1) > MAX_RANGE_CELLS) throw new FormulaError("#REF!", "That range is too large.");
        return { t: "range", c1, r1, c2, r2 };
      }
      return { t: "ref", col: a.col, row: a.row };
    }
    throw new FormulaError("#ERROR!", `The formula does not make sense here: "${t.v}".`);
  };

  const tree = expr(0);
  if (p < toks.length) throw new FormulaError("#ERROR!", `There is something extra after the end of the formula: "${toks[p].v}".`);
  return tree;
}

/** Every cell a formula reads (ranges expanded), and every function it calls. Used for feedback such as "your range stops one row early". */
export function analyse(node: Node): { refs: Set<string>; fns: Set<string>; ranges: Array<{ c1: number; r1: number; c2: number; r2: number }> } {
  const refs = new Set<string>();
  const fns = new Set<string>();
  const ranges: Array<{ c1: number; r1: number; c2: number; r2: number }> = [];
  const walk = (n: Node) => {
    switch (n.t) {
      case "ref": refs.add(refName(n.col, n.row)); break;
      case "range":
        ranges.push({ c1: n.c1, r1: n.r1, c2: n.c2, r2: n.r2 });
        for (let c = n.c1; c <= n.c2; c++) for (let r = n.r1; r <= n.r2; r++) refs.add(refName(c, r));
        break;
      case "un": case "pct": walk(n.a); break;
      case "bin": walk(n.a); walk(n.b); break;
      case "fn": fns.add(n.name); n.args.forEach(walk); break;
      default: break;
    }
  };
  walk(node);
  return { refs, fns, ranges };
}
