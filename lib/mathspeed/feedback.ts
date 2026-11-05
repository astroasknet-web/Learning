/** Plain-language feedback on a round, from accuracy and speed. Pure, so it is tested without a page. */
export interface Round { total: number; accuracy: number; inTime: number; medianMs: number | null; typicalAllowedMs: number | null }

export interface Coaching { headline: string; detail: string }

export function coach(r: Round): Coaching {
  if (r.total === 0) return { headline: "No answers yet", detail: "Answer a few questions and your speed and accuracy will show here." };
  const accurate = r.accuracy >= 90, steady = r.accuracy >= 75;
  const quick = r.inTime >= 75;
  const times = r.medianMs !== null && r.typicalAllowedMs !== null ? ` Your typical correct answer took ${(r.medianMs / 1000).toFixed(1)} s against about ${(r.typicalAllowedMs / 1000).toFixed(1)} s allowed.` : "";
  if (accurate && quick) return { headline: "Accurate and quick", detail: `That is the target: almost everything right, and in good time.${times} Keep going, and try the next step up.` };
  if (accurate) return { headline: "Accurate, now build speed", detail: `Your answers are right, which is what matters first.${times} Do a few timed drills; speed grows from methods you no longer have to think about.` };
  if (steady && quick) return { headline: "Quick, with a few slips", detail: `You are keeping up with the clock, but some answers were wrong. Slow down by a second and check the sign and the last digit before you press Enter.` };
  if (steady) return { headline: "Good progress", detail: `Most answers were right, but there is room on both accuracy and speed.${times} Revisit the method in the lesson, then practise again.` };
  if (quick) return { headline: "Fast, but accuracy comes first", detail: "You answered quickly, but too many answers were wrong. Slow down and use the method from the lesson. Speed that is wrong does not count." };
  return { headline: "Keep practising", detail: "This one was hard, and that is how learning works. Read the lesson again, look at the answers you missed below, and try another round." };
}
