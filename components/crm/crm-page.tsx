import Link from "next/link";
import type { ReactNode } from "react";
import type { PortalUser } from "@/lib/portal/session";
import { dropSessionData, getSession } from "@/lib/portal/session";
import * as L from "@/lib/crm/leads";
import { PortalPage } from "@/components/portal/shell";

/** A CRM page: the staff frame, the CRM tab bar, and the one-time message set by the last action. */
export async function CrmPage({ me, manager, tab, title, subtitle, actions, children }: { me: PortalUser; manager: boolean; tab: string; title: string; subtitle?: string; actions?: ReactNode; children: ReactNode }) {
  const s = await getSession();
  const f = s?.data?.crm_flash as [string, string] | undefined;
  if (f) await dropSessionData("crm_flash");
  const tabs: Array<[string, string, string]> = [["home", "/crm", "Overview"], ["leads", "/crm/leads", "Leads"], ["board", "/crm/leads?view=board", "Pipeline"]];
  if (manager) tabs.push(["reports", "/crm/reports", "Reports"]);
  if (me.role === "admin") tabs.push(["team", "/crm/team", "Team access"]);
  return (
    <PortalPage user={me} active="crm" title={title} subtitle={subtitle} wide="full">
      <nav aria-label="CRM sections" className="flex flex-wrap gap-2 mb-5">
        {tabs.map(([k, href, label]) => <Link key={k} href={href} aria-current={k === tab ? "page" : undefined} className={`min-h-[44px] inline-flex items-center px-4 rounded-full border text-[14px] font-medium ${k === tab ? "bg-ink text-white border-ink" : "bg-white border-black/[0.15] hover:bg-cream-2"}`}>{label}</Link>)}
        {actions ? <span className="ml-auto">{actions}</span> : null}
      </nav>
      {f ? <p role={f[0] === "err" ? "alert" : "status"} className={`mb-5 rounded-lg border px-3.5 py-3 text-[14px] ${f[0] === "err" ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>{f[1]}</p> : null}
      {children}
    </PortalPage>
  );
}

const GREEN = ["enrolled", "visa_approved", "deposit_paid", "offer"];
export function StagePill({ stage }: { stage: string }) {
  const cls = GREEN.includes(stage) ? "bg-emerald-50 text-emerald-800" : stage === "lost" ? "bg-red-50 text-red-800" : stage === "on_hold" ? "bg-cream-3 text-ink-3" : "bg-amber-50 text-amber-900";
  return <span className={`px-2.5 py-1 rounded-full text-[12px] font-semibold whitespace-nowrap ${cls}`}>{L.STAGES[stage] ?? stage}</span>;
}

export const inr = (n: number): string => "₹" + Math.trunc(n).toLocaleString("en-IN");
export const when = (ts: string | null | undefined, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true }): string =>
  ts ? new Date(String(ts).replace(" ", "T") + "Z").toLocaleString("en-IN", { ...opts, timeZone: "UTC" }) : "";
export const fieldCls = "w-full px-3 py-2.5 rounded-lg border border-black/[0.15] bg-white text-[15px] min-h-[44px]";
export const btnCls = "min-h-[44px] px-4 rounded-lg text-[14px] font-semibold";
