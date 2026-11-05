import { NextResponse } from "next/server";
import { databaseConfigured } from "@/lib/portal/db";
import { cleanPhrase } from "@/lib/market/catalog-query";
import { suggestCatalog } from "@/lib/market/catalog-search";

export const dynamic = "force-dynamic";

// Type-ahead for the courses search box: the best few matches, scored like the search itself. Read-only, public, tiny JSON.
export async function GET(req: Request) {
  const headers = { "Cache-Control": "private, max-age=30", "X-Content-Type-Options": "nosniff" };
  if (!databaseConfigured()) return NextResponse.json([], { headers });
  try {
    return NextResponse.json(await suggestCatalog(cleanPhrase(new URL(req.url).searchParams.get("q") ?? "")), { headers });
  } catch (e) {
    console.error("courses-suggest:", e instanceof Error ? e.message : e);
    return NextResponse.json([], { headers });
  }
}
