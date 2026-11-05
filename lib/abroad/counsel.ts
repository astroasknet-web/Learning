import { all, one, run, val } from "../portal/db";
import * as notify from "./notify";
import { audit } from "./store";
import * as vault from "./vault";

/** Counselor role: caseload, assignment, internal notes and document review, always scoped to the assigned student (port of Portal\Counsel). */
type Viewer = { id: number; role: string };

/** Admins may act on any student; a counselor only on students assigned to them. */
export async function canAccess(viewer: Viewer, studentId: number): Promise<boolean> {
  if (viewer.role === "admin") return true;
  if (viewer.role !== "counselor") return false;
  return Number(await val("SELECT counselor_id FROM sa_profiles WHERE user_id = $1", [studentId])) === viewer.id;
}

export async function counselors(): Promise<Array<{ id: number; name: string; email: string; caseload: number }>> {
  return all("SELECT u.id, u.name, u.email, (SELECT COUNT(*) FROM sa_profiles p WHERE p.counselor_id = u.id) AS caseload FROM users u WHERE u.role = 'counselor' ORDER BY u.name");
}

export async function counselorOf(studentId: number): Promise<{ id: number; name: string } | null> {
  return one("SELECT u.id, u.name FROM sa_profiles p JOIN users u ON u.id = p.counselor_id WHERE p.user_id = $1", [studentId]);
}

/** Students with a finished profile and nobody assigned yet. */
export async function unassigned(limit = 30): Promise<Array<Record<string, unknown>>> {
  return all(
    `SELECT p.user_id, p.stage, p.intake, p.level, p.field, p.updated_at, u.name, u.email FROM sa_profiles p JOIN users u ON u.id = p.user_id
     WHERE p.counselor_id IS NULL AND p.consent_at IS NOT NULL AND p.academic_index IS NOT NULL AND u.role = 'student' ORDER BY p.updated_at ASC LIMIT ${Math.trunc(limit)}`,
  );
}

export async function caseload(counselorId: number): Promise<Array<Record<string, unknown>>> {
  return all(
    `SELECT * FROM (SELECT p.user_id, p.stage, p.intake, p.level, p.field, p.updated_at, u.name, u.email,
        (SELECT COUNT(*) FROM sa_documents d WHERE d.user_id = p.user_id AND d.status = 'uploaded') AS docs_pending,
        (SELECT COUNT(*) FROM sa_applications a WHERE a.user_id = p.user_id AND a.status = 'in_review') AS apps_review,
        (SELECT COUNT(*) FROM sa_applications a WHERE a.user_id = p.user_id AND a.status = 'offer') AS offers
      FROM sa_profiles p JOIN users u ON u.id = p.user_id WHERE p.counselor_id = $1) c ORDER BY (docs_pending + apps_review) DESC, updated_at ASC`,
    [counselorId],
  );
}

export async function assign(studentId: number, counselorId: number | null, actor: number): Promise<string | null> {
  if ((await val("SELECT user_id FROM sa_profiles WHERE user_id = $1", [studentId])) === null) return "That student has no study-abroad profile yet.";
  if (counselorId !== null && (await val("SELECT id FROM users WHERE id = $1 AND role = 'counselor'", [counselorId])) === null) return "Choose a valid counselor.";
  await run("UPDATE sa_profiles SET counselor_id = $1 WHERE user_id = $2", [counselorId, studentId]);
  await audit(actor, studentId, counselorId ? "counselor.assign" : "counselor.unassign", String(counselorId ?? ""));
  if (counselorId) await notify.counselor(studentId, String(await val("SELECT name FROM users WHERE id = $1", [counselorId])));
  return null;
}

/** A counselor takes an unassigned student. Atomic, so two counselors cannot both claim. */
export async function claim(counselorId: number, studentId: number): Promise<string | null> {
  const n = await run("UPDATE sa_profiles SET counselor_id = $1 WHERE user_id = $2 AND counselor_id IS NULL AND consent_at IS NOT NULL", [counselorId, studentId]);
  if (n === 0) return "That student was just taken by someone else.";
  await audit(counselorId, studentId, "counselor.claim", "");
  await notify.counselor(studentId, String(await val("SELECT name FROM users WHERE id = $1", [counselorId])));
  return null;
}

export async function addNote(studentId: number, authorId: number, body: string): Promise<string | null> {
  const b = body.trim();
  if (b === "") return "Write a note first.";
  await run("INSERT INTO sa_notes (student_id, author_id, body, created_at) VALUES ($1,$2,$3,NOW())", [studentId, authorId, Array.from(b).slice(0, 1000).join("")]);
  await audit(authorId, studentId, "note.add", "");
  return null;
}

export async function notes(studentId: number): Promise<Array<Record<string, unknown> & { author: string | null }>> {
  return all("SELECT n.*, u.name AS author FROM sa_notes n LEFT JOIN users u ON u.id = n.author_id WHERE n.student_id = $1 ORDER BY n.id DESC LIMIT 50", [studentId]);
}

/** Verify or reject a document. */
export async function reviewDoc(actor: number, docId: number, ok: boolean, reason: string): Promise<string | null> {
  const d = await vault.find(docId);
  if (!d) return "Document not found.";
  if (!ok && reason.trim() === "") return "Add a short reason so the student knows what to fix.";
  await run("UPDATE sa_documents SET status = $1, reject_reason = $2, verified_by = $3, verified_at = NOW() WHERE id = $4", [ok ? "verified" : "rejected", ok ? "" : Array.from(reason).slice(0, 255).join(""), actor, docId]);
  await audit(actor, Number(d.user_id), ok ? "doc.verify" : "doc.reject", `${d.doc_type} #${docId}`);
  await notify.document(Number(d.user_id), vault.TYPES[d.doc_type], ok, reason);
  return null;
}
