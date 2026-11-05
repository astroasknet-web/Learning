"use server";

import { redirect } from "next/navigation";
import { currentUser } from "@/lib/portal/guard";
import { homeFor } from "@/lib/portal/auth";
import { safeNext } from "@/lib/portal/security";
import { setStudyMinutes } from "@/lib/mathstudio/store";

/** Set the study minutes used to size the practice plan. Checks the signed-in student itself. */
export async function studyMinutesAction(fd: FormData): Promise<void> {
  const me = await currentUser();
  if (!me) redirect("/login?next=/math-studio");
  if (me.role !== "student") redirect(homeFor(me.role));
  await setStudyMinutes(me.id, Number(fd.get("minutes")) || 30);
  redirect(safeNext(String(fd.get("back") ?? ""), "/math-studio/dashboard"));
}
