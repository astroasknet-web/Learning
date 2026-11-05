import { all, one, run, val } from "../portal/db";
import { WINDOW_MIN, clearFails, fails, recordFail } from "../portal/security";
import * as learning from "../market/learning";
import * as attempts from "../tests/attempts";
import * as classes from "./classes";

/**
 * Parent accounts. A parent sees a child only after the child's private learner code is entered, and sees only study progress:
 * courses, practice-test results and class assignments. No contact details, applications, documents or study-abroad data.
 */
export async function learnerCode(studentId: number): Promise<string> {
  const have = await val<string>("SELECT code FROM learner_codes WHERE student_id = $1", [studentId]);
  if (have) return have;
  for (let i = 0; i < 6; i++) {
    const code = classes.newCode(8);
    try {
      await run("INSERT INTO learner_codes (student_id, code) VALUES ($1,$2) ON CONFLICT (student_id) DO NOTHING", [studentId, code]);
      return String(await val<string>("SELECT code FROM learner_codes WHERE student_id = $1", [studentId]));
    } catch (e) {
      if (!/uq_learner_code|duplicate key/i.test((e as Error).message)) throw e;
    }
  }
  throw new Error("could not allocate a learner code");
}

export async function link(parentId: number, rawCode: string): Promise<{ ok: true; name: string } | { ok: false; error: string }> {
  const bucket = `plink:${parentId}`;
  if ((await fails(bucket)) >= 6) return { ok: false, error: `Too many wrong codes. Please wait ${WINDOW_MIN} minutes and try again.` };
  const code = classes.normCode(rawCode);
  const s = code.length === 8 ? await one("SELECT u.id, u.name FROM learner_codes l JOIN users u ON u.id = l.student_id WHERE l.code = $1 AND u.role = 'student'", [code]) : null;
  if (!s) {
    await recordFail(bucket);
    return { ok: false, error: "That learner code does not match a student. Ask your child to check it on their My classes page." };
  }
  await run("INSERT INTO parent_links (parent_id, student_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", [parentId, s.id]);
  await clearFails(bucket);
  return { ok: true, name: String(s.name) };
}

export async function unlink(parentId: number, studentId: number): Promise<void> {
  await run("DELETE FROM parent_links WHERE parent_id = $1 AND student_id = $2", [parentId, studentId]);
}

export async function children(parentId: number): Promise<Array<{ id: number; name: string }>> {
  return (await all("SELECT u.id, u.name FROM parent_links p JOIN users u ON u.id = p.student_id WHERE p.parent_id = $1 ORDER BY u.name", [parentId])).map((r) => ({ id: Number(r.id), name: String(r.name) }));
}

export async function isLinked(parentId: number, studentId: number): Promise<boolean> {
  return (await val("SELECT 1 FROM parent_links WHERE parent_id = $1 AND student_id = $2", [parentId, studentId])) !== null;
}

export interface ChildReport {
  name: string;
  courses: learning.MyCourse[];
  tests: Array<attempts.Attempt & { label: string }>;
  classes: classes.StudentClass[];
}
/** The report for one child. Callers must have checked isLinked first. */
export async function report(studentId: number): Promise<ChildReport | null> {
  const name = await val<string>("SELECT name FROM users WHERE id = $1 AND role = 'student'", [studentId]);
  if (!name) return null;
  const tests: ChildReport["tests"] = [];
  for (const [exam, ex] of Object.entries(classes.TEST_EXAMS)) for (const a of await attempts.forUser(studentId, exam, 10)) tests.push({ ...a, label: ex.label });
  tests.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return { name: String(name), courses: await learning.forUser(studentId), tests: tests.slice(0, 20), classes: await classes.classesOfStudent(studentId) };
}
