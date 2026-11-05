import { randomInt } from "node:crypto";
import { all, one, run, val } from "../portal/db";
import { WINDOW_MIN, clearFails, fails, recordFail } from "../portal/security";
import * as courses from "../market/courses";
import * as ielts from "../tests/ielts";
import * as gre from "../tests/gre";

/**
 * Classes, assignments and the gradebook. A teacher owns classes; students join with a short code; an assignment is a course
 * (progress comes from the student's existing enrolment) or a practice test (result comes from the student's saved attempts).
 * Nothing here stores progress itself, so the gradebook always agrees with My courses and the test pages.
 */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L
export const newCode = (len = 6): string => Array.from({ length: len }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
export const normCode = (s: string): string => s.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);

export const TEST_EXAMS: Record<string, { label: string; max: number; valid: (n: number) => boolean }> = {
  "ielts-reading": { label: "IELTS Reading", max: ielts.TOTAL_TESTS, valid: ielts.validNumber },
  "ielts-listening": { label: "IELTS Listening", max: ielts.TOTAL_TESTS, valid: ielts.validNumber },
  "gre-quant": { label: "GRE Quant", max: gre.TOTAL_TESTS, valid: gre.validNumber },
};

export interface ClassRow { id: number; teacher_id: number; name: string; join_code: string; archived: boolean; created_at: string; students: number; assignments: number }
export interface Assignment { id: number; class_id: number; kind: "course" | "test"; ref: string; test_no: number | null; title: string; note: string; due_date: string | null }
export interface Student { id: number; name: string; email: string }
export interface Cell { state: "none" | "started" | "done"; pct: number | null; label: string }

const mapClass = (r: Record<string, unknown>): ClassRow => ({
  id: Number(r.id), teacher_id: Number(r.teacher_id), name: String(r.name), join_code: String(r.join_code), archived: Number(r.archived) === 1,
  created_at: String(r.created_at), students: Number(r.students ?? 0), assignments: Number(r.assignments ?? 0),
});
const mapAssign = (r: Record<string, unknown>): Assignment => ({
  id: Number(r.id), class_id: Number(r.class_id), kind: r.kind as "course" | "test", ref: String(r.ref), test_no: r.test_no == null ? null : Number(r.test_no),
  title: String(r.title), note: String(r.note ?? ""), due_date: r.due_date == null ? null : String(r.due_date).slice(0, 10),
});

// ---- teacher side ------------------------------------------------------------------------------------------------

export async function createClass(teacherId: number, name: string): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  const n = Array.from(name.trim()).slice(0, 120).join("");
  if (Array.from(n).length < 2) return { ok: false, error: "Give the class a name of at least two characters." };
  if (Number(await val("SELECT COUNT(*) FROM classes WHERE teacher_id = $1 AND archived = 0", [teacherId])) >= 50) return { ok: false, error: "You have reached the limit of 50 active classes. Archive one first." };
  for (let i = 0; i < 6; i++) {
    try {
      const id = await val<number>("INSERT INTO classes (teacher_id, name, join_code) VALUES ($1,$2,$3) RETURNING id", [teacherId, n, newCode()]);
      return { ok: true, id: Number(id) };
    } catch (e) {
      if (!/uq_class_code|duplicate key/i.test((e as Error).message)) throw e; // a code clash: try another
    }
  }
  return { ok: false, error: "Could not make a join code. Please try again." };
}

const CLASS_SELECT = `SELECT c.*, (SELECT COUNT(*) FROM class_members m WHERE m.class_id = c.id) AS students, (SELECT COUNT(*) FROM assignments a WHERE a.class_id = c.id) AS assignments FROM classes c`;

export async function classesOf(teacherId: number): Promise<ClassRow[]> {
  return (await all(`${CLASS_SELECT} WHERE c.teacher_id = $1 ORDER BY c.archived, c.created_at DESC`, [teacherId])).map(mapClass);
}

/** A class, only if this teacher owns it (admins may read any). */
export async function ownedClass(viewer: { id: number; role: string }, classId: number): Promise<ClassRow | null> {
  const r = await one(`${CLASS_SELECT} WHERE c.id = $1`, [classId]);
  if (!r) return null;
  const c = mapClass(r);
  return c.teacher_id === viewer.id || viewer.role === "admin" ? c : null;
}

export async function setArchived(teacherId: number, classId: number, archived: boolean): Promise<void> {
  await run("UPDATE classes SET archived = $1 WHERE id = $2 AND teacher_id = $3", [archived ? 1 : 0, classId, teacherId]);
}

export async function students(classId: number): Promise<Student[]> {
  return (await all("SELECT u.id, u.name, u.email FROM class_members m JOIN users u ON u.id = m.student_id WHERE m.class_id = $1 ORDER BY u.name", [classId])).map((r) => ({ id: Number(r.id), name: String(r.name), email: String(r.email) }));
}

export async function removeStudent(teacherId: number, classId: number, studentId: number): Promise<void> {
  await run("DELETE FROM class_members WHERE class_id = $1 AND student_id = $2 AND class_id IN (SELECT id FROM classes WHERE teacher_id = $3)", [classId, studentId, teacherId]);
}

export async function assignmentsOf(classId: number): Promise<Assignment[]> {
  return (await all("SELECT * FROM assignments WHERE class_id = $1 ORDER BY due_date IS NULL, due_date, id", [classId])).map(mapAssign);
}

export interface NewAssignment { kind: string; ref: string; testNo?: number; note?: string; due?: string }
/** Returns an error message, or null. The title is built here from the real course or test, never taken from the form. */
export async function addAssignment(teacherId: number, classId: number, a: NewAssignment): Promise<string | null> {
  if ((await val("SELECT id FROM classes WHERE id = $1 AND teacher_id = $2 AND archived = 0", [classId, teacherId])) === null) return "That class was not found, or it is archived.";
  let title: string;
  let ref = a.ref;
  let testNo: number | null = null;
  if (a.kind === "course") {
    const c = await courses.bySlug(a.ref.toLowerCase().replace(/[^a-z0-9-]/g, ""));
    if (!c) return "Choose a course from the list.";
    ref = c.slug;
    title = c.title;
  } else if (a.kind === "test") {
    const ex = TEST_EXAMS[a.ref];
    const n = Math.trunc(Number(a.testNo));
    if (!ex || !ex.valid(n)) return "Choose a test and a test number.";
    testNo = n;
    title = `${ex.label} Practice Test ${n}`;
  } else return "Choose what to assign.";
  const due = a.due && /^\d{4}-\d{2}-\d{2}$/.test(a.due) ? a.due : null;
  if ((await val("SELECT id FROM assignments WHERE class_id = $1 AND kind = $2 AND ref = $3 AND COALESCE(test_no, 0) = $4", [classId, a.kind, ref, testNo ?? 0])) !== null) return "That is already assigned to this class.";
  if (Number(await val("SELECT COUNT(*) FROM assignments WHERE class_id = $1", [classId])) >= 100) return "A class can have at most 100 assignments.";
  await run("INSERT INTO assignments (class_id, kind, ref, test_no, title, note, due_date) VALUES ($1,$2,$3,$4,$5,$6,$7)", [classId, a.kind, ref, testNo, title, Array.from((a.note ?? "").trim()).slice(0, 400).join(""), due]);
  return null;
}

export async function removeAssignment(teacherId: number, classId: number, assignmentId: number): Promise<void> {
  await run("DELETE FROM assignments WHERE id = $1 AND class_id = $2 AND class_id IN (SELECT id FROM classes WHERE teacher_id = $3)", [assignmentId, classId, teacherId]);
}

// ---- progress, shared by gradebook, student view and parent report ------------------------------------------------

/** One cell per (assignment, student): where that student stands on that assignment. */
export async function progress(assignments: Assignment[], studentIds: number[]): Promise<Map<string, Cell>> {
  const out = new Map<string, Cell>();
  const key = (aid: number, sid: number) => `${aid}:${sid}`;
  for (const a of assignments) for (const s of studentIds) out.set(key(a.id, s), { state: "none", pct: null, label: "Not started" });
  if (!studentIds.length) return out;
  for (const a of assignments) {
    if (a.kind === "course") {
      const rows = await all("SELECT e.user_id, e.progress, e.status FROM course_enrolments e JOIN courses c ON c.id = e.course_id WHERE c.slug = $1 AND e.user_id = ANY($2::int[])", [a.ref, studentIds]);
      for (const r of rows) {
        const done = String(r.status) === "completed";
        const pct = Number(r.progress);
        out.set(key(a.id, Number(r.user_id)), { state: done ? "done" : pct > 0 ? "started" : "none", pct, label: done ? "Completed" : pct > 0 ? `${pct}%` : "Enrolled" });
      }
    } else {
      const rows = await all(
        "SELECT t.user_id, t.raw, t.total, t.band, t.score FROM test_attempts t WHERE t.exam = $1 AND t.test_no = $2 AND t.user_id = ANY($3::int[]) AND t.id = (SELECT t2.id FROM test_attempts t2 WHERE t2.exam = t.exam AND t2.test_no = t.test_no AND t2.user_id = t.user_id ORDER BY t2.raw DESC, t2.created_at DESC, t2.id DESC LIMIT 1)",
        [a.ref, a.test_no, studentIds],
      );
      for (const r of rows) {
        const raw = Number(r.raw);
        const total = Number(r.total);
        const extra = r.band != null ? ` · band ${Number(r.band).toFixed(1)}` : r.score != null ? ` · about ${Number(r.score)}` : "";
        out.set(key(a.id, Number(r.user_id)), { state: "done", pct: total ? Math.round((raw / total) * 100) : 0, label: `${raw}/${total}${extra}` });
      }
    }
  }
  return out;
}
export const cellKey = (assignmentId: number, studentId: number): string => `${assignmentId}:${studentId}`;

export interface Gradebook { students: Student[]; assignments: Assignment[]; cells: Map<string, Cell> }
export async function gradebook(classId: number): Promise<Gradebook> {
  const [st, asg] = await Promise.all([students(classId), assignmentsOf(classId)]);
  return { students: st, assignments: asg, cells: await progress(asg, st.map((s) => s.id)) };
}

/** Gradebook as CSV. Cells that start with a formula character are prefixed so a spreadsheet cannot run them. */
export function toCsv(g: Gradebook): string {
  const q = (v: string) => `"${(/^[=+\-@\t\r]/.test(v) ? "'" + v : v).replace(/"/g, '""')}"`;
  const head = ["Student", "Email", ...g.assignments.map((a) => a.title + (a.due_date ? ` (due ${a.due_date})` : ""))];
  const lines = [head.map(q).join(",")];
  for (const s of g.students) lines.push([s.name, s.email, ...g.assignments.map((a) => g.cells.get(cellKey(a.id, s.id))?.label ?? "")].map(q).join(","));
  return lines.join("\r\n") + "\r\n";
}

// ---- student side -------------------------------------------------------------------------------------------------

/** Join a class by code. Wrong guesses are throttled per student so codes cannot be brute-forced. */
export async function join(studentId: number, rawCode: string): Promise<{ ok: true; name: string } | { ok: false; error: string }> {
  const bucket = `join:${studentId}`;
  if ((await fails(bucket)) >= 8) return { ok: false, error: `Too many wrong codes. Please wait ${WINDOW_MIN} minutes and try again.` };
  const code = normCode(rawCode);
  const c = code.length >= 4 ? await one("SELECT id, name, archived FROM classes WHERE join_code = $1", [code]) : null;
  if (!c || Number(c.archived) === 1) {
    await recordFail(bucket);
    return { ok: false, error: "That code does not match an active class. Check it with your teacher." };
  }
  await run("INSERT INTO class_members (class_id, student_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", [c.id, studentId]);
  await clearFails(bucket);
  return { ok: true, name: String(c.name) };
}

export async function leave(studentId: number, classId: number): Promise<void> {
  await run("DELETE FROM class_members WHERE class_id = $1 AND student_id = $2", [classId, studentId]);
}

export interface StudentClass { id: number; name: string; teacher: string; items: Array<Assignment & { cell: Cell }> }
export async function classesOfStudent(studentId: number): Promise<StudentClass[]> {
  const rows = await all("SELECT c.id, c.name, u.name AS teacher FROM class_members m JOIN classes c ON c.id = m.class_id JOIN users u ON u.id = c.teacher_id WHERE m.student_id = $1 AND c.archived = 0 ORDER BY c.name", [studentId]);
  const out: StudentClass[] = [];
  for (const r of rows) {
    const asg = await assignmentsOf(Number(r.id));
    const cells = await progress(asg, [studentId]);
    out.push({ id: Number(r.id), name: String(r.name), teacher: String(r.teacher), items: asg.map((a) => ({ ...a, cell: cells.get(cellKey(a.id, studentId))! })) });
  }
  return out;
}

/** The URL where a student does an assignment. */
export const hrefFor = (a: Pick<Assignment, "kind" | "ref" | "test_no">): string => (a.kind === "course" ? `/courses/${a.ref}` : `/practice-tests/${a.ref}/${a.test_no}`);

/** Courses a teacher can assign: the ones taught on GrowQR first, then the rest of the catalogue. */
export async function courseOptions(nativeSlugs: string[]): Promise<Array<{ slug: string; title: string; native: boolean }>> {
  const rows = await all("SELECT slug, title FROM courses ORDER BY title");
  const list = rows.map((r) => ({ slug: String(r.slug), title: String(r.title), native: nativeSlugs.includes(String(r.slug)) }));
  return [...list.filter((c) => c.native), ...list.filter((c) => !c.native)];
}
