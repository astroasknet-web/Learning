import { all, one, run, tx, val } from "../portal/db";
import * as docs from "./docs";
import { log } from "./leads";

/**
 * Third-party document verification (port of Crm\Verify).
 *
 * Flow: the student submits documents -> a verification case is opened -> the STUDENT pays the fee (online or at the desk) -> only then does it
 * go to the partner -> staff record the partner's result per document -> the case closes as verified or discrepancy and the documents are marked
 * accordingly. Nothing is sent to the partner before payment.
 *
 * Settings: CRM_VERIFY_PROVIDER, CRM_VERIFY_BASE_INR (default 0), CRM_VERIFY_PER_DOC_INR (default 750).
 */
export const STATUS: Record<string, string> = { awaiting_payment: "Awaiting student payment", in_progress: "With verification partner", verified: "All verified", discrepancy: "Discrepancy found", cancelled: "Cancelled" };
export const RESULT: Record<string, string> = { pending: "Pending", verified: "Verified", mismatch: "Mismatch", unverifiable: "Could not verify" };

export const provider = (): string => process.env.CRM_VERIFY_PROVIDER || "Third-party verification partner";

/** What the student pays: a fixed handling fee plus a fee per document. Decided here, never by the browser. */
export function fee(docCount: number): number {
  const n = (k: string, d: number) => Math.max(0, Math.trunc(Number(process.env[k] ?? d)) || 0);
  return n("CRM_VERIFY_BASE_INR", 0) + n("CRM_VERIFY_PER_DOC_INR", 750) * docCount;
}

export interface Verification { id: number; lead_id: number; provider: string; reference: string; fee_inr: number; status: string; report_note: string; requested_by: string; created_at: string; paid_at: string | null; completed_at: string | null }
export interface Item { id: number; verification_id: number; document_id: number; result: string; note: string; doc_type: string; original_name: string }

export const forLead = (leadId: number): Promise<Verification[]> => all<Verification>("SELECT * FROM crm_verifications WHERE lead_id = $1 ORDER BY id DESC", [leadId]);
export const find = (id: number): Promise<Verification | null> => one<Verification>("SELECT * FROM crm_verifications WHERE id = $1", [id]);
export const items = (id: number): Promise<Item[]> => all<Item>("SELECT i.*, d.doc_type, d.original_name FROM crm_verification_items i JOIN crm_documents d ON d.id = i.document_id WHERE i.verification_id = $1 ORDER BY i.id", [id]);

/** Documents of the lead that may still be submitted (verifiable type, not already in a live case, not already verified). */
export async function submittable(leadId: number): Promise<docs.Doc[]> {
  return (await docs.forLead(leadId)).filter((d) => docs.VERIFIABLE.includes(d.doc_type) && ["uploaded", "rejected"].includes(d.status));
}

/** Open a case for the chosen documents. Returns [verification id, error]. */
export async function request(leadId: number, docIds: number[], by: string, actor: number | null = null): Promise<[number | null, string | null]> {
  const allowed = new Set((await submittable(leadId)).map((d) => d.id));
  const ok = [...new Set(docIds.map((x) => Math.trunc(Number(x))))].filter((id) => allowed.has(id));
  if (!ok.length) return [null, "Choose at least one uploaded document to verify."];
  if (Number(await val("SELECT COUNT(*) FROM crm_verifications WHERE lead_id = $1 AND status = 'awaiting_payment'", [leadId])) > 0) return [null, "There is already a verification waiting for payment. Pay or cancel it first."];
  const f = fee(ok.length);
  let vid = 0;
  try {
    vid = await tx(async (c) => {
      const id = Number((await c.query("INSERT INTO crm_verifications (lead_id, provider, fee_inr, status, requested_by) VALUES ($1,$2,$3,$4,$5) RETURNING id", [leadId, provider(), f, f > 0 ? "awaiting_payment" : "in_progress", by === "staff" ? "staff" : "student"])).rows[0].id);
      for (const d of ok) {
        await c.query("INSERT INTO crm_verification_items (verification_id, document_id) VALUES ($1,$2)", [id, d]);
        await c.query("UPDATE crm_documents SET status = 'in_verification' WHERE id = $1", [d]);
      }
      if (f > 0) await c.query("INSERT INTO crm_payments (lead_id, kind, amount_inr, status, note, verification_id, recorded_by) VALUES ($1,'verification',$2,'due',$3,$4,$5)", [leadId, f, "Third-party verification, paid by the student", id, actor]);
      return id;
    });
  } catch (e) {
    console.error("crm verify request:", e instanceof Error ? e.message : e);
    return [null, "Could not open the verification. Please try again."];
  }
  await log(leadId, actor, "system", `Verification #${vid} opened for ${ok.length} document(s). Student fee: INR ${f}${f > 0 ? ", awaiting payment." : "."}`);
  return [vid, null];
}

/** The student's fee has arrived (online or recorded at the desk). Idempotent. */
export async function markPaid(verificationId: number, actor: number | null, how: string): Promise<boolean> {
  const n = await run("UPDATE crm_verifications SET status = 'in_progress', paid_at = NOW() WHERE id = $1 AND status = 'awaiting_payment'", [verificationId]);
  if (n !== 1) return false;
  const v = (await find(verificationId))!;
  await log(v.lead_id, actor, "system", `Verification #${verificationId} paid by the student (${how}). Sent to ${v.provider || "the partner"}.`);
  return true;
}

export async function cancel(verificationId: number, actor: number): Promise<string | null> {
  const v = await find(verificationId);
  if (!v || v.status !== "awaiting_payment") return "Only a case that is still awaiting payment can be cancelled.";
  await run("UPDATE crm_verifications SET status = 'cancelled', completed_at = NOW() WHERE id = $1", [verificationId]);
  await run("UPDATE crm_documents SET status = 'uploaded' WHERE id IN (SELECT document_id FROM crm_verification_items WHERE verification_id = $1) AND status = 'in_verification'", [verificationId]);
  await run("UPDATE crm_payments SET status = 'waived', note = 'Verification cancelled' WHERE verification_id = $1 AND status = 'due'", [verificationId]);
  await log(v.lead_id, actor, "system", `Verification #${verificationId} cancelled before payment.`);
  return null;
}

export async function setCase(verificationId: number, prov: string, reference: string): Promise<void> {
  await run("UPDATE crm_verifications SET provider = $1, reference = $2 WHERE id = $3", [Array.from(prov.trim()).slice(0, 120).join(""), Array.from(reference.trim()).slice(0, 80).join(""), verificationId]);
}

/** Record the partner's finding for one document; closes the case when every document has an answer. */
export async function recordResult(itemId: number, result: string, note: string, actor: number): Promise<string | null> {
  const item = await one<{ verification_id: number; document_id: number; lead_id: number; vstatus: string }>(
    "SELECT i.*, v.lead_id, v.status AS vstatus FROM crm_verification_items i JOIN crm_verifications v ON v.id = i.verification_id WHERE i.id = $1", [itemId]);
  if (!item || !RESULT[result] || result === "pending") return "Choose a result.";
  if (item.vstatus !== "in_progress") return item.vstatus === "awaiting_payment" ? "The student has not paid yet, so this cannot go to the partner." : "This case is already closed.";
  await run("UPDATE crm_verification_items SET result = $1, note = $2 WHERE id = $3", [result, Array.from(note.trim()).slice(0, 255).join(""), itemId]);
  await run("UPDATE crm_documents SET status = $1 WHERE id = $2", [result === "verified" ? "verified" : "rejected", item.document_id]);
  const vid = item.verification_id;
  if (Number(await val("SELECT COUNT(*) FROM crm_verification_items WHERE verification_id = $1 AND result = 'pending'", [vid])) === 0) {
    const bad = Number(await val("SELECT COUNT(*) FROM crm_verification_items WHERE verification_id = $1 AND result <> 'verified'", [vid]));
    await run("UPDATE crm_verifications SET status = $1, completed_at = NOW() WHERE id = $2", [bad ? "discrepancy" : "verified", vid]);
    await log(item.lead_id, actor, "system", `Verification #${vid} closed: ${bad ? bad + " document(s) need attention." : "all documents verified."}`);
  }
  return null;
}

/** True when every verifiable document the lead has uploaded is verified (and there is at least one). */
export async function allClear(leadId: number): Promise<boolean> {
  const rows = (await docs.forLead(leadId)).filter((d) => docs.VERIFIABLE.includes(d.doc_type));
  return rows.length > 0 && rows.every((d) => d.status === "verified");
}
