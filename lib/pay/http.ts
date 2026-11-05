import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { mfaRequiredFor } from "@/lib/portal/auth";
import { siteOrigin } from "@/lib/portal/origin";
import { clientIp } from "@/lib/portal/security";
import { getSession } from "@/lib/portal/session";
import { IdempotencyConflict } from "./idempotency";
import { PayError, type Viewer } from "./orders";
import { ProviderError } from "./providers/types";
import { can, payRole, type PayRole, type Permission } from "./staff";

/**
 * Shared plumbing for the /api/v1 payment endpoints.
 *   success: { "data": ... } (lists add page, perPage and total)
 *   failure: { "error": { "code": "...", "message": "...", "details": ... } }
 * Errors never include provider responses, stack traces or SQL.
 */
const NO_STORE = { "Cache-Control": "no-store" };

export const ok = (data: unknown, status = 200, extra: Record<string, unknown> = {}): NextResponse => NextResponse.json({ data, ...extra }, { status, headers: NO_STORE });
export const fail = (code: string, message: string, status = 400, details?: unknown): NextResponse => NextResponse.json({ error: { code, message, ...(details ? { details } : {}) } }, { status, headers: NO_STORE });

export function handleError(e: unknown): NextResponse {
  if (e instanceof PayError) return fail(e.code, e.message, e.status, e.details);
  if (e instanceof IdempotencyConflict) return fail(e.code === "key_reuse" ? "idempotency_key_reuse" : "request_in_progress", e.message, 409);
  if (e instanceof ZodError) return fail("invalid_request", "Some fields are not valid.", 422, e.issues.slice(0, 20).map((i) => ({ field: i.path.join("."), message: i.message })));
  if (e instanceof ProviderError) return fail("provider_unavailable", "The payment provider could not be reached. Please try again in a moment.", e.retryable ? 503 : 502);
  if (e instanceof Error && e.message === "Invalid Idempotency-Key") return fail("bad_idempotency_key", "Idempotency-Key must be 8 to 100 letters, numbers, dots, dashes, underscores or colons.", 400);
  console.error("[pay] unexpected error:", e instanceof Error ? e.message : e);
  return fail("server_error", "Something went wrong. Please try again.", 500);
}

/** State-changing browser calls must come from our own pages (a cross-site request forgery guard; webhooks do not use this). */
export function assertSameOrigin(req: Request): void {
  const here = new URL(siteOrigin(req)).host;
  const origin = req.headers.get("origin");
  if (origin) {
    try { if (new URL(origin).host === here) return; } catch { /* fall through */ }
    throw new PayError("bad_origin", "This request did not come from our site.", 403);
  }
  const site = req.headers.get("sec-fetch-site");
  if (site === "same-origin" || site === "none") return;
  throw new PayError("bad_origin", "This request did not come from our site.", 403);
}

export async function viewerOf(req: Request): Promise<Viewer> {
  const s = await getSession();
  const u = s?.user ?? null;
  const url = new URL(req.url);
  const token = req.headers.get("x-order-token") ?? url.searchParams.get("k");
  return { userId: u?.id ?? null, role: u?.role ?? null, email: u?.email ?? null, token: token && token.length < 100 ? token : null };
}

export async function ipOf(): Promise<string> {
  return clientIp().catch(() => "0.0.0.0");
}

/** The signed-in staff member with the permission, or an error. Staff accounts must have two-step login on (the same rule as the rest of the console). */
export async function requireStaff(permission: Permission): Promise<{ user: { id: number; email: string; role: string }; role: PayRole }> {
  const s = await getSession();
  const u = s?.user;
  if (!u) throw new PayError("unauthenticated", "Please sign in.", 401);
  const role = await payRole(u);
  if (!can(role, permission)) throw new PayError("forbidden", "You do not have permission to do this.", 403);
  if (mfaRequiredFor(u) && !u.mfa_enabled_at) throw new PayError("mfa_required", "Turn on two-step login first.", 403);
  return { user: { id: u.id, email: u.email, role: u.role }, role: role as PayRole };
}

export function pageParams(req: Request, max = 100): { page: number; perPage: number } {
  const u = new URL(req.url);
  return { page: Math.max(1, Number(u.searchParams.get("page")) || 1), perPage: Math.min(max, Math.max(1, Number(u.searchParams.get("perPage")) || 25)) };
}

/** A CSV cell that spreadsheets cannot run as a formula. */
export function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export type Staff = { user: { id: number; email: string; role: string }; role: PayRole };

/**
 * Wraps an admin endpoint: same-origin check for changes, staff sign-in and permission, two-step login for staff, and uniform error replies.
 * `perm` may be a function of the request method (for example "view" for GET and "refund" for POST).
 */
export function staffApi<P extends Record<string, string> = Record<string, never>>(perm: Permission | ((method: string) => Permission), handler: (req: Request, staff: Staff, params: P) => Promise<NextResponse>) {
  // The context argument is required in the type because Next.js checks route handler signatures; a call without one still works at run time.
  return async (req: Request, ctx: { params: Promise<P> }): Promise<NextResponse> => {
    try {
      if (req.method !== "GET" && req.method !== "HEAD") assertSameOrigin(req);
      const staff = await requireStaff(typeof perm === "function" ? perm(req.method) : perm);
      return await handler(req, staff, (ctx?.params ? await ctx.params : {}) as P);
    } catch (e) {
      return handleError(e);
    }
  };
}
