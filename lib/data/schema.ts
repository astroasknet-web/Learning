import { all } from "@/lib/portal/db";

/**
 * What the data layer needs to know about each column to turn a row into the shapes the app expects:
 *   dt   DATETIME  <-> ISO 8601 string (UTC)
 *   bool TINYINT(1) <-> true / false
 *   json LONGTEXT holding JSON <-> parsed value (column comment "json", optionally "json:[]" for the default)
 * Read once from information_schema and kept for the life of the process.
 */
export type Kind = "dt" | "bool" | "json" | "date" | "other";
export interface ColumnMeta { kind: Kind; generated: boolean; autoIncrement: boolean; uuid: boolean; jsonDefault: string | null; nullable: boolean; hasDefault: boolean }
export type TableMeta = Map<string, ColumnMeta>;

const g = globalThis as unknown as { __dataMeta?: Promise<Map<string, TableMeta>> };

async function load(): Promise<Map<string, TableMeta>> {
  const rows = await all<{ t: string; c: string; ct: string; dt: string; extra: string; cm: string; nl: string; df: string | null }>(
    "SELECT TABLE_NAME AS t, COLUMN_NAME AS c, COLUMN_TYPE AS ct, DATA_TYPE AS dt, EXTRA AS extra, COLUMN_COMMENT AS cm, IS_NULLABLE AS nl, COLUMN_DEFAULT AS df FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()",
  );
  const out = new Map<string, TableMeta>();
  for (const r of rows) {
    const t = out.get(r.t) ?? new Map<string, ColumnMeta>();
    out.set(r.t, t);
    const comment = String(r.cm ?? "");
    const type = String(r.ct).toLowerCase();
    const kind: Kind = comment.startsWith("json") ? "json" : /^tinyint\(1\)/.test(type) ? "bool" : /^(datetime|timestamp)/.test(type) ? "dt" : type === "date" ? "date" : "other";
    const extra = String(r.extra ?? "").toLowerCase();
    t.set(r.c, {
      kind,
      generated: extra.includes("generated"),
      autoIncrement: extra.includes("auto_increment"),
      uuid: type === "char(36)",
      jsonDefault: kind === "json" && comment.includes(":") ? comment.slice(comment.indexOf(":") + 1) : null,
      nullable: r.nl === "YES",
      hasDefault: r.df !== null || extra.includes("auto_increment") || extra.includes("default_generated"),
    });
  }
  return out;
}

export async function tableMeta(table: string): Promise<TableMeta> {
  g.__dataMeta ??= load().catch((e) => { g.__dataMeta = undefined; throw e; });
  return (await g.__dataMeta).get(table) ?? new Map();
}

/** After a migration (tests). */
export function resetMeta(): void {
  g.__dataMeta = undefined;
}

const pad = (n: number, w = 2): string => String(n).padStart(w, "0");

/** ISO 8601 (or a Date) -> "YYYY-MM-DD HH:MM:SS.mmm" in UTC. Anything else is returned unchanged. */
export function toDbTime(v: unknown): unknown {
  if (v === null || v === undefined) return v;
  const d = v instanceof Date ? v : typeof v === "string" && /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(v) ? parseTime(v) : null;
  if (!d || Number.isNaN(d.getTime())) return v;
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}.${pad(d.getUTCMilliseconds(), 3)}`;
}

/** A time string with no zone is read as UTC, matching the database session. */
function parseTime(s: string): Date {
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/i.test(s);
  return new Date(hasZone ? s : s.replace(" ", "T") + "Z");
}

/** "YYYY-MM-DD HH:MM:SS(.mmm)" from the database -> ISO 8601 with Z. */
export function fromDbTime(v: unknown): unknown {
  if (typeof v !== "string") return v;
  const d = parseTime(v);
  return Number.isNaN(d.getTime()) ? v : d.toISOString();
}

export function toDb(meta: ColumnMeta | undefined, v: unknown): unknown {
  if (v === undefined) return undefined;
  if (v === null) return null;
  switch (meta?.kind) {
    case "dt": return toDbTime(v);
    case "bool": return v === true || v === 1 || v === "1" || v === "true" ? 1 : 0;
    case "json": return JSON.stringify(v);
    default: return v instanceof Date ? toDbTime(v) : typeof v === "boolean" ? (v ? 1 : 0) : v;
  }
}

export function fromDb(meta: ColumnMeta | undefined, v: unknown): unknown {
  if (v === null || v === undefined) return v ?? null;
  switch (meta?.kind) {
    case "dt": return fromDbTime(v);
    case "bool": return v === 1 || v === true || v === "1";
    case "json":
      if (typeof v !== "string") return v;
      try { return JSON.parse(v); } catch { return v; }
    default: return v;
  }
}
