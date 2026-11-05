import Link from "next/link";
import type { ReactNode } from "react";
import { startAction } from "@/app/(portal)/reading-studio/actions";

/** Small pieces shared by the Reading Studio pages. Student-facing words: levels, skills, assessments, practice. No exam names. */
export const btn = "inline-flex min-h-[48px] items-center justify-center rounded-lg px-6 text-[15px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep";
export const btnPrimary = `${btn} bg-orange text-white hover:bg-orange-dark`;
export const btnDark = `${btn} bg-ink text-white hover:bg-ink-2`;
export const btnLight = `${btn} border border-black/15 bg-white text-ink hover:border-orange`;
export const card = "rounded-2xl border border-black/[0.08] bg-white p-5 shadow-card sm:p-6";

export function Card({ title, children, className = "", id, tone = "plain" }: { title?: ReactNode; children: ReactNode; className?: string; id?: string; tone?: "plain" | "soft" }) {
  return (
    <section id={id} className={`${card} ${tone === "soft" ? "bg-orange-lighter" : ""} mb-5 ${className}`} aria-labelledby={id ? `${id}-h` : undefined}>
      {title ? <h2 id={id ? `${id}-h` : undefined} className="mb-3 text-[18px] font-semibold text-ink">{title}</h2> : null}
      {children}
    </section>
  );
}

export function Flash({ text }: { text?: string }) {
  if (!text) return null;
  return <p role="alert" className="mb-5 rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-[14.5px] text-amber-900">{text}</p>;
}

export function StartButton({ kind, level, skill, back, children, className = btnPrimary }: { kind: string; level?: string; skill?: string; back: string; children: ReactNode; className?: string }) {
  return (
    <form action={startAction} className="inline-block">
      <input type="hidden" name="kind" value={kind} />
      {level ? <input type="hidden" name="level" value={level} /> : null}
      {skill ? <input type="hidden" name="skill" value={skill} /> : null}
      <input type="hidden" name="back" value={back} />
      <button type="submit" className={className}>{children}</button>
    </form>
  );
}

export function Stat({ label, value, sub, hint }: { label: string; value: ReactNode; sub?: ReactNode; hint?: string }) {
  return (
    <div className="rounded-xl border border-black/[0.08] bg-cream-2 p-4">
      <p className="text-[12.5px] font-medium uppercase tracking-wide text-ink-3" title={hint}>{label}</p>
      <p className="mt-1 text-[26px] font-semibold leading-tight text-ink">{value}</p>
      {sub ? <p className="mt-1 text-[13px] leading-snug text-ink-3">{sub}</p> : null}
    </div>
  );
}

export function Bar({ pct, label, tone = "orange" }: { pct: number; label: string; tone?: "orange" | "teal" }) {
  const v = Math.max(0, Math.min(100, Math.round(pct)));
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-cream-3" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={v} aria-label={label}>
      <div className={`h-full rounded-full ${tone === "teal" ? "bg-[#0F766E]" : "bg-orange"}`} style={{ width: `${v}%` }} />
    </div>
  );
}

export const clock = (secs: number): string => `${Math.floor(secs / 60)}:${String(Math.round(secs % 60)).padStart(2, "0")}`;
export const rupees = (minor: number): string => `₹${(minor / 100).toLocaleString("en-IN")}`;
export const when = (iso: string): string => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** A locked area: says plainly what the package adds, using only facts from the student's own result. The button goes to the package page via a tracked link. */
export function Locked({ headline, body, source, cta = "See what is included" }: { headline: string; body: string; source: string; cta?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-orange/60 bg-orange-lighter p-5">
      <p className="text-[12px] font-semibold uppercase tracking-wide text-orange-deep">Part of the Reading Studio package</p>
      <h3 className="mt-1 text-[18px] font-semibold text-ink">{headline}</h3>
      <p className="mt-1.5 max-w-prose text-[14.5px] leading-relaxed text-ink-2">{body}</p>
      <Link href={`/reading-studio/upgrade?from=${source}`} className={`${btnPrimary} mt-4`}>{cta}</Link>
    </div>
  );
}

export function Crumbs({ items }: { items: Array<{ href?: string; label: string }> }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-3 text-[13.5px] text-ink-3">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((c, i) => (
          <li key={c.label} className="flex items-center gap-1.5">
            {i > 0 ? <span aria-hidden>/</span> : null}
            {c.href ? <Link href={c.href} className="underline hover:text-ink">{c.label}</Link> : <span aria-current="page" className="font-medium text-ink">{c.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
