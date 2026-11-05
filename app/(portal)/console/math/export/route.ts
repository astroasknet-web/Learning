import { NextResponse } from "next/server";
import { currentUser } from "@/lib/portal/guard";
import { aggregateCsv } from "@/lib/mathstudio/admin";
import { audit } from "@/lib/mathstudio/store";
import { pool } from "@/lib/pay/db";

export const dynamic = "force-dynamic";

/** Aggregate (never individual) topic figures for authorised administrators. The export is audited; groups below the minimum cohort are withheld. */
export async function GET() {
  const me = await currentUser();
  if (!me || me.role !== "admin" || me.is_demo) return new NextResponse("Not allowed", { status: 403 });
  const csv = await aggregateCsv();
  await audit(pool, me.id, "report.exported", "report", "aggregate");
  return new NextResponse(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="math-studio-aggregate.csv"', "cache-control": "no-store" } });
}
