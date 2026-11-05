import "server-only";
import { all, one, run, val } from "../portal/db";
import { appUrl, send } from "../portal/mail";
import { LIMITS, PRIORITY_LABEL, STAFF_STATUS_LABEL, STATUS_LABEL, canRate, canUserReply, categoryLabel, defaultPriority, isPriority, isStatus, isTicketNo, shouldAutoClose, statusAfterStaffReply, statusAfterUserReply, ticketNo, type NewTicket, type Priority, type Status } from "./model";

/**
 * Support tickets on the portal database. A ticket always belongs to a signed-in account, so only registered people can raise one and
 * every query that serves a person filters by their user id. Staff (role admin) see and work every ticket from the admin console.
 */
export interface Ticket {
  id: number; no: string; userId: number; userName: string; userEmail: string;
  category: string; subject: string; relatedRef: string;
  status: Status; priority: Priority; assignedTo: number | null; assignedName: string | null;
  rating: number | null; ratingComment: string | null;
  createdAt: string; updatedAt: string; lastActivityAt: string; resolvedAt: string | null; closedAt: string | null;
  /** Unread messages for the person (their list) or for staff (the inbox). */
  unread: number;
}
export interface Message { id: number; authorName: string; isStaff: boolean; isInternal: boolean; body: string; createdAt: string }
export interface SupportEvent { actor: string; kind: string; detail: string; createdAt: string }
export interface Actor { id: number; name: string; email: string }

type Row = Record<string, unknown>;
const toDate = (s: string): Date => new Date(s.replace(" ", "T") + "Z");
const s = (v: unknown): string => String(v ?? "");

const SELECT = `SELECT t.*, u.name AS user_name, u.email AS user_email, a.name AS assigned_name FROM support_tickets t
  JOIN users u ON u.id = t.user_id LEFT JOIN users a ON a.id = t.assigned_to`;

function ticket(r: Row, unread = 0): Ticket {
  return {
    id: Number(r.id), no: s(r.ticket_no), userId: Number(r.user_id), userName: s(r.user_name), userEmail: s(r.user_email),
    category: s(r.category), subject: s(r.subject), relatedRef: s(r.related_ref), status: (isStatus(r.status) ? r.status : "open"), priority: (isPriority(r.priority) ? r.priority : "medium"),
    assignedTo: r.assigned_to === null ? null : Number(r.assigned_to), assignedName: r.assigned_name === null || r.assigned_name === undefined ? null : s(r.assigned_name),
    rating: r.rating === null ? null : Number(r.rating), ratingComment: r.rating_comment === null ? null : s(r.rating_comment),
    createdAt: s(r.created_at), updatedAt: s(r.updated_at), lastActivityAt: s(r.last_activity_at), resolvedAt: r.resolved_at ? s(r.resolved_at) : null, closedAt: r.closed_at ? s(r.closed_at) : null,
    unread,
  };
}

async function event(ticketId: number, actor: string, kind: string, detail = ""): Promise<void> {
  await run("INSERT INTO support_events (ticket_id, actor, kind, detail) VALUES ($1,$2,$3,$4)", [ticketId, actor.slice(0, 120), kind, detail.slice(0, 300)]);
}

const staffEmail = (): string => (process.env.SUPPORT_NOTIFY_EMAIL ?? "").trim();

/** Tell the team a ticket arrived or the person replied. Needs SUPPORT_NOTIFY_EMAIL; without it the admin console is where staff look. */
async function notifyStaff(t: { no: string; subject: string; id: number }, headline: string, detail: string): Promise<void> {
  const to = staffEmail();
  if (!to) return;
  await send({ email: to, name: "GrowQR support" }, `[${t.no}] ${headline}`, headline, [`Ticket ${t.no}: ${t.subject}`, detail], ["Open in the console", await appUrl(`/console/support/${t.no}`)], "support-staff");
}

async function notifyPerson(t: Ticket, subject: string, heading: string, paras: string[]): Promise<void> {
  await send({ email: t.userEmail, name: t.userName }, subject, heading, paras, ["Open your ticket", await appUrl(`/support/tickets/${t.no}`)], "support");
}

// ---- a person's own tickets -------------------------------------------------------------------------------------------------------

export type CreateResult = { ok: true; no: string; duplicate: boolean } | { ok: false; error: string };

export async function createTicket(user: Actor, input: NewTicket): Promise<CreateResult> {
  const recent = Number(await val<number>("SELECT COUNT(*) FROM support_tickets WHERE user_id = $1 AND created_at > (NOW() - INTERVAL 1 HOUR)", [user.id]) ?? 0);
  if (recent >= LIMITS.perHour) return { ok: false, error: `You have opened ${LIMITS.perHour} tickets in the last hour. Please wait a little, or add to a ticket you already have.` };
  const open = Number(await val<number>("SELECT COUNT(*) FROM support_tickets WHERE user_id = $1 AND status NOT IN ('resolved','closed')", [user.id]) ?? 0);
  if (open >= LIMITS.openAtOnce) return { ok: false, error: `You already have ${open} open tickets. Please wait for replies, or reply on one of them, before opening more.` };
  // The same person sending the same subject within a day is a double click or a retry, not a new problem.
  const dup = await one<Row>("SELECT ticket_no FROM support_tickets WHERE user_id = $1 AND LOWER(subject) = LOWER($2) AND created_at > (NOW() - INTERVAL 1 DAY) ORDER BY id DESC LIMIT 1", [user.id, input.subject]);
  if (dup) return { ok: true, no: s(dup.ticket_no), duplicate: true };

  const id = Number(await val<number>("INSERT INTO support_tickets (user_id, category, subject, related_ref, status, priority) VALUES ($1,$2,$3,$4,'open',$5) RETURNING id", [user.id, input.category, input.subject, input.related_ref, defaultPriority(input.category)]));
  const no = ticketNo(id);
  await run("UPDATE support_tickets SET ticket_no = $1 WHERE id = $2", [no, id]);
  await run("INSERT INTO support_messages (ticket_id, author_id, is_staff, is_internal, body, read_by_user, read_by_staff) VALUES ($1,$2,0,0,$3,1,0)", [id, user.id, input.body]);
  await event(id, user.name, "created", `${categoryLabel(input.category)}, ${PRIORITY_LABEL[defaultPriority(input.category)]} priority`);
  const t = { no, subject: input.subject, id };
  await send({ email: user.email, name: user.name }, `[${no}] We received your support request`, "We received your request", [`Your ticket ${no} is open: ${input.subject}.`, "The GrowQR team will reply here. You will get an email when we do, and you can follow the conversation from your account at any time."], ["Open your ticket", await appUrl(`/support/tickets/${no}`)], "support");
  await notifyStaff(t, "New support ticket", `${user.name} (${user.email}) opened a ${PRIORITY_LABEL[defaultPriority(input.category)]} priority ticket in "${categoryLabel(input.category)}".`);
  return { ok: true, no, duplicate: false };
}

export async function listForUser(userId: number, q = ""): Promise<Ticket[]> {
  const params: unknown[] = [userId];
  let where = "t.user_id = $1";
  if (q) { where += " AND (t.ticket_no LIKE $2 OR t.subject LIKE $2 OR t.related_ref LIKE $2)"; params.push(`%${q.slice(0, 80)}%`); }
  const rows = await all<Row>(`${SELECT} WHERE ${where} ORDER BY t.updated_at DESC LIMIT 100`, params);
  const unread = new Map((await all<Row>("SELECT ticket_id, COUNT(*) AS n FROM support_messages WHERE is_staff = 1 AND is_internal = 0 AND read_by_user = 0 AND ticket_id IN (SELECT id FROM support_tickets WHERE user_id = $1) GROUP BY ticket_id", [userId])).map((r) => [Number(r.ticket_id), Number(r.n)]));
  return rows.map((r) => ticket(r, unread.get(Number(r.id)) ?? 0));
}

export async function unreadFor(userId: number): Promise<number> {
  return Number(await val<number>("SELECT COUNT(*) FROM support_messages m JOIN support_tickets t ON t.id = m.ticket_id WHERE t.user_id = $1 AND m.is_staff = 1 AND m.is_internal = 0 AND m.read_by_user = 0", [userId]) ?? 0);
}

async function mine(userId: number, no: string): Promise<Ticket | null> {
  if (!isTicketNo(no)) return null;
  const r = await one<Row>(`${SELECT} WHERE t.ticket_no = $1 AND t.user_id = $2`, [no, userId]);
  return r ? ticket(r) : null;
}

/** A person's own ticket with its public conversation (internal notes are never returned). Opening it marks the team's replies as read. */
export async function getForUser(userId: number, no: string): Promise<{ ticket: Ticket; messages: Message[] } | null> {
  const t = await mine(userId, no);
  if (!t) return null;
  await run("UPDATE support_messages SET read_by_user = 1 WHERE ticket_id = $1 AND is_staff = 1 AND is_internal = 0", [t.id]);
  return { ticket: t, messages: await messagesOf(t.id, false) };
}

async function messagesOf(ticketId: number, withInternal: boolean): Promise<Message[]> {
  const rows = await all<Row>(`SELECT m.*, u.name AS author_name FROM support_messages m LEFT JOIN users u ON u.id = m.author_id WHERE m.ticket_id = $1 ${withInternal ? "" : "AND m.is_internal = 0"} ORDER BY m.created_at, m.id`, [ticketId]);
  return rows.map((r) => ({ id: Number(r.id), authorName: Number(r.is_staff) === 1 ? (s(r.author_name) || "GrowQR support") : s(r.author_name), isStaff: Number(r.is_staff) === 1, isInternal: Number(r.is_internal) === 1, body: s(r.body), createdAt: s(r.created_at) }));
}

export type ActionResult = { ok: true } | { ok: false; error: string };
const fail = (error: string): ActionResult => ({ ok: false, error });

export async function replyAsUser(user: Actor, no: string, body: string): Promise<ActionResult> {
  const t = await mine(user.id, no);
  if (!t) return fail("That ticket was not found.");
  if (!canUserReply(t.status)) return fail("This ticket is closed. Please open a new ticket if you still need help.");
  const recent = Number(await val<number>("SELECT COUNT(*) FROM support_messages WHERE author_id = $1 AND is_staff = 0 AND created_at > (NOW() - INTERVAL 1 HOUR)", [user.id]) ?? 0);
  if (recent >= LIMITS.repliesPerHour) return fail("You have sent a lot of messages in the last hour. Please wait a little.");
  await run("INSERT INTO support_messages (ticket_id, author_id, is_staff, is_internal, body, read_by_user, read_by_staff) VALUES ($1,$2,0,0,$3,1,0)", [t.id, user.id, body]);
  const next = statusAfterUserReply(t.status);
  await run("UPDATE support_tickets SET last_activity_at = NOW(), status = $1, resolved_at = CASE WHEN $1 = 'open' THEN NULL ELSE resolved_at END WHERE id = $2", [next ?? t.status, t.id]);
  await event(t.id, user.name, "reply", next && next !== t.status ? `replied; reopened from ${t.status}` : "replied");
  await notifyStaff(t, "Customer replied", `${user.name} replied on this ticket.`);
  return { ok: true };
}

export async function rate(user: Actor, no: string, rating: number, comment: string): Promise<ActionResult> {
  const t = await mine(user.id, no);
  if (!t || !canRate(t.status, t.rating)) return fail("This ticket cannot be rated.");
  await run("UPDATE support_tickets SET rating = $1, rating_comment = $2 WHERE id = $3", [rating, comment || null, t.id]);
  await event(t.id, user.name, "rating", `${rating}/5`);
  return { ok: true };
}

// ---- staff ---------------------------------------------------------------------------------------------------------------------------------

export interface Filters { status?: string; priority?: string; category?: string; q?: string; assigned?: "me" | "none"; page?: number }
export interface Stats { total: number; open: number; pending: number; waiting: number; resolved: number; closed: number; critical: number; today: number; avgRating: number | null }

export async function staffList(f: Filters, staffId: number): Promise<{ tickets: Ticket[]; total: number; pages: number; stats: Stats }> {
  const where: string[] = ["1=1"];
  const p: unknown[] = [];
  const add = (sql: string, v: unknown) => { p.push(v); where.push(sql.replace("?", `$${p.length}`)); };
  if (isStatus(f.status)) add("t.status = ?", f.status);
  if (isPriority(f.priority)) add("t.priority = ?", f.priority);
  if (f.category) add("t.category = ?", f.category.slice(0, 30));
  if (f.assigned === "me") add("t.assigned_to = ?", staffId);
  if (f.assigned === "none") where.push("t.assigned_to IS NULL");
  if (f.q) { p.push(`%${f.q.slice(0, 80)}%`); const i = p.length; where.push(`(t.ticket_no LIKE $${i} OR t.subject LIKE $${i} OR u.email LIKE $${i} OR u.name LIKE $${i} OR t.related_ref LIKE $${i})`); }
  const page = Math.max(1, Math.trunc(f.page ?? 1));
  const per = 40;
  const total = Number(await val<number>(`SELECT COUNT(*) FROM support_tickets t JOIN users u ON u.id = t.user_id WHERE ${where.join(" AND ")}`, p) ?? 0);
  const rows = await all<Row>(`${SELECT} WHERE ${where.join(" AND ")} ORDER BY FIELD(t.status,'open','pending','waiting_user','resolved','closed'), FIELD(t.priority,'critical','high','medium','low'), t.last_activity_at DESC LIMIT ${per} OFFSET ${(page - 1) * per}`, p);
  const unread = new Map((await all<Row>("SELECT ticket_id, COUNT(*) AS n FROM support_messages WHERE is_staff = 0 AND read_by_staff = 0 GROUP BY ticket_id")).map((r) => [Number(r.ticket_id), Number(r.n)]));
  const st = (await one<Row>(`SELECT COUNT(*) AS total, SUM(status='open') AS open_n, SUM(status='pending') AS pending_n, SUM(status='waiting_user') AS waiting_n,
      SUM(status='resolved') AS resolved_n, SUM(status='closed') AS closed_n, SUM(priority='critical' AND status NOT IN ('resolved','closed')) AS critical_n,
      SUM(DATE(created_at) = CURDATE()) AS today_n, ROUND(AVG(rating), 2) AS avg_rating FROM support_tickets`)) ?? {};
  const n = (k: string): number => Number(st[k] ?? 0);
  return { tickets: rows.map((r) => ticket(r, unread.get(Number(r.id)) ?? 0)), total, pages: Math.max(1, Math.ceil(total / per)), stats: { total: n("total"), open: n("open_n"), pending: n("pending_n"), waiting: n("waiting_n"), resolved: n("resolved_n"), closed: n("closed_n"), critical: n("critical_n"), today: n("today_n"), avgRating: st.avg_rating === null || st.avg_rating === undefined ? null : Number(st.avg_rating) } };
}

export async function staffGet(no: string): Promise<{ ticket: Ticket; messages: Message[]; events: SupportEvent[]; history: Array<{ no: string; subject: string; status: Status; createdAt: string }>; staff: Array<{ id: number; name: string }> } | null> {
  if (!isTicketNo(no)) return null;
  const r = await one<Row>(`${SELECT} WHERE t.ticket_no = $1`, [no]);
  if (!r) return null;
  const t = ticket(r);
  await run("UPDATE support_messages SET read_by_staff = 1 WHERE ticket_id = $1", [t.id]);
  const events = (await all<Row>("SELECT * FROM support_events WHERE ticket_id = $1 ORDER BY created_at, id", [t.id])).map((e) => ({ actor: s(e.actor), kind: s(e.kind), detail: s(e.detail), createdAt: s(e.created_at) }));
  const history = (await all<Row>("SELECT ticket_no, subject, status, created_at FROM support_tickets WHERE user_id = $1 AND id <> $2 ORDER BY id DESC LIMIT 10", [t.userId, t.id])).map((h) => ({ no: s(h.ticket_no), subject: s(h.subject), status: (isStatus(h.status) ? h.status : "open") as Status, createdAt: s(h.created_at) }));
  const staff = (await all<Row>("SELECT id, name FROM users WHERE role = 'admin' ORDER BY name")).map((u) => ({ id: Number(u.id), name: s(u.name) }));
  return { ticket: t, messages: await messagesOf(t.id, true), events, history, staff };
}

async function byNo(no: string): Promise<Ticket | null> {
  if (!isTicketNo(no)) return null;
  const r = await one<Row>(`${SELECT} WHERE t.ticket_no = $1`, [no]);
  return r ? ticket(r) : null;
}

export async function staffReply(staff: Actor, no: string, body: string, internal: boolean, newStatus?: string): Promise<ActionResult> {
  const t = await byNo(no);
  if (!t) return fail("That ticket was not found.");
  await run("INSERT INTO support_messages (ticket_id, author_id, is_staff, is_internal, body, read_by_user, read_by_staff) VALUES ($1,$2,1,$3,$4,$5,1)", [t.id, staff.id, internal ? 1 : 0, body, internal ? 1 : 0]);
  await event(t.id, `staff:${staff.name}`, internal ? "note" : "reply", internal ? "internal note" : "replied");
  let status: Status = t.status;
  if (!internal) status = isStatus(newStatus) && newStatus !== t.status ? newStatus : t.status === "closed" ? t.status : statusAfterStaffReply(t.status);
  await run("UPDATE support_tickets SET last_activity_at = NOW() WHERE id = $1", [t.id]);
  if (status !== t.status) await applyStatus(t, status, staff);
  if (!internal) {
    const fresh = (await byNo(no)) ?? t;
    await notifyPerson(fresh, `[${no}] New reply from GrowQR support`, "We replied to your ticket", [`Ticket ${no}: ${t.subject}`, body.length > 600 ? body.slice(0, 600) + "..." : body]);
  }
  return { ok: true };
}

async function applyStatus(t: Ticket, status: Status, staff: Actor | null): Promise<void> {
  await run("UPDATE support_tickets SET status = $1, resolved_at = CASE WHEN $1 = 'resolved' THEN NOW() ELSE resolved_at END, closed_at = CASE WHEN $1 = 'closed' THEN NOW() ELSE closed_at END WHERE id = $2", [status, t.id]);
  await event(t.id, staff ? `staff:${staff.name}` : "system", "status", `${t.status} to ${status}`);
}

export async function staffSetStatus(staff: Actor, no: string, status: string): Promise<ActionResult> {
  const t = await byNo(no);
  if (!t || !isStatus(status)) return fail("That ticket or status was not found.");
  if (status === t.status) return { ok: true };
  await applyStatus(t, status, staff);
  if (status === "resolved" || status === "closed") {
    await notifyPerson(t, `[${no}] Your ticket is ${STATUS_LABEL[status].toLowerCase()}`, `Your ticket is ${STATUS_LABEL[status].toLowerCase()}`, [status === "resolved" ? "We believe this is sorted. If anything is still wrong, reply on the ticket and it will reopen." : "This ticket is now closed. You can rate our help on the ticket page, or open a new ticket if you need more help."]);
  }
  return { ok: true };
}

export async function staffSetPriority(staff: Actor, no: string, priority: string): Promise<ActionResult> {
  const t = await byNo(no);
  if (!t || !isPriority(priority)) return fail("That ticket or priority was not found.");
  await run("UPDATE support_tickets SET priority = $1 WHERE id = $2", [priority, t.id]);
  await event(t.id, `staff:${staff.name}`, "priority", `${t.priority} to ${priority}`);
  return { ok: true };
}

export async function staffAssign(staff: Actor, no: string, staffId: number | null): Promise<ActionResult> {
  const t = await byNo(no);
  if (!t) return fail("That ticket was not found.");
  let name = "nobody";
  if (staffId !== null) {
    const u = await one<Row>("SELECT id, name FROM users WHERE id = $1 AND role = 'admin'", [staffId]);
    if (!u) return fail("Only administrators can be assigned.");
    name = s(u.name);
  }
  await run("UPDATE support_tickets SET assigned_to = $1 WHERE id = $2", [staffId, t.id]);
  await event(t.id, `staff:${staff.name}`, "assign", `assigned to ${name}`);
  return { ok: true };
}

/** Close tickets that have gone quiet (waiting on the person, or resolved, for a week), with a note on the ticket. Safe to repeat. */
export async function autoCloseIdle(now: Date = new Date()): Promise<number> {
  const rows = await all<Row>("SELECT id, status, last_activity_at FROM support_tickets WHERE status IN ('waiting_user','resolved') AND last_activity_at < (NOW() - INTERVAL 6 DAY)");
  let n = 0;
  for (const r of rows) {
    if (!isStatus(r.status) || !shouldAutoClose(r.status, toDate(s(r.last_activity_at)), now)) continue;
    const t = await one<Row>(`${SELECT} WHERE t.id = $1`, [Number(r.id)]);
    if (!t) continue;
    const tk = ticket(t);
    await run("INSERT INTO support_messages (ticket_id, author_id, is_staff, is_internal, body, read_by_user, read_by_staff) VALUES ($1,NULL,1,0,$2,0,1)", [tk.id, `This ticket was closed automatically after ${LIMITS.idleCloseDays} days without activity. If you still need help, please open a new ticket and we will pick it up from there.`]);
    await applyStatus(tk, "closed", null);
    n++;
  }
  return n;
}

export { STAFF_STATUS_LABEL };
