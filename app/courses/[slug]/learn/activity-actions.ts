"use server";

import { currentUser } from "@/lib/portal/guard";
import { databaseConfigured } from "@/lib/portal/db";
import { WINDOW_MIN, fails, recordFail } from "@/lib/portal/security";
import { cleanState, findActivity, learnCourse, levelFor } from "@/lib/learn/activities";
import { runChecks } from "@/lib/learn/checks";
import * as results from "@/lib/learn/results";
import type { RunResult } from "@/lib/learn/types";

const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9-]/g, "");

export interface SubmitReply {
  ok: boolean;
  error?: string;
  run?: RunResult;
  /** "account" = stored for this student; "none" = the work is only in this browser tab. */
  saved: "account" | "none";
  newBadges: string[];
  xp: number;
  level: string;
  moduleComplete: boolean;
  courseComplete: boolean;
}
const none = (error: string): SubmitReply => ({ ok: false, error, saved: "none", newBadges: [], xp: 0, level: "", moduleComplete: false, courseComplete: false });

/**
 * Check a student's work on the server (the same checks the browser ran, so a result cannot be made up) and, for a logged-in
 * student, keep it. mode "check" counts an attempt and can pass the activity; mode "save" only keeps the work.
 * Guests get the same feedback but nothing is stored, and the reply says so.
 */
export async function submitActivity(slugIn: string, idIn: string, rawState: unknown, mode: "check" | "save"): Promise<SubmitReply> {
  const slug = clean(String(slugIn));
  const a = findActivity(slug, String(idIn));
  const lc = learnCourse(slug);
  if (!a || !lc) return none("That activity was not found.");
  const state = cleanState(a, rawState);
  if (!state) return none("That work could not be read. Reload the page and try again.");
  const run = mode === "check" ? runChecks(a, state) : undefined;
  const me = await currentUser();
  if (!me || me.role !== "student" || !databaseConfigured()) return { ok: true, run, saved: "none", newBadges: [], xp: 0, level: "", moduleComplete: false, courseComplete: false };

  const bucket = `act:${me.id}`;
  if ((await fails(bucket)) >= 200) return none(`You are submitting very fast. Please wait ${WINDOW_MIN} minutes.`);
  await recordFail(bucket); // counts submissions per student in the throttle window

  const before = await results.summary(me.id, slug);
  try {
    await results.save(me.id, slug, a.id, state, a.xp, run ?? null);
  } catch (e) {
    return none((e as Error).message || "Your work could not be saved.");
  }
  let moduleComplete = false;
  let courseComplete = false;
  if (run?.allPassed) {
    const rc = await results.reconcile(me.id, slug);
    courseComplete = rc.completed;
    moduleComplete = rc.ticked.length > 0;
  }
  const after = await results.summary(me.id, slug);
  const earnedBefore = new Set(before?.badges.filter((b) => b.earned).map((b) => b.id));
  const newBadges = (after?.badges ?? []).filter((b) => b.earned && !earnedBefore.has(b.id)).map((b) => b.title);
  const xp = after?.xp ?? 0;
  return { ok: true, run, saved: "account", newBadges, xp, level: levelFor(lc, xp).title, moduleComplete, courseComplete };
}

/** The student's saved work for one activity, if any (null for guests). */
export async function loadSaved(slugIn: string, idIn: string): Promise<unknown | null> {
  const slug = clean(String(slugIn));
  const a = findActivity(slug, String(idIn));
  const me = await currentUser();
  if (!a || !me || me.role !== "student" || !databaseConfigured()) return null;
  return results.savedState(me.id, slug, a.id);
}

