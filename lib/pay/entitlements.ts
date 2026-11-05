import { first, rows, pool, type Db } from "./db";

/** Read side of the entitlements table: what a person has bought and may use right now. */
const ORDER_OF_PLANS = ["pro", "silver", "gold"];

export interface Entitlement { id: number; kind: string; ref: string; title: string; startsAt: string; expiresAt: string | null; status: string; orderId: string }

export async function entitlementsFor(userId: number, db: Db = pool): Promise<Entitlement[]> {
  const r = await rows(db, "SELECT e.id, e.kind, e.ref, e.status, e.starts_at, e.expires_at, i.title, o.public_id FROM pay_entitlements e JOIN pay_order_items i ON i.id = e.order_item_id JOIN pay_orders o ON o.id = e.order_id WHERE e.user_id = $1 ORDER BY e.id DESC", [userId]);
  return r.map((x) => ({ id: Number(x.id), kind: x.kind, ref: x.ref, title: x.title, startsAt: String(x.starts_at), expiresAt: x.expires_at ? String(x.expires_at) : null, status: x.status, orderId: x.public_id }));
}

/** The highest plan the person currently holds ("pro" | "silver" | "gold"), or null for the free plan. */
export async function activePlan(userId: number, db: Db = pool): Promise<string | null> {
  const r = await rows<{ ref: string }>(db, "SELECT ref FROM pay_entitlements WHERE user_id = $1 AND kind = 'plan' AND status = 'active' AND (expires_at IS NULL OR expires_at > UTC_TIMESTAMP(3))", [userId]);
  const best = r.map((x) => ORDER_OF_PLANS.indexOf(x.ref)).reduce((a, b) => Math.max(a, b), -1);
  return best >= 0 ? ORDER_OF_PLANS[best] : null;
}

export async function hasEntitlement(userId: number, kind: string, ref: string, db: Db = pool): Promise<boolean> {
  const r = await first(db, "SELECT id FROM pay_entitlements WHERE user_id = $1 AND kind = $2 AND ref = $3 AND status = 'active' AND (expires_at IS NULL OR expires_at > UTC_TIMESTAMP(3)) LIMIT 1", [userId, kind, ref]);
  return r !== null;
}
