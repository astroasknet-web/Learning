import { NextResponse } from "next/server";
import { currentUser } from "@/lib/portal/guard";
import { aggregateCsv, } from "@/lib/reading/admin";
import { audit } from "@/lib/reading/store";
import { pool } from "@/lib/pay/db";

export const dynamic = "force-dynamic";

/** Aggregate (never individual) results for authorised administrators. The export itself is written to the audit log. */
export async function GET() {
  const me = await currentUser();
  if (!me || me.role !== "admin" || me.is_demo) return new NextResponse("Not allowed", { status: 403 });
  const csv = await aggregateCsv();
  await audit(pool, me.id, "report.exported", "report", "aggregate");
  return new NextResponse(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="reading-aggregate.csv"', "cache-control": "no-store" } });
}
