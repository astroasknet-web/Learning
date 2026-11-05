import "server-only";
import { exec, first, pool, rows, type Db } from "../pay/db";
import { configSchema, DEFAULT_CONFIG, type Config } from "./config";
import { backfill } from "./ingest";
import { audit, getConfig, refreshMastery } from "./store";
import { AREAS, isArea, SEED_TOPIC_IDS, topicById } from "./taxonomy";
import { STUDIO_SLUG } from "./access";

/** Administrator operations for the Mathematics Studio: integration monitoring, scoring configuration, taxonomy management, reprocessing and reports. Every change is audited; aggregate reports describe groups only. */
export type Result = { ok: true; message: string } | { ok: false; message: string };
const fail = (m: string): Result => ({ ok: false, message: m });

// ---- integration status ----------------------------------------------------------------------------------------------------------

export interface SourceStatus { source: string; label: string; processed: number; available: number | null; items: number; students: number; lastAt: string | null }
export async function integrationStatus(db: Db = pool): Promise<SourceStatus[]> {
  const out: SourceStatus[] = [];
  const bySource = await rows(db, "SELECT source, COUNT(*) AS n, COALESCE(SUM(item_count),0) AS items, COUNT(DISTINCT user_id) AS students, MAX(finished_at) AS last FROM mx_attempts GROUP BY source");
  const greAvail = Number((await first(db, "SELECT COUNT(*) AS n FROM test_attempts WHERE exam = 'gre-quant'"))?.n ?? 0);
  const msAvail = Number((await first(db, "SELECT COUNT(*) AS n FROM ms_sessions WHERE status = 'submitted'"))?.n ?? 0);
  const avail: Record<string, number> = { "gre-quant": greAvail, "math-speed": msAvail };
  const labels: Record<string, string> = { "gre-quant": "GRE Quant mocks", "math-speed": "Mathematics Speed studio", "jee-mains": "JEE Main (maths)", "neet-ug": "NEET UG (maths)", "upsc-prelims": "UPSC Prelims (quant)", "ssc-cgl": "SSC CGL (quant)" };
  const label = (src: string): string => labels[src] ?? (/^imo-/.test(src) ? `IMO ${src.replace("imo-class-", "Class ").replace("imo-", "")} mock` : src);
  const seen = new Set<string>();
  for (const r of bySource) { seen.add(r.source); out.push({ source: r.source, label: label(r.source), processed: Number(r.n), available: avail[r.source] ?? null, items: Number(r.items), students: Number(r.students), lastAt: r.last ? String(r.last) : null }); }
  for (const [src, label] of Object.entries(labels)) if (!seen.has(src)) out.push({ source: src, label, processed: 0, available: avail[src], items: 0, students: 0, lastAt: null });
  return out;
}

export interface AdminStats { minCohort: number; students: number; attempts: number; items: number; premium: number; ctaClicks: number; conversion: number | null; avgScore: number | null; hardestTopics: Array<{ topic: string; avg: number; students: number }> | null; suppressed: boolean }
export async function adminStats(db: Db = pool): Promise<AdminStats> {
  const cfg = await getConfig(db);
  const num = async (sql: string, p: unknown[] = []) => Number((await first(db, sql, p))?.n ?? 0);
  const students = await num("SELECT COUNT(DISTINCT user_id) AS n FROM mx_attempts");
  const small = students < cfg.minCohort;
  const premium = await num("SELECT COUNT(DISTINCT user_id) AS n FROM pay_entitlements WHERE kind = 'course' AND ref = $1 AND status = 'active'", [STUDIO_SLUG]);
  const avg = small ? null : Number((await first(db, "SELECT AVG(overall_score) AS a FROM mx_attempts WHERE overall_score IS NOT NULL"))?.a ?? 0) || null;
  const hardest = small ? null : (await rows(db, "SELECT topic, AVG(score) AS a, COUNT(*) AS u FROM mx_mastery GROUP BY topic HAVING COUNT(DISTINCT user_id) >= $1 ORDER BY AVG(score) ASC LIMIT 6", [cfg.minCohort])).map((r) => ({ topic: r.topic, avg: Math.round(Number(r.a) * 10) / 10, students: Number(r.u) }));
  return { minCohort: cfg.minCohort, students, attempts: await num("SELECT COUNT(*) AS n FROM mx_attempts"), items: await num("SELECT COUNT(*) AS n FROM mx_items"), premium, ctaClicks: await num("SELECT COUNT(*) AS n FROM mx_events WHERE event = 'cta_click'"), conversion: small || !students ? null : Math.round((1000 * premium) / students) / 10, avgScore: avg === null ? null : Math.round(avg * 10) / 10, hardestTopics: hardest, suppressed: small };
}

// ---- configuration ---------------------------------------------------------------------------------------------------------------

export async function saveConfig(actor: number, patch: Partial<Record<keyof Config, unknown>>, db: Db = pool): Promise<Result> {
  const before = await getConfig(db);
  const next: Record<string, unknown> = { ...before };
  for (const [k, v] of Object.entries(patch)) if (k in DEFAULT_CONFIG) next[k] = v;
  const parsed = configSchema.safeParse(next);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Those settings are not valid.");
  const changed = Object.keys(patch).filter((k) => JSON.stringify((before as Record<string, unknown>)[k]) !== JSON.stringify((parsed.data as Record<string, unknown>)[k]));
  for (const k of changed) await exec(db, "INSERT INTO mx_config (k, v_json, updated_by) VALUES ($1,$2,$3) ON DUPLICATE KEY UPDATE v_json = VALUES(v_json), updated_by = VALUES(updated_by)", [k, JSON.stringify((parsed.data as Record<string, unknown>)[k]), actor]);
  if (changed.length) await audit(db, actor, "config.changed", "config", changed.join(","), { before: Object.fromEntries(changed.map((k) => [k, (before as Record<string, unknown>)[k]])), after: Object.fromEntries(changed.map((k) => [k, (parsed.data as Record<string, unknown>)[k]])) });
  return { ok: true, message: changed.length ? `Saved: ${changed.join(", ")}. New analytics use the new settings; a reprocess applies them to stored scores.` : "Nothing changed." };
}
export async function resetConfig(actor: number, db: Db = pool): Promise<Result> {
  await exec(db, "DELETE FROM mx_config");
  await audit(db, actor, "config.reset", "config", "all");
  return { ok: true, message: "Settings are back to the starting values. Reprocess to apply them to stored scores." };
}

// ---- taxonomy --------------------------------------------------------------------------------------------------------------------

export interface TopicRow { id: string; name: string; area: string; cognitive: string; position: number; active: boolean; items: number }
export async function listTopics(db: Db = pool): Promise<TopicRow[]> {
  const used = new Map((await rows(db, "SELECT topic, COUNT(*) AS n FROM mx_items GROUP BY topic")).map((r) => [String(r.topic), Number(r.n)]));
  return (await rows(db, "SELECT id, name, area, cognitive, position, active FROM mx_topics ORDER BY position ASC, id ASC")).map((r) => ({ id: String(r.id), name: String(r.name), area: String(r.area), cognitive: String(r.cognitive), position: Number(r.position), active: Number(r.active) === 1, items: used.get(String(r.id)) ?? 0 }));
}
export async function saveTopic(actor: number, e: { id: string; name: string; area: string; position: number; active: boolean }, db: Db = pool): Promise<Result> {
  if (!SEED_TOPIC_IDS.includes(e.id)) return fail("That topic id is not recognised. Adding brand-new topic ids needs an engine change so adapters can map to them.");
  if (e.name.trim().length < 3 || e.name.length > 100) return fail("Give the topic a name of 3 to 100 characters.");
  if (!isArea(e.area)) return fail("Unknown area.");
  await exec(db, "UPDATE mx_topics SET name = $1, area = $2, position = $3, active = $4 WHERE id = $5", [e.name.trim(), e.area, e.position, e.active ? 1 : 0, e.id]);
  await audit(db, actor, "topic.changed", "topic", e.id, { name: e.name, area: e.area, active: e.active });
  return { ok: true, message: `Topic ${e.id} saved.` };
}

// ---- reprocess -------------------------------------------------------------------------------------------------------------------

export async function reprocess(actor: number, db: Db = pool): Promise<Result> {
  const r = await backfill(db);
  await audit(db, actor, "reprocess.all", "engine", "all", { ...r });
  return { ok: true, message: `Reprocessed from source: ${r.gre} GRE and ${r.mathspeed} Mathematics Speed attempts (${r.errors} skipped). Mastery is refreshed.` };
}
export async function reprocessUser(actor: number, userId: number, db: Db = pool): Promise<Result> {
  await refreshMastery(db, userId, await getConfig(db));
  await audit(db, actor, "reprocess.user", "student", userId);
  return { ok: true, message: `Recomputed mastery for student ${userId}.` };
}

// ---- reports ---------------------------------------------------------------------------------------------------------------------

export async function recentAudit(limit = 40, db: Db = pool): Promise<Array<{ id: number; at: string; actor: string; action: string; entity: string; entityId: string; detail: string }>> {
  return (await rows(db, `SELECT a.id, a.created_at, a.action, a.entity, a.entity_id, a.detail_json, COALESCE(u.name, 'system') AS actor FROM mx_audit a LEFT JOIN users u ON u.id = a.actor_id ORDER BY a.id DESC LIMIT ${Math.max(1, Math.min(200, limit))}`)).map((r) => ({ id: Number(r.id), at: String(r.created_at), actor: String(r.actor), action: String(r.action), entity: String(r.entity), entityId: String(r.entity_id), detail: String(r.detail_json) }));
}

export async function aggregateCsv(db: Db = pool): Promise<string> {
  const cfg = await getConfig(db);
  const out = ["topic,area,students,avg_mastery"];
  for (const r of await rows(db, "SELECT m.topic, COUNT(DISTINCT m.user_id) AS u, AVG(m.score) AS a FROM mx_mastery m GROUP BY m.topic HAVING COUNT(DISTINCT m.user_id) >= $1 ORDER BY m.topic", [cfg.minCohort])) {
    const area = topicById(String(r.topic))?.area ?? "";
    out.push([r.topic, area, r.u, Math.round(Number(r.a) * 10) / 10].join(","));
  }
  if (out.length === 1) out.push(`# no topic has at least ${cfg.minCohort} students yet, so none is shown`);
  return out.join("\r\n");
}
