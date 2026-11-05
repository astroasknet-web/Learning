import { Check } from "lucide-react";
import { perUnit, savingFor, type PlanStack, type Saving } from "@/lib/market/plan-value";

const rs = (n: number): string => `₹${n.toLocaleString("en-IN")}`;

/**
 * The saving banner under a plan's price. Monthly view: what the plan's priced contents cost one by one against the plan price. Yearly view: what a year
 * saves against twelve months of paying monthly (a one-time purchase and a year of access are not compared). Shows nothing it cannot back with arithmetic.
 */
export function SavingBadge({ stack, price, yearlyBy }: { stack: PlanStack; price: number; yearlyBy?: Saving | null }) {
  const s = yearlyBy === undefined ? savingFor(price, stack.value) : null;
  const shown = s ?? yearlyBy ?? null;
  return (
    <div className="mt-3 rounded-2xl bg-emerald-50 p-3 ring-1 ring-emerald-200">
      <p className="text-[0.7rem] font-semibold uppercase tracking-wider text-emerald-800">{stack.items} items included{s ? ` · worth ${rs(stack.value)}` : ""}</p>
      {shown ? (
        <>
          <p className="mt-1 text-[1.2rem] font-bold leading-tight text-emerald-900">Save {rs(shown.amount)} <span className="text-[0.95rem]">({shown.percent}%)</span></p>
          <p className="text-[0.78rem] leading-snug text-emerald-900/80">{s ? "compared with buying each one separately" : "compared with paying monthly for 12 months"}</p>
        </>
      ) : null}
    </div>
  );
}

/** What the plan includes with each item's own price, the total, and what is included but not priced. */
export function ValueStack({ stack, price, period, accent, compact = false, collapsed = false }: { stack: PlanStack; price: number; period: string; accent: string; compact?: boolean; collapsed?: boolean }) {
  const s = savingFor(price, stack.value);
  const each = perUnit(price, stack);
  const SHOWN = 4; // the summary shows the first few lines, so every card is the same height
  const lines = collapsed ? stack.lines.slice(0, SHOWN) : stack.lines;
  const hidden = stack.lines.length - lines.length + stack.extras.length;
  return (
    <div className="mt-6 flex-1 border-t border-black/[0.07] pt-5">
      <p className="mb-3 text-[0.82rem] font-semibold text-ink">What you get, at its own price</p>
      <ul className="space-y-3">
        {lines.map((l) => (
          <li key={l.label} className="flex items-start justify-between gap-3 text-[0.9rem] leading-snug text-ink-2">
            <span className="flex min-w-0 gap-2.5">
              <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: accent }} aria-hidden />
              <span className="min-w-0">
                {l.label}
                {l.detail && !collapsed ? <span className="mt-0.5 block text-[0.76rem] text-ink-4">{l.detail}</span> : null}
              </span>
            </span>
            <span className="shrink-0 font-semibold tabular-nums text-ink">{rs(l.rupees)}</span>
          </li>
        ))}
      </ul>
      {s ? (
        <dl className="mt-4 space-y-1.5 border-t border-dashed border-black/15 pt-3 text-[0.88rem]">
          <div className="flex justify-between gap-3"><dt className="text-ink-3">Bought one by one</dt><dd className="font-semibold tabular-nums text-ink">{rs(stack.value)}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-ink-3">This plan, {period}</dt><dd className="font-semibold tabular-nums text-ink">{rs(price)}</dd></div>
          <div className="flex justify-between gap-3 text-emerald-700"><dt className="font-semibold">You save</dt><dd className="font-semibold tabular-nums">{rs(s.amount)} ({s.percent}%)</dd></div>
        </dl>
      ) : collapsed ? null : (
        <p className="mt-4 border-t border-dashed border-black/15 pt-3 text-[0.82rem] leading-snug text-ink-3">
          Those items come to {rs(stack.value)} bought one by one. The {rs(price)} for {period} also covers everything listed below, which has no price of its own, so we do not claim a saving here.
        </p>
      )}
      {collapsed ? <p className="mt-4 text-[0.85rem] font-medium text-ink-3">+ {hidden} more included</p> : null}
      {!collapsed && each ? <p className="mt-2 text-[0.8rem] text-ink-3">Works out to about {rs(each)} per course or studio.</p> : null}
      {!collapsed && s && stack.valueMax > stack.value ? <p className="mt-1 text-[0.8rem] text-ink-3">Worth up to {rs(stack.valueMax)} if you pick the higher-priced courses.</p> : null}

      {collapsed ? null : compact ? (
        <details className="mt-5 text-[0.85rem]">
          <summary className="cursor-pointer font-semibold text-ink">Also included: {stack.extras.length} more items <span className="font-normal text-ink-4">(not priced)</span></summary>
        <ul className="space-y-2">
          {stack.extras.map((t) => (
            <li key={t} className="flex gap-2.5 text-[0.85rem] leading-snug text-ink-3">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-ink-4" aria-hidden />
              <span>{t}</span>
            </li>
          ))}
        </ul>

        </details>
      ) : (
        <>
          <p className="mb-2 mt-5 text-[0.82rem] font-semibold text-ink">Also included <span className="font-normal text-ink-4">(not priced, not counted above)</span></p>
        <ul className="space-y-2">
          {stack.extras.map((t) => (
            <li key={t} className="flex gap-2.5 text-[0.85rem] leading-snug text-ink-3">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-ink-4" aria-hidden />
              <span>{t}</span>
            </li>
          ))}
        </ul>
  
        </>
      )}
    </div>
  );
}
