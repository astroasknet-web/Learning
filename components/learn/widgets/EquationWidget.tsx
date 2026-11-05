"use client";

import { useMemo, useState } from "react";
import { applyMove, assetDirection, equationTotals, type Direction } from "@/lib/learn/widgets/engine";
import type { EquationSpec } from "@/lib/learn/widgets/types";
import { awardXp } from "./store";
import { btnGhost, btnPrimary, Feedback, rs, Shell } from "./ui";

const XP = 15;
const TONE: Record<string, string> = { A: "bg-emerald-200 border-emerald-500 text-emerald-950", L: "bg-red-100 border-red-400 text-red-950", C: "bg-amber-100 border-amber-500 text-amber-950" };
const DIR_LABEL: Record<Direction, string> = { up: "Go up", down: "Go down", same: "Stay the same" };

/** The accounting equation as two live bars. For each transaction the student predicts what happens to total assets, then sees the bars move. */
export function EquationWidget({ spec, slug }: { spec: EquationSpec; slug: string }) {
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<Record<string, number>>(spec.start);
  const [guess, setGuess] = useState<Direction | null>(null);
  const [applied, setApplied] = useState(false);
  const [correctFirst, setCorrectFirst] = useState(0);
  const n = spec.moves.length;
  const done = step >= n;
  const totals = equationTotals(spec, values);
  const scaleMax = useMemo(() => {
    let v = spec.start, m = Math.max(equationTotals(spec, v).A, equationTotals(spec, v).L + equationTotals(spec, v).C);
    spec.moves.forEach((_, i) => { v = applyMove(spec, v, i); const t = equationTotals(spec, v); m = Math.max(m, t.A, t.L + t.C); });
    return m || 1;
  }, [spec]);
  const move = done ? null : spec.moves[step];
  const truth = done ? null : assetDirection(spec, step);

  const answer = (d: Direction) => {
    if (guess !== null || !move) return;
    setGuess(d);
    if (d === truth) { setCorrectFirst((c) => c + 1); awardXp(slug, `${spec.id}:${step}`, XP, "Equation lab"); }
  };
  const apply = () => { if (!move) return; setValues(applyMove(spec, values, step)); setApplied(true); };
  const next = () => { setStep(step + 1); setGuess(null); setApplied(false); };
  const restart = () => { setStep(0); setValues(spec.start); setGuess(null); setApplied(false); setCorrectFirst(0); };

  const side = (s: "A" | "L" | "C") => spec.items.filter((i) => i.side === s);
  const bar = (sides: Array<"A" | "L" | "C">, label: string) => {
    const parts = sides.flatMap((s) => side(s).map((i) => ({ ...i, v: Math.max(0, values[i.key] ?? 0) })));
    const total = parts.reduce((a, p) => a + p.v, 0);
    return (
      <div className="flex min-w-0 flex-1 flex-col items-center">
        <p className="mb-1 text-center text-[13px] font-bold text-ink">{label}</p>
        <p className="mb-2 text-[17px] font-extrabold tabular-nums text-orange-deep">{rs(total)}</p>
        <div className="flex h-56 w-full max-w-[190px] flex-col-reverse overflow-hidden rounded-xl border-2 border-ink/70 bg-cream-2" role="img" aria-label={`${label}: ${parts.map((p) => `${p.label} ${rs(p.v)}`).join(", ")}`}>
          {parts.map((p) => (
            <div key={p.key} className={`cw-bar flex items-center justify-center border-t border-white/60 px-1 text-center text-[12px] font-semibold leading-tight ${TONE[p.side]}`} style={{ height: `${(p.v / scaleMax) * 100}%` }}>
              {p.v > 0 && (p.v / scaleMax) * 224 > 26 ? <span>{p.label}<br />{rs(p.v)}</span> : null}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Shell kind="Try it: accounting equation" title={spec.title} xp={n * XP}>
      <div className="flex items-end justify-center gap-3 sm:gap-6">
        {bar(["A"], "Assets")}
        <p className={`pb-24 text-[34px] font-extrabold transition-colors ${totals.balanced ? "text-emerald-600" : "text-red-600"}`} aria-label={totals.balanced ? "equals" : "not equal"}>{totals.balanced ? "=" : "≠"}</p>
        {bar(["L", "C"], "Liabilities + Capital")}
      </div>
      <ul className="mt-3 flex list-none flex-wrap p-0 justify-center gap-x-4 gap-y-1 text-[12.5px] text-ink-2" aria-label="Colour key">
        {(["A", "L", "C"] as const).map((s) => <li key={s} className="flex items-center gap-1.5"><span className={`inline-block h-3 w-3 rounded border ${TONE[s]}`} />{s === "A" ? "What the business owns" : s === "L" ? "What it owes outsiders" : "The owner's share"}</li>)}
      </ul>

      {move ? (
        <div className="mt-4 rounded-xl border border-black/[0.1] bg-cream-2 p-4">
          <p className="text-[12px] font-bold uppercase tracking-wide text-ink-3">Transaction {step + 1} of {n}</p>
          <p className="mt-1 text-[16px] font-semibold text-ink">{move.text}</p>
          {guess === null ? (
            <>
              <p className="mt-3 text-[14.5px] text-ink-2">Before you apply it: what happens to <b>total assets</b>?</p>
              <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Predict the change in total assets">
                {(["up", "down", "same"] as const).map((d) => <button key={d} type="button" onClick={() => answer(d)} className={btnGhost}>{DIR_LABEL[d]}</button>)}
              </div>
            </>
          ) : (
            <>
              <Feedback ok={guess === truth}>{`Total assets ${DIR_LABEL[truth!].toLowerCase()}. ${move.why}`}</Feedback>
              <div className="mt-3 flex flex-wrap gap-2">
                {!applied ? <button type="button" onClick={apply} className={btnPrimary}>Apply it and watch the bars</button> : <button type="button" onClick={next} className={btnPrimary}>{step + 1 < n ? "Next transaction" : "Finish"}</button>}
              </div>
              {applied ? <p className="mt-2 text-[13.5px] font-semibold text-emerald-800" role="status">Assets {rs(totals.A)} = liabilities {rs(totals.L)} + capital {rs(totals.C)}. Still balanced.</p> : null}
            </>
          )}
        </div>
      ) : (
        <div className="cw-pop mt-4 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-center">
          <p className="text-[18px] font-bold text-emerald-900">The equation held after all {n} transactions</p>
          <p className="mt-1 text-[14.5px] text-emerald-900">{correctFirst} of {n} predictions right. That balance is exactly why double entry works: every transaction changes both sides equally.</p>
          <button type="button" onClick={restart} className={`${btnGhost} mt-3`}>Run it again</button>
        </div>
      )}
    </Shell>
  );
}
