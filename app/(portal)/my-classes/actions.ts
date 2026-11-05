"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/portal/guard";
import * as classes from "@/lib/lms/classes";

/** Student Server Actions: join a class with a teacher's code, or leave one. */
export async function joinClassAction(fd: FormData): Promise<void> {
  const me = await requireUser("student");
  const r = await classes.join(me.id, String(fd.get("code") ?? ""));
  redirect(r.ok ? `/my-classes?ok=joined` : `/my-classes?e=${encodeURIComponent(r.error)}`);
}

export async function leaveClassAction(fd: FormData): Promise<void> {
  const me = await requireUser("student");
  const id = parseInt(String(fd.get("class_id") ?? ""), 10);
  if (id) await classes.leave(me.id, id);
  redirect("/my-classes?ok=left");
}
