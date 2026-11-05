import "server-only";
import { run } from "./db";
import { clientIpFrom } from "./security";
import { isBot, referrerHost, visitorHash } from "./tracker";

/**
 * First-party, cookie-less analytics writer (port of Tracker::view / Tracker::click). No IP address and no user agent is stored:
 * the visitor is a one-way hash that rotates daily. Writes never throw into a page.
 */
export const device = (ua: string): "tablet" | "mobile" | "desktop" => (/ipad|tablet|kindle|silk/i.test(ua) ? "tablet" : /mobi|iphone|android/i.test(ua) ? "mobile" : "desktop");

/** Pages that are never counted: staff tools, endpoints, private pages and assets. */
const SKIP = /^\/(console|crm|counselor|admin|api|file|go|_next|account\/mfa|login\/mfa|studio\/export|abroad\/doc|crm\/doc)(\/|$)|\.[a-z0-9]{2,5}$/i;
const ITEM = /^\/(internships|courses|study-abroad|universities)\/([\w.-]{1,120})$/;

type Headers = { get(name: string): string | null };

export async function recordView(h: Headers, path: string, referer: string, user: { id: number; role: string } | null): Promise<void> {
  const ua = h.get("user-agent") ?? "";
  const p = path === "" || path === "/" ? "/" : path.split("?")[0].slice(0, 160);
  if (isBot(ua) || SKIP.test(p) || !p.startsWith("/")) return;
  const item = ITEM.exec(p)?.[2] ?? null;
  const ref = referrerHost(referer, h.get("x-forwarded-host") ?? h.get("host") ?? "");
  try {
    await run("INSERT INTO analytics_events (kind, path, item, visitor, user_id, role, referrer, device) VALUES ('view', $1, $2, $3, $4, $5, $6, $7)",
      [p, item, visitorHash(clientIpFrom(h), ua), user?.id ?? null, user?.role ?? null, ref || null, device(ua)]);
  } catch (e) {
    console.error("tracker view:", (e as Error).message); // analytics must never break a page
  }
}

export async function recordClick(h: Headers, campaign: string, dest: string, user: { id: number; role: string } | null): Promise<void> {
  const ua = h.get("user-agent") ?? "";
  if (isBot(ua)) return;
  try {
    await run("INSERT INTO analytics_events (kind, path, item, campaign, visitor, user_id, role, device) VALUES ('click', '/go', $1, $2, $3, $4, $5, $6)",
      [dest.slice(0, 120), campaign.replace(/[^\w-]/g, "").slice(0, 40), visitorHash(clientIpFrom(h), ua), user?.id ?? null, user?.role ?? null, device(ua)]);
  } catch (e) {
    console.error("tracker click:", (e as Error).message);
  }
}
