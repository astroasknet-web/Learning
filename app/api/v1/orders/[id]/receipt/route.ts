import { NextResponse } from "next/server";
import { getDocuments, renderDocumentHtml } from "@/lib/pay/invoices";
import { pool } from "@/lib/pay/db";
import { fail, handleError, viewerOf } from "@/lib/pay/http";
import { loadOrder } from "@/lib/pay/orders";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/orders/{id}/receipt?doc=RCT-2026-000001
 * The printable receipt (or invoice, or credit note) for an order the caller owns. Without `doc` the first document is shown. Use the
 * browser's Print, "Save as PDF" to keep a copy.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const o = await loadOrder(pool, id, await viewerOf(req));
    const docs = await getDocuments(Number(o.id));
    const want = new URL(req.url).searchParams.get("doc");
    const doc = want ? docs.find((d) => d.number === want) : docs[0];
    if (!doc) return fail("document_not_found", "No receipt has been issued for this order yet.", 404);
    return new NextResponse(renderDocumentHtml(doc), {
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'", "Referrer-Policy": "no-referrer" },
    });
  } catch (e) {
    return handleError(e);
  }
}
