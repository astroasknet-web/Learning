import { all, one, run } from "../db";
import type { ScoredResult } from "@/lib/qrscore";

/** Student profile + RQ Score storage and the deterministic job-match formula (port of Portal\Passport.php and Learning::learnedText). */
export interface PassportProfile {
  user_id: number;
  college: string;
  phone: string;
  skills: string[];
  rq_overall: string | null;
  rq_grade: string | null;
  rq_updated_at: string | null;
  resume_name: string | null;
  rq: ScoredResult | null;
  learned: string;
}

const lower = (s: string) => s.replace(/[A-Z]+/g, (m) => m.toLowerCase());

/** Lower-case text of completed, certificate-backed or verified courses: what this student has demonstrably learned. */
export async function learnedText(uid: number): Promise<string> {
  const rows = await all<{ title: string; brief: string | null; learn_json: string | null }>(
    "SELECT c.title, c.brief, c.learn_json FROM course_enrolments e JOIN courses c ON c.id = e.course_id WHERE e.user_id = $1 AND e.status = 'completed' AND (e.verified = 1 OR e.certificate_url <> '')",
    [uid],
  );
  let t = "";
  for (const r of rows) {
    let learn: string[] = [];
    try {
      const v = JSON.parse(r.learn_json ?? "[]");
      if (Array.isArray(v)) learn = v.map(String);
    } catch {
      /* ignore */
    }
    t += " " + r.title + " " + (r.brief ?? "") + " " + learn.join(" ");
  }
  return lower(t);
}

const parseJson = <T>(s: string | null, fallback: T): T => {
  try {
    return s ? ((JSON.parse(s) as T) ?? fallback) : fallback;
  } catch {
    return fallback;
  }
};

export async function profile(uid: number): Promise<PassportProfile | null> {
  const p = await one<Record<string, string | number | null>>("SELECT * FROM student_profiles WHERE user_id = $1", [uid]);
  if (!p) return null;
  return {
    user_id: Number(p.user_id),
    college: String(p.college ?? ""),
    phone: String(p.phone ?? ""),
    skills: parseJson<string[]>(p.skills as string | null, []),
    rq_overall: p.rq_overall === null ? null : String(p.rq_overall),
    rq_grade: p.rq_grade === null ? null : String(p.rq_grade),
    rq_updated_at: p.rq_updated_at === null ? null : String(p.rq_updated_at),
    resume_name: p.resume_name === null ? null : String(p.resume_name),
    rq: parseJson<ScoredResult | null>(p.rq_json as string | null, null),
    learned: await learnedText(uid),
  };
}

/** Persist an RQ engine result as the student's passport. */
export async function saveResult(uid: number, result: ScoredResult, fileName: string | null, resumeText: string): Promise<void> {
  if (!result.overall || typeof result.overall.score !== "number") throw new Error("Only a scored resume can be saved to a Skill Passport.");
  const skills = Array.from(new Set([...(result.profile.skills.technical ?? []), ...(result.profile.skills.soft ?? [])]));
  const slim = { ...result, extraction: { ...result.extraction, text: undefined } };
  await run(
    "UPDATE student_profiles SET skills = $1, resume_text = $2, resume_name = $3, rq_overall = $4, rq_grade = $5, rq_json = $6, rq_updated_at = NOW() WHERE user_id = $7",
    [JSON.stringify(skills), resumeText, fileName !== null ? Array.from(fileName).slice(0, 160).join("") : null, result.overall.score, result.grade ?? "", JSON.stringify(slim), uid],
  );
}

const norm = (s: string): string => lower(s).replace(/[^a-z0-9+#]/g, "");

/** Match score 0-100, or null when we cannot compute it honestly. 75% skill overlap with the role's required skills + 25% RQ score. */
export function match(jobSkills: string[], p: Pick<PassportProfile, "skills" | "learned" | "rq_overall"> | null): { score: number | null; have: string[]; miss: string[]; via: string[] } {
  const learned = p?.learned ?? "";
  if (!p || (!p.skills.length && learned === "") || !jobSkills.length) return { score: null, have: [], miss: jobSkills, via: [] };
  const mine = p.skills.map(norm);
  const have: string[] = [];
  const miss: string[] = [];
  const via: string[] = [];
  for (const s of jobSkills) {
    if (mine.includes(norm(s))) have.push(s);
    else if (learned !== "" && Buffer.byteLength(s) >= 3 && learned.includes(lower(s))) {
      have.push(s); // demonstrated by a completed, certificate-backed course
      via.push(s);
    } else miss.push(s);
  }
  const h = Array.from(new Set(have));
  const m = Array.from(new Set(miss));
  const overlap = h.length / Math.max(1, h.length + m.length);
  const rq = p.rq_overall !== null ? Number(p.rq_overall) / 100 : null;
  const score = rq === null ? overlap : 0.75 * overlap + 0.25 * rq;
  return { score: Math.round(score * 100), have: h, miss: m, via: Array.from(new Set(via)) };
}
