import Link from "next/link";
import type { ReactNode } from "react";

/** Small pieces shared by the Mathematics Studio pages. */
export const btn = "inline-flex min-h-[48px] items-center justify-center rounded-lg px-6 text-[15px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep";
export const btnPrimary = `${btn} bg-orange text-white hover:bg-orange-dark`;
export const btnDark = `${btn} bg-ink text-white hover:bg-ink-2`;
export const btnLight = `${btn} border border-black/15 bg-white text-ink hover:border-orange`;
export const card = "rounded-2xl border border-black/[0.08] bg-white p-5 shadow-card sm:p-6";

export function Card({ title, children, className = "", id, tone = "plain" }: { title?: ReactNode; children: ReactNode; className?: string; id?: string; tone?: "plain" | "soft" | "dark" }) {
  return (
    <section id={id} className={`${tone === "dark" ? "rounded-2xl bg-ink p-5 text-white shadow-card sm:p-6" : card} ${tone === "soft" ? "bg-orange-lighter" : ""} mb-5 ${className}`} aria-labelledby={id ? `${id}-h` : undefined}>
      {title ? <h2 id={id ? `${id}-h` : undefined} className={`mb-3 text-[18px] font-semibold ${tone === "dark" ? "text-white" : "text-ink"}`}>{title}</h2> : null}
      {children}
    </section>
  );
}

export function Stat({ label, value, sub, hint, tone }: { label: string; value: ReactNode; sub?: ReactNode; hint?: string; tone?: "teal" | "rust" | "plain" }) {
  return (
    <div className={`rounded-xl border p-4 ${tone === "teal" ? "border-[#0F766E]/25 bg-[#EEF6F4]" : tone === "rust" ? "border-[#B4410F]/25 bg-orange-lighter" : "border-black/[0.08] bg-cream-2"}`}>
      <p className="text-[12px] font-medium uppercase tracking-wide text-ink-3" title={hint}>{label}</p>
      <p className="mt-1 text-[24px] font-semibold leading-tight text-ink">{value}</p>
      {sub ? <p className="mt-1 text-[12.5px] leading-snug text-ink-3">{sub}</p> : null}
    </div>
  );
}

export function Bar({ pct, label, tone = "teal", low, high }: { pct: number; label: string; tone?: "teal" | "orange"; low?: number; high?: number }) {
  const v = Math.max(0, Math.min(100, Math.round(pct)));
  return (
    <div className="relative h-3 w-full overflow-hidden rounded-full bg-cream-3" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={v} aria-label={label}>
      {low !== undefined && high !== undefined ? <div className="absolute inset-y-0 rounded-full bg-black/10" style={{ left: `${low}%`, width: `${Math.max(0, high - low)}%` }} /> : null}
      <div className={`h-full rounded-full ${tone === "orange" ? "bg-orange" : "bg-[#0F766E]"}`} style={{ width: `${v}%` }} />
    </div>
  );
}

const EV: Record<string, string> = { "Insufficient data": "bg-cream-3 text-ink-3", "Preliminary insight": "bg-amber-100 text-amber-900", "Developing evidence": "bg-sky-100 text-sky-900", "Strong evidence": "bg-emerald-100 text-emerald-900" };
export function EvidenceTag({ label }: { label: string }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${EV[label] ?? "bg-cream-3 text-ink-3"}`}>{label}</span>;
}

export function Locked({ headline, body, source, cta = "See what is included" }: { headline: string; body: string; source: string; cta?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-orange/60 bg-orange-lighter p-5">
      <p className="text-[12px] font-semibold uppercase tracking-wide text-orange-deep">Part of the Mathematics Studio</p>
      <h3 className="mt-1 text-[18px] font-semibold text-ink">{headline}</h3>
      <p className="mt-1.5 max-w-prose text-[14.5px] leading-relaxed text-ink-2">{body}</p>
      <Link href={`/math-studio/upgrade?from=${source}`} className={`${btnPrimary} mt-4`}>{cta}</Link>
    </div>
  );
}

export function Crumbs({ items }: { items: Array<{ href?: string; label: string }> }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-3 text-[13.5px] text-ink-3">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((c, i) => <li key={c.label} className="flex items-center gap-1.5">{i > 0 ? <span aria-hidden>/</span> : null}{c.href ? <Link href={c.href} className="underline hover:text-ink">{c.label}</Link> : <span aria-current="page" className="font-medium text-ink">{c.label}</span>}</li>)}
      </ol>
    </nav>
  );
}

export const when = (iso: string): string => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "");
const SRC: Record<string, string> = { "gre-quant": "GRE Quant", "math-speed": "Mathematics Speed", "jee-mains": "JEE Main", "neet-ug": "NEET UG", "upsc-prelims": "UPSC Prelims", "ssc-cgl": "SSC CGL" };
export const sourceLabel = (src: string): string => SRC[src] ?? (/^imo-/.test(src) ? `IMO ${src.replace("imo-class-", "Class ").replace("imo-", "")}` : src);
