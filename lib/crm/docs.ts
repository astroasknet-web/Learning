import { randomBytes } from "node:crypto";
import { all, one, run, val } from "../portal/db";
import * as storage from "../market/storage";
import * as scanner from "../abroad/scanner";

/** A lead's documents (port of Crm\Docs). Same safety rules as the study-abroad vault: type, signature and size check, malware scan, random private names, never served from the web root. */
export const TYPES: Record<string, string> = {
  passport: "Passport", transcripts: "Academic transcripts / marksheets", degree: "Degree / provisional certificate", english_test: "English test result (IELTS / TOEFL / PTE)",
  sat_score: "SAT / ACT score report", gre_gmat_score: "GRE / GMAT score report", internship_cert: "Internship certificate", community_cert: "Community service (NGO) certificate",
  sop: "Statement of purpose", lor: "Letter of recommendation", cv: "CV / resume", financial: "Financial documents", other: "Other",
};
/** Documents the verification partner can check against the issuer. */
export const VERIFIABLE = ["passport", "transcripts", "degree", "english_test", "sat_score", "gre_gmat_score", "internship_cert", "community_cert", "financial"];
export const MAX_BYTES = 8 * 1024 * 1024;
export const MAX_FILES = 40;
const ALLOWED: Record<string, string[]> = { pdf: ["application/pdf"], jpg: ["image/jpeg"], jpeg: ["image/jpeg"], png: ["image/png"], docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"] };

export interface Doc { id: number; lead_id: number; doc_type: string; original_name: string; stored_name: string; mime: string; size: number; status: string; uploaded_by: number | null; scan_status: string; created_at: string }

export const forLead = (leadId: number): Promise<Doc[]> => all<Doc>("SELECT * FROM crm_documents WHERE lead_id = $1 ORDER BY created_at DESC, id DESC", [leadId]);
export const find = (id: number): Promise<Doc | null> => one<Doc>("SELECT * FROM crm_documents WHERE id = $1", [id]);

function sniff(b: Uint8Array, ext: string): string | null {
  const h = (sig: number[]) => sig.every((x, i) => b[i] === x);
  if (ext === "pdf" && h([0x25, 0x50, 0x44, 0x46])) return "application/pdf";
  if ((ext === "jpg" || ext === "jpeg") && h([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (ext === "png" && h([0x89, 0x50, 0x4e, 0x47])) return "image/png";
  if (ext === "docx" && h([0x50, 0x4b])) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  return null;
}

/** Returns the new id, or an error message. */
export async function upload(leadId: number, type: string, file: { name: string; size: number; bytes: Uint8Array }, by: number | null): Promise<number | string> {
  if (!TYPES[type]) return "Choose a document type.";
  if (file.size === 0) return "Choose a file to upload.";
  if (file.size > MAX_BYTES) return "That file is too large (maximum 8 MB).";
  if (Number(await val("SELECT COUNT(*) FROM crm_documents WHERE lead_id = $1", [leadId])) >= MAX_FILES) return `The limit of ${MAX_FILES} documents is reached.`;
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  const mime = ALLOWED[ext] ? sniff(file.bytes, ext) : null;
  if (!mime) return "Upload a PDF, JPG, PNG or DOCX file.";
  const [scan, note] = await scanner.scan(file.bytes, ext);
  if (scan !== "clean") return `That file did not pass our security check: ${note}.`;
  const stored = "crm-" + randomBytes(20).toString("hex") + "." + ext;
  if (!(await storage.put("vault", stored, file.bytes, mime))) return "We could not save that file. Please try again.";
  const name = file.name.replace(/[^\p{L}\p{N}_ .\-()]+/gu, "_").slice(0, 160);
  return Number(await val("INSERT INTO crm_documents (lead_id, doc_type, original_name, stored_name, mime, size, uploaded_by, scan_status) VALUES ($1,$2,$3,$4,$5,$6,$7,'clean') RETURNING id", [leadId, type, name, stored, mime, file.size, by]));
}

export const bytes = (doc: Pick<Doc, "stored_name">): Promise<Buffer | null> => storage.get("vault", doc.stored_name.replace(/^.*[\\/]/, ""));

/** Documents in a live verification cannot be deleted. */
export async function remove(id: number): Promise<boolean> {
  const d = await find(id);
  if (!d || d.status === "in_verification") return false;
  await storage.remove("vault", d.stored_name.replace(/^.*[\\/]/, ""));
  await run("DELETE FROM crm_documents WHERE id = $1", [id]);
  return true;
}

export async function deleteAllFor(leadId: number): Promise<void> {
  for (const d of await forLead(leadId)) await storage.remove("vault", d.stored_name.replace(/^.*[\\/]/, ""));
  await run("DELETE FROM crm_documents WHERE lead_id = $1", [leadId]);
}

/** Headers and body for serving a document. The caller has already checked who may see it. */
export function response(doc: Doc, body: Buffer): Response {
  const ext = (doc.stored_name.split(".").pop() ?? "").toLowerCase();
  return new Response(new Uint8Array(body), {
    headers: {
      "X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store", "Content-Type": doc.mime,
      "Content-Disposition": `${["pdf", "jpg", "jpeg", "png"].includes(ext) ? "inline" : "attachment"}; filename="${doc.original_name.replace(/[^\w.\-]+/g, "_")}"`, "Content-Length": String(body.length),
    },
  });
}
