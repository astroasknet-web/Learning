"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/portal/guard";
import * as classes from "@/lib/lms/classes";

/** Teacher Server Actions. Ownership is re-checked in every query (teacher_id in the WHERE), never trusted from the form. */
const s = (fd: FormData, k: string): string => String(fd.get(k) ?? "").trim();
const n = (fd: FormData, k: string): number => parseInt(s(fd, k), 10) || 0;
const back = (path: string, ok?: string, err?: string | null): never => redirect(`${path}${err ? `?e=${encodeURIComponent(err)}` : ok ? `?ok=${ok}` : ""}`);

export async function createClassAction(fd: FormData): Promise<void> {
  const me = await requireUser("teacher");
  const r = await classes.createClass(me.id, s(fd, "name"));
  if (!r.ok) back("/teacher", undefined, r.error);
  else redirect(`/teacher/class/${r.id}?ok=created`);
}

export async function classAction(fd: FormData): Promise<void> {
  const me = await requireUser("teacher");
  const id = n(fd, "class_id");
  const here = `/teacher/class/${id}`;
  const act = s(fd, "act");
  if (!id || !(await classes.ownedClass(me, id))) redirect("/teacher");
  switch (act) {
    case "archive":
      await classes.setArchived(me.id, id, true);
      return back("/teacher", "archived");
    case "restore":
      await classes.setArchived(me.id, id, false);
      return back(here, "restored");
    case "assign": {
      const err = await classes.addAssignment(me.id, id, { kind: s(fd, "kind"), ref: s(fd, s(fd, "kind") === "course" ? "course" : "exam"), testNo: n(fd, "test_no"), note: s(fd, "note"), due: s(fd, "due") });
      return back(here, "assigned", err);
    }
    case "unassign":
      await classes.removeAssignment(me.id, id, n(fd, "assignment_id"));
      return back(here, "removed");
    case "remove_student":
      await classes.removeStudent(me.id, id, n(fd, "student_id"));
      return back(here, "student_removed");
    default:
      return back(here);
  }
}
