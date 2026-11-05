import { requiredFor, activitiesFor } from "./activities";
import type { NativeCourse } from "@/lib/market/lessons";
import type { LearnCourse } from "./types";

/** Where "Continue learning" should go: the first module not yet complete, at its first required activity that is not passed. */
export function nextStep(slug: string, nc: NativeCourse, lc: LearnCourse | null, done: Set<number>, passed: Set<string>, started: boolean): { href: string; label: string; module: string | null } {
  const keys = [...nc.modules.map((m) => m.slug), "capstone"];
  const base = `/courses/${slug}/learn`;
  for (let i = 0; i < keys.length; i++) {
    if (done.has(i)) continue;
    const key = keys[i];
    const todo = lc ? requiredFor(slug, key).find((a) => !passed.has(a.id)) : undefined;
    if (todo) return { href: `${base}/${key}/a/${todo.id}`, label: started ? "Continue learning" : "Start learning", module: key };
    return { href: `${base}/${key}`, label: started ? "Continue learning" : "Start learning", module: key };
  }
  return { href: `${base}/${keys[0]}`, label: "Review the course", module: null };
}

/** The activity after `id` in its module, or null when it is the last one. */
export function nextActivity(slug: string, module: string, id: string): { id: string; title: string } | null {
  const list = activitiesFor(slug, module);
  const i = list.findIndex((a) => a.id === id);
  return i >= 0 && i + 1 < list.length ? { id: list[i + 1].id, title: list[i + 1].title } : null;
}
