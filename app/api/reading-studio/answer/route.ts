import { isResponse, out, rate, studentJson } from "@/lib/studio/api";
import { submitAnswer } from "@/lib/reading/store";
import type { Response } from "@/lib/reading/scoring";

export const dynamic = "force-dynamic";

/**
 * Save one answer. The browser sends which question, what was chosen and how long it says it took; the server checks the question belongs to this
 * assessment, limits the time to what its own clock allows, and marks it. In a practice round it answers with the result and explanation.
 */
export async function POST(req: Request) {
  const ctx = await studentJson(req);
  if (isResponse(ctx)) return ctx;
  const limited = rate(ctx.sessionId, "rd-answer", 120);
  if (limited) return limited;
  const id = String(ctx.input.id ?? "").slice(0, 40);
  const qid = Number(ctx.input.qid);
  const raw = ctx.input.r;
  const r: Response = typeof raw === "number" || typeof raw === "string" ? raw : Array.isArray(raw) ? raw.slice(0, 12).map((x) => Number(x)) : null;
  if (!id || !Number.isInteger(qid)) return out({ ok: false, error: "That answer could not be read." }, 400);
  const res = await submitAnswer(ctx.me.id, id, qid, r, Number(ctx.input.ms) || 0);
  return out(res, res.ok ? 200 : 404);
}
