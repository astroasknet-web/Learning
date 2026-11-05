"use client";

import { useState } from "react";

export interface QuizItem { q: string; options: string[]; correct: number; explanation: string }

/** A short self-check: pick an answer and see at once whether it is right, with the explanation when there is one. HTML comes pre-rendered from the server. */
export default function QuizBlock({ items }: { items: QuizItem[] }) {
  const [picked, setPicked] = useState<Record<number, number>>({});
  const done = Object.keys(picked).length;
  const right = items.filter((it, i) => picked[i] === it.correct).length;
  return (
    <div className="mt-6 rounded-2xl border border-black/[0.08] bg-cream-2 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-[15px] font-bold text-ink">Check yourself</h4>
        <p className="text-[13px] text-ink-3" aria-live="polite">{done ? `${right} of ${done} right` : `${items.length} questions`}</p>
      </div>
      <ol className="mt-3 space-y-5">
        {items.map((it, i) => {
          const sel = picked[i];
          const answered = sel !== undefined;
          return (
            <li key={i}>
              <div className="text-[15px] text-ink [&_p]:inline" dangerouslySetInnerHTML={{ __html: `${i + 1}. ${it.q}` }} />
              <div role="radiogroup" aria-label={`Question ${i + 1}`} className="mt-2 grid gap-2 sm:grid-cols-2">
                {it.options.map((o, j) => {
                  const isRight = answered && j === it.correct;
                  const isWrong = answered && j === sel && j !== it.correct;
                  return (
                    <button key={j} type="button" role="radio" aria-checked={sel === j} disabled={answered} onClick={() => setPicked((p) => ({ ...p, [i]: j }))}
                      className={`min-h-[44px] rounded-lg border px-3 py-2 text-left text-[14px] transition ${isRight ? "border-emerald-600 bg-emerald-50 text-emerald-900" : isWrong ? "border-red-500 bg-red-50 text-red-900" : "border-black/[0.12] bg-white text-ink hover:border-orange"} disabled:cursor-default`}>
                      <span className="mr-2 font-semibold">{String.fromCharCode(65 + j)}.</span><span dangerouslySetInnerHTML={{ __html: o }} />
                      {isRight ? <span className="sr-only"> (correct answer)</span> : null}{isWrong ? <span className="sr-only"> (your answer, wrong)</span> : null}
                    </button>
                  );
                })}
              </div>
              {answered && it.explanation ? <div className="mt-2 rounded-lg bg-white px-3 py-2 text-[14px] text-ink-2" dangerouslySetInnerHTML={{ __html: it.explanation }} /> : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
