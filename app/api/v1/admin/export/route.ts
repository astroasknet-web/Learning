import { NextResponse } from "next/server";
import { audit } from "@/lib/pay/audit";
import { searchPayments } from "@/lib/pay/admin";
import { csvCell, staffApi } from "@/lib/pay/http";
import { plainAmount } from "@/lib/pay/money";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/admin/export?status=&provider=&currency=&from=&to=&q=  (permission: export)
 * A CSV of the matching orders (up to 5,000 rows). Amounts are plain decimals in the order's own currency. Cells that start with = + - or @
 * are neutralised so a spreadsheet cannot run them. Every export is written to the audit log.
 */
export const GET = staffApi("export", async (req, staff) => {
  const u = new URL(req.url);
  const f = { q: u.searchParams.get("q") ?? undefined, status: u.searchParams.get("status") ?? undefined, provider: u.searchParams.get("provider") ?? undefined, currency: u.searchParams.get("currency") ?? undefined, from: u.searchParams.get("from") ?? undefined, to: u.searchParams.get("to") ?? undefined };
  const out: string[] = ["order_id,created_at,paid_at,status,currency,total,refunded,tax,provider,provider_ref,method,customer_email,customer_name"];
  let count = 0;
  for (let page = 1; page <= 25; page++) {
    const r = await searchPayments({ ...f, page, perPage: 200 });
    for (const x of r.rows) out.push([x.orderId, x.createdAt, x.paidAt, x.status, x.currency, plainAmount(x.totalMinor, x.currency), plainAmount(x.refundedMinor, x.currency), plainAmount(x.taxMinor, x.currency), x.provider, x.providerRef, x.method, x.email, x.name].map(csvCell).join(","));
    count += r.rows.length;
    if (r.rows.length < 200) break;
  }
  await audit({ actorType: "staff", actorId: staff.user.id, action: "export.csv", entity: "export", entityId: new Date().toISOString(), detail: { filters: f, rows: count } });
  return new NextResponse("﻿" + out.join("\r\n") + "\r\n", { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="payments-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
});
