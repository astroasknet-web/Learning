import { first, pool } from "./db";

/** Who may do what in the payment console. Portal admins are payment admins; others need a row in `pay_staff`. */
export type PayRole = "support" | "finance" | "admin";
export type Permission = "view" | "refund" | "export" | "retry_webhook" | "reconcile" | "manage_catalogue" | "manage_staff" | "view_audit";

const GRANTS: Record<PayRole, Permission[]> = {
  support: ["view"],
  finance: ["view", "refund", "export", "retry_webhook", "reconcile", "view_audit"],
  admin: ["view", "refund", "export", "retry_webhook", "reconcile", "manage_catalogue", "manage_staff", "view_audit"],
};

export const can = (role: PayRole | null, p: Permission): boolean => role !== null && GRANTS[role].includes(p);

export async function payRole(user: { id: number; role: string } | null | undefined): Promise<PayRole | null> {
  if (!user) return null;
  if (user.role === "admin") return "admin";
  const r = await first<{ role: PayRole }>(pool, "SELECT role FROM pay_staff WHERE user_id = $1", [user.id]);
  return r?.role ?? null;
}
