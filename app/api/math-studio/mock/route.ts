import { isResponse, out, rate, studentJson } from "@/lib/studio/api";
import { tryIngestMock, type MockItemIn } from "@/lib/mathstudio/ingest";

export const dynamic = "force-dynamic";

/**
 * A finished mixed-subject mock (JEE, IMO, other LMS mocks) sends its per-question outcomes here, already tagged with a taxonomy topic by the page.
 * The server ingests the mathematics questions into the Mathematics Studio. Non-blocking for the student: a failure never affects their mock result.
 */
export async function POST(req: Request) {
  const ctx = await studentJson(req);
  if (isResponse(ctx)) return ctx;
  const limited = rate(ctx.sessionId, "mx-mock", 20);
  if (limited) return limited;
  const i = ctx.input;
  const rawItems = Array.isArray(i.items) ? i.items.slice(0, 300) : [];
  const items: MockItemIn[] = rawItems.map((x) => { const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>; return { topic: String(o.topic ?? ""), difficulty: Number(o.difficulty) || 3, correct: o.correct === true, skipped: o.skipped === true, maxMarks: Number(o.maxMarks) || 1 }; }).filter((x) => x.topic);
  const source = String(i.source ?? "").slice(0, 40), sourceRef = String(i.sourceRef ?? "").slice(0, 64), label = String(i.label ?? "Mock test").slice(0, 120);
  if (!source || !sourceRef || !items.length) return out({ ok: true, ingested: false });
  await tryIngestMock(ctx.me.id, { source, sourceRef, label, finishedAt: new Date(), totalMs: Number(i.totalMs) || 0, items });
  return out({ ok: true, ingested: true });
}
