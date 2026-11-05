/**
 * A tiny, safe expression evaluator for the course "explorer" widgets (sliders that drive formulas).
 * Grammar: numbers, names (looked up in a scope), + - * / ^, unary minus, brackets, and the functions min, max, abs, round, sqrt, pow, log2, ln, log10, ceil, floor.
 * It never uses eval, Function or any dynamic code: the text is parsed into a tree and walked. Length and depth are capped.
 */
export type Scope = Record<string, number>;

type Node =
  | { t: "num"; v: number }
  | { t: "var"; n: string }
  | { t: "neg"; a: Node }
  | { t: "bin"; op: "+" | "-" | "*" | "/" | "^"; a: Node; b: Node }
  | { t: "call"; f: string; args: Node[] };

const MAX_LEN = 240;
const MAX_DEPTH = 40;
const FUNCS: Record<string, (...a: number[]) => number> = {
  min: Math.min, max: Math.max, abs: Math.abs, sqrt: Math.sqrt, pow: Math.pow, log2: Math.log2, ln: Math.log, log10: Math.log10, ceil: Math.ceil, floor: Math.floor,
  round: (x, d = 0) => { const k = 10 ** Math.max(0, Math.min(6, Math.trunc(d))); return Math.round(x * k) / k; },
};

export class ExprError extends Error {}

function tokenize(src: string): string[] {
  const out: string[] = [];
  const re = /\s*(\d+(?:\.\d+)?|[A-Za-z_][A-Za-z0-9_]*|[-+*/^(),])/y;
  let i = 0;
  while (i < src.length) {
    if (/\s/.test(src[i])) { i++; continue; }
    re.lastIndex = i;
    const m = re.exec(src);
    if (!m) throw new ExprError(`Unexpected character "${src[i]}"`);
    out.push(m[1]);
    i = re.lastIndex;
  }
  return out;
}

export function parse(src: string): Node {
  if (typeof src !== "string" || src.length === 0 || src.length > MAX_LEN) throw new ExprError("Expression is empty or too long");
  const toks = tokenize(src);
  let p = 0;
  const peek = () => toks[p];
  const eat = (x?: string) => { const t = toks[p]; if (x !== undefined && t !== x) throw new ExprError(`Expected "${x}"`); p++; return t; };
  function expr(d: number): Node {
    if (d > MAX_DEPTH) throw new ExprError("Expression is nested too deeply");
    let a = term(d + 1);
    while (peek() === "+" || peek() === "-") { const op = eat() as "+" | "-"; a = { t: "bin", op, a, b: term(d + 1) }; }
    return a;
  }
  function term(d: number): Node {
    let a = unary(d + 1);
    while (peek() === "*" || peek() === "/") { const op = eat() as "*" | "/"; a = { t: "bin", op, a, b: unary(d + 1) }; }
    return a;
  }
  function power(d: number): Node {
    const a = primary(d + 1);
    if (peek() === "^") { eat(); return { t: "bin", op: "^", a, b: unary(d + 1) }; }
    return a;
  }
  function unary(d: number): Node {
    if (peek() === "-") { eat(); return { t: "neg", a: unary(d + 1) }; }
    if (peek() === "+") { eat(); return unary(d + 1); }
    return power(d + 1);
  }
  function primary(d: number): Node {
    if (d > MAX_DEPTH) throw new ExprError("Expression is nested too deeply");
    const t = peek();
    if (t === undefined) throw new ExprError("Expression ended early");
    if (/^\d/.test(t)) { eat(); return { t: "num", v: Number(t) }; }
    if (t === "(") { eat("("); const e = expr(d + 1); eat(")"); return e; }
    if (/^[A-Za-z_]/.test(t)) {
      eat();
      if (peek() === "(") {
        if (!Object.prototype.hasOwnProperty.call(FUNCS, t)) throw new ExprError(`Unknown function ${t}`);
        eat("(");
        const args: Node[] = [];
        if (peek() !== ")") { args.push(expr(d + 1)); while (peek() === ",") { eat(); args.push(expr(d + 1)); } }
        eat(")");
        if (args.length > 3) throw new ExprError("Too many arguments");
        return { t: "call", f: t, args };
      }
      return { t: "var", n: t };
    }
    throw new ExprError(`Unexpected "${t}"`);
  }
  const root = expr(0);
  if (p < toks.length) throw new ExprError(`Unexpected "${toks[p]}"`);
  return root;
}

function run(n: Node, scope: Scope): number {
  switch (n.t) {
    case "num": return n.v;
    case "var": {
      if (!Object.prototype.hasOwnProperty.call(scope, n.n)) throw new ExprError(`Unknown name ${n.n}`);
      return scope[n.n];
    }
    case "neg": return -run(n.a, scope);
    case "call": return FUNCS[n.f](...n.args.map((a) => run(a, scope)));
    case "bin": {
      const a = run(n.a, scope), b = run(n.b, scope);
      switch (n.op) {
        case "+": return a + b;
        case "-": return a - b;
        case "*": return a * b;
        case "/": return b === 0 ? NaN : a / b;
        case "^": return Math.abs(b) > 64 ? NaN : Math.pow(a, b);
      }
    }
  }
}

/** Evaluate. Returns NaN for anything undefined (division by zero, huge powers) and throws ExprError for malformed text. */
export function evaluate(src: string, scope: Scope): number {
  const v = run(parse(src), scope);
  return Number.isFinite(v) ? v : NaN;
}

/** Names used by an expression (for validation). */
export function names(src: string): string[] {
  const out = new Set<string>();
  const walk = (n: Node) => { if (n.t === "var") out.add(n.n); else if (n.t === "neg") walk(n.a); else if (n.t === "bin") { walk(n.a); walk(n.b); } else if (n.t === "call") n.args.forEach(walk); };
  walk(parse(src));
  return [...out];
}
