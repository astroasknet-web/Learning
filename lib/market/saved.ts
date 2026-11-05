import { all, run, val } from "../portal/db";

/** A student's bookmarked internships (port of Portal\Saved). */
export async function ids(userId: number): Promise<number[]> {
  return (await all<{ internship_id: number }>("SELECT internship_id FROM saved_internships WHERE user_id = $1", [userId])).map((r) => Number(r.internship_id));
}

/** Toggle and return the new state (true = saved). */
export async function toggle(userId: number, internshipId: number): Promise<boolean> {
  if ((await val("SELECT internship_id FROM saved_internships WHERE user_id = $1 AND internship_id = $2", [userId, internshipId])) !== null) {
    await run("DELETE FROM saved_internships WHERE user_id = $1 AND internship_id = $2", [userId, internshipId]);
    return false;
  }
  // Only live postings can be saved.
  if ((await val("SELECT id FROM internships WHERE id = $1 AND status = 'live'", [internshipId])) === null) return false;
  await run("INSERT INTO saved_internships (user_id, internship_id, created_at) VALUES ($1, $2, NOW()) ON CONFLICT DO NOTHING", [userId, internshipId]);
  return true;
}
