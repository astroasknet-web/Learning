import mysql, { type Pool, type PoolConnection, type ResultSetHeader } from "mysql2/promise";

/**
 * Database access for the portal (accounts, courses, enrolments, internships, study abroad, CRM, ...). MySQL or MariaDB.
 *
 *   DATABASE_URL        mysql://user:password@host:3306/database   (special characters in the password must be URL-encoded)
 *   DATABASE_SSL        "require" to use TLS without verifying the certificate, "verify" to verify it; default: no TLS
 *   DATABASE_POOL_MAX   connections kept open (default 5)
 *   DB_TIMEZONE         session time zone as an offset such as "+00:00" (default UTC). Dates are stored and returned in this zone.
 *
 * The code base was written with numbered placeholders ($1, $2 ...) and a few PostgreSQL idioms. `translate()` below turns those
 * into MySQL for every statement, so the rest of the portal keeps one familiar API: all, one, val, run, tx.
 */
type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const g = globalThis as unknown as { __portalPool?: Pool };

export function databaseConfigured(): boolean {
  return /^mysql2?:\/\//i.test(process.env.DATABASE_URL ?? "");
}

/** The connection settings parsed from DATABASE_URL. Exported for the migration runner and scripts. */
export function connectionConfig(url = process.env.DATABASE_URL ?? "") {
  if (!/^mysql2?:\/\//i.test(url)) throw new Error("DATABASE_URL must look like mysql://user:password@host:3306/database");
  const u = new URL(url.replace(/^mysql2:/i, "mysql:"));
  const mode = process.env.DATABASE_SSL ?? "disable";
  return {
    host: u.hostname,
    port: u.port ? Number(u.port) : 3306,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: decodeURIComponent(u.pathname.replace(/^\//, "")),
    charset: "utf8mb4",
    timezone: "Z",
    dateStrings: true, // DATETIME and DATE come back as the plain strings the database holds
    supportBigNumbers: true,
    bigNumberStrings: false,
    decimalNumbers: true,
    flags: ["+FOUND_ROWS"], // an UPDATE reports the rows it matched, not only the rows that changed
    ssl: mode === "verify" ? {} : mode === "require" ? { rejectUnauthorized: false } : undefined,
  };
}

function pool(): Pool {
  if (g.__portalPool) return g.__portalPool;
  const p = mysql.createPool({ ...connectionConfig(), waitForConnections: true, connectionLimit: Number(process.env.DATABASE_POOL_MAX ?? 5), queueLimit: 0, connectTimeout: 10_000, enableKeepAlive: true });
  const tz = /^[+-]\d{2}:\d{2}$/.test(process.env.DB_TIMEZONE ?? "") ? (process.env.DB_TIMEZONE as string) : "+00:00";
  // Standard SQL string concatenation (||) and no ONLY_FULL_GROUP_BY, so queries behave the same on MySQL 8 and MariaDB.
  p.on("connection", (c) => { c.query(`SET time_zone = '${tz}', sql_mode = 'STRICT_TRANS_TABLES,NO_ENGINE_SUBSTITUTION,PIPES_AS_CONCAT'`); });
  g.__portalPool = p;
  return p;
}

/* ------------------------------------------------------------------ translating PostgreSQL idioms ---------------------------------- */

const UNIT: Record<string, string> = { sec: "SECOND", secs: "SECOND", second: "SECOND", seconds: "SECOND", min: "MINUTE", mins: "MINUTE", minute: "MINUTE", minutes: "MINUTE", hour: "HOUR", hours: "HOUR", day: "DAY", days: "DAY", week: "WEEK", weeks: "WEEK", month: "MONTH", months: "MONTH", year: "YEAR", years: "YEAR" };

export interface Translated { sql: string; values: unknown[]; returning: string[] | null; insertIgnore: boolean }

/** Run `fn` over the SQL outside quoted strings and comments only. */
function codeOnly(sql: string, fn: (code: string) => string): string {
  const out: string[] = [];
  const re = /'(?:[^'\\]|\\.|'')*'|"(?:[^"\\]|\\.|"")*"|`[^`]*`|--[^\n]*|\/\*[\s\S]*?\*\//g;
  let last = 0;
  for (let m = re.exec(sql); m; m = re.exec(sql)) {
    out.push(fn(sql.slice(last, m.index)), m[0]);
    last = m.index + m[0].length;
  }
  out.push(fn(sql.slice(last)));
  return out.join("");
}

/** Index of the ")" that closes the "(" at `open`, skipping quoted strings. -1 when unbalanced. */
function closing(sql: string, open: number): number {
  let depth = 0;
  for (let i = open; i < sql.length; i++) {
    const ch = sql[i];
    if (ch === "'") { i++; while (i < sql.length && !(sql[i] === "'" && sql[i + 1] !== "'")) i += sql[i] === "'" ? 2 : 1; continue; }
    if (ch === "(") depth++;
    else if (ch === ")" && --depth === 0) return i;
  }
  return -1;
}

/** COUNT(*) FILTER (WHERE c) -> SUM(CASE WHEN c THEN 1 ELSE 0 END);  COUNT(DISTINCT x) FILTER (WHERE c) -> COUNT(DISTINCT CASE WHEN c THEN x END). */
function rewriteFilter(sql: string): string {
  let out = sql;
  for (let guard = 0; guard < 50; guard++) {
    const m = /\bFILTER\s*\(\s*WHERE\b/i.exec(out);
    if (!m) break;
    const open = out.indexOf("(", m.index);
    const end = closing(out, open);
    if (end < 0) break;
    const cond = out.slice(out.indexOf("WHERE", open) + 5, end).trim();
    const before = out.slice(0, m.index).trimEnd();
    const call = /\bCOUNT\s*\(([^()]*)\)$/i.exec(before);
    if (!call) break;
    const arg = call[1].trim();
    const repl = /^DISTINCT\s+/i.test(arg) ? `COUNT(DISTINCT CASE WHEN ${cond} THEN ${arg.replace(/^DISTINCT\s+/i, "")} END)` : `SUM(CASE WHEN ${cond} THEN 1 ELSE 0 END)`;
    out = before.slice(0, before.length - call[0].length) + repl + out.slice(end + 1);
  }
  return out;
}

export function translate(sqlIn: string, params: unknown[] = []): Translated {
  let sql = rewriteFilter(sqlIn);
  if (/regexp_replace/i.test(sql)) sql = sql.replace(/,\s*'g'\s*\)/gi, ")");
  sql = sql.replace(/\bAS\s+key\b/gi, "AS `key`");
  sql = sql.replace(/([\w.]+)(\s+ASC)?\s+NULLS\s+LAST\b/gi, (m, col: string, asc?: string) => `${col} IS NULL, ${col}${asc ?? ""}`);
  sql = sql.replace(/(\$\d+|'[^']*')\s*=\s*ANY\(\s*string_to_array\(\s*([\w.]+)\s*,\s*','\s*\)\s*\)/gi, "FIND_IN_SET($1, $2) > 0");
  sql = sql.replace(/([\w.]+)::date\b/gi, "DATE($1)");
  sql = sql.replace(/\bAS\s+timestamp\b/gi, "AS DATETIME").replace(/\bAS\s+(?:integer|int|bigint)\b/gi, "AS SIGNED").replace(/\bAS\s+text\b/gi, "AS CHAR");
  if (/\bOFFSET\b/i.test(sql) && !/\bLIMIT\b/i.test(sql)) sql = sql.replace(/\bOFFSET\b/i, "LIMIT 18446744073709551615 OFFSET");
  // INTERVAL '15 minutes' has its amount inside a quoted string, so it is handled before the quotes are set aside.
  sql = sql.replace(/INTERVAL\s+'\s*(\d+)\s+([a-z]+?)s?\s*'/gi, (m, n: string, u: string) => `INTERVAL ${n} ${UNIT[u.toLowerCase()] ?? UNIT[`${u.toLowerCase()}s`] ?? u.toUpperCase()}`);

  let returning: string[] | null = null;
  let insertIgnore = false;
  const values: unknown[] = [];

  sql = codeOnly(sql, (code) => {
    let c = code;
    c = c.replace(/::\s*[a-z_]+(?:\(\d+(?:\s*,\s*\d+)?\))?(?:\[\])?/gi, ""); // casts: $1::int, x::text, '{}'::jsonb
    c = c.replace(/=\s*ANY\(\s*(\$\d+)\s*\)/gi, "IN ($1)");
    c = c.replace(/(?:<>|!=)\s*ALL\(\s*(\$\d+)\s*\)/gi, "NOT IN ($1)");
    c = c.replace(/\bILIKE\b/gi, "LIKE");
    c = c.replace(/make_interval\(\s*([a-z]+)\s*=>\s*([^()]+?)\s*\)/gi, (m, u: string, e: string) => `INTERVAL (${e}) ${UNIT[u.toLowerCase()] ?? u.toUpperCase()}`);
    return c;
  });

  // ON CONFLICT ... DO NOTHING | DO UPDATE SET ...   and   RETURNING cols   (on INSERT statements)
  sql = sql.replace(/\s+RETURNING\s+([\w\s,]+?)\s*$/i, (m, cols: string) => { returning = cols.split(",").map((s) => s.trim()).filter(Boolean); return ""; });
  sql = sql.replace(/\s+ON\s+CONFLICT\s*(?:\([^)]*\))?\s+DO\s+NOTHING\s*$/i, () => { insertIgnore = true; return ""; });
  if (insertIgnore) sql = sql.replace(/^\s*INSERT\s+INTO/i, "INSERT IGNORE INTO");
  sql = sql.replace(/\s+ON\s+CONFLICT\s*(?:\([^)]*\))?\s+DO\s+UPDATE\s+SET\s+([\s\S]+)$/i, (m, set: string) => ` ON DUPLICATE KEY UPDATE ${set.replace(/\bEXCLUDED\.(\w+)/gi, "VALUES($1)")}`);

  // numbered placeholders -> ?, with the values lined up in order of appearance (a number may repeat or come out of order)
  sql = codeOnly(sql, (code) => code.replace(/\$(\d+)/g, (m, n: string) => { const v = params[Number(n) - 1]; values.push(Array.isArray(v) && v.length === 0 ? null : v); return "?"; }));
  return { sql, values, returning, insertIgnore };
}

/* ------------------------------------------------------------------ running statements ------------------------------------------- */

type Exec = Pick<Pool, "query"> | Pick<PoolConnection, "query">;

interface Result<T> { rows: T[]; rowCount: number }

async function exec<T extends Row>(x: Exec, sqlIn: string, params: unknown[], asArray = false): Promise<Result<T>> {
  const t = translate(sqlIn, params);
  const [res] = (await (x as Pool).query({ sql: t.sql, values: t.values as never[], rowsAsArray: asArray })) as unknown as [unknown];
  if (Array.isArray(res)) return { rows: res as T[], rowCount: res.length };
  const h = res as ResultSetHeader;
  if (t.returning) {
    // INSERT ... RETURNING id: the new id. With ON CONFLICT DO NOTHING nothing comes back when the row already existed.
    const rows = h.affectedRows > 0 && h.insertId ? [{ id: h.insertId } as unknown as T] : [];
    return { rows, rowCount: rows.length };
  }
  return { rows: [], rowCount: h.affectedRows ?? 0 };
}

/** Run a statement and return all rows. Use $1, $2 ... placeholders. */
export async function all<T extends Row = Row>(sql: string, params: unknown[] = []): Promise<T[]> {
  return (await exec<T>(pool(), sql, params)).rows;
}

export async function one<T extends Row = Row>(sql: string, params: unknown[] = []): Promise<T | null> {
  return (await all<T>(sql, params))[0] ?? null;
}

/** First column of the first row, or null. */
export async function val<T = unknown>(sql: string, params: unknown[] = []): Promise<T | null> {
  const t = translate(sql, params);
  if (t.returning) {
    const r = await exec<Row>(pool(), sql, params);
    const v = r.rows[0]?.[t.returning[0]];
    return (v === undefined ? null : v) as T | null;
  }
  const r = await exec<Row>(pool(), sql, params, true);
  const v = (r.rows[0] as unknown as unknown[] | undefined)?.[0];
  return (v === undefined ? null : v) as T | null;
}

/** Run a statement, returning the number of affected rows. */
export async function run(sql: string, params: unknown[] = []): Promise<number> {
  return (await exec(pool(), sql, params)).rowCount;
}

/** A connection inside a transaction. query() returns { rows, rowCount }. */
export interface Conn {
  query<T extends Row = Row>(sql: string | { text: string; values?: unknown[] }, params?: unknown[]): Promise<{ rows: T[]; rowCount: number }>;
}
export type PoolClient = Conn;

/** Run several statements atomically. The callback gets a connection; throw to roll back. */
export async function tx<T>(fn: (c: Conn) => Promise<T>): Promise<T> {
  const conn = await pool().getConnection();
  const c: Conn = { query: (s, p = []) => (typeof s === "string" ? exec(conn, s, p) : exec(conn, s.text, s.values ?? [])) as never };
  try {
    await conn.beginTransaction();
    const out = await fn(c);
    await conn.commit();
    return out;
  } catch (e) {
    await conn.rollback().catch(() => undefined);
    throw e;
  } finally {
    conn.release();
  }
}

/** For tests and shutdown. */
export async function closePool(): Promise<void> {
  if (g.__portalPool) {
    await g.__portalPool.end();
    g.__portalPool = undefined;
  }
}
