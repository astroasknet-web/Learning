import * as studio from "@/lib/studio/access";
import { dbTime, exec, first, rows, type Db, type Row } from "./db";

/**
 * Fulfilment: turning a paid order into access. Called only from settlement, inside the same transaction that marks the order paid.
 *
 * Each order item gets exactly one row in `pay_entitlements` (the unique key is the order item), so running fulfilment twice, or from
 * two requests at once, cannot grant anything twice. The side effect for an item (enrolling in a course, switching on Studio Pro) runs only
 * when that row was newly inserted.
 *
 *   plan                    the entitlement row is the access record (see entitlements.ts)
 *   course                  enrols the buyer in the course
 *   resume (studio_pro)     switches on Resume Studio Pro
 *   ebook, class, other     the entitlement row is the access record
 *   consulting              the entitlement row, plus a task for staff (the caller queues the alert)
 */
export interface FulfilResult { granted: number; staffTasks: string[] }

const addDays = (days: number | null, qty: number): string | null => (days === null ? null : dbTime(Date.now() + days * qty * 86_400_000));

async function sideEffect(db: Db, it: Row, userId: number, order: Row): Promise<void> {
  if (it.kind === "course") {
    const c = await first<{ id: number }>(db, "SELECT id FROM courses WHERE slug = $1", [it.fulfil_ref]);
    if (c) await exec(db, "INSERT IGNORE INTO course_enrolments (user_id, course_id, status, done_json, progress, started_at, updated_at) VALUES ($1,$2,'enrolled','[]',0,NOW(),NOW())", [userId, c.id]);
  } else if (it.kind === "resume" && it.fulfil_ref === "studio_pro") {
    const paise = order.currency === "INR" ? Number(it.total_minor) : 0;
    await studio.grant(userId, "payment", String(order.public_id), paise, it.access_days === null ? null : Number(it.access_days) * Number(it.qty), db);
  }
}

export async function fulfilOrder(db: Db, order: Row): Promise<FulfilResult> {
  const items = await rows(db, "SELECT * FROM pay_order_items WHERE order_id = $1 ORDER BY id", [order.id]);
  const out: FulfilResult = { granted: 0, staffTasks: [] };
  for (const it of items) {
    const inserted = await exec(db,
      "INSERT IGNORE INTO pay_entitlements (order_id, order_item_id, user_id, email, product_id, kind, ref, status, starts_at, expires_at) VALUES ($1,$2,$3,$4,$5,$6,$7,'active',$8,$9)",
      [order.id, it.id, order.user_id, order.email, it.product_id, it.kind, it.fulfil_ref, dbTime(), addDays(it.access_days === null ? null : Number(it.access_days), Number(it.qty))]);
    if (inserted === 0) continue; // already fulfilled
    out.granted++;
    if (order.user_id !== null) await sideEffect(db, it, Number(order.user_id), order);
    if (it.kind === "consulting" || it.kind === "class") out.staffTasks.push(`${it.title} (order ${order.public_id}, ${order.email})`);
  }
  return out;
}

/** A guest buyer signed up: attach their entitlements to the new account and run the deferred side effects. Only call with a verified email. */
export async function claimGuestEntitlements(db: Db, user: { id: number; email: string }): Promise<number> {
  const list = await rows(db, "SELECT e.id, e.order_id, e.order_item_id FROM pay_entitlements e WHERE e.user_id IS NULL AND e.email = $1 AND e.status = 'active'", [user.email.toLowerCase()]);
  for (const e of list) {
    await exec(db, "UPDATE pay_entitlements SET user_id = $1 WHERE id = $2 AND user_id IS NULL", [user.id, e.id]);
    await exec(db, "UPDATE pay_orders SET user_id = $1 WHERE id = $2 AND user_id IS NULL", [user.id, e.order_id]);
    const it = await first(db, "SELECT * FROM pay_order_items WHERE id = $1", [e.order_item_id]);
    const order = await first(db, "SELECT * FROM pay_orders WHERE id = $1", [e.order_id]);
    if (it && order) await sideEffect(db, it, user.id, order);
  }
  return list.length;
}

/**
 * Take access away after a full refund or a lost dispute. Courses the buyer has verifiably completed stay (a completion is a permanent
 * record); everything else is revoked. Partial refunds do not revoke anything: that is a business decision made by staff.
 */
export async function revokeOrderEntitlements(db: Db, orderId: number, reason: string): Promise<number> {
  const list = await rows(db, "SELECT * FROM pay_entitlements WHERE order_id = $1 AND status = 'active'", [orderId]);
  for (const e of list) {
    await exec(db, "UPDATE pay_entitlements SET status = 'revoked', revoked_at = $1, revoke_reason = $2 WHERE id = $3", [dbTime(), reason.slice(0, 120), e.id]);
    if (e.user_id === null) continue;
    if (e.kind === "course") {
      const c = await first<{ id: number }>(db, "SELECT id FROM courses WHERE slug = $1", [e.ref]);
      if (c) await exec(db, "DELETE FROM course_enrolments WHERE user_id = $1 AND course_id = $2 AND verified = 0", [e.user_id, c.id]);
    } else if (e.kind === "resume" && e.ref === "studio_pro") {
      const others = await first<{ n: number }>(db, "SELECT COUNT(*) AS n FROM pay_entitlements WHERE user_id = $1 AND kind = 'resume' AND ref = 'studio_pro' AND status = 'active' AND id <> $2", [e.user_id, e.id]);
      if (Number(others?.n ?? 0) === 0) await studio.revoke(Number(e.user_id));
    }
  }
  return list.length;
}
