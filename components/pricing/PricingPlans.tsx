"use client";

import Link from "next/link";
import { useState } from "react";
import { COMPARE, FAQ, PLANS } from "@/lib/market/plans";
import { BillingToggle, inr, PlanGrid } from "./PlanCards";
import type { PaidPlanKey, PlanStack } from "@/lib/market/plan-value";

export default function PricingPlans({ stacks }: { stacks: Record<PaidPlanKey, PlanStack> }) {
  const [yearly, setYearly] = useState(false);

  return (
    <div className="bg-cream-2">
      <section className="mx-auto max-w-[1180px] px-5 pb-6 pt-28 text-center md:pt-36">
        <p className="text-[0.78rem] font-semibold uppercase tracking-[0.16em] text-ink-4">Student packages</p>
        <h1 className="mx-auto mt-3 max-w-[18em] text-[clamp(2rem,4.6vw,3.4rem)] font-semibold leading-[1.08] tracking-tight text-ink">
          Learn free. Pay only when you want more.
        </h1>
        <p className="mx-auto mt-4 max-w-[34em] text-[1.05rem] leading-relaxed text-ink-3">
          Four simple packages, priced for students. Start free, and upgrade when you are ready.
        </p>

        <div className="mt-8"><BillingToggle yearly={yearly} onChange={setYearly} /></div>
      </section>

      <PlanGrid yearly={yearly} stacks={stacks} />

      <p className="mx-auto max-w-[44em] px-5 pb-10 text-center text-[0.85rem] text-ink-4">
        Early-access prices for students, in Indian rupees. Each price in a package is what that item costs on its own today; items without a price of their own are listed but never counted.
      </p>


      <section className="mx-auto max-w-[1180px] px-5 pb-16" aria-labelledby="compare">
        <h2 id="compare" className="text-center text-[1.6rem] font-semibold text-ink">Compare packages</h2>
        <div className="mt-6 overflow-x-auto rounded-2xl border border-black/10 bg-white">
          <table className="w-full min-w-[640px] border-collapse text-left text-[0.9rem]">
            <thead>
              <tr className="border-b border-black/10">
                <th className="w-[34%] px-4 py-3 font-medium text-ink-4"><span className="sr-only">Feature</span></th>
                {PLANS.map((p) => (
                  <th key={p.key} scope="col" className="px-4 py-3 font-semibold text-ink">
                    <span aria-hidden className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full" style={{ background: p.accent }} />{p.name}
                    <span className="block text-[0.8rem] font-normal text-ink-4">{p.monthly ? inr(yearly && !p.annualOnly ? p.yearly : p.monthly) + (yearly && !p.annualOnly ? "/yr" : "/mo") : "₹0"}</span>
                  </th>
                ))}
              </tr>
            </thead>
            {COMPARE.map((g) => (
              <tbody key={g.group}>
                <tr><th colSpan={5} scope="colgroup" className="bg-cream-2 px-4 py-2 text-[0.74rem] font-semibold uppercase tracking-[0.12em] text-ink-4">{g.group}</th></tr>
                {g.rows.map((r) => (
                  <tr key={r.label} className="border-t border-black/[0.06]">
                    <th scope="row" className="px-4 py-3 font-normal text-ink-2">
                      {r.label}{r.soon ? <span className="ml-1.5 rounded-full bg-amber-100 px-2 py-0.5 align-middle text-[0.66rem] font-semibold text-amber-800">Soon</span> : null}
                    </th>
                    {r.v.map((c, i) => (
                      <td key={i} className={`px-4 py-3 ${c === "–" ? "text-ink-5" : "font-medium text-ink"}`}>{c}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      </section>

      <section className="mx-auto max-w-[760px] px-5 pb-24">
        <h2 className="text-center text-[1.6rem] font-semibold text-ink">Questions</h2>
        <div className="mt-6 divide-y divide-black/[0.08] rounded-2xl border border-black/10 bg-white">
          {FAQ.map((f) => (
            <details key={f.q} className="group px-5 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[0.98rem] font-medium text-ink">
                {f.q}
                <span aria-hidden className="text-ink-4 transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-2 text-[0.92rem] leading-relaxed text-ink-3">{f.a}</p>
            </details>
          ))}
        </div>
        <p className="mt-6 text-center text-[0.9rem] text-ink-3">
          Questions about a plan? <Link href="/contact" className="font-medium text-ink underline">Talk to us</Link>. See the <Link href="/refund-policy" className="font-medium text-ink underline">refund policy</Link>.
        </p>
      </section>
    </div>
  );
}
