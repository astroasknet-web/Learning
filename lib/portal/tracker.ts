import { createHash } from "node:crypto";

/** Small helpers shared with the first-party analytics (port of the pure functions in Portal\Tracker.php). No IP or user agent is ever stored: only a daily-rotating hash. */
const BOT_RE = /bot|crawl|spider|slurp|facebookexternalhit|preview|monitor|uptime|curl|wget|python-requests|httpclient|headless|lighthouse|pingdom|go-http|java\/|node-fetch|axios|scrapy|semrush|ahrefs|mj12|bingpreview|whatsapp|telegram|discord/i;

export function isBot(ua: string): boolean {
  return ua === "" || BOT_RE.test(ua);
}

/** Same scheme as PHP: sha256(ip|ua|YYYY-MM-DD(UTC)|growqr-visitor), first 20 hex characters. */
export function visitorHash(ip: string, ua: string, day: string = new Date().toISOString().slice(0, 10)): string {
  return createHash("sha256").update(`${ip}|${ua}|${day}|growqr-visitor`).digest("hex").slice(0, 20);
}

/** Host of an external referrer ("" when direct, internal or malformed). */
export function referrerHost(referer: string, ownHost: string): string {
  let h = "";
  try {
    h = new URL(referer).hostname.toLowerCase();
  } catch {
    return "";
  }
  const own = ownHost.toLowerCase().replace(/:\d+$/, "");
  h = h.replace(/^www\./, "");
  return h === "" || h === own || h === own.replace(/^www\./, "") || !/^[a-z0-9.-]{3,120}$/.test(h) ? "" : h;
}
