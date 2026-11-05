"use server";

import { redirect } from "next/navigation";
import { currentUser } from "@/lib/portal/guard";
import { homeFor } from "@/lib/portal/auth";
import { safeNext } from "@/lib/portal/security";
import { chooseStart, enrol, getEnrolment, markRead, startSession } from "@/lib/mathspeed/store";
import { moduleByKey } from "@/lib/mathspeed/curriculum";
import { hasCourse, moduleIsFree } from "@/lib/mathspeed/access";
import type { SessionKind } from "@/lib/mathspeed/plan";

/** Form handlers for the studio. Each one checks the signed-in student itself; nothing is trusted from the form beyond what it names. */
const KINDS: SessionKind[] = ["practice", "drill", "level", "progress", "mastery", "foundation", "revision", "review", "diagnostic", "benchmark"];
const FALLBACK = "/math-speed/journey";

async function student(next: string) {
  const me = await currentUser();
  if (!me) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (me.role !== "student") redirect(homeFor(me.role));
  return me;
}
const flash = (back: string, text: string): string => `${back}${back.includes("?") ? "&" : "?"}e=${encodeURIComponent(text)}`;

export async function enrolAction(fd: FormData): Promise<void> {
  const me = await student("/math-speed/enrol");
  const first = (await getEnrolment(me.id)) === null;
  await enrol(me.id, { language: String(fd.get("language") ?? ""), country: String(fd.get("country") ?? ""), ageBand: String(fd.get("age") ?? ""), pace: String(fd.get("pace") ?? "") });
  redirect(first ? "/math-speed/diagnostic" : FALLBACK);
}

export async function startAction(fd: FormData): Promise<void> {
  const back = safeNext(String(fd.get("back") ?? ""), FALLBACK);
  const me = await student(back);
  const kind = String(fd.get("kind") ?? "") as SessionKind;
  const ref = String(fd.get("ref") ?? "").slice(0, 12);
  if (!KINDS.includes(kind)) redirect(back);
  const r = await startSession(me.id, kind, ref);
  if (r.ok) redirect(`/math-speed/session/${r.id}`);
  if (r.code === "enrol") redirect("/math-speed/enrol");
  redirect(flash(back, r.error));
}

export async function readAction(fd: FormData): Promise<void> {
  const key = String(fd.get("key") ?? "").toUpperCase();
  const back = `/math-speed/module/${key}`;
  const me = await student(back);
  const m = moduleByKey(key);
  if (!m || !(await getEnrolment(me.id))) redirect(FALLBACK);
  if (!moduleIsFree(m.key) && !(await hasCourse(me.id))) redirect(flash(back, "This module is part of the full course."));
  await markRead(me.id, m.key);
  redirect(`${back}?read=1#practise`);
}

export async function chooseStartAction(fd: FormData): Promise<void> {
  const me = await student("/math-speed/diagnostic");
  await chooseStart(me.id, Number(fd.get("level")) || 1);
  redirect(FALLBACK);
}
