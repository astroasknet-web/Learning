"use server";

import { redirect } from "next/navigation";
import { currentUser } from "@/lib/portal/guard";
import * as lessons from "@/lib/market/lessons";
import * as results from "@/lib/learn/results";

const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9-]/g, "");

/**
 * Grade a module (or capstone) quiz on the server. A student's pass is recorded as a result; the module's checkpoint is ticked only when
 * its required practice activities are passed too (a course with no activities ticks on the quiz alone, as before). The picked answers go
 * back in the URL so the page can show the review. Anyone can take a quiz, only students keep progress.
 */
export async function quizAction(fd: FormData): Promise<void> {
  const slug = clean(String(fd.get("slug") ?? ""));
  const step = clean(String(fd.get("step") ?? ""));
  const nc = lessons.nativeCourse(slug);
  const at = nc ? lessons.stepFor(nc, step) : null;
  if (!nc || !at) redirect("/courses");
  const quiz = at.capstone ? nc.capstone.quiz : at.module?.quiz;
  const here = `/courses/${slug}/learn/${step}`;
  if (!quiz) redirect(here);
  const picked = quiz.questions.map((_, i) => {
    const v = fd.get(`q${i}`);
    return v === null || v === "" ? null : Math.trunc(Number(v));
  });
  const res = lessons.gradeQuiz(quiz, picked);
  let saved = "";
  const me = await currentUser();
  if (me && me.role === "student") {
    await results.recordQuiz(me.id, slug, step, res.percent, res.passed);
    if (res.passed) {
      const rc = await results.reconcile(me.id, slug);
      saved = rc.completed ? "completed" : rc.ticked.includes(at.index) ? "saved" : rc.pending.includes(step) ? "pending" : "saved";
    }
  } else if (res.passed) saved = "guest";
  const a = picked.map((p) => (p === null ? "x" : String(p))).join(".");
  redirect(`${here}?a=${a}${saved ? "&s=" + saved : ""}#result`);
}
