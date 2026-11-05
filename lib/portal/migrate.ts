import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";
import { connectionConfig } from "./db";

/**
 * Applies the database migrations in db/migrations (2026*.sql) that this database has not seen yet, in order, recording each one in
 * schema_meta as "migration:<file>". Safe to run repeatedly and from several servers at once (a named lock). Used by
 * `npm run portal:migrate` and, when PORTAL_AUTO_MIGRATE=1, once at server start.
 *
 * MySQL and MariaDB cannot roll back table changes, so each file is written to be repeatable: CREATE TABLE IF NOT EXISTS, and a
 * duplicate index or column (errors 1061 and 1060) is skipped. A file is recorded only after every statement has run.
 */
export interface MigrationReport { applied: string[]; pending: string[]; all: string[] }

const SKIPPABLE = new Set([1060, 1061, 1050, 1091, 1826]); // duplicate column, duplicate key name, table exists, cannot drop, duplicate foreign key

/** Split a file into statements, ignoring semicolons inside quotes and comments. */
export function splitStatements(sql: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q: string | null = null;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    const next = sql[i + 1];
    if (q) {
      cur += ch;
      if (ch === "\\" && q !== "`") { cur += next ?? ""; i++; continue; }
      if (ch === q) { if (next === q) { cur += next; i++; } else q = null; }
      continue;
    }
    if (ch === "-" && next === "-") { const e = sql.indexOf("\n", i); i = e === -1 ? sql.length : e; cur += "\n"; continue; }
    if (ch === "/" && next === "*") { const e = sql.indexOf("*/", i + 2); i = e === -1 ? sql.length : e + 1; continue; }
    if (ch === "'" || ch === '"' || ch === "`") { q = ch; cur += ch; continue; }
    if (ch === ";") { if (cur.trim()) out.push(cur.trim()); cur = ""; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

export async function runPortalMigrations(url: string, opts: { statusOnly?: boolean; dir?: string } = {}): Promise<MigrationReport> {
  const dir = opts.dir ?? path.join(process.cwd(), "db", "migrations");
  const files = fs.readdirSync(dir).filter((f) => /^2026\d+_.+\.sql$/.test(f)).sort();
  const c = await mysql.createConnection(connectionConfig(url));
  try {
    await c.query("SELECT GET_LOCK('growqr-portal-migrate', 120)");
    await c.query("CREATE TABLE IF NOT EXISTS schema_meta (k varchar(120) NOT NULL PRIMARY KEY, v varchar(255) NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    const [rows] = await c.query("SELECT k FROM schema_meta WHERE k LIKE 'migration:%'");
    const done = new Set((rows as Array<{ k: string }>).map((r) => String(r.k).slice(10)));
    const pending = files.filter((f) => !done.has(f));
    const applied: string[] = [];
    if (!opts.statusOnly) {
      for (const f of pending) {
        for (const stmt of splitStatements(fs.readFileSync(path.join(dir, f), "utf8"))) {
          try {
            await c.query(stmt);
          } catch (e) {
            const err = e as { errno?: number; message: string };
            if (err.errno !== undefined && SKIPPABLE.has(err.errno)) continue;
            throw new Error(`${f}: ${err.message}\n  in: ${stmt.replace(/\s+/g, " ").slice(0, 160)}`);
          }
        }
        await c.query("INSERT INTO schema_meta (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)", [`migration:${f}`, new Date().toISOString()]);
        applied.push(f);
      }
    }
    return { applied, pending: opts.statusOnly ? pending : [], all: files };
  } finally {
    await c.query("SELECT RELEASE_LOCK('growqr-portal-migrate')").catch(() => undefined);
    await c.end();
  }
}
