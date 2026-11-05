"use client";

import { useState } from "react";
import { BillingToggle, PlanGrid, inr } from "@/components/pricing/PlanCards";
import { PLANS } from "@/lib/market/plans";
import { chargedRupees, savingFor, type PaidPlanKey, type PlanStack } from "@/lib/market/plan-value";

/**
 * Shown on a free student's dashboard: the three paid packages with what each includes at its own price and what the student saves,
 * so the upgrade is a visible choice. The numbers are the same ones as on the home page (lib/market/plan-value.ts).
 */
export default function UpgradePlans({ stacks }: { stacks: Record<PaidPlanKey, PlanStack> }) {
  const [yearly, setYearly] = useState(false);
  const biggest = PLANS.filter((p) => p.key !== "free")
    .map((p) => ({ name: p.name, s: savingFor(chargedRupees(p, false), stacks[p.key as PaidPlanKey].value) }))
    .reduce<{ name: string; amount: number } | null>((best, x) => (x.s && (!best || x.s.amount > best.amount) ? { name: x.name, amount: x.s.amount } : best), null);
  return (
    <section aria-labelledby="upgrade-h" className="rounded-3xl border border-black/[0.08] bg-gradient-to-b from-cream-2 to-white py-8 shadow-card">
      <div className="px-5 text-center">
        <p className="text-[0.74rem] font-semibold uppercase tracking-[0.16em] text-orange-dark">You are on the Free plan</p>
        <h2 id="upgrade-h" className="mx-auto mt-2 max-w-[22em] text-[1.6rem] font-semibold leading-tight tracking-tight text-ink sm:text-[2rem]">Unlock more courses, studios and expert help</h2>
        <p className="mx-auto mt-3 max-w-[40em] text-[0.98rem] leading-relaxed text-ink-3">
          Every package below includes courses chosen from your resume-scan recommendations, the complete Vedic Mathematics course and Resume Studio Pro.
          {biggest ? <> {biggest.name} saves you <b className="text-emerald-700">{inr(biggest.amount)}</b> against buying the same things one by one.</> : null}
        </p>
        <div className="mt-6"><BillingToggle yearly={yearly} onChange={setYearly} /></div>
      </div>
      <PlanGrid yearly={yearly} headingLevel={3} stacks={stacks} hideFree />
    </section>
  );
}
