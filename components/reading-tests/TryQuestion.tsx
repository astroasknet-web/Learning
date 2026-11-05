"use client";

import { useState } from "react";

export interface SampleQ { test: number; title: string; stem: string; options: string[]; answer: number; explanation: string }

/**
 * A real question from one of the free tests, answerable on the spot. The answer is sent to the page because this one question is a public sample;
 * in the tests themselves nothing is revealed until the test is handed in.
 */
export default function TryQuestion({ q }: { q: SampleQ }) {
  const [pick, setPick] = useState<number | null>(null);
  const done = pick !== null;
  const ok = pick === q.answer;
  return (
    <div className="rounded-3xl border border-white/15 bg-white/[0.07] p-5 shadow-2xl backdrop-blur-md sm:p-6" role="group" aria-label="Try a real question">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-orange">Try a real question</p>
        <p className="rounded-full bg-white/10 px-2.5 py-1 text-[11.5px] text-white/70">Test {String(q.test).padStart(2, "0")}</p>
      </div>
      <p className="mt-3 text-[16px] font-medium leading-snug text-white">{q.stem}</p>
      <div className="mt-4 space-y-2" role="radiogroup" aria-label="Answer options">
        {q.options.map((o, i) => {
          const isKey = done && i === q.answer;
          const wrong = done && pick === i && !ok;
          return (
            <button key={i} type="button" role="radio" aria-checked={pick === i} disabled={done} onClick={() => setPick(i)}
              className={`flex w-full min-h-[48px] items-start gap-3 rounded-xl border px-3.5 py-2.5 text-left text-[14.5px] leading-snug transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange ${isKey ? "border-emerald-300 bg-emerald-400/20 text-white" : wrong ? "border-orange bg-orange/20 text-white" : "border-white/15 bg-white/[0.04] text-white/90 hover:border-white/40 hover:bg-white/10"}`}>
              <span className="mt-px grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/10 text-[12px] font-semibold">{String.fromCharCode(65 + i)}</span>
              <span>{o}{isKey ? <span className="ml-2 text-[12px] font-semibold text-emerald-200">correct</span> : null}{wrong ? <span className="ml-2 text-[12px] font-semibold text-orange">your choice</span> : null}</span>
            </button>
          );
        })}
      </div>
      <div aria-live="polite" className="mt-3 min-h-[20px] text-[13.5px] leading-relaxed text-white/80">
        {done ? <><strong className="text-white">{ok ? "Right." : "Not quite."}</strong> {q.explanation}</> : "Choose an option to see the explanation, the way every test explains each answer."}
      </div>
      {done ? <button type="button" onClick={() => setPick(null)} className="mt-2 text-[13px] font-semibold text-orange underline underline-offset-2">Try again</button> : null}
    </div>
  );
}
