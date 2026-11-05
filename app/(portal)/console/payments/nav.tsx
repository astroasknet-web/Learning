import Link from "next/link";
import type { ReactNode } from "react";
import { ConsolePage } from "@/components/admin/console-page";
import type { PortalUser } from "@/lib/portal/session";
import { can, type PayRole } from "@/lib/pay/staff";
import { formatMoney } from "@/lib/pay/money";

export const money = (n: number, c: string): string => formatMoney(n, c, c === "INR" ? "en-IN" : "en-US");
export const when = (s: string | null | undefined): string => (s ? new Date(s).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "");

const LINKS: Array<[string, string, string | null]> = [["orders", "/console/payments", null], ["ops", "/console/payments/ops", "view_audit"], ["catalogue", "/console/payments/catalogue", "manage_catalogue"]];

/** The payment console frame: the shared admin frame plus a section bar showing only what this staff member may open. */
export async function PayConsole({ me, role, section, title, subtitle, children }: { me: PortalUser; role: PayRole; section: string; title: string; subtitle?: string; children: ReactNode }) {
  return (
    <ConsolePage me={me} tab="payments" title={title} subtitle={subtitle} plain>
      <nav aria-label="Payment sections" className="mb-5 flex flex-wrap gap-2">
        {LINKS.filter(([, , perm]) => perm === null || can(role, perm as never)).map(([k, href, ]) => (
          <Link key={k} href={href} aria-current={k === section ? "page" : undefined} className={`inline-flex min-h-[44px] items-center rounded-full border px-4 text-[14px] font-medium ${k === section ? "border-ink bg-ink text-white" : "border-black/[0.15] bg-white hover:bg-cream-2"}`}>
            {k === "orders" ? "Orders and revenue" : k === "ops" ? "Webhooks, reconciliation, audit" : "Prices, coupons, staff"}
          </Link>
        ))}
      </nav>
      {children}
    </ConsolePage>
  );
}
