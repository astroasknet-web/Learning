import "server-only";
import { redirect } from "next/navigation";
import { homeFor, mfaRequiredFor } from "./auth";
import { getSession, type PortalUser, type Role } from "./session";

/**
 * Page guards for Server Components.
 *   const me = await requireUser();                      // any signed-in person
 *   const me = await requireUser("admin", "counselor");  // only these roles (anyone else is sent to their own home)
 *   await requireMfaIfStaff(me);                         // staff must have two-step login on before sensitive pages
 */
export async function currentUser(): Promise<PortalUser | null> {
  return (await getSession())?.user ?? null;
}

export async function requireUser(...roles: Role[]): Promise<PortalUser> {
  const s = await getSession();
  const user = s?.user ?? null;
  if (!user) redirect(s?.demoBlocked ? "/demo-readonly" : "/login");
  if (roles.length && !roles.includes(user.role)) redirect(homeFor(user.role));
  return user;
}

/** Send staff without two-step login to set it up first. `here` is the page they were trying to reach. */
export async function requireMfaIfStaff(user: PortalUser, here: string): Promise<void> {
  if (mfaRequiredFor(user) && !user.mfa_enabled_at) redirect(`/account/mfa?required=1&next=${encodeURIComponent(here)}`);
}
