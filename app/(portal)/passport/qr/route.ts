import QRCode from "qrcode";
import { getSession } from "@/lib/portal/session";
import * as share from "@/lib/portal/passport/share";

export const dynamic = "force-dynamic";

const plain = (body: string, status: number) => new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "private, no-store" } });

// Download the QR code of the signed-in student's own public passport (SVG for print, PNG for Word / LinkedIn).
export async function GET(req: Request) {
  const me = (await getSession())?.user;
  if (!me || me.role !== "student") return plain("Please log in as a student.", 401);
  const p = await share.forUser(me.id);
  if (!p || Number(p.is_public) !== 1) return plain("Publish your passport first.", 404);
  const link = await share.url(String(p.code), true);
  const h = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
  if (new URL(req.url).searchParams.get("fmt") === "png") {
    const png = await QRCode.toBuffer(link, { type: "png", errorCorrectionLevel: "M", margin: 4, scale: 12, color: { dark: "#111827", light: "#ffffff" } });
    return new Response(new Uint8Array(png), { headers: { ...h, "Content-Type": "image/png", "Content-Disposition": 'attachment; filename="growqr-passport-qr.png"' } });
  }
  const svg = (await QRCode.toString(link, { type: "svg", errorCorrectionLevel: "M", margin: 4, color: { dark: "#111827", light: "#ffffff" } })).replace("<svg ", '<svg role="img" aria-label="GrowQR Skill Passport QR code" ');
  return new Response(svg, { headers: { ...h, "Content-Type": "image/svg+xml; charset=utf-8", "Content-Disposition": 'attachment; filename="growqr-passport-qr.svg"' } });
}
