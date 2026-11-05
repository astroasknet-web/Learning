import "server-only";
import { redirect } from "next/navigation";
import { requireMfaIfStaff, requireUser } from "@/lib/portal/guard";
import type { PortalUser } from "@/lib/portal/session";
import { can, payRole, type PayRole, type Permission } from "@/lib/pay/staff";

/**
 * Every payment console page and action starts here: signed in, a payment role (portal admins are payment admins), the permission the
 * page needs, and two-step login for staff. Pages and actions both call it; a form that rendered proves nothing.
 */
export async function payGate(permission: Permission, here = "/console/payments"): Promise<{ me: PortalUser; role: PayRole }> {
  const me = await requireUser();
  const role = await payRole(me);
  if (!can(role, permission)) redirect("/account");
  await requireMfaIfStaff(me, here);
  return { me, role: role as PayRole };
}
