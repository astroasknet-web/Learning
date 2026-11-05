import { all, one, run, val } from "../portal/db";
import { hashPassword } from "../portal/password";
import { audit } from "../abroad/store";

/**
 * Who may open the Overseas CRM (port of Crm\Access). Admins always can. Everyone else needs a row in crm_access, which only an admin creates.
 *  agent   : sees and works the leads assigned to them, plus the unassigned pool (to claim from).
 *  manager : sees every lead, reassigns, records payments, runs reports.
 */
export const LEVELS: Record<string, string> = { agent: "Agent (own leads)", manager: "Manager (all leads + reports)" };
export type Viewer = { id: number; role: string };
export type Level = "admin" | "manager" | "agent";

export async function levelOf(user: Viewer | null): Promise<Level | null> {
  if (!user) return null;
  if (user.role === "admin") return "admin";
  if (user.role !== "counselor") return null;
  const l = await val<string>("SELECT level FROM crm_access WHERE user_id = $1", [user.id]);
  return l === null ? null : l === "manager" ? "manager" : "agent";
}

export const has = async (user: Viewer | null): Promise<boolean> => (await levelOf(user)) !== null;
export const isManager = async (user: Viewer | null): Promise<boolean> => ["admin", "manager"].includes((await levelOf(user)) ?? "");

export async function members(): Promise<Array<Record<string, unknown>>> {
  return all("SELECT u.id, u.name, u.email, u.role, a.level, a.created_at, u.last_login_at, u.mfa_enabled_at FROM crm_access a JOIN users u ON u.id = a.user_id ORDER BY u.name");
}

/** Staff who can own leads (shown in the assign drop-down). */
export async function staff(): Promise<Array<{ id: number; name: string }>> {
  return all("SELECT u.id, u.name FROM users u WHERE u.role = 'admin' OR u.id IN (SELECT user_id FROM crm_access) ORDER BY u.name");
}

export async function grant(userId: number, level: string, by: number): Promise<string | null> {
  const u = await one<{ id: number; role: string; name: string }>("SELECT id, role, name FROM users WHERE id = $1", [userId]);
  if (!u) return "No such account.";
  if (u.role !== "counselor") return u.role === "admin" ? "Administrators already have full access." : "Only staff (counselor) accounts can be given CRM access. Create a staff login below instead.";
  const l = level === "manager" ? "manager" : "agent";
  await run("INSERT INTO crm_access (user_id, level, granted_by) VALUES ($1,$2,$3) ON CONFLICT (user_id) DO UPDATE SET level = EXCLUDED.level, granted_by = EXCLUDED.granted_by", [userId, l, by]);
  await audit(by, null, "crm.grant", `${u.name} as ${l}`);
  return null;
}

export async function revoke(userId: number, by: number): Promise<void> {
  await run("DELETE FROM crm_access WHERE user_id = $1", [userId]);
  await run("UPDATE crm_leads SET counsellor_id = NULL WHERE counsellor_id = $1", [userId]); // their leads return to the pool
  await audit(by, null, "crm.revoke", "user #" + userId);
}

/** Create a staff login and give it CRM access in one step (the admin tells the person the password). */
export async function createStaff(nameIn: string, emailIn: string, password: string, level: string, by: number): Promise<string | null> {
  const name = nameIn.trim();
  const email = emailIn.trim().toLowerCase();
  if (name === "" || Array.from(name).length > 120) return "Enter the staff member's name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || Buffer.byteLength(email) > 190) return "Enter a valid email address.";
  if (Buffer.byteLength(password) < 12) return "Use a password of at least 12 characters.";
  if ((await val("SELECT id FROM users WHERE email = $1", [email])) !== null) return 'An account with that email already exists. Use "Give access" for existing staff.';
  const id = await val<number>("INSERT INTO users (role, email, password_hash, name, email_verified_at, created_at) VALUES ('counselor', $1, $2, $3, NOW(), NOW()) RETURNING id", [email, await hashPassword(password), name]);
  await run("INSERT INTO crm_access (user_id, level, granted_by) VALUES ($1,$2,$3)", [id, level === "manager" ? "manager" : "agent", by]);
  await audit(by, null, "crm.staff.create", `${name} (${level})`);
  return null;
}
