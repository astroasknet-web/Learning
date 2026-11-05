import * as share from "@/lib/portal/passport/share";
import { verify } from "@/lib/portal/passport/credential";

export const dynamic = "force-dynamic";

/** The signed credential itself (compact vc+jwt), for anyone to verify with standard tools. Only while the passport is public and valid. */
export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  const p = await share.byCode(code);
  if (!p || p.is_public !== 1 || !p.credential) return new Response("Not found", { status: 404 });
  const v = await verify(p.credential.jwt);
  if (v.state !== "valid") return new Response("Not available", { status: 410 });
  return new Response(p.credential.jwt, {
    headers: { "Content-Type": "application/vc+jwt; charset=utf-8", "Content-Disposition": `inline; filename="growqr-passport-${code}.jwt"`, "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow", "X-Content-Type-Options": "nosniff" },
  });
}
