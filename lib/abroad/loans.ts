import { all, run, val } from "../portal/db";
import { phpRound } from "../qrscore/php";
import { audit } from "./store";

/** Education-loan tracker (self-reported; GrowQR is not a lender) with an EMI calculator (port of Portal\Loans). */
export const STATUS: Record<string, string> = {
  researching: "Researching", applied: "Applied", docs: "Lender wants documents", sanctioned: "Sanctioned", disbursing: "Disbursing", rejected: "Rejected", closed: "Closed",
};
export const CHECKLIST: Record<string, string> = {
  admission: "Admission letter, I-20 or CAS from the university",
  costs: "University cost estimate (tuition and living)",
  kyc: "KYC of student and co-borrower (Aadhaar, PAN, passport)",
  income: "Co-borrower income proof (salary slips, Form 16 or ITR for 2-3 years)",
  academics: "Marksheets and test scores (IELTS, GRE and similar)",
  bank: "Six months of bank statements",
  collateral: "Collateral papers, only for secured loans",
  photos: "Photographs and signed application form",
};
export const MAX_LOANS = 8;
const MAX_AMOUNT = 30000000; // Rs 3 crore

export interface Emi { balance_at_start: number; emi: number; total_payable: number; total_interest: number }
export interface Loan {
  id: number; user_id: number; lender: string; loan_type: string; amount_inr: number; rate_pct: number | null; tenure_years: number; moratorium_months: number; status: string;
  sanctioned_inr: number | null; document_id: number | null; doc_status: string | null; doc_name: string | null; checks: string[]; emi: Emi | null;
}

export async function forUser(uid: number): Promise<Loan[]> {
  const rows = await all<Record<string, unknown>>("SELECT l.*, d.status AS doc_status, d.original_name AS doc_name FROM sa_loans l LEFT JOIN sa_documents d ON d.id = l.document_id WHERE l.user_id = $1 ORDER BY l.id", [uid]);
  return rows.map((r) => {
    let saved: string[] = [];
    try {
      const v = JSON.parse(String(r.checklist_json ?? "[]"));
      if (Array.isArray(v)) saved = v.map(String);
    } catch {
      /* none */
    }
    const sanctioned = r.sanctioned_inr === null ? null : Number(r.sanctioned_inr);
    const amount = Number(r.amount_inr);
    const rate = r.rate_pct === null ? null : Number(r.rate_pct);
    return {
      ...(r as object), id: Number(r.id), user_id: Number(r.user_id), amount_inr: amount, rate_pct: rate, tenure_years: Number(r.tenure_years), moratorium_months: Number(r.moratorium_months), sanctioned_inr: sanctioned,
      document_id: r.document_id === null ? null : Number(r.document_id), checks: Object.keys(CHECKLIST).filter((k) => saved.includes(k)),
      emi: emi(sanctioned || amount, rate, Number(r.tenure_years), Number(r.moratorium_months)),
    } as Loan;
  });
}

/**
 * Repayment estimate. Interest accrues during the moratorium as simple interest and is added to the balance when repayment starts (the
 * usual conservative assumption), then a standard reducing-balance EMI applies. Null when the rate is unknown.
 */
export function emi(principal: number, ratePct: number | null, years: number, moratoriumMonths: number): Emi | null {
  if (ratePct === null || principal <= 0 || years < 1) return null;
  const r = ratePct / 100 / 12;
  const start = principal + principal * r * moratoriumMonths;
  const n = years * 12;
  const e = r > 0 ? (start * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1) : start / n;
  const total = e * n;
  return { balance_at_start: phpRound(start), emi: phpRound(e), total_payable: phpRound(total), total_interest: phpRound(total - principal) };
}

const digits = (s: unknown): number => parseInt(String(s ?? "").replace(/[^\d]/g, ""), 10) || 0;
/** PHP (int) cast with a default only for a missing value: an empty string is 0. */
const phpInt = (v: unknown, dflt: number): number => (v === undefined || v === null ? dflt : parseInt(String(v), 10) || 0);

export interface LoanValues { lender: string; loan_type: string; amount_inr: number; rate_pct: number | null; tenure_years: number; moratorium_months: number; status: string; sanctioned_inr: number | null; checks: string[] }

export function validate(input: Record<string, unknown>): [LoanValues, Record<string, string>] {
  const e: Record<string, string> = {};
  const lender = String(input.lender ?? "").trim();
  if (Array.from(lender).length < 2 || Array.from(lender).length > 80) e.lender = "Enter the lender name.";
  const type = input.loan_type === "secured" ? "secured" : "unsecured";
  const amount = digits(input.amount_inr);
  if (amount < 50000 || amount > MAX_AMOUNT) e.amount_inr = "Enter an amount between Rs 50,000 and Rs 3 crore.";
  const rate = String(input.rate_pct ?? "").trim();
  let ratePct: number | null = null;
  if (rate !== "") {
    if (!Number.isFinite(Number(rate)) || Number(rate) < 1 || Number(rate) > 30) e.rate_pct = "Enter an annual rate between 1 and 30 percent, or leave it blank.";
    else ratePct = phpRound(Number(rate), 2);
  }
  const years = phpInt(input.tenure_years, 10);
  if (years < 1 || years > 20) e.tenure_years = "Repayment period must be 1 to 20 years.";
  const mor = phpInt(input.moratorium_months, 30);
  if (mor < 0 || mor > 72) e.moratorium_months = "Moratorium must be 0 to 72 months.";
  let status = String(input.status ?? "researching");
  if (!STATUS[status]) status = "researching";
  let sanc: number | null = null;
  if (status === "sanctioned" || status === "disbursing") {
    sanc = digits(input.sanctioned_inr);
    if (sanc < 50000 || sanc > MAX_AMOUNT) e.sanctioned_inr = "Enter the sanctioned amount from your sanction letter.";
  }
  const given = Array.isArray(input.checks) ? input.checks.map(String) : [];
  const checks = Object.keys(CHECKLIST).filter((k) => given.includes(k));
  return [{ lender, loan_type: type, amount_inr: amount, rate_pct: ratePct, tenure_years: years, moratorium_months: mor, status, sanctioned_inr: sanc, checks }, e];
}

/** A financial document can be attached only if it is this student's own. */
async function ownDoc(uid: number, docId: number): Promise<number | null> {
  return docId > 0 && (await val("SELECT id FROM sa_documents WHERE id = $1 AND user_id = $2 AND doc_type = 'financial'", [docId, uid])) !== null ? docId : null;
}

export async function save(uid: number, id: number | null, v: LoanValues, docId: number): Promise<string | null> {
  const doc = await ownDoc(uid, docId);
  const args = [v.lender, v.loan_type, v.amount_inr, v.rate_pct, v.tenure_years, v.moratorium_months, v.status, v.sanctioned_inr, doc, JSON.stringify(v.checks)];
  if (id === null) {
    if (Number(await val("SELECT COUNT(*) FROM sa_loans WHERE user_id = $1", [uid])) >= MAX_LOANS) return `You can track up to ${MAX_LOANS} loans. Remove one first.`;
    await run("INSERT INTO sa_loans (lender, loan_type, amount_inr, rate_pct, tenure_years, moratorium_months, status, sanctioned_inr, document_id, checklist_json, user_id, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW(),NOW())", [...args, uid]);
    await audit(uid, uid, "loan.add", v.lender);
    return null;
  }
  if ((await val("SELECT id FROM sa_loans WHERE id = $1 AND user_id = $2", [id, uid])) === null) return "Loan not found.";
  await run("UPDATE sa_loans SET lender=$1, loan_type=$2, amount_inr=$3, rate_pct=$4, tenure_years=$5, moratorium_months=$6, status=$7, sanctioned_inr=$8, document_id=$9, checklist_json=$10, updated_at=NOW() WHERE id=$11 AND user_id=$12", [...args, id, uid]);
  await audit(uid, uid, "loan.update", `${v.lender}: ${v.status}`);
  return null;
}

export async function remove(uid: number, id: number): Promise<boolean> {
  const n = await run("DELETE FROM sa_loans WHERE id = $1 AND user_id = $2", [id, uid]);
  if (n) await audit(uid, uid, "loan.delete", "#" + id);
  return n > 0;
}

