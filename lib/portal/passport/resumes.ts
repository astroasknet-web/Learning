import { all, one, run, tx } from "../db";
import { sha256 } from "../security";
import type { ScoredResult, RefusedResult } from "@/lib/qrscore";

/**
 * Every resume a student uploads: extracted text, the "is this a resume?" verdict and the RQ score go to the `resumes` table
 * (history, newest flagged current). Uploads refused as "not a resume" are logged WITHOUT their text in `resume_rejections`.
 * Port of Portal\Resumes.php. Keeping the ORIGINAL FILE in private storage comes with the storage phase; until then only the
 * text and score are kept (storage_path stays empty), which is all the product needs.
 */
export const KEEP = 20; // history kept per student

export interface FileInfo {
  name: string;
  mime: string;
  size: number;
}

export async function saveAccepted(uid: number, result: ScoredResult, text: string, file: Partial<FileInfo> = {}): Promise<number> {
  const name = file.name ?? "";
  const ext = (name.split(".").pop() ?? "").toLowerCase();
  const source = name === "" ? "pasted" : ["pdf", "docx"].includes(ext) ? ext : "text";
  const gate = result.gate;
  const slim = { ...result, extraction: { ...result.extraction, text: undefined } };
  const id = await tx(async (c) => {
    await c.query("UPDATE resumes SET is_current = 0 WHERE user_id = $1", [uid]);
    const r = await c.query<{ id: number }>(
      `INSERT INTO resumes (user_id, original_name, mime, size, source, extraction_method, extraction_confidence, extracted_text, words,
         gate_score, gate_label, gate_json, rq_overall, rq_grade, rq_json, is_current, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,1,NOW()) RETURNING id`,
      [
        uid, Array.from(name).slice(0, 160).join(""), (file.mime ?? "").slice(0, 80), file.size ?? 0, source,
        result.extraction.method ?? null, result.extraction.confidence ?? null, text, gate.words ?? 0, gate.score ?? 0, gate.label ?? "resume",
        JSON.stringify({ found: gate.found ?? [], signals: gate.signals ?? {}, metrics: gate.metrics ?? {} }),
        result.overall.score ?? null, result.grade ?? null, JSON.stringify(slim),
      ],
    );
    return r.rows[0].id;
  });
  await prune(uid);
  return id;
}

/** Log a refused upload (no text kept). Never throws. */
export async function recordRejection(uid: number | null, name: string, gate: RefusedResult["gate"], source = "pasted", ip = ""): Promise<void> {
  try {
    await run(
      "INSERT INTO resume_rejections (user_id, original_name, source, words, gate_score, gate_label, other_type, ip_hash, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())",
      [uid, Array.from(name).slice(0, 160).join(""), source.slice(0, 12), gate.words ?? 0, gate.score ?? 0, gate.label ?? "", gate.other_type ?? null, sha256(ip)],
    );
  } catch {
    /* logging must never block the user-facing refusal */
  }
}

export interface ResumeRow {
  id: number;
  original_name: string;
  source: string;
  gate_label: string;
  rq_overall: string | null;
  rq_grade: string | null;
  is_current: number;
  created_at: string;
}

export async function forUser(uid: number): Promise<ResumeRow[]> {
  return all<ResumeRow>("SELECT id, original_name, source, gate_label, rq_overall, rq_grade, is_current, created_at FROM resumes WHERE user_id = $1 ORDER BY id DESC", [uid]);
}

export async function remove(uid: number, id: number): Promise<boolean> {
  const r = await one<{ user_id: number; is_current: number }>("SELECT user_id, is_current FROM resumes WHERE id = $1", [id]);
  if (!r || r.user_id !== uid) return false;
  await run("DELETE FROM resumes WHERE id = $1", [id]);
  if (r.is_current === 1) await run("UPDATE resumes SET is_current = 1 WHERE id = (SELECT id FROM (SELECT id FROM resumes WHERE user_id = $1 ORDER BY id DESC LIMIT 1) AS latest)", [uid]); // promote the previous upload
  return true;
}

async function prune(uid: number): Promise<void> {
  for (const old of await all<{ id: number }>("SELECT id FROM resumes WHERE user_id = $1 ORDER BY id DESC OFFSET $2", [uid, KEEP])) await remove(uid, old.id);
}
