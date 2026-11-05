/* eslint-disable @typescript-eslint/no-explicit-any */
import { randomUUID } from "node:crypto";
import { all, run, tx, type Conn } from "@/lib/portal/db";
import type { Database } from "@/types/database";
import { fromDb, tableMeta, toDb, type TableMeta } from "./schema";
import { callFunction } from "./rpc";

/**
 * A small query builder over the portal's MySQL / MariaDB connection that answers to the calls the marketing code already makes
 * (from, select, insert, update, upsert, delete, eq, in, or, order, range, single, rpc ...), so forms, applications, bookings and
 * the chat bot did not need rewriting when the database moved to MySQL. It returns the same { data, error, count } shape,
 * times as ISO strings, true/false for flags and parsed JSON.
 */
type Tables = Database["public"]["Tables"];
export type TableName = keyof Tables;
type Fns = Database["public"]["Functions"];

export interface DbError { message: string; code: string; details: string; hint: string }
export type Result<D> = { data: D; error: null; count: number | null } | { data: null; error: DbError; count: null };

type Opts = { count?: "exact" | "planned" | "estimated"; head?: boolean };

export interface Builder<R, I, U, D> extends PromiseLike<Result<D>> {
  select(columns?: string, opts?: Opts): Builder<R, I, U, R[]>;
  insert(values: I | I[], opts?: { defaultToNull?: boolean }): Builder<R, I, U, null>;
  upsert(values: I | I[], opts?: { onConflict?: string; ignoreDuplicates?: boolean }): Builder<R, I, U, null>;
  update(values: U): Builder<R, I, U, null>;
  delete(): Builder<R, I, U, null>;
  eq(col: string, val: unknown): Builder<R, I, U, D>;
  neq(col: string, val: unknown): Builder<R, I, U, D>;
  gt(col: string, val: unknown): Builder<R, I, U, D>;
  gte(col: string, val: unknown): Builder<R, I, U, D>;
  lt(col: string, val: unknown): Builder<R, I, U, D>;
  lte(col: string, val: unknown): Builder<R, I, U, D>;
  like(col: string, val: string): Builder<R, I, U, D>;
  ilike(col: string, val: string): Builder<R, I, U, D>;
  is(col: string, val: null | boolean): Builder<R, I, U, D>;
  in(col: string, vals: readonly unknown[]): Builder<R, I, U, D>;
  contains(col: string, val: unknown): Builder<R, I, U, D>;
  not(col: string, op: string, val: unknown): Builder<R, I, U, D>;
  or(filters: string): Builder<R, I, U, D>;
  match(obj: Record<string, unknown>): Builder<R, I, U, D>;
  filter(col: string, op: string, val: unknown): Builder<R, I, U, D>;
  order(col: string, opts?: { ascending?: boolean; nullsFirst?: boolean }): Builder<R, I, U, D>;
  limit(n: number): Builder<R, I, U, D>;
  range(from: number, to: number): Builder<R, I, U, D>;
  single(): Builder<R, I, U, D extends unknown[] ? R : D>;
  maybeSingle(): Builder<R, I, U, D extends unknown[] ? R | null : D>;
}

export interface DataClient {
  from<T extends TableName>(table: T): Builder<Tables[T]["Row"], Tables[T]["Insert"], Tables[T]["Update"], null>;
  rpc<F extends keyof Fns>(fn: F, args?: Fns[F]["Args"]): RpcCall<Fns[F]["Returns"]>;
  storage: Storage;
}

/** What rpc() returns: awaitable, and .single() / .maybeSingle() pick the first row of a table-returning function. */
export interface RpcCall<D> extends PromiseLike<Result<D>> {
  single(): PromiseLike<Result<D extends (infer E)[] ? E : D>>;
  maybeSingle(): PromiseLike<Result<(D extends (infer E)[] ? E : D) | null>>;
}

export interface Storage {
  from(bucket: string): {
    upload(path: string, body: ArrayBuffer | Uint8Array | Buffer, opts?: { contentType?: string; upsert?: boolean }): Promise<{ data: { path: string } | null; error: DbError | null }>;
    createSignedUrl(path: string, expiresInSeconds: number): Promise<{ data: { signedUrl: string } | null; error: DbError | null }>;
    download(path: string): Promise<{ data: Blob | null; error: DbError | null }>;
    remove(paths: string[]): Promise<{ data: unknown[] | null; error: DbError | null }>;
    getPublicUrl(path: string): { data: { publicUrl: string } };
  };
}

/* ------------------------------------------------------------------ errors -------------------------------------------------------- */

const PG_CODE: Record<number, string> = { 1062: "23505", 1451: "23503", 1452: "23503", 1048: "23502", 1364: "23502", 3819: "23514", 4025: "23514", 1146: "42P01", 1054: "42703", 1406: "22001", 1213: "40P01", 1205: "55P03" };

export function toDbError(e: unknown): DbError {
  const err = e as { errno?: number; code?: string; sqlMessage?: string; message?: string };
  const code = (err.errno && PG_CODE[err.errno]) || err.code || "XX000";
  const message = String(err.sqlMessage ?? err.message ?? e);
  return { message, code, details: message, hint: "" };
}

/* ------------------------------------------------------------------ filters ------------------------------------------------------- */

interface Ctx { meta: TableMeta; params: unknown[] }
type Filter = (c: Ctx) => string;

function q(col: string): string {
  if (!/^[A-Za-z_]\w*$/.test(col)) throw new Error(`Invalid column name: ${col}`);
  return "`" + col + "`";
}
const ph = (c: Ctx, v: unknown): string => { c.params.push(v); return "$" + c.params.length; };

/** Split on commas that are not inside quotes, brackets or braces. */
function splitTop(s: string): string[] {
  const out: string[] = [];
  let cur = "";
  let depth = 0;
  let inQ = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inQ) {
      cur += ch;
      if (ch === "\\" && i + 1 < s.length) cur += s[++i];
      else if (ch === '"') inQ = false;
      continue;
    }
    if (ch === '"') { inQ = true; cur += ch; continue; }
    if (ch === "(" || ch === "{" || ch === "[") depth++;
    if (ch === ")" || ch === "}" || ch === "]") depth--;
    if (ch === "," && depth === 0) { out.push(cur); cur = ""; continue; }
    cur += ch;
  }
  if (cur !== "") out.push(cur);
  return out;
}

function unquote(s: string): string {
  const t = s.trim();
  if (t.length >= 2 && t.startsWith('"') && t.endsWith('"')) return t.slice(1, -1).replace(/\\(.)/g, "$1");
  return t;
}

function listValue(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  const s = String(raw).trim();
  return splitTop(s.replace(/^[({\[]/, "").replace(/[)}\]]$/, "")).map(unquote);
}

function cond(c: Ctx, col: string, op: string, raw: unknown): string {
  const m = c.meta.get(col);
  const k = q(col);
  const v = (x: unknown): string => ph(c, toDb(m, x));
  switch (op) {
    case "eq": return raw === null ? `${k} IS NULL` : `${k} = ${v(raw)}`;
    case "neq": return raw === null ? `${k} IS NOT NULL` : `${k} <> ${v(raw)}`;
    case "gt": return `${k} > ${v(raw)}`;
    case "gte": return `${k} >= ${v(raw)}`;
    case "lt": return `${k} < ${v(raw)}`;
    case "lte": return `${k} <= ${v(raw)}`;
    case "like":
    case "ilike": return `${k} LIKE ${ph(c, String(raw))}`;
    case "is": {
      const s = raw === null ? "null" : String(raw).toLowerCase();
      return s === "null" ? `${k} IS NULL` : s === "true" ? `${k} = 1` : `${k} = 0`;
    }
    case "in": {
      const list = listValue(raw).map((x) => toDb(m, x));
      return list.length === 0 ? "1 = 0" : `${k} IN (${ph(c, list)})`;
    }
    case "cs":
    case "contains": {
      const arr = Array.isArray(raw) ? raw : typeof raw === "string" && /^\{.*\}$/.test(raw.trim()) ? listValue(raw) : null;
      return `JSON_CONTAINS(${k}, ${ph(c, JSON.stringify(arr ?? raw))})`;
    }
    default: throw new Error(`Unsupported filter operator: ${op}`);
  }
}

/** Parses the PostgREST "a.eq.1,b.ilike.%x%" syntax that .or() takes. */
function orFilter(expr: string): Filter {
  const parts = splitTop(expr).map((p) => p.trim()).filter(Boolean);
  return (c) => {
    const sql = parts.map((p) => {
      const a = p.indexOf(".");
      const b = p.indexOf(".", a + 1);
      if (a < 1 || b < 0) throw new Error(`Cannot read filter: ${p}`);
      let op = p.slice(a + 1, b);
      let rest = p.slice(b + 1);
      let negate = false;
      if (op === "not") { negate = true; const d = rest.indexOf("."); op = rest.slice(0, d); rest = rest.slice(d + 1); }
      const col = p.slice(0, a);
      const val = op === "in" || op === "cs" ? rest : unquote(rest);
      const s = cond(c, col, op, val);
      return negate ? `NOT (${s})` : `(${s})`;
    });
    return `(${sql.join(" OR ")})`;
  };
}

/* ------------------------------------------------------------------ the builder --------------------------------------------------- */

class QB {
  private op: "select" | "insert" | "update" | "delete" | "upsert" = "select";
  private cols = "*";
  private rows: Record<string, unknown>[] = [];
  private patch: Record<string, unknown> = {};
  private filters: Filter[] = [];
  private orders: Array<{ col: string; asc: boolean; nullsFirst?: boolean }> = [];
  private lim: number | null = null;
  private off = 0;
  private wantRows = false;
  private countMode = false;
  private head = false;
  private mode: "many" | "single" | "maybe" = "many";
  private conflict: string[] = [];
  private ignoreDup = false;

  constructor(private table: string) {
    q(table);
  }

  select(cols = "*", o: Opts = {}) { this.cols = cols; this.wantRows = true; this.countMode = !!o.count; this.head = !!o.head; return this; }
  insert(v: any) { this.op = "insert"; this.rows = Array.isArray(v) ? v : [v]; return this; }
  upsert(v: any, o: { onConflict?: string; ignoreDuplicates?: boolean } = {}) {
    this.op = "upsert";
    this.rows = Array.isArray(v) ? v : [v];
    this.conflict = (o.onConflict ?? "id").split(",").map((s) => s.trim());
    this.ignoreDup = !!o.ignoreDuplicates;
    return this;
  }
  update(v: any) { this.op = "update"; this.patch = v; return this; }
  delete() { this.op = "delete"; return this; }
  private add(f: Filter) { this.filters.push(f); return this; }
  eq(c: string, v: unknown) { return this.add((x) => cond(x, c, "eq", v)); }
  neq(c: string, v: unknown) { return this.add((x) => cond(x, c, "neq", v)); }
  gt(c: string, v: unknown) { return this.add((x) => cond(x, c, "gt", v)); }
  gte(c: string, v: unknown) { return this.add((x) => cond(x, c, "gte", v)); }
  lt(c: string, v: unknown) { return this.add((x) => cond(x, c, "lt", v)); }
  lte(c: string, v: unknown) { return this.add((x) => cond(x, c, "lte", v)); }
  like(c: string, v: string) { return this.add((x) => cond(x, c, "like", v)); }
  ilike(c: string, v: string) { return this.add((x) => cond(x, c, "ilike", v)); }
  is(c: string, v: null | boolean) { return this.add((x) => cond(x, c, "is", v)); }
  in(c: string, v: readonly unknown[]) { return this.add((x) => cond(x, c, "in", v)); }
  contains(c: string, v: unknown) { return this.add((x) => cond(x, c, "contains", v)); }
  not(c: string, op: string, v: unknown) { return this.add((x) => `NOT (${cond(x, c, op, v)})`); }
  or(expr: string) { return this.add(orFilter(expr)); }
  match(o: Record<string, unknown>) { for (const [k, v] of Object.entries(o)) this.eq(k, v); return this; }
  filter(c: string, op: string, v: unknown) { return this.add((x) => cond(x, c, op, v)); }
  order(col: string, o: { ascending?: boolean; nullsFirst?: boolean } = {}) { this.orders.push({ col, asc: o.ascending !== false, nullsFirst: o.nullsFirst }); return this; }
  limit(n: number) { this.lim = n; return this; }
  range(a: number, b: number) { this.off = a; this.lim = b - a + 1; return this; }
  single() { this.mode = "single"; return this; }
  maybeSingle() { this.mode = "maybe"; return this; }

  then<A = Result<any>, B = never>(onOk?: ((v: Result<any>) => A | PromiseLike<A>) | null, onErr?: ((e: unknown) => B | PromiseLike<B>) | null): Promise<A | B> {
    return this.exec().then(onOk, onErr);
  }

  private where(c: Ctx): string {
    const w = this.filters.map((f) => f(c));
    return w.length ? " WHERE " + w.join(" AND ") : "";
  }

  private orderBy(): string {
    if (!this.orders.length) return "";
    // Postgres puts NULLs last when ascending and first when descending; MySQL does the opposite, so say it out loud.
    const parts = this.orders.map(({ col, asc, nullsFirst }) => {
      const nf = nullsFirst ?? !asc;
      return `${q(col)} IS ${nf ? "NOT " : ""}NULL, ${q(col)} ${asc ? "ASC" : "DESC"}`;
    });
    return " ORDER BY " + parts.join(", ");
  }

  private selectList(): string {
    const t = this.cols.trim();
    if (t === "*" || t === "") return "*";
    return t.split(",").map((s) => s.trim()).filter(Boolean).map((s) => (s === "*" ? "*" : q(s))).join(", ");
  }

  private convert(meta: TableMeta, row: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) out[k] = fromDb(meta.get(k), v);
    return out;
  }

  private async fetchRows(meta: TableMeta, sqlWhere: string, params: unknown[], conn?: Conn): Promise<Record<string, unknown>[]> {
    const sql = `SELECT ${this.selectList()} FROM ${q(this.table)}${sqlWhere}`;
    const rows = conn ? (await conn.query(sql, params)).rows : await all(sql, params);
    return (rows as Record<string, unknown>[]).map((r) => this.convert(meta, r));
  }

  private shape(rows: Record<string, unknown>[], count: number | null): Result<any> {
    if (this.mode === "many") return { data: rows, error: null, count };
    if (rows.length === 1) return { data: rows[0], error: null, count };
    if (rows.length === 0 && this.mode === "maybe") return { data: null as any, error: null, count } as Result<any>;
    return { data: null, error: { message: rows.length ? "JSON object requested, multiple (or no) rows returned" : "JSON object requested, multiple (or no) rows returned", code: "PGRST116", details: `The result contains ${rows.length} rows`, hint: "" }, count: null };
  }

  private async exec(): Promise<Result<any>> {
    try {
      const meta = await tableMeta(this.table);
      if (this.op === "select") return await this.doSelect(meta);
      if (this.op === "insert" || this.op === "upsert") return await this.doInsert(meta);
      return await this.doMutate(meta);
    } catch (e) {
      return { data: null, error: toDbError(e), count: null };
    }
  }

  private async doSelect(meta: TableMeta): Promise<Result<any>> {
    const c: Ctx = { meta, params: [] };
    const where = this.where(c);
    let count: number | null = null;
    if (this.countMode) {
      const n = await all<{ n: number }>(`SELECT COUNT(*) AS n FROM ${q(this.table)}${where}`, [...c.params]);
      count = Number(n[0]?.n ?? 0);
      if (this.head) return { data: null as any, error: null, count } as Result<any>;
    }
    const limit = this.lim !== null ? ` LIMIT ${Math.max(0, Math.trunc(this.lim))}${this.off ? ` OFFSET ${Math.trunc(this.off)}` : ""}` : this.mode !== "many" ? " LIMIT 2" : "";
    const rows = await this.fetchRows(meta, where + this.orderBy() + limit, c.params);
    return this.shape(rows, count);
  }

  private prepareRow(meta: TableMeta, row: Record<string, unknown>): { cols: string[]; vals: unknown[]; id: unknown } {
    const cols: string[] = [];
    const vals: unknown[] = [];
    for (const [k, v] of Object.entries(row)) {
      if (v === undefined || meta.get(k)?.generated) continue;
      cols.push(k);
      vals.push(toDb(meta.get(k), v));
    }
    for (const [k, m] of meta) {
      if (cols.includes(k) || m.generated) continue;
      if (k === "id" && m.uuid) { cols.push(k); vals.push(randomUUID()); }
      else if (m.kind === "json" && m.jsonDefault !== null) { cols.push(k); vals.push(m.jsonDefault); }
    }
    const i = cols.indexOf("id");
    return { cols, vals, id: i >= 0 ? vals[i] : null };
  }

  private async doInsert(meta: TableMeta): Promise<Result<any>> {
    if (!this.rows.length) return { data: this.wantRows ? ([] as any) : null, error: null, count: null };
    const autoId = !!meta.get("id")?.autoIncrement;
    const lookups: Array<Record<string, unknown>> = [];
    const result = await tx(async (conn) => {
      for (const row of this.rows) {
        const { cols, vals, id } = this.prepareRow(meta, row);
        const ps = vals.map((_, i) => "$" + (i + 1));
        let sql = `INSERT ${this.op === "upsert" && this.ignoreDup ? "IGNORE " : ""}INTO ${q(this.table)} (${cols.map(q).join(", ")}) VALUES (${ps.join(", ")})`;
        if (this.op === "upsert" && !this.ignoreDup) {
          const upd = cols.filter((c) => !this.conflict.includes(c) && c !== "id").map((c) => `${q(c)} = VALUES(${q(c)})`);
          sql += ` ON DUPLICATE KEY UPDATE ${upd.length ? upd.join(", ") : `${q(cols[0])} = ${q(cols[0])}`}`;
        }
        const gotId = autoId && id === null && this.op === "insert";
        const r = await conn.query<{ id: number }>(gotId ? sql + " RETURNING id" : sql, vals);
        if (this.wantRows) {
          if (this.op === "upsert") lookups.push(Object.fromEntries(this.conflict.map((c) => [c, row[c]])));
          else lookups.push({ id: gotId ? r.rows[0]?.id : id });
        }
      }
      if (!this.wantRows) return [] as Record<string, unknown>[];
      const out: Record<string, unknown>[] = [];
      for (const l of lookups) {
        const c: Ctx = { meta, params: [] };
        const w = Object.entries(l).map(([k, v]) => cond(c, k, "eq", v ?? null)).join(" AND ");
        out.push(...(await this.fetchRows(meta, " WHERE " + w, c.params, conn)));
      }
      return out;
    });
    return this.wantRows ? this.shape(result, null) : { data: null, error: null, count: null };
  }

  private async doMutate(meta: TableMeta): Promise<Result<any>> {
    if (!this.filters.length) throw new Error(`${this.op === "update" ? "UPDATE" : "DELETE"} on ${this.table} needs at least one filter`);
    const buildSet = (c: Ctx): string => {
      const sets: string[] = [];
      for (const [k, v] of Object.entries(this.patch)) {
        if (v === undefined) continue;
        sets.push(`${q(k)} = ${ph(c, toDb(meta.get(k), v))}`);
      }
      if (!sets.length) throw new Error("UPDATE with no values");
      return sets.join(", ");
    };
    if (!this.wantRows) {
      const c: Ctx = { meta, params: [] };
      const set = this.op === "update" ? buildSet(c) : "";
      const sql = this.op === "update" ? `UPDATE ${q(this.table)} SET ${set}${this.where(c)}` : `DELETE FROM ${q(this.table)}${this.where(c)}`;
      const n = await run(sql, c.params);
      return { data: null, error: null, count: n };
    }
    // Rows come back: lock the matching rows first so a concurrent caller sees the change (a conditional "claim" stays exclusive).
    const out = await tx(async (conn) => {
      const c0: Ctx = { meta, params: [] };
      const ids = (await conn.query<{ id: unknown }>(`SELECT ${q("id")} FROM ${q(this.table)}${this.where(c0)} FOR UPDATE`, c0.params)).rows.map((r) => r.id);
      if (!ids.length) return [] as Record<string, unknown>[];
      const c: Ctx = { meta, params: [] };
      const byId = ` WHERE ${q("id")} IN (${ph(c, ids)})`;
      if (this.op === "delete") {
        const rows = await this.fetchRows(meta, byId, [...c.params], conn);
        await conn.query(`DELETE FROM ${q(this.table)}${byId}`, c.params);
        return rows;
      }
      const set = buildSet(c);
      c.params.push(ids);
      await conn.query(`UPDATE ${q(this.table)} SET ${set} WHERE ${q("id")} IN ($${c.params.length})`, c.params);
      const c2: Ctx = { meta, params: [] };
      return this.fetchRows(meta, ` WHERE ${q("id")} IN (${ph(c2, ids)})`, c2.params, conn);
    });
    return this.shape(out, null);
  }
}

/* ------------------------------------------------------------------ client -------------------------------------------------------- */

export function createDataClient(storage: Storage): DataClient {
  return {
    from: ((table: string) => new QB(table)) as any,
    rpc: ((fn: string, args: Record<string, unknown> = {}) => {
      const run = (): Promise<Result<any>> =>
        callFunction(fn, args).then(
          (data) => ({ data, error: null, count: null }) as Result<any>,
          (e) => ({ data: null, error: toDbError(e), count: null }) as Result<any>,
        );
      const first = (maybe: boolean) => run().then((r): Result<any> => {
        if (r.error) return r;
        const rows = Array.isArray(r.data) ? r.data : [r.data];
        if (rows.length === 1) return { data: rows[0], error: null, count: null };
        if (rows.length === 0 && maybe) return { data: null as any, error: null, count: null } as Result<any>;
        return { data: null, error: { message: "JSON object requested, multiple (or no) rows returned", code: "PGRST116", details: "", hint: "" }, count: null };
      });
      return { then: (a: any, b: any) => run().then(a, b), single: () => first(false), maybeSingle: () => first(true) };
    }) as any,
    storage,
  };
}
