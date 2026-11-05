import { databaseConfigured } from "@/lib/portal/db";
import * as DC from "@/lib/crm/docs";
import * as LD from "@/lib/crm/leads";

export const dynamic = "force-dynamic";

const plain = (body: string, status: number) => new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "private, no-store" } });

// The student downloads one of their own documents, identified by their private file link.
export async function GET(_req: Request, { params }: { params: Promise<{ token: string; id: string }> }) {
  if (!databaseConfigured()) return plain("Not available.", 503);
  const { token, id } = await params;
  const lead = /^[a-f0-9]{32}$/.test(token) ? await LD.findByToken(token) : null;
  const doc = lead && /^\d{1,9}$/.test(id) ? await DC.find(Number(id)) : null;
  if (!lead || !doc || doc.lead_id !== lead.id) return plain("Not found.", 404);
  const bytes = await DC.bytes(doc);
  return bytes ? DC.response(doc, bytes) : plain("File is no longer available.", 404);
}
