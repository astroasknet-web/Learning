import { NextResponse } from "next/server";
import { databaseConfigured } from "@/lib/portal/db";
import * as courses from "@/lib/market/courses";
import { parseQuery } from "@/lib/market/catalog-query";
import { runCatalog } from "@/lib/market/catalog-service";

export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "private, max-age=15", "X-Content-Type-Options": "nosniff" };

/**
 * Catalogue search for the courses page: the same validated query as the URL (see lib/market/catalog-query.ts), answered from SQL.
 * Public and read-only. Unknown filter values are dropped, sorts come from an allowlist and the page size from a fixed list; only courses in the
 * catalogue are returned (nothing about any student).
 */
export async function GET(req: Request) {
  if (!databaseConfigured()) return NextResponse.json({ error: "unavailable" }, { status: 503, headers });
  try {
    const keys = (await courses.categories()).map((c) => c.key);
    const q = parseQuery(new URL(req.url).searchParams, keys);
    return NextResponse.json(await runCatalog(q), { headers });
  } catch (e) {
    console.error("courses-search:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "failed" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
