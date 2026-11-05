import "server-only";
import { requireMfaIfStaff, requireUser } from "@/lib/portal/guard";
import type { PortalUser } from "@/lib/portal/session";

/** Every administrator page and action starts here: signed in as an admin, with two-step login on. */
export async function adminGate(here = "/console"): Promise<PortalUser> {
  const me = await requireUser("admin");
  await requireMfaIfStaff(me, here);
  return me;
}
