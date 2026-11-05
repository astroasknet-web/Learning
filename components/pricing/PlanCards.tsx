"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AddToCart from "@/components/pay/AddToCart";
import { Check } from "lucide-react";
import { PLANS, savingPercent } from "@/lib/market/plans";
import { bestValue, chargedRupees, yearlySaving, type PaidPlanKey, type PlanStack } from "@/lib/market/plan-value";
import { SavingBadge, ValueStack } from "./ValueStack";

export const inr = (n: number): string => (n === 0 ? "₹0" : `₹${n.toLocaleString("en-IN")}`);

/** Monthly / Yearly switch. */
export function BillingToggle({ yearly, onChange }: { yearly: boolean; onChange: (yearly: boolean) => void }) {
  return (
    <div role="group" aria-label="Billing period" className="inline-flex rounded-full border border-black/10 bg-white p-1 text-[0.92rem] font-medium">
      <button type="button" aria-pressed={!yearly} onClick={() => onChange(false)} className={`min-h-[40px] rounded-full px-5 transition ${!yearly ? "bg-ink text-white" : "text-ink-3"}`}>Monthly</button>
      <button type="button" aria-pressed={yearly} onClick={() => onChange(true)} className={`min-h-[40px] rounded-full px-5 transition ${yearly ? "bg-ink text-white" : "text-ink-3"}`}>
        Yearly <span className={`ml-1 text-[0.78rem] ${yearly ? "text-emerald-300" : "text-emerald-600"}`}>save 33%</span>
      </button>
    </div>
  );
}

/** The four package cards. Used on the pricing page and the home page. */
export function PlanGrid({ yearly, headingLevel = 2, stacks, hideFree = false, collapsed = false }: { yearly: boolean; headingLevel?: 2 | 3; stacks?: Record<PaidPlanKey, PlanStack>; hideFree?: boolean; /** Show a short, equal-height summary of each plan (the home page); the full list opens with the page-level toggle. */ collapsed?: boolean }) {
  const H = headingLevel === 2 ? "h2" : "h3";
  // Buy buttons go to checkout only when the server says online payment is switched on; otherwise they keep going to sign-up.
  const [payOn, setPayOn] = useState(false);
  useEffect(() => {
    let live = true;
    fetch("/api/v1/payments/config").then((r) => r.json()).then((j) => { if (live) setPayOn(!!j?.data?.enabled); }).catch(() => {});
    return () => { live = false; };
  }, []);
  // With value stacks, "Best value" goes to the plan that saves the most percent at the prices on show (none when no plan saves anything).
  // Savings are measured against what checkout charges (the year for Gold), never the monthly figure shown for Gold.
  const charged = (p: (typeof PLANS)[number]): number => chargedRupees(p, yearly);
  const best = stacks ? bestValue({ pro: charged(PLANS[1]), silver: charged(PLANS[2]), gold: charged(PLANS[3]) }, stacks) : null;
  return (
    <div className={`mx-auto grid max-w-[1180px] gap-5 px-5 py-10 ${hideFree ? "lg:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-4"}`} role="list" aria-label="Packages">
      {PLANS.filter((p) => !(hideFree && p.key === "free")).map((p) => {
        const showYear = yearly && !p.annualOnly;
        const price = showYear ? p.yearly : p.monthly;
        const per = p.monthly === 0 ? "forever" : showYear ? "per year" : "per month";
        const perMonth = showYear && p.yearly ? Math.round(p.yearly / 12) : 0;
        const stack = stacks && p.key !== "free" ? stacks[p.key] : null;
        const badge = stacks ? (best === p.key ? "Best value" : p.key === "gold" ? "Most complete" : undefined) : p.badge;
        return (
          <article role="listitem" key={p.key} style={badge ? { borderColor: p.accent, ["--tw-ring-color" as string]: p.accent } : undefined} className={`relative flex flex-col rounded-3xl border bg-white p-6 shadow-sm ${badge ? "ring-2" : "border-black/10"}`}>
            {badge ? <span className="absolute -top-3 left-6 rounded-full px-3 py-1 text-[0.72rem] font-semibold text-white" style={{ background: p.accent }}>{badge}</span> : null}
            <div className="flex items-center gap-2">
              <span aria-hidden className="h-3 w-3 rounded-full" style={{ background: p.accent }} />
              <H className="text-[1.25rem] font-semibold text-ink">{p.name}</H>
            </div>
            <p className="mt-2 min-h-[2.8em] text-[0.92rem] leading-snug text-ink-3">{p.tagline}</p>

            <p className="mt-5 flex items-baseline gap-1.5">
              <span className="text-[2.6rem] font-semibold leading-none tracking-tight text-ink">{inr(price)}</span>
              <span className="text-[0.9rem] text-ink-4">{per}</span>
            </p>
            <p className="mt-1 h-5 text-[0.82rem] text-emerald-700">
              {p.annualOnly ? `Billed yearly: ${inr(p.yearly)} · annual plan only` : perMonth ? `Just ${inr(perMonth)} a month · save ${savingPercent(p)}%` : p.monthly === 0 ? "No card needed" : ""}
            </p>

            {stack ? <SavingBadge stack={stack} price={charged(p)} yearlyBy={yearly ? yearlySaving(p) : undefined} /> : null}

            <Link
              href={p.key === "free" ? "/signup" : payOn ? `/checkout?sku=plan-${p.key}-${showYear || p.annualOnly ? "yearly" : "monthly"}` : `/signup?plan=${p.key}`}
              className={`mt-5 inline-flex min-h-[46px] items-center justify-center rounded-xl px-5 text-[0.95rem] font-semibold transition ${p.key === "free" ? "border border-black/15 text-ink hover:bg-cream-2" : "bg-ink text-white hover:opacity-90"}`}
            >
              {p.cta}
            </Link>
            {p.key !== "free" ? <AddToCart sku={`plan-${p.key}-${showYear || p.annualOnly ? "yearly" : "monthly"}`} compact className="mt-2 w-full" /> : null}

            {stack ? <ValueStack stack={stack} price={charged(p)} period={showYear || p.annualOnly ? "1 year" : "1 month"} accent={p.accent} compact={hideFree} collapsed={collapsed} /> : (
            <div className="mt-6 flex-1 border-t border-black/[0.07] pt-5">
              <p className="mb-3 text-[0.82rem] font-semibold text-ink">{p.inherits ?? "Includes"}</p>
              <ul className="space-y-2.5">
                {p.features.map((f) => (
                  <li key={f.text} className="flex gap-2.5 text-[0.9rem] leading-snug text-ink-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: p.accent }} aria-hidden />
                    <span>
                      {f.text}
                      {f.soon ? <span className="ml-1.5 rounded-full bg-amber-100 px-2 py-0.5 align-middle text-[0.68rem] font-semibold text-amber-800">Soon</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            </div>)}
          </article>
        );
      })}
    </div>
  );
}
