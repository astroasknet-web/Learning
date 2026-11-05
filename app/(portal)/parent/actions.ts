"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/portal/guard";
import * as parents from "@/lib/lms/parents";

/** Parent Server Actions: follow a child with their learner code, or stop following. */
export async function linkChildAction(fd: FormData): Promise<void> {
  const me = await requireUser("parent");
  const r = await parents.link(me.id, String(fd.get("code") ?? ""));
  redirect(r.ok ? "/parent?ok=linked" : `/parent?e=${encodeURIComponent(r.error)}`);
}

export async function unlinkChildAction(fd: FormData): Promise<void> {
  const me = await requireUser("parent");
  const id = parseInt(String(fd.get("student_id") ?? ""), 10);
  if (id) await parents.unlink(me.id, id);
  redirect("/parent?ok=unlinked");
}
