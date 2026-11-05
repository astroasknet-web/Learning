/**
 * A small Tableau-style calculation language for the practice viz builder: field references like [Sales], arithmetic and comparisons, IF/THEN/ELSEIF/ELSE/END,
 * CASE/WHEN, text and date helpers, aggregates (SUM, AVG, MIN, MAX, COUNT, COUNTD, MEDIAN, ATTR), and level-of-detail expressions { FIXED [Region] : SUM([Sales]) },
 * { INCLUDE ... } and { EXCLUDE ... }. Evaluation is a walk over the parsed tree: no eval, no dynamic code. Every problem is a CalcError with plain words.
 */
export class CalcError extends Error {
  constructor(message: string, public hint?: string) {
    super(message);
  }
}
export type Cell = number | string | null;
type Val = Cell | boolean;

export type CNode =
  | { t: "num"; v: number }
  | { t: "str"; v: string }
  | { t: "bool"; v: boolean }
  | { t: "field"; name: string }
  | { t: "bin"; op: string; a: CNode; b: CNode }
  | { t: "neg"; a: CNode }
  | { t: "not"; a: CNode }
  | { t: "call"; name: string; args: CNode[] }
  | { t: "if"; branches: Array<{ cond: CNode; then: CNode }>; otherwise?: CNode }
  | { t: "case"; subject: CNode; whens: Array<{ when: CNode; then: CNode }>; otherwise?: CNode }
  | { t: "lod"; kind: "FIXED" | "INCLUDE" | "EXCLUDE"; dims: string[]; body: CNode };

type Tok = { k: "num" | "str" | "field" | "id" | "op" | "eof"; v: string };
function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === "/" && src[i + 1] === "/") { while (i < n && src[i] !== "\n") i++; continue; }
    if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(src[i + 1] ?? ""))) {
      let j = i;
      while (j < n && /[0-9.]/.test(src[j])) j++;
      out.push({ k: "num", v: src.slice(i, j) }); i = j; continue;
    }
    if (c === '"' || c === "'") {
      const e = src.indexOf(c, i + 1);
      if (e < 0) throw new CalcError("A piece of text that starts with a quote is never closed.", 'Text goes in quotes, like "West".');
      out.push({ k: "str", v: src.slice(i + 1, e) }); i = e + 1; continue;
    }
    if (c === "[") {
      const e = src.indexOf("]", i + 1);
      if (e < 0) throw new CalcError("A field name that starts with [ is never closed.", "Field names go in square brackets, like [Sales].");
      out.push({ k: "field", v: src.slice(i + 1, e).trim() }); i = e + 1; continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < n && /[A-Za-z0-9_]/.test(src[j])) j++;
      out.push({ k: "id", v: src.slice(i, j) }); i = j; continue;
    }
    const two = src.slice(i, i + 2);
    if (["<=", ">=", "<>", "!=", "=="].includes(two)) { out.push({ k: "op", v: two === "==" ? "=" : two === "!=" ? "<>" : two }); i += 2; continue; }
    if ("+-*/%^=<>(),:{}".includes(c)) { out.push({ k: "op", v: c }); i++; continue; }
    throw new CalcError(`The character "${c}" cannot be used in a calculation here.`);
  }
  out.push({ k: "eof", v: "" });
  return out;
}

const AGGS = new Set(["SUM", "AVG", "MIN", "MAX", "COUNT", "COUNTD", "MEDIAN", "ATTR"]);
const KW = new Set(["IF", "THEN", "ELSEIF", "ELSE", "END", "CASE", "WHEN", "AND", "OR", "NOT", "TRUE", "FALSE", "FIXED", "INCLUDE", "EXCLUDE"]);

class P {
  i = 0;
  constructor(public toks: Tok[]) {}
  get cur(): Tok { return this.toks[this.i]; }
  isKw(v: string): boolean { return this.cur.k === "id" && this.cur.v.toUpperCase() === v; }
  isOp(v: string, t: Tok = this.cur): boolean { return t.k === "op" && t.v === v; }
  fail(msg: string, hint?: string): never { throw new CalcError(msg, hint); }
  expectKw(v: string): void { if (!this.isKw(v)) this.fail(`${v} is missing here.`, v === "END" ? "Every IF and CASE must finish with END." : v === "THEN" ? "After the condition of an IF, write THEN and the result." : undefined); this.i++; }
  expr(): CNode { return this.or(); }
  or(): CNode { let a = this.and(); while (this.isKw("OR")) { this.i++; a = { t: "bin", op: "OR", a, b: this.and() }; } return a; }
  and(): CNode { let a = this.not(); while (this.isKw("AND")) { this.i++; a = { t: "bin", op: "AND", a, b: this.not() }; } return a; }
  not(): CNode { if (this.isKw("NOT")) { this.i++; return { t: "not", a: this.not() }; } return this.cmp(); }
  cmp(): CNode {
    const a = this.add();
    const t = this.cur;
    if (t.k === "op" && ["=", "<>", "<", "<=", ">", ">="].includes(t.v)) { this.i++; return { t: "bin", op: t.v, a, b: this.add() }; }
    return a;
  }
  add(): CNode { let a = this.mul(); while (this.isOp("+") || this.isOp("-")) { const op = this.cur.v; this.i++; a = { t: "bin", op, a, b: this.mul() }; } return a; }
  mul(): CNode { let a = this.unary(); while (this.isOp("*") || this.isOp("/") || this.isOp("%")) { const op = this.cur.v; this.i++; a = { t: "bin", op, a, b: this.unary() }; } return a; }
  unary(): CNode { if (this.isOp("-")) { this.i++; return { t: "neg", a: this.unary() }; } return this.pow(); }
  pow(): CNode { const a = this.primary(); if (this.isOp("^")) { this.i++; return { t: "bin", op: "^", a, b: this.unary() }; } return a; }
  primary(): CNode {
    const t = this.cur;
    if (t.k === "num") { this.i++; const v = parseFloat(t.v); if (Number.isNaN(v)) this.fail(`"${t.v}" is not a number.`); return { t: "num", v }; }
    if (t.k === "str") { this.i++; return { t: "str", v: t.v }; }
    if (t.k === "field") { this.i++; return { t: "field", name: t.v }; }
    if (this.isOp("(")) { this.i++; const e = this.expr(); if (!this.isOp(")")) this.fail("A closing bracket ) is missing.", "Every ( needs a matching )."); this.i++; return e; }
    if (this.isOp("{")) return this.lod();
    if (t.k === "id") {
      const up = t.v.toUpperCase();
      if (up === "TRUE" || up === "FALSE") { this.i++; return { t: "bool", v: up === "TRUE" }; }
      if (up === "IF") return this.ifExpr();
      if (up === "CASE") return this.caseExpr();
      if (this.isOp("(", this.toks[this.i + 1])) {
        this.i += 2;
        const args: CNode[] = [];
        if (!this.isOp(")")) do args.push(this.expr()); while (this.isOp(",") && (this.i++, true));
        if (!this.isOp(")")) this.fail(`A closing bracket ) is missing after ${up}(...).`, "Check the commas between the arguments.");
        this.i++;
        return { t: "call", name: up, args };
      }
      if (KW.has(up)) this.fail(`${t.v.toUpperCase()} cannot be used here.`);
      this.fail(`"${t.v}" is not a field or function.`, `Field names go in square brackets, like [${t.v}].`);
    }
    if (t.k === "eof") this.fail("The calculation stops too soon: a value is missing at the end.");
    return this.fail(`Unexpected "${t.v}".`);
  }
  ifExpr(): CNode {
    this.i++; // IF
    const branches: Array<{ cond: CNode; then: CNode }> = [];
    const cond = this.expr(); this.expectKw("THEN"); branches.push({ cond, then: this.expr() });
    while (this.isKw("ELSEIF")) { this.i++; const c = this.expr(); this.expectKw("THEN"); branches.push({ cond: c, then: this.expr() }); }
    let otherwise: CNode | undefined;
    if (this.isKw("ELSE")) { this.i++; otherwise = this.expr(); }
    this.expectKw("END");
    return { t: "if", branches, otherwise };
  }
  caseExpr(): CNode {
    this.i++;
    const subject = this.expr();
    const whens: Array<{ when: CNode; then: CNode }> = [];
    while (this.isKw("WHEN")) { this.i++; const w = this.expr(); this.expectKw("THEN"); whens.push({ when: w, then: this.expr() }); }
    if (!whens.length) this.fail("A CASE needs at least one WHEN ... THEN.");
    let otherwise: CNode | undefined;
    if (this.isKw("ELSE")) { this.i++; otherwise = this.expr(); }
    this.expectKw("END");
    return { t: "case", subject, whens, otherwise };
  }
  lod(): CNode {
    this.i++; // {
    let kind: "FIXED" | "INCLUDE" | "EXCLUDE" = "FIXED";
    const dims: string[] = [];
    if (this.isKw("FIXED") || this.isKw("INCLUDE") || this.isKw("EXCLUDE")) {
      kind = this.cur.v.toUpperCase() as typeof kind; this.i++;
      while (this.cur.k === "field") { dims.push(this.cur.v); this.i++; if (this.isOp(",")) this.i++; }
      if (!this.isOp(":")) this.fail("A level-of-detail expression needs a colon after its fields, like { FIXED [Region] : SUM([Sales]) }.");
      this.i++;
    }
    const body = this.expr();
    if (!this.isOp("}")) this.fail("A closing brace } is missing at the end of the level-of-detail expression.");
    this.i++;
    return { t: "lod", kind, dims, body };
  }
}
export function parseCalc(src: string): CNode {
  const toks = tokenize(src);
  if (toks.length === 1) throw new CalcError("The calculation is empty.");
  const p = new P(toks);
  const e = p.expr();
  if (p.cur.k !== "eof") p.fail("Something extra was found after the end of the calculation.", "Check for a missing operator or comma.");
  return e;
}

/** True when the calculation contains an aggregate (outside a level-of-detail expression): it is then worked out once per mark, not per row. */
export function isAggregate(n: CNode): boolean {
  switch (n.t) {
    case "call": return AGGS.has(n.name) || n.args.some(isAggregate);
    case "bin": return isAggregate(n.a) || isAggregate(n.b);
    case "neg": case "not": return isAggregate(n.a);
    case "if": return n.branches.some((b) => isAggregate(b.cond) || isAggregate(b.then)) || (n.otherwise ? isAggregate(n.otherwise) : false);
    case "case": return isAggregate(n.subject) || n.whens.some((w) => isAggregate(w.when) || isAggregate(w.then)) || (n.otherwise ? isAggregate(n.otherwise) : false);
    case "lod": return n.kind !== "FIXED" ? true : false;
    default: return false;
  }
}

/* ------------------------------------------------------------------------------------------------------------------ evaluation */
export interface FieldInfo { name: string; idx: number; role: "dimension" | "measure"; type: "string" | "number" | "date" }
export interface Env {
  fields: Map<string, FieldInfo>;
  rows: Cell[][];
  calcs: Map<string, { name: string; node: CNode; agg: boolean }>;
  /** The dimensions of the view (field names), used by INCLUDE and EXCLUDE. */
  viewDims?: string[];
  /** The rows that survived the view's filters: an EXCLUDE expression looks across all of them, not only the current mark. */
  scope?: number[];
  fixedCache: Map<string, Map<string, Val>>;
  depth: number;
}
const lc = (s: string): string => s.toLowerCase();

export function makeEnv(fields: FieldInfo[], rows: Cell[][], calcs: Map<string, { name: string; node: CNode; agg: boolean }>): Env {
  return { fields: new Map(fields.map((f) => [lc(f.name), f])), rows, calcs, fixedCache: new Map(), depth: 0 };
}

function suggest(name: string, options: string[]): string | null {
  let best: string | null = null, bd = 99;
  const a = lc(name);
  for (const o of options) {
    const b = lc(o);
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
    for (let j = 1; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    if (dp[m][n] < bd && dp[m][n] <= Math.max(2, Math.floor(b.length / 3))) { bd = dp[m][n]; best = o; }
  }
  return best;
}

function num(v: Val, what: string): number {
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (v === null) return 0;
  const n = Number(v);
  if (v.trim() !== "" && Number.isFinite(n)) return n;
  throw new CalcError(`"${v}" is text, but a number was needed for ${what}.`);
}
const text = (v: Val): string => (v === null ? "" : typeof v === "number" ? String(Math.round(v * 1e9) / 1e9) : String(v));
const truth = (v: Val): boolean => (typeof v === "boolean" ? v : v === null ? false : typeof v === "number" ? v !== 0 : v !== "");
const norm = (n: number): number => Math.round(n * 1e9) / 1e9;

function aggregate(name: string, vals: Val[]): Val {
  const v = vals.filter((x) => x !== null);
  const nums = v.filter((x): x is number => typeof x === "number");
  switch (name) {
    case "SUM": return nums.length ? norm(nums.reduce((a, b) => a + b, 0)) : null;
    case "AVG": return nums.length ? norm(nums.reduce((a, b) => a + b, 0) / nums.length) : null;
    case "MIN": return nums.length === v.length && nums.length ? Math.min(...nums) : v.length ? ([...v].map(String).sort()[0]) : null;
    case "MAX": return nums.length === v.length && nums.length ? Math.max(...nums) : v.length ? ([...v].map(String).sort().slice(-1)[0]) : null;
    case "COUNT": return v.length;
    case "COUNTD": return new Set(v).size;
    case "MEDIAN": { if (!nums.length) return null; const s = [...nums].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
    case "ATTR": { const u = new Set(v); return u.size === 1 ? v[0] : u.size === 0 ? null : "*"; }
  }
  return null;
}

function fieldInfo(env: Env, name: string): FieldInfo {
  const f = env.fields.get(lc(name));
  if (!f) {
    const s = suggest(name, [...env.fields.values()].map((x) => x.name).concat([...env.calcs.values()].map((c) => c.name)));
    throw new CalcError(`There is no field called [${name}] in this data.`, s ? `Did you mean [${s}]?` : `The fields are: ${[...env.fields.values()].map((x) => x.name).join(", ")}.`);
  }
  return f;
}

/** The value of a calculation for one row. Aggregates are not allowed here unless they sit inside a level-of-detail expression. */
export function evalRow(n: CNode, row: number, env: Env): Val {
  if (env.depth > 30) throw new CalcError("A calculation refers back to itself.", "A calculated field cannot use itself, directly or through other fields.");
  switch (n.t) {
    case "num": case "str": case "bool": return n.v;
    case "neg": return -num(evalRow(n.a, row, env), "the minus sign");
    case "not": return !truth(evalRow(n.a, row, env));
    case "field": {
      const c = env.calcs.get(lc(n.name));
      if (c && !env.fields.has(lc(n.name))) {
        if (c.agg) throw new CalcError(`[${n.name}] is an aggregate calculation and cannot be used inside a row-level calculation.`, "Aggregate calculations are worked out per mark, after the rows are grouped.");
        return evalRow(c.node, row, { ...env, depth: env.depth + 1 });
      }
      return env.rows[row][fieldInfo(env, n.name).idx];
    }
    case "bin": return binary(n.op, () => evalRow(n.a, row, env), () => evalRow(n.b, row, env));
    case "if": { for (const b of n.branches) if (truth(evalRow(b.cond, row, env))) return evalRow(b.then, row, env); return n.otherwise ? evalRow(n.otherwise, row, env) : null; }
    case "case": { const s = evalRow(n.subject, row, env); for (const w of n.whens) if (eq(s, evalRow(w.when, row, env))) return evalRow(w.then, row, env); return n.otherwise ? evalRow(n.otherwise, row, env) : null; }
    case "lod": {
      if (n.kind !== "FIXED") throw new CalcError(`${n.kind} level-of-detail expressions work on the marks of a view, so they must be wrapped in an aggregate such as SUM or AVG.`, "For example: AVG({ INCLUDE [Customer] : SUM([Sales]) }).");
      return fixed(n, row, env);
    }
    case "call": return callFn(n.name, n.args, (a) => evalRow(a, row, env), () => { throw new CalcError(`${n.name} is an aggregate, so it cannot be used in a row-level calculation.`, "Use it in an aggregate calculation such as SUM([Sales]) / SUM([Cost]), or inside a { FIXED ... } expression."); });
  }
}

function fixed(n: Extract<CNode, { t: "lod" }>, row: number, env: Env): Val {
  const key = n.dims.map((d) => lc(d)).join("|") + "::" + JSON.stringify(n.body);
  let cache = env.fixedCache.get(key);
  if (!cache) {
    cache = new Map();
    env.fixedCache.set(key, cache);
    const idxs = n.dims.map((d) => fieldInfo(env, d).idx);
    const groups = new Map<string, number[]>();
    env.rows.forEach((r, i) => { const k = JSON.stringify(idxs.map((x) => r[x])); (groups.get(k) ?? groups.set(k, []).get(k)!).push(i); });
    for (const [k, rows] of groups) cache.set(k, evalGroup(n.body, rows, { ...env, depth: env.depth + 1 }));
  }
  const idxs = n.dims.map((d) => fieldInfo(env, d).idx);
  return cache.get(JSON.stringify(idxs.map((x) => env.rows[row][x]))) ?? null;
}

/** The value of a calculation for a group of rows (one mark of the view): aggregates reduce the rows; other fields must be wrapped in ATTR. */
export function evalGroup(n: CNode, rows: number[], env: Env): Val {
  if (env.depth > 30) throw new CalcError("A calculation refers back to itself.");
  switch (n.t) {
    case "num": case "str": case "bool": return n.v;
    case "neg": return -num(evalGroup(n.a, rows, env), "the minus sign");
    case "not": return !truth(evalGroup(n.a, rows, env));
    case "field": {
      const c = env.calcs.get(lc(n.name));
      if (c && !env.fields.has(lc(n.name))) {
        if (c.agg) return evalGroup(c.node, rows, { ...env, depth: env.depth + 1 });
        throw new CalcError(`[${n.name}] is a row-level calculation, so wrap it in an aggregate here, such as SUM([${n.name}]) or ATTR([${n.name}]).`);
      }
      fieldInfo(env, n.name);
      throw new CalcError(`[${n.name}] is used next to an aggregate without being aggregated itself.`, `Wrap it in an aggregate such as SUM([${n.name}]), or ATTR([${n.name}]) for a dimension. Tableau calls this "cannot mix aggregate and non-aggregate arguments".`);
    }
    case "bin": return binary(n.op, () => evalGroup(n.a, rows, env), () => evalGroup(n.b, rows, env));
    case "if": { for (const b of n.branches) if (truth(evalGroup(b.cond, rows, env))) return evalGroup(b.then, rows, env); return n.otherwise ? evalGroup(n.otherwise, rows, env) : null; }
    case "case": { const s = evalGroup(n.subject, rows, env); for (const w of n.whens) if (eq(s, evalGroup(w.when, rows, env))) return evalGroup(w.then, rows, env); return n.otherwise ? evalGroup(n.otherwise, rows, env) : null; }
    case "lod": {
      if (n.kind === "FIXED") { const vals = rows.map((r) => fixed(n, r, env)); return vals.length ? vals[0] : null; }
      return includeExclude(n, rows, env);
    }
    case "call": {
      if (AGGS.has(n.name)) {
        if (n.args.length !== 1) throw new CalcError(`${n.name} needs exactly one value inside the brackets.`);
        const inner = n.args[0];
        if (inner.t === "lod" && inner.kind !== "FIXED") {
          const parts = includeExcludeParts(inner, rows, env);
          return aggregate(n.name, parts);
        }
        return aggregate(n.name, rows.map((r) => evalRow(inner, r, env)));
      }
      return callFn(n.name, n.args, (a) => evalGroup(a, rows, env), () => null);
    }
  }
}

function includeExcludeParts(n: Extract<CNode, { t: "lod" }>, rows: number[], env: Env): Val[] {
  const view = env.viewDims ?? [];
  const dims = n.kind === "INCLUDE" ? [...view, ...n.dims] : view.filter((d) => !n.dims.some((x) => lc(x) === lc(d)));
  const idxs = dims.map((d) => fieldInfo(env, d).idx);
  if (n.kind === "EXCLUDE" && rows.length) {
    // the marks that share the remaining dimensions with this one, across the whole view
    const want = JSON.stringify(idxs.map((x) => env.rows[rows[0]][x]));
    const across = (env.scope ?? rows).filter((r) => JSON.stringify(idxs.map((x) => env.rows[r][x])) === want);
    return [evalGroup(n.body, across, { ...env, depth: env.depth + 1 })];
  }
  const groups = new Map<string, number[]>();
  for (const r of rows) { const k = JSON.stringify(idxs.map((x) => env.rows[r][x])); (groups.get(k) ?? groups.set(k, []).get(k)!).push(r); }
  return [...groups.values()].map((g) => evalGroup(n.body, g, { ...env, depth: env.depth + 1 }));
}
function includeExclude(n: Extract<CNode, { t: "lod" }>, rows: number[], env: Env): Val {
  if (n.kind === "INCLUDE") throw new CalcError("An INCLUDE expression must be wrapped in an aggregate such as AVG or SUM.", "For example: AVG({ INCLUDE [Customer] : SUM([Sales]) }).");
  const parts = includeExcludeParts(n, rows, env);
  return parts.length ? parts[0] : null;
}

function eq(a: Val, b: Val): boolean {
  if (a === null || b === null) return a === b;
  if (typeof a === "string" && typeof b === "string") return lc(a) === lc(b);
  return a === b;
}
function binary(op: string, ea: () => Val, eb: () => Val): Val {
  if (op === "AND") return truth(ea()) && truth(eb());
  if (op === "OR") return truth(ea()) || truth(eb());
  const a = ea(), b = eb();
  switch (op) {
    case "=": return eq(a, b);
    case "<>": return !eq(a, b);
    case "<": case "<=": case ">": case ">=": {
      if (a === null || b === null) return false;
      const bothText = typeof a === "string" && typeof b === "string";
      const x = bothText ? lc(a as string) : num(a, `the ${op} comparison`), y = bothText ? lc(b as string) : num(b, `the ${op} comparison`);
      return op === "<" ? x < y : op === "<=" ? x <= y : op === ">" ? x > y : x >= y;
    }
    case "+": if (typeof a === "string" || typeof b === "string") return text(a) + text(b); return a === null || b === null ? null : norm(num(a, "+") + num(b, "+"));
    case "-": return a === null || b === null ? null : norm(num(a, "-") - num(b, "-"));
    case "*": return a === null || b === null ? null : norm(num(a, "*") * num(b, "*"));
    case "/": { if (a === null || b === null) return null; const d = num(b, "/"); return d === 0 ? null : norm(num(a, "/") / d); }
    case "%": { if (a === null || b === null) return null; const d = num(b, "%"); return d === 0 ? null : num(a, "%") % d; }
    case "^": return a === null || b === null ? null : norm(Math.pow(num(a, "^"), num(b, "^")));
  }
  throw new CalcError(`The operator ${op} is not supported.`);
}

const iso = (s: string): [number, number, number] | null => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); return m ? [+m[1], +m[2], +m[3]] : null; };
function callFn(name: string, args: CNode[], ev: (n: CNode) => Val, onAgg: () => Val): Val {
  if (AGGS.has(name)) return onAgg();
  const need = (min: number, max = min): void => { if (args.length < min || args.length > max) throw new CalcError(`${name} needs ${min === max ? min : `${min} to ${max}`} value${max === 1 ? "" : "s"} inside the brackets, but has ${args.length}.`); };
  const a = (i: number): Val => ev(args[i]);
  switch (name) {
    case "ZN": { need(1); const v = a(0); return v === null ? 0 : v; }
    case "IFNULL": { need(2); const v = a(0); return v === null ? a(1) : v; }
    case "ISNULL": { need(1); return a(0) === null; }
    case "IIF": { need(3, 4); const c = a(0); return truth(c) ? a(1) : a(2); }
    case "ROUND": { need(1, 2); const x = a(0); if (x === null) return null; const d = args[1] ? num(a(1), "ROUND") : 0; const f = Math.pow(10, d); return Math.round((num(x, "ROUND") + Number.EPSILON) * f) / f; }
    case "ABS": { need(1); const x = a(0); return x === null ? null : Math.abs(num(x, "ABS")); }
    case "FLOOR": { need(1); const x = a(0); return x === null ? null : Math.floor(num(x, "FLOOR")); }
    case "CEILING": { need(1); const x = a(0); return x === null ? null : Math.ceil(num(x, "CEILING")); }
    case "SQRT": { need(1); const x = a(0); return x === null ? null : Math.sqrt(num(x, "SQRT")); }
    case "MIN": case "MAX": { need(2); const x = a(0), y = a(1); if (x === null) return y; if (y === null) return x; return (num(x, name) <= num(y, name)) === (name === "MIN") ? x : y; }
    case "UPPER": { need(1); const x = a(0); return x === null ? null : text(x).toUpperCase(); }
    case "LOWER": { need(1); const x = a(0); return x === null ? null : text(x).toLowerCase(); }
    case "LEN": { need(1); const x = a(0); return x === null ? null : text(x).length; }
    case "TRIM": { need(1); const x = a(0); return x === null ? null : text(x).trim(); }
    case "LEFT": { need(2); const x = a(0); return x === null ? null : text(x).slice(0, Math.max(0, num(a(1), "LEFT"))); }
    case "RIGHT": { need(2); const x = a(0); const k = Math.max(0, num(a(1), "RIGHT")); return x === null ? null : k === 0 ? "" : text(x).slice(-k); }
    case "CONTAINS": { need(2); const x = a(0), y = a(1); return x === null || y === null ? false : lc(text(x)).includes(lc(text(y))); }
    case "STARTSWITH": { need(2); const x = a(0), y = a(1); return x === null || y === null ? false : lc(text(x)).startsWith(lc(text(y))); }
    case "STR": { need(1); const x = a(0); return x === null ? null : text(x); }
    case "INT": { need(1); const x = a(0); return x === null ? null : Math.trunc(num(x, "INT")); }
    case "FLOAT": { need(1); const x = a(0); return x === null ? null : num(x, "FLOAT"); }
    case "YEAR": case "MONTH": case "DAY": {
      need(1); const x = a(0); if (x === null) return null;
      const p = iso(String(x)); if (!p) throw new CalcError(`${name} needs a date, but got "${x}".`);
      return name === "YEAR" ? p[0] : name === "MONTH" ? p[1] : p[2];
    }
    case "DATETRUNC": {
      need(2); const unit = text(a(0)).toLowerCase(); const x = a(1); if (x === null) return null;
      const p = iso(String(x)); if (!p) throw new CalcError(`DATETRUNC needs a date, but got "${x}".`);
      const pad = (n: number): string => String(n).padStart(2, "0");
      if (unit === "year") return `${p[0]}-01-01`;
      if (unit === "quarter") return `${p[0]}-${pad(Math.floor((p[1] - 1) / 3) * 3 + 1)}-01`;
      if (unit === "month") return `${p[0]}-${pad(p[1])}-01`;
      if (unit === "day") return `${p[0]}-${pad(p[1])}-${pad(p[2])}`;
      throw new CalcError("DATETRUNC knows 'year', 'quarter', 'month' and 'day'.");
    }
    default: {
      const known = ["SUM", "AVG", "MIN", "MAX", "COUNT", "COUNTD", "ZN", "IFNULL", "ROUND", "ABS", "UPPER", "LOWER", "LEFT", "CONTAINS", "YEAR", "MONTH", "DATETRUNC", "ATTR", "MEDIAN"];
      const s = suggest(name, known);
      throw new CalcError(`"${name}" is not a function this practice builder knows.`, s ? `Did you mean ${s}?` : "Try SUM, AVG, COUNTD, ZN, IFNULL, ROUND, UPPER, LEFT, CONTAINS, YEAR, MONTH or DATETRUNC.");
    }
  }
}

export { AGGS };
