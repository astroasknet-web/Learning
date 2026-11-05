/** The public address of this site, for redirect links. PORTAL_APP_URL wins; otherwise the forwarded host of the request. */
export function siteOrigin(req: Request): string {
  const fixed = (process.env.PORTAL_APP_URL ?? "").trim().replace(/\/+$/, "");
  if (/^https?:\/\/[^\s/]+$/.test(fixed)) return fixed;
  const h = req.headers;
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").split(",")[0].trim();
  const proto = (h.get("x-forwarded-proto") ?? "").split(",")[0].trim() || (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  if (/^[a-z0-9.-]+(:\d+)?$/i.test(host)) return `${proto}://${host}`;
  return new URL(req.url).origin;
}
