import "server-only";
import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/portal/guard";
import { homeFor } from "@/lib/portal/auth";
import { databaseConfigured } from "@/lib/portal/db";
import { getSession } from "@/lib/portal/session";
import type { PortalUser } from "@/lib/portal/session";
import { snapshot, type Snapshot } from "./store";

/** Loaders for the signed-in studio pages: the student (sent to log in if needed) and, once enrolled, their snapshot. */
export async function studentOnly(path: string): Promise<PortalUser> {
  if (!databaseConfigured()) notFound();
  const me = await currentUser();
  if (!me) redirect(`/login?next=${encodeURIComponent(path)}`);
  if (me.role !== "student") redirect(homeFor(me.role));
  return me;
}

export async function enrolledStudent(path: string): Promise<{ me: PortalUser; snap: Snapshot; csrf: string }> {
  const me = await studentOnly(path);
  const snap = await snapshot(me.id);
  if (!snap) redirect("/math-speed/enrol");
  return { me, snap, csrf: (await getSession())?.csrf ?? "" };
}
