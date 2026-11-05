import { isResponse, out, rate, studentJson } from "@/lib/studio/api";
import { finishAssessment } from "@/lib/reading/store";
import { aiAvailable, aiFeedback } from "@/lib/reading/ai";

export const dynamic = "force-dynamic";

/** Hand in an assessment. The server scores it from the answers it stored and its own clock; the optional AI note never changes a score. */
export async function POST(req: Request) {
  const ctx = await studentJson(req);
  if (isResponse(ctx)) return ctx;
  const limited = rate(ctx.sessionId, "rd-finish", 20);
  if (limited) return limited;
  const id = String(ctx.input.id ?? "").slice(0, 40);
  if (!id) return out({ ok: false, error: "That could not be read." }, 400);
  const res = await finishAssessment(ctx.me.id, id, Date.now(), aiAvailable() ? { ai: (f) => aiFeedback(f) } : {});
  if (!res) return out({ ok: false, error: "That assessment was not found." }, 404);
  return out({ ok: true, id: res.id });
}
