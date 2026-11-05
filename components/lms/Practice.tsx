"use client";

import { useState } from "react";

export interface PracticeItem { problem: string; hints?: string[]; answer: string }

/** Practice problems: reveal hints one at a time, then the answer. Everything stays in the browser. */
export function PracticeList({ items }: { items: PracticeItem[] }) {
  return (
    <ol className="space-y-3">
      {items.map((it, i) => <PracticeRow key={i} n={i + 1} it={it} />)}
    </ol>
  );
}

function PracticeRow({ n, it }: { n: number; it: PracticeItem }) {
  const hints = it.hints ?? [];
  const [shown, setShown] = useState(0);
  const [reveal, setReveal] = useState(false);
  return (
    <li className="rounded-xl border border-black/[0.1] bg-white p-3.5">
      <p className="text-[14.5px] text-ink"><b className="mr-1.5 text-ink-4">{n}.</b>{it.problem}</p>
      {shown > 0 ? <ul className="mt-2 space-y-1 text-[14px] text-ink-3">{hints.slice(0, shown).map((h, k) => <li key={k}><b>Hint {k + 1}:</b> {h}</li>)}</ul> : null}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {shown < hints.length ? <button type="button" onClick={() => setShown(shown + 1)} className="min-h-[40px] rounded-lg border border-black/[0.15] px-3.5 text-[13.5px] font-semibold hover:bg-cream-2">{shown === 0 ? "Show a hint" : "Next hint"}</button> : null}
        {!reveal ? <button type="button" onClick={() => setReveal(true)} className="min-h-[40px] rounded-lg bg-ink px-3.5 text-[13.5px] font-semibold text-white hover:bg-orange-deep">Show the answer</button> : <span className="rounded-lg bg-emerald-50 px-3 py-2 text-[14px] font-semibold text-emerald-900">Answer: {it.answer}</span>}
      </div>
    </li>
  );
}

/** Flashcards: tap a card to flip it. */
export function Flashcards({ cards }: { cards: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<Record<number, boolean>>({});
  return (
    <ul className="grid gap-2.5 sm:grid-cols-2">
      {cards.map((c, i) => (
        <li key={i}>
          <button type="button" aria-pressed={!!open[i]} onClick={() => setOpen((o) => ({ ...o, [i]: !o[i] }))} className={`min-h-[64px] w-full rounded-xl border px-4 py-3 text-left text-[14.5px] transition ${open[i] ? "border-emerald-600 bg-emerald-50 text-emerald-900" : "border-black/[0.12] bg-white text-ink hover:border-orange"}`}>
            {open[i] ? <><span className="block text-[11px] font-bold uppercase tracking-wider opacity-70">Answer</span>{c.a}</> : <><span className="block text-[11px] font-bold uppercase tracking-wider text-ink-4">Question</span>{c.q}</>}
          </button>
        </li>
      ))}
    </ul>
  );
}
