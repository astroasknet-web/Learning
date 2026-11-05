"use client";

import type { ReactNode } from "react";

/** Shared frame for every interactive lesson widget: a labelled card with an XP chip. */
export function Shell({ kind, title, intro, xp, children }: { kind: string; title?: string; intro?: string; xp?: number; children: ReactNode }) {
  return (
    <section className="cw-widget my-6 overflow-hidden rounded-2xl border border-orange/30 bg-white shadow-card" aria-label={`${kind}${title ? `: ${title}` : ""}`}>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-orange/20 bg-gradient-to-r from-orange-lighter to-white px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-ink px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white"><span aria-hidden="true">&#9889;</span>{kind}</span>
          {title ? <h3 className="mt-1.5 text-[17px] font-bold leading-snug text-ink">{title}</h3> : null}
        </div>
        {typeof xp === "number" ? <span className="rounded-full bg-orange-light px-3 py-1 text-[12.5px] font-bold text-orange-deep" aria-label={`${xp} experience points available`}>up to +{xp} XP</span> : null}
      </header>
      <div className="px-4 py-4 sm:px-5">
        {intro ? <p className="mb-3 text-[15px] text-ink-2">{intro}</p> : null}
        {children}
      </div>
    </section>
  );
}

export const btnPrimary = "inline-flex min-h-[44px] items-center justify-center rounded-lg bg-orange-deep px-5 text-[15px] font-semibold text-white transition hover:bg-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep disabled:cursor-not-allowed disabled:opacity-50";
export const btnGhost = "inline-flex min-h-[44px] items-center justify-center rounded-lg border border-black/[0.18] bg-white px-4 text-[14.5px] font-medium text-ink transition hover:bg-cream-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep disabled:cursor-not-allowed disabled:opacity-50";

export function Feedback({ ok, children }: { ok: boolean | null; children: ReactNode }) {
  if (ok === null) return <p className="min-h-[1.5rem]" aria-live="polite" />;
  return (
    <p role="status" aria-live="polite" className={`cw-rise mt-3 rounded-xl px-4 py-3 text-[14.5px] ${ok ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-900"}`}>
      <b>{ok ? "Correct. " : "Not yet. "}</b>{children}
    </p>
  );
}

export const rs = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
