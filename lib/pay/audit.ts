import { createHash } from "node:crypto";
import { dbTime, exec, first, insertId, rows, tx, type Db } from "./db";

/**
 * The payment audit log: append-only, and hash-chained, so changing or deleting an old row is detectable. Each row stores the hash of
 * the row before it; `verifyAuditChain` walks the chain. Detail is JSON with secrets and card-like values removed.
 */
export type ActorType = "customer" | "staff" | "system" | "provider";
export interface AuditEvent {
  actorType: ActorType;
  actorId?: string | number | null;
  action: string;
  entity: "order" | "payment" | "refund" | "webhook" | "price" | "coupon" | "reconciliation" | "export" | "staff" | "dispute";
  entityId: string | number;
  detail?: Record<string, unknown>;
}

const SECRET_KEY = /(secret|token|password|authorization|api[_-]?key|signature|card|cvv|cvc|pan|pin|otp)/i;

/** Remove anything that looks like a credential, and cut long strings, before writing or logging. */
export function redact(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return value.length > 300 ? value.slice(0, 300) + "..." : value;
  if (typeof value !== "object") return value;
  if (depth > 4) return "[nested]";
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => redact(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = SECRET_KEY.test(k) ? "[removed]" : redact(v, depth + 1);
  return out;
}

const hashOf = (prev: string, at: string, actorType: string, actorId: string | null, action: string, entity: string, entityId: string, detail: string): string =>
  createHash("sha256").update(JSON.stringify([prev, at, actorType, actorId, action, entity, entityId, detail])).digest("hex");

/** Write one event using an open transaction (the head row is locked, so concurrent writers queue up and the chain stays linear). */
export async function auditIn(db: Db, e: AuditEvent): Promise<void> {
  const head = await first<{ last_hash: string }>(db, "SELECT last_hash FROM pay_audit_head WHERE id = 1 FOR UPDATE");
  const prev = head?.last_hash ?? "0".repeat(64);
  const at = dbTime();
  const actorId = e.actorId === undefined || e.actorId === null ? null : String(e.actorId);
  const detail = JSON.stringify(redact(e.detail ?? {}));
  const hash = hashOf(prev, at, e.actorType, actorId, e.action, e.entity, String(e.entityId), detail);
  await insertId(db, "INSERT INTO pay_audit_events (at, actor_type, actor_id, action, entity, entity_id, detail, prev_hash, hash) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)", [at, e.actorType, actorId, e.action, e.entity, String(e.entityId), detail, prev, hash]);
  await exec(db, "UPDATE pay_audit_head SET last_hash = $1 WHERE id = 1", [hash]);
}

/** Write one event in its own transaction. */
export async function audit(e: AuditEvent): Promise<void> {
  await tx((c) => auditIn(c, e));
}

/** Walk the chain from the start. Returns the first broken row, or null when intact. */
export async function verifyAuditChain(db: Db, limit = 100_000): Promise<{ brokenAt: number | null; checked: number }> {
  const list = await rows<{ id: number; at: string; actor_type: string; actor_id: string | null; action: string; entity: string; entity_id: string; detail: string; prev_hash: string; hash: string }>(
    db, "SELECT id, at, actor_type, actor_id, action, entity, entity_id, detail, prev_hash, hash FROM pay_audit_events ORDER BY id ASC LIMIT $1", [limit]);
  let prev = "0".repeat(64);
  let n = 0;
  for (const r of list) {
    const want = hashOf(prev, String(r.at), r.actor_type, r.actor_id, r.action, r.entity, r.entity_id, r.detail ?? "{}");
    if (r.prev_hash !== prev || r.hash !== want) return { brokenAt: r.id, checked: n };
    prev = r.hash;
    n++;
  }
  return { brokenAt: null, checked: n };
}
