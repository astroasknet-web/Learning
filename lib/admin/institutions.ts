import "server-only";
import { all, one, run } from "../portal/db";

/** Admin side of student-submitted colleges (port of Institutions.php: pending, approve, reject, merge, similar). */
export const PROMOTE_AT = 3;

export function norm(s: string): string {
  const t = s.replace(/[^\p{L}\p{N}]+/gu, " ").trim().toLowerCase();
  return t.replace(/\s+/g, " ").replace(/^the /, "");
}

/** PHP similar_text(): longest common substring, recursively on both sides. Returns the number of matching characters. */
function simText(a: string, b: string): number {
  if (!a.length || !b.length) return 0;
  let max = 0;
  let pa = 0;
  let pb = 0;
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      let k = 0;
      while (i + k < a.length && j + k < b.length && a[i + k] === b[j + k]) k++;
      if (k > max) { max = k; pa = i; pb = j; }
    }
  }
  if (!max) return 0;
  return max + simText(a.slice(0, pa), b.slice(0, pb)) + simText(a.slice(pa + max), b.slice(pb + max));
}
export const similarPct = (a: string, b: string): number => (a.length + b.length === 0 ? 0 : (simText(a, b) * 2 * 100) / (a.length + b.length));

export function levenshtein(a: string, b: string): number {
  const m = b.length;
  let prev = Array.from({ length: m + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= m; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[m];
}

export interface Match { id: number; name: string; place: string; score: number }

/** Existing approved colleges in `state` that look like `name` (typo, case, punctuation). Best match first. */
export async function similar(name: string, state: string, limit = 3): Promise<Match[]> {
  const n = norm(name);
  const out: Match[] = [];
  for (const r of await all<{ id: number; name: string; name_norm: string; district: string | null }>("SELECT id, name, name_norm, district FROM institutions WHERE status = 'approved' AND state = $1", [state])) {
    const m = String(r.name_norm);
    const pct = similarPct(n, m);
    if (n === m || pct >= 86 || levenshtein(n.slice(0, 250), m.slice(0, 250)) <= 2) out.push({ id: Number(r.id), name: r.name, place: r.district ?? "", score: pct });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}

export interface Pending { id: number; name: string; state: string; district: string | null; submit_count: number; created_at: string; matches: Match[] }

export async function pending(): Promise<Pending[]> {
  const rows = await all<Omit<Pending, "matches">>("SELECT id, name, state, district, submit_count, created_at FROM institutions WHERE status = 'pending' ORDER BY submit_count DESC, created_at");
  return Promise.all(rows.map(async (r) => ({ ...r, matches: await similar(r.name, r.state, 3) })));
}

export const approvedCount = async (): Promise<number> => Number((await one<{ n: number }>("SELECT COUNT(*) AS n FROM institutions WHERE status = 'approved'"))?.n ?? 0);

const review = (status: "approved" | "rejected") => (id: number, adminId: number): Promise<unknown> =>
  run(`UPDATE institutions SET status = '${status}', reviewed_by = $1, reviewed_at = LOCALTIMESTAMP(0), updated_at = LOCALTIMESTAMP(0) WHERE id = $2 AND status = 'pending'`, [adminId, id]);
export const approve = review("approved");
export const reject = review("rejected");

/** A duplicate of an existing college: students who typed it get the real name, then the pending row is rejected. */
export async function mergeInto(id: number, targetId: number, adminId: number): Promise<boolean> {
  const p = await one<{ name: string }>("SELECT name FROM institutions WHERE id = $1 AND status = 'pending'", [id]);
  const t = await one<{ name: string }>("SELECT name FROM institutions WHERE id = $1 AND status = 'approved'", [targetId]);
  if (!p || !t) return false;
  await run("UPDATE student_profiles SET college = $1 WHERE college = $2", [t.name, p.name]);
  await reject(id, adminId);
  return true;
}
