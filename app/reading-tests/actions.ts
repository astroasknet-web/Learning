"use server";

import { redirect } from "next/navigation";
import { currentUser } from "@/lib/portal/guard";
import { homeFor } from "@/lib/portal/auth";
import { startAssessment } from "@/lib/reading/store";

/** Start an essay reading test. The server checks the student and the package; the form proves nothing but the test number it names. */
export async function startEssayAction(fd: FormData): Promise<void> {
  const n = Number(fd.get("n"));
  const back = `/reading-tests/${Number.isInteger(n) ? n : ""}`;
  const me = await currentUser();
  if (!me) redirect(`/login?next=${encodeURIComponent(back)}`);
  if (me.role !== "student") redirect(homeFor(me.role));
  const r = await startAssessment(me.id, "essay", { skill: `essay-${n}` });
  if (r.ok) redirect(`/reading-studio/assessment/${r.id}`);
  if (r.code === "locked") redirect(`/reading-studio/upgrade?from=essay-${Number.isInteger(n) ? n : 0}`);
  redirect(`${back}?e=${encodeURIComponent(r.error)}`);
}
