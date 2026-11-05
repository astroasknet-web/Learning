import "server-only";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/portal/guard";
import type { PortalUser } from "@/lib/portal/session";

/** The signed-in person for a support page. Anyone who is not signed in is sent to log in and brought back here afterwards. */
export async function supportUser(path: string): Promise<PortalUser> {
  const me = await currentUser();
  if (!me) redirect(`/login?next=${encodeURIComponent(path)}`);
  return me;
}
