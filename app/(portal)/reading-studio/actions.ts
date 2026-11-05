"use server";

import { redirect } from "next/navigation";
import { currentUser } from "@/lib/portal/guard";
import { homeFor } from "@/lib/portal/auth";
import { safeNext } from "@/lib/portal/security";
import { markLessonRead, setStudyMinutes, setTracks, startAssessment } from "@/lib/reading/store";
import type { Kind } from "@/lib/reading/taxonomy";

/** Form handlers for the studio. Each one checks the signed-in student itself; nothing is trusted from the form beyond what it names. */
const KINDS: Kind[] = ["diagnostic", "practice", "mastery", "recall", "timed", "fresh"];
const FALLBACK = "/reading-studio/dashboard";

async function student(next: string) {
  const me = await currentUser();
  if (!me) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (me.role !== "student") redirect(homeFor(me.role));
  return me;
}
const flash = (back: string, text: string): string => `${back}${back.includes("?") ? "&" : "?"}e=${encodeURIComponent(text)}`;

export async function startAction(fd: FormData): Promise<void> {
  const back = safeNext(String(fd.get("back") ?? ""), FALLBACK);
  const me = await student(back);
  const kind = String(fd.get("kind") ?? "") as Kind;
  if (!KINDS.includes(kind)) redirect(back);
  const r = await startAssessment(me.id, kind, { levelKey: String(fd.get("level") ?? "").slice(0, 2) || undefined, skill: String(fd.get("skill") ?? "").slice(0, 24) || undefined });
  if (r.ok) redirect(`/reading-studio/assessment/${r.id}`);
  redirect(flash(back, r.error));
}

export async function lessonReadAction(fd: FormData): Promise<void> {
  const key = String(fd.get("level") ?? "").toUpperCase().slice(0, 2);
  const back = `/reading-studio/levels/${key}`;
  const me = await student(back);
  await markLessonRead(me.id, key);
  redirect(back);
}

/** Choose which tracks to see on the dashboard. Choosing never grants access: what a student may open is decided by what they hold. */
export async function chooseTracksAction(fd: FormData): Promise<void> {
  const me = await student(FALLBACK);
  await setTracks(me.id, fd.getAll("track").map(String));
  redirect(safeNext(String(fd.get("back") ?? ""), FALLBACK));
}

export async function studyMinutesAction(fd: FormData): Promise<void> {
  const me = await student(FALLBACK);
  await setStudyMinutes(me.id, Number(fd.get("minutes")) || 20);
  redirect(safeNext(String(fd.get("back") ?? ""), FALLBACK));
}
