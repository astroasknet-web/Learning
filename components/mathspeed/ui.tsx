import Link from "next/link";
import type { ReactNode } from "react";
import { startAction } from "@/app/(portal)/math-speed/actions";
import type { LevelStatus } from "@/lib/mathspeed/rules";

/** Small pieces shared by the studio pages. Student-facing words only: Level, Module, Learn, Understand, Practise, Level Assessment. */
export const btn = "inline-flex min-h-[48px] items-center justify-center rounded-lg px-6 text-[15px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep";
export const btnPrimary = `${btn} bg-orange text-white hover:bg-orange-dark`;
export const btnDark = `${btn} bg-ink text-white hover:bg-ink-2`;
export const btnLight = `${btn} border border-black/15 bg-white text-ink hover:border-orange`;
export const card = "rounded-2xl border border-black/[0.08] bg-white p-5 shadow-card sm:p-6";

export function Card({ title, children, className = "", id }: { title?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={`${card} mb-5 ${className}`}>
      {title ? <h2 className="mb-3 text-[18px] font-semibold text-ink">{title}</h2> : null}
      {children}
    </section>
  );
}

const CHIP: Record<LevelStatus | "soon", { text: string; cls: string }> = {
  completed: { text: "Completed", cls: "bg-green-100 text-green-900" },
  in_progress: { text: "In progress", cls: "bg-orange-light text-orange-deep" },
  locked: { text: "Locked", cls: "bg-cream-3 text-ink-3" },
  soon: { text: "Opens soon", cls: "bg-cream-3 text-ink-3" },
};
export function StatusChip({ status }: { status: LevelStatus | "soon" }) {
  const c = CHIP[status];
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[12px] font-semibold ${c.cls}`}>{c.text}</span>;
}

export function Bar({ pct, label }: { pct: number; label: string }) {
  const v = Math.max(0, Math.min(100, Math.round(pct)));
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-cream-3" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={v} aria-label={label}>
      <div className="h-full rounded-full bg-orange" style={{ width: `${v}%` }} />
    </div>
  );
}

/** A button that starts a session (a server action creates it and sends the student to the practice screen). */
export function StartButton({ kind, refKey = "", back, children, className = btnPrimary }: { kind: string; refKey?: string; back: string; children: ReactNode; className?: string }) {
  return (
    <form action={startAction} className="inline-block">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="ref" value={refKey} />
      <input type="hidden" name="back" value={back} />
      <button type="submit" className={className}>{children}</button>
    </form>
  );
}

export function Flash({ text }: { text?: string }) {
  if (!text) return null;
  return <p role="alert" className="mb-5 rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-[14.5px] text-amber-900">{text}</p>;
}

export const seconds = (ms: number | null): string => (ms === null ? "n/a" : `${(ms / 1000).toFixed(1)} s`);
export const rupees = (minor: number): string => `₹${(minor / 100).toLocaleString("en-IN")}`;

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

/** The paywall note for anything beyond the free sample. */
export function Unlock({ feeMinor, buy, signedIn }: { feeMinor: number | null; buy: string; signedIn: boolean }) {
  return (
    <div className="rounded-2xl border border-orange/40 bg-orange-lighter p-5">
      <p className="text-[16px] font-semibold text-ink">This part is in the full course</p>
      <p className="mt-1 text-[14.5px] text-ink-2">Level A, Module 1 is free to try. The full course opens all 15 levels, the timed drills, the assessments and your daily review{feeMinor ? ` for ${rupees(feeMinor)}, paid once` : ""}.</p>
      <div className="mt-3"><Link className={btnPrimary} href={signedIn ? buy : `/login?next=${encodeURIComponent(buy)}`}>Get the full course</Link></div>
    </div>
  );
}
