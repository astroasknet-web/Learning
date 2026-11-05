import { first, pool, type Db } from "./db";
import { isNative } from "@/lib/market/lessons";
import { recommendedCourses, type Recommended } from "@/lib/market/plan-picks";

/** The student's latest resume scan, or null if they have not scanned one. */
export async function latestScan(userId: number, db: Db = pool): Promise<unknown | null> {
  const r = (await first<{ rq_json: string | null }>(db, "SELECT rq_json FROM resumes WHERE user_id = $1 AND rq_json IS NOT NULL ORDER BY is_current DESC, id DESC LIMIT 1", [userId]))
    ?? (await first<{ rq_json: string | null }>(db, "SELECT rq_json FROM student_profiles WHERE user_id = $1 AND rq_json IS NOT NULL", [userId]));
  if (!r?.rq_json) return null;
  try { return JSON.parse(r.rq_json); } catch { return null; }
}

/** The courses this student may choose from their plan. `scanned` is false until a resume has been scanned (nothing can be chosen yet). */
export async function planRecommended(userId: number, db: Db = pool): Promise<{ scanned: boolean; list: Recommended[] }> {
  const scan = await latestScan(userId, db);
  if (scan === null) return { scanned: false, list: [] };
  return { scanned: true, list: recommendedCourses(scan as never, isNative) };
}
