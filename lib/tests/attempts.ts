import { all, run } from "../portal/db";

/** Saved practice-test attempts (students only; guests see their result but nothing is stored). */
export interface Attempt { id: number; exam: string; test_no: number; raw: number; total: number; band: number | null; score: number | null; seconds: number; created_at: string }

export async function save(userId: number, a: { exam: string; testNo: number; raw: number; total: number; band?: number | null; score?: number | null; answers: Record<string, string>; seconds: number }): Promise<void> {
  await run(
    "INSERT INTO test_attempts (user_id, exam, test_no, raw, total, band, score, answers_json, seconds) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
    [userId, a.exam, a.testNo, a.raw, a.total, a.band ?? null, a.score ?? null, JSON.stringify(a.answers), Math.max(0, Math.min(86400, Math.trunc(a.seconds)))],
  );
}

const map = (r: Record<string, unknown>): Attempt => ({
  id: Number(r.id), exam: String(r.exam), test_no: Number(r.test_no), raw: Number(r.raw), total: Number(r.total),
  band: r.band == null ? null : Number(r.band), score: r.score == null ? null : Number(r.score), seconds: Number(r.seconds), created_at: String(r.created_at),
});

/** A student's attempts for one exam, newest first. */
export async function forUser(userId: number, exam: string, limit = 50): Promise<Attempt[]> {
  return (await all("SELECT id, exam, test_no, raw, total, band, score, seconds, created_at FROM test_attempts WHERE user_id = $1 AND exam = $2 ORDER BY created_at DESC LIMIT " + Math.trunc(limit), [userId, exam])).map(map);
}

/** Best result per test number, for the hub (a tick and the top score on each test card). */
export async function bestByTest(userId: number, exam: string): Promise<Map<number, Attempt>> {
  const out = new Map<number, Attempt>();
  for (const a of await forUser(userId, exam, 500)) {
    const cur = out.get(a.test_no);
    if (!cur || a.raw > cur.raw) out.set(a.test_no, a);
  }
  return out;
}
