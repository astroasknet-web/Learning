import { NextResponse } from "next/server";
import { verifySignedFile } from "@/lib/data/storage";
import * as files from "@/lib/market/storage";

export const runtime = "nodejs";

/** Buckets whose files are meant for public pages (event posters, speaker photos). */
const PUBLIC_BUCKETS = new Set(["event-assets", "expert-media"]);

const TYPES: Record<string, string> = { pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif" };

/** Serves an uploaded file to someone holding a signed link (made by createSignedUrl; it carries an expiry and a signature). */
export async function GET(req: Request, ctx: { params: Promise<{ bucket: string; path: string[] }> }) {
  const { bucket, path } = await ctx.params;
  const rel = path.map(decodeURIComponent).join("/");
  const u = new URL(req.url);
  const open = PUBLIC_BUCKETS.has(decodeURIComponent(bucket)); // images shown on public pages
  if (!open && !(await verifySignedFile(decodeURIComponent(bucket), rel, u.searchParams.get("exp"), u.searchParams.get("sig")))) {
    return new NextResponse("This link has expired or is not valid.", { status: 403 });
  }
  const buf = await files.get(decodeURIComponent(bucket), rel);
  if (!buf) return new NextResponse("Not found", { status: 404 });
  const ext = rel.split(".").pop()?.toLowerCase() ?? "";
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": TYPES[ext] ?? "application/octet-stream",
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
