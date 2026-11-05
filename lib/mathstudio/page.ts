import "server-only";
import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/portal/guard";
import { homeFor } from "@/lib/portal/auth";
import { databaseConfigured } from "@/lib/portal/db";
import { getSession } from "@/lib/portal/session";
import type { PortalUser } from "@/lib/portal/session";
import { ensureSeed } from "./store";

/** Loader for the signed-in Mathematics Studio pages: the student (sent to log in if needed), the taxonomy seeded, and the CSRF token. */
export async function studentPage(path: string): Promise<{ me: PortalUser; csrf: string }> {
  if (!databaseConfigured()) notFound();
  const me = await currentUser();
  if (!me) redirect(`/login?next=${encodeURIComponent(path)}`);
  if (me.role !== "student") redirect(homeFor(me.role));
  await ensureSeed();
  return { me, csrf: (await getSession())?.csrf ?? "" };
}
