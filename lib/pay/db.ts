import { all, run, tx as poolTx, type Conn } from "@/lib/portal/db";

/** A database handle: either a transaction connection or the plain pool. Functions take one so callers decide the transaction boundary. */
export type Db = Conn;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = Record<string, any>;

export const pool: Db = {
  async query<T extends Row = Row>(sql: string | { text: string; values?: unknown[] }, params: unknown[] = []) {
    const text = typeof sql === "string" ? sql : sql.text;
    const values = typeof sql === "string" ? params : sql.values ?? [];
    if (/^\s*(select|show|with)\b/i.test(text) || /\breturning\b/i.test(text)) {
      const rows = (await all<T>(text, values)) as T[];
      return { rows, rowCount: rows.length };
    }
    return { rows: [] as T[], rowCount: await run(text, values) };
  },
};

export const tx = poolTx;

/** Run a transaction, trying again (up to three times) if MySQL picks it as a deadlock victim or a lock wait times out. The work must be safe to repeat from the start. */
export async function txRetry<T>(fn: (db: Db) => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await poolTx(fn);
    } catch (e) {
      const errno = (e as { errno?: number }).errno;
      if ((errno === 1213 || errno === 1205) && attempt < 3) { await new Promise((r) => setTimeout(r, 40 * attempt + Math.floor(Math.random() * 60))); continue; }
      throw e;
    }
  }
}

export async function rows<T extends Row = Row>(db: Db, sql: string, params: unknown[] = []): Promise<T[]> {
  return (await db.query<T>(sql, params)).rows;
}
export async function first<T extends Row = Row>(db: Db, sql: string, params: unknown[] = []): Promise<T | null> {
  return (await db.query<T>(sql, params)).rows[0] ?? null;
}
export async function exec(db: Db, sql: string, params: unknown[] = []): Promise<number> {
  return (await db.query(sql, params)).rowCount;
}
/** INSERT and return the new auto-increment id. */
export async function insertId(db: Db, sql: string, params: unknown[] = []): Promise<number> {
  const r = await db.query<{ id: number }>(`${sql} RETURNING id`, params);
  const id = r.rows[0]?.id;
  if (!id) throw new Error("Insert did not return an id");
  return Number(id);
}

/** "YYYY-MM-DD HH:MM:SS.mmm" in UTC, for comparisons and inserts. */
export function dbTime(d: Date | number = new Date()): string {
  const x = typeof d === "number" ? new Date(d) : d;
  return x.toISOString().replace("T", " ").replace("Z", "");
}
/** A DATETIME string from the database (UTC) as a Date. */
export function fromDb(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(String(s).replace(" ", "T") + (/[zZ]|[+-]\d\d:?\d\d$/.test(String(s)) ? "" : "Z"));
  return Number.isNaN(d.getTime()) ? null : d;
}
