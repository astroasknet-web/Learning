/**
 * Admin check for code that cannot reach the database (the edge middleware). It only tells whether a portal session cookie is
 * present; the real check (role = "admin") is lib/auth/admin.ts, run by the admin layout and by every admin API route.
 */
export const SESSION_COOKIE = "gq_session";

export function hasSessionCookie(cookie: string | undefined): boolean {
  return !!cookie && /^[a-f0-9]{64}$/.test(cookie);
}
