import type { Metadata } from "next";
import Link from "next/link";
import { Analytics, RANGES, cleanRange } from "@/lib/admin/analytics";
import { ConsolePage } from "@/components/admin/console-page";
import { TabBody } from "@/components/admin/analytics-tabs";
import { adminGate } from "../gate";

export const metadata: Metadata = { title: "Analytics | GrowQR", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const TABS: Array<[string, string]> = [["overview", "Overview"], ["users", "Users"], ["internships", "Internships"], ["courses", "Courses"], ["abroad", "Study abroad"], ["resumes", "Resumes"], ["ebooks", "E-books"], ["colleges", "Colleges"], ["system", "System"]];
const one = (v: string | string[] | undefined): string => (Array.isArray(v) ? v[0] ?? "" : v ?? "");

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await adminGate("/console/analytics");
  const sp = await searchParams;
  const tab = TABS.some(([k]) => k === one(sp.tab)) ? one(sp.tab) : "overview";
  const days = cleanRange(one(sp.range));
  const label = RANGES[days];
  const href = (over: Record<string, string>) => `/console/analytics?${new URLSearchParams({ tab, range: String(days), ...over })}`;
  const reissued = one(sp.reissued) !== "" ? parseInt(one(sp.reissued), 10) || 0 : undefined;
  const updated = new Date().toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" });

  return (
    <ConsolePage me={me} tab="analytics" title="Analytics" subtitle="Everything happening across GrowQR in one place. Click any tile to dig in.">
      <nav aria-label="Date range" className="flex flex-wrap gap-2 mb-3">
        {Object.entries(RANGES).map(([n, l]) => <Link key={n} href={href({ range: n })} aria-current={Number(n) === days ? "true" : undefined} className={`min-h-[44px] inline-flex items-center px-4 rounded-lg border text-[14px] ${Number(n) === days ? "bg-ink text-white border-ink" : "bg-white border-black/[0.15] hover:bg-cream-2"}`}>{l.replace("Last ", "")}</Link>)}
      </nav>
      <nav aria-label="Analytics sections" className="flex flex-wrap gap-1.5 mb-3 border-b border-black/[0.08] pb-3">
        {TABS.map(([k, l]) => <Link key={k} href={href({ tab: k })} aria-current={k === tab ? "page" : undefined} className={`min-h-[44px] inline-flex items-center px-3 rounded-lg text-[14px] font-medium ${k === tab ? "bg-orange-light text-orange-deep" : "text-ink-3 hover:bg-cream-2"}`}>{l}</Link>)}
      </nav>
      <p className="text-[13px] text-ink-4 mb-5">{label} &middot; compared with the {days} days before &middot; updated {updated} UTC &middot; <Link className="underline" href={href({})}>Refresh</Link></p>
      <TabBody tab={tab} an={new Analytics(days)} label={label} reissued={reissued} />
    </ConsolePage>
  );
}
