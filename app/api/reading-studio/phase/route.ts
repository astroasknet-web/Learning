import { isResponse, out, rate, studentJson } from "@/lib/studio/api";
import { markPhase } from "@/lib/reading/store";

export const dynamic = "force-dynamic";

/** Note when the student started or finished reading a passage, on the server clock. Reading speed is an estimate built from these two moments. */
export async function POST(req: Request) {
  const ctx = await studentJson(req);
  if (isResponse(ctx)) return ctx;
  const limited = rate(ctx.sessionId, "rd-phase", 60);
  if (limited) return limited;
  const phase = ctx.input.phase === "read_done" ? "read_done" : ctx.input.phase === "read_start" ? "read_start" : null;
  const id = String(ctx.input.id ?? "").slice(0, 40);
  const unit = Number(ctx.input.unit);
  if (!phase || !id || !Number.isInteger(unit)) return out({ ok: false, error: "That could not be read." }, 400);
  const res = await markPhase(ctx.me.id, id, unit, phase);
  return out(res, res.ok ? 200 : 404);
}
