import { databaseConfigured } from "@/lib/portal/db";
import { recordView } from "@/lib/portal/events";
import { clientIpFrom } from "@/lib/portal/security";
import { getSession } from "@/lib/portal/session";

export const dynamic = "force-dynamic";

const seen = new Map<string, { t: number; n: number }>();

// Page-view beacon from the browser. Answers 204 whatever happens, so tracking can never show an error to a visitor.
export async function POST(req: Request) {
  const done = () => new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  if (!databaseConfigured()) return done();
  const ip = clientIpFrom(req.headers);
  const now = Math.floor(Date.now() / 1000);
  let w = seen.get(ip) ?? { t: now, n: 0 };
  if (now - w.t >= 60) w = { t: now, n: 0 };
  w.n++;
  seen.set(ip, w);
  if (seen.size > 5000) for (const [k, v] of seen) if (now - v.t >= 60) seen.delete(k);
  if (w.n > 120) return done();
  try {
    const raw = await req.text();
    const b = raw.length < 2048 ? (JSON.parse(raw) as { path?: unknown; ref?: unknown }) : {};
    const user = (await getSession())?.user ?? null;
    await recordView(req.headers, typeof b.path === "string" ? b.path : "", typeof b.ref === "string" ? b.ref.slice(0, 300) : "", user ? { id: user.id, role: user.role } : null);
  } catch {
    /* ignore */
  }
  return done();
}
