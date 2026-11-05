"use client";

import type { ClassifyData } from "@/lib/learn/types";

/** Sort items into groups. Every item is a labelled radio group, so it works with a keyboard and a screen reader (no drag and drop needed). */
export default function ClassifyBoard({ data, answers, onChange, marks }: { data: ClassifyData; answers: Record<string, string>; onChange: (a: Record<string, string>) => void; marks?: Record<string, boolean> }) {
  return (
    <ol className="grid gap-3">
      {data.items.map((it, i) => {
        const mark = marks?.[it.id];
        return (
          <li key={it.id} className={`rounded-xl border p-3 sm:p-4 ${mark === true ? "border-emerald-300 bg-emerald-50" : mark === false ? "border-red-300 bg-red-50" : "border-black/[0.1] bg-white"}`}>
            <fieldset>
              <legend className="mb-2 text-[15px] font-medium text-ink"><span className="mr-1.5 text-ink-3">{i + 1}.</span>{it.text}{mark === true ? <span className="ml-2 text-[12px] font-semibold text-emerald-800">Correct</span> : mark === false ? <span className="ml-2 text-[12px] font-semibold text-red-800">Not quite</span> : null}</legend>
              <div className="flex flex-wrap gap-2">
                {data.categories.map((c) => (
                  <label key={c.id} className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-lg border border-black/[0.16] bg-white px-3 text-[14px] text-ink has-[:checked]:border-orange-deep has-[:checked]:bg-orange-deep has-[:checked]:text-white has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-orange-deep">
                    <input type="radio" name={`cl-${it.id}`} value={c.id} checked={answers[it.id] === c.id} onChange={() => onChange({ ...answers, [it.id]: c.id })} className="sr-only" />
                    {c.label}
                  </label>
                ))}
              </div>
            </fieldset>
          </li>
        );
      })}
    </ol>
  );
}
