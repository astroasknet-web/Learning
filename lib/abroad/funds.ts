import { all, run, val } from "../portal/db";
import { phpRound } from "../qrscore/php";
import * as A from "./catalogue";
import * as loans from "./loans";
import { applications, audit, shortlistIds, type Application } from "./store";

/**
 * Proof-of-funds planner (port of Portal\Funds). The required amount follows the destination's published rule (e.g. a blocked account or a GIC)
 * plus first-year tuition where the rule adds it. Figures are indicative: always confirm with the embassy and the university. A source counts as
 * "documented" only when a financial document is attached to it.
 */
export const KINDS: Record<string, string> = { savings: "Savings or fixed deposit", family: "Family contribution", scholarship: "Scholarship or grant", other: "Other (sponsor, property sale)" };
export const MAX_SOURCES = 20;
const MAX_AMOUNT = 50000000; // Rs 5 crore

export interface Target { min_inr: number; est_inr: number; label: string; note: string; seasoning: string; basis: string; tuition_inr: number; links: Array<{ label: string; url: string }> }

/** What the student should be able to show for one application. */
export function target(uni: Pick<A.University, "cost_tier">, country: A.Country): Target {
  const cost = A.cost(uni, country);
  const rule = (country.funds ?? {}) as { fixed?: number | null; adds_tuition?: boolean; label?: string; note?: string; seasoning?: string };
  const fx = Number(country.fx ?? 1);
  const fixed = rule.fixed !== undefined && rule.fixed !== null ? phpRound(Number(rule.fixed) * fx) : null;
  let min: number;
  let basis: string;
  if (fixed === null) {
    min = cost.total_inr;
    basis = "Estimated first-year tuition plus living costs";
  } else {
    min = fixed + (rule.adds_tuition ? cost.tuition_inr : 0);
    basis = rule.adds_tuition ? "Published requirement plus estimated first-year tuition" : "Published requirement";
  }
  return { min_inr: min, est_inr: cost.total_inr, label: String(rule.label ?? "Funds to show"), note: String(rule.note ?? ""), seasoning: String(rule.seasoning ?? ""), basis, tuition_inr: cost.tuition_inr, links: (country.official as Target["links"]) ?? [] };
}

export interface Source { id: number; kind: string; label: string; amount_inr: number; document_id: number | null; doc_status: string | null; doc_name: string | null; created_at: string }

export async function sources(uid: number): Promise<Source[]> {
  return (await all<Record<string, unknown>>("SELECT f.*, d.status AS doc_status, d.original_name AS doc_name FROM sa_funds f LEFT JOIN sa_documents d ON d.id = f.document_id WHERE f.user_id = $1 ORDER BY f.id", [uid])).map((r) => ({ ...(r as object), id: Number(r.id), amount_inr: Number(r.amount_inr), document_id: r.document_id === null ? null : Number(r.document_id) }) as Source);
}

export interface PoolLine { name: string; kind: string; amount: number; documented: boolean; verified: boolean; id: number; loan: boolean }
export interface Pool { lines: PoolLine[]; documented: number; planned: number }

/**
 * Everything the student can draw on for year one: manual sources plus loans from the tracker. Documented = backed by an attached financial
 * document. Planned = stated but not evidenced yet.
 */
export async function pool(uid: number): Promise<Pool> {
  const lines: PoolLine[] = [];
  let doc = 0;
  let plan = 0;
  for (const s of await sources(uid)) {
    const has = s.document_id !== null && s.doc_status !== null && s.doc_status !== "rejected";
    lines.push({ name: s.label, kind: KINDS[s.kind], amount: s.amount_inr, documented: has, verified: s.doc_status === "verified", id: s.id, loan: false });
    if (has) doc += s.amount_inr;
    else plan += s.amount_inr;
  }
  for (const l of await loans.forUser(uid)) {
    if (["researching", "rejected", "closed"].includes(l.status)) continue;
    const sanctioned = ["sanctioned", "disbursing"].includes(l.status);
    const amount = Number((sanctioned ? l.sanctioned_inr : l.amount_inr) ?? 0);
    const has = sanctioned && l.document_id !== null && l.doc_status !== "rejected";
    lines.push({ name: l.lender + " education loan", kind: sanctioned ? "Loan (sanctioned)" : "Loan (applied, not sanctioned yet)", amount, documented: has, verified: l.doc_status === "verified", id: l.id, loan: true });
    if (has) doc += amount;
    else plan += amount;
  }
  return { lines, documented: doc, planned: plan };
}

export interface Coverage { pct_documented: number; pct_total: number; gap: number; status: "ready" | "planned" | "short" }

export function coverage(p: Pick<Pool, "documented" | "planned">, requiredIn: number): Coverage {
  const required = Math.max(1, requiredIn);
  const tot = p.documented + p.planned;
  return {
    pct_documented: Math.min(100, Math.floor((p.documented / required) * 100)),
    pct_total: Math.min(100, Math.floor((tot / required) * 100)),
    gap: Math.max(0, required - tot),
    status: p.documented >= required ? "ready" : tot >= required ? "planned" : "short",
  };
}

export async function add(uid: number, kind: string, label: string, amount: string, docId: number): Promise<string | null> {
  const l = label.trim();
  const amt = parseInt(String(amount).replace(/[^\d]/g, ""), 10) || 0;
  if (!KINDS[kind]) return "Choose the type of funds.";
  if (Array.from(l).length < 2 || Array.from(l).length > 80) return "Give this source a short name, for example \"Parents' savings\".";
  if (amt < 1000 || amt > MAX_AMOUNT) return "Enter an amount between Rs 1,000 and Rs 5 crore.";
  if (Number(await val("SELECT COUNT(*) FROM sa_funds WHERE user_id = $1", [uid])) >= MAX_SOURCES) return `You can list up to ${MAX_SOURCES} sources. Remove one first.`;
  const doc = docId > 0 && (await val("SELECT id FROM sa_documents WHERE id = $1 AND user_id = $2 AND doc_type = 'financial'", [docId, uid])) !== null ? docId : null;
  await run("INSERT INTO sa_funds (user_id, kind, label, amount_inr, document_id, created_at) VALUES ($1,$2,$3,$4,$5,NOW())", [uid, kind, l, amt, doc]);
  await audit(uid, uid, "funds.add", `${kind}: ${amt}`);
  return null;
}

export async function remove(uid: number, id: number): Promise<boolean> {
  const n = await run("DELETE FROM sa_funds WHERE id = $1 AND user_id = $2", [id, uid]);
  if (n) await audit(uid, uid, "funds.remove", "#" + id);
  return n > 0;
}

/** Applications to plan for, most relevant first (accepted, offer, applied, then others). */
export async function planTargets(uid: number): Promise<Application[]> {
  const rank: Record<string, number> = { accepted: 0, offer: 1, applied: 2, in_review: 3, draft: 4, declined: 9 };
  const apps = await applications(uid);
  return apps.sort((a, b) => (rank[a.status] ?? 5) - (rank[b.status] ?? 5)).filter((a) => a.status !== "declined");
}

/** The university to summarise by default: the most advanced application, else the first shortlisted. */
export async function primaryUniversity(uid: number): Promise<A.University | null> {
  const apps = await planTargets(uid);
  const id = apps.length ? apps[0].university_id : (await shortlistIds(uid))[0] ?? 0;
  return id ? A.universityById(id) : null;
}
