"use client";

import { useState } from "react";
import type { FlashcardSpec } from "@/lib/learn/widgets/types";
import { awardXp } from "./store";
import { btnGhost, btnPrimary, Shell } from "./ui";

/** Flip cards with self-grading: "Got it" cards leave the deck, "Again" cards come back at the end. Finishing awards XP once. */
export function FlashcardsWidget({ spec, slug }: { spec: FlashcardSpec; slug: string }) {
  const [queue, setQueue] = useState<number[]>(() => spec.cards.map((_, i) => i));
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState(0);
  const total = spec.cards.length;
  const cur = queue[0];
  const card = cur === undefined ? null : spec.cards[cur];

  const grade = (gotIt: boolean) => {
    const rest = queue.slice(1);
    if (gotIt) {
      setKnown(known + 1);
      if (rest.length === 0) awardXp(slug, spec.id, 20, "Flashcards");
    } else rest.push(cur);
    setQueue(rest);
    setFlipped(false);
  };
  const restart = () => { setQueue(spec.cards.map((_, i) => i)); setKnown(0); setFlipped(false); };

  return (
    <Shell kind="Flashcards" title={spec.title} xp={20}>
      <div className="mb-3 h-2 overflow-hidden rounded-full bg-cream-3" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={known} aria-label="Cards learned">
        <div className="h-full rounded-full bg-orange transition-all" style={{ width: `${(known / total) * 100}%` }} />
      </div>
      {card ? (
        <>
          <button type="button" onClick={() => setFlipped(!flipped)} aria-label={flipped ? "Showing the meaning. Press to see the term again." : "Showing the term. Press to reveal the meaning."}
            className={`cw-rise grid min-h-[170px] w-full place-items-center rounded-2xl border-2 p-5 text-center transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep ${flipped ? "border-orange bg-orange-lighter" : "border-ink/70 bg-white"}`}>
            <span>
              <span className="block text-[11.5px] font-bold uppercase tracking-widest text-ink-3">{flipped ? "Meaning" : "Term"} &middot; {known + 1 > total ? total : known + 1} of {total}</span>
              <span className={`mt-2 block leading-snug text-ink ${flipped ? "text-[16px]" : "text-[22px] font-bold"}`}>{flipped ? card.back : card.front}</span>
              {!flipped ? <span className="mt-3 block text-[13px] text-ink-3">Tap to flip</span> : null}
            </span>
          </button>
          {flipped ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => grade(true)} className={btnPrimary}>Got it</button>
              <button type="button" onClick={() => grade(false)} className={btnGhost}>Show me again later</button>
            </div>
          ) : null}
        </>
      ) : (
        <div className="cw-pop rounded-xl border border-emerald-300 bg-emerald-50 p-5 text-center">
          <p className="text-[18px] font-bold text-emerald-900">You know all {total} terms</p>
          <button type="button" onClick={restart} className={`${btnGhost} mt-3`}>Go through them again</button>
        </div>
      )}
    </Shell>
  );
}
