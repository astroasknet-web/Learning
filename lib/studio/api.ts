import "server-only";
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { databaseConfigured } from "../portal/db";
import { getSession, type PortalUser } from "../portal/session";

/** Shared guards for the Resume Studio JSON endpoints: student login, JSON body, CSRF, size and rate limits (port of public/_studio.php). */
export function out(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}

export interface Ctx { me: PortalUser; sessionId: string; csrf: string; input: Record<string, unknown> }

const MAX_BODY = 262144;
const eq = (a: string, b: string): boolean => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/** The signed-in student with a valid JSON body and CSRF token, or the error response to return. */
export async function studentJson(req: Request): Promise<Ctx | NextResponse> {
  if (!databaseConfigured()) return out({ ok: false, error: "Resume Studio is not available right now." }, 503);
  const s = await getSession();
  if (!s?.user || s.user.role !== "student") return out({ ok: false, error: "Please log in as a student.", login: true }, 401);
  const raw = await req.text();
  if (Buffer.byteLength(raw) > MAX_BODY) return out({ ok: false, error: "That is too large." }, 413);
  let input: unknown = null;
  try {
    input = JSON.parse(raw);
  } catch {
    /* handled below */
  }
  if (!input || typeof input !== "object" || Array.isArray(input) || !s.csrf || !eq(s.csrf, String((input as Record<string, unknown>)._csrf ?? ""))) {
    return out({ ok: false, error: "Your session expired. Reload the page and try again." }, 403);
  }
  return { me: s.user, sessionId: s.id, csrf: s.csrf, input: input as Record<string, unknown> };
}

const windows = new Map<string, { t: number; n: number }>();

/** At most `max` calls per minute per session (live scoring is cheap but must not be abusable). Returns an error response when exceeded. */
export function rate(sessionId: string, bucket: string, max: number): NextResponse | null {
  const now = Math.floor(Date.now() / 1000);
  const key = `${sessionId}:${bucket}`;
  let w = windows.get(key) ?? { t: now, n: 0 };
  if (now - w.t >= 60) w = { t: now, n: 0 };
  w.n++;
  windows.set(key, w);
  if (windows.size > 5000) for (const [k, v] of windows) if (now - v.t >= 60) windows.delete(k);
  return w.n > max ? out({ ok: false, error: "Slow down a little and try again in a moment." }, 429) : null;
}

export const isResponse = (v: unknown): v is NextResponse => v instanceof NextResponse;
