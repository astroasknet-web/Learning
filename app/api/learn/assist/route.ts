import { NextResponse } from "next/server";
import { currentUser } from "@/lib/portal/guard";
import { databaseConfigured } from "@/lib/portal/db";
import { fails, recordFail } from "@/lib/portal/security";
import { rateLimit, rateLimited } from "@/lib/rate-limit";
import { DEFAULT_MODEL } from "@/lib/ai/env";
import { aiAvailable, buildMessages, describeWork, MAX_QUESTION } from "@/lib/learn/assist";
import { cleanState, findActivity } from "@/lib/learn/activities";

export const dynamic = "force-dynamic";
const no = (status: number, error: string) => NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Optional AI helper for the course. Students only, rate limited per IP, per 15 minutes and per day. It never sees a student's work
 * unless the student ticked the box to share it, and the answer is plain text. If AI is off or down, the lessons are unaffected.
 */
export async function POST(req: Request): Promise<Response> {
  if (!aiAvailable()) return no(503, "The assistant is not available right now. The lesson works without it.");
  const rl = await rateLimit(req, { key: "learn-assist", limit: 20, windowMs: 10 * 60_000 });
  if (!rl.ok) return rateLimited(rl.retryAfterSec);
  const me = await currentUser();
  if (!me || me.role !== "student" || !databaseConfigured()) return no(401, "Log in as a student to use the assistant.");
  if ((await fails(`ai15:${me.id}`, 15)) >= 12 || (await fails(`ai1d:${me.id}`, 1440)) >= 40) return no(429, "You have asked a lot of questions. Please try again later, or use the hints in the lesson.");

  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; } catch { return no(400, "Bad request."); }
  const question = typeof body.question === "string" ? body.question.trim().slice(0, MAX_QUESTION) : "";
  if (question.length < 3) return no(400, "Type a question first.");
  const activity = typeof body.slug === "string" && typeof body.activityId === "string" ? findActivity(body.slug.toLowerCase().replace(/[^a-z0-9-]/g, ""), body.activityId) : null;
  const level = body.level === "intermediate" ? "intermediate" : "beginner";
  let work: string | null = null;
  if (body.share === true && activity) {
    const st = cleanState(activity, body.state);
    work = st ? describeWork(st) : null;
  }

  await Promise.all([recordFail(`ai15:${me.id}`), recordFail(`ai1d:${me.id}`)]);
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 12_000);
  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model: process.env.OPENAI_MODEL || DEFAULT_MODEL, messages: buildMessages({ activity, question, level, work }), max_tokens: 350, temperature: 0.3 }),
      signal: ctl.signal,
    });
    if (!r.ok) return no(502, "The assistant could not answer just now. Try the hints in the lesson.");
    const j = (await r.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const answer = (j.choices?.[0]?.message?.content ?? "").trim().slice(0, 1500);
    if (!answer) return no(502, "The assistant did not have an answer. Try asking in a different way.");
    return NextResponse.json({ answer, sharedWork: work !== null }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return no(504, "The assistant took too long to answer. Try the hints in the lesson.");
  } finally {
    clearTimeout(timer);
  }
}
