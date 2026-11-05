import { isResponse, out, rate, studentJson } from "@/lib/studio/api";
import { submitSession } from "@/lib/mathspeed/store";

export const dynamic = "force-dynamic";

/**
 * Hand in a practice round. The browser sends only what the student typed and how long each answer took; the server rebuilds the questions from
 * the stored plan and marks them itself, so nothing here can say an answer was right.
 */
export async function POST(req: Request) {
  const ctx = await studentJson(req);
  if (isResponse(ctx)) return ctx;
  const limited = rate(ctx.sessionId, "ms-submit", 30);
  if (limited) return limited;
  const id = String(ctx.input.id ?? "");
  const raw = Array.isArray(ctx.input.responses) ? ctx.input.responses.slice(0, 200) : [];
  const responses = raw.map((x) => {
    const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
    return { r: typeof o.r === "string" ? o.r.slice(0, 60) : "", ms: Number(o.ms) || 0 };
  });
  const result = await submitSession(ctx.me.id, id, responses);
  if (!result) return out({ ok: false, error: "That round was not found." }, 404);
  const { tryIngestMathSpeedSession } = await import("@/lib/mathstudio/ingest");
  await tryIngestMathSpeedSession(ctx.me.id, id);
  return out({ ok: true, id: result.id });
}
