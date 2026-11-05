import * as share from "@/lib/portal/passport/share";
import { verify } from "@/lib/portal/passport/credential";

export const dynamic = "force-dynamic";

/** The same signed credential as readable JSON (the payload). */
export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  const p = await share.byCode(code);
  if (!p || p.is_public !== 1 || !p.credential) return new Response("Not found", { status: 404 });
  const v = await verify(p.credential.jwt);
  if (v.state !== "valid" || !v.payload) return new Response("Not available", { status: 410 });
  return new Response(JSON.stringify(v.payload, null, 2), {
    headers: { "Content-Type": "application/vc+ld+json; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow", "X-Content-Type-Options": "nosniff" },
  });
}
