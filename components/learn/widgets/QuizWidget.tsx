"use client";

import { useState } from "react";
import { scoreQuiz } from "@/lib/learn/widgets/engine";
import type { QuizSpec } from "@/lib/learn/widgets/types";
import { awardXp } from "./store";
import { btnGhost, btnPrimary, Feedback, Shell } from "./ui";

const XP_FIRST_TRY = 10;

/** Instant-feedback quick check: one question at a time, explanation on every answer, XP for first-try answers. */
export function QuizWidget({ spec, slug }: { spec: QuizSpec; slug: string }) {
  const n = spec.questions.length;
  const [i, setI] = useState(0);
  const [picks, setPicks] = useState<Array<number | null>>(() => spec.questions.map(() => null));
  const [first, setFirst] = useState<Array<number | null>>(() => spec.questions.map(() => null)); // the first choice, for scoring
  const [done, setDone] = useState(false);
  const q = spec.questions[i];
  const pick = picks[i];
  const answered = pick !== null;
  const right = answered && pick === q.answer;

  const choose = (j: number) => {
    if (answered) return;
    setPicks((p) => p.map((x, k) => (k === i ? j : x)));
    setFirst((p) => p.map((x, k) => (k === i && x === null ? j : x)));
    if (first[i] === null && j === q.answer) awardXp(slug, `${spec.id}:${i}`, XP_FIRST_TRY, "Quick check"); // first try only
  };
  const retry = () => { setPicks((p) => p.map((x, k) => (k === i ? null : x))); };
  const next = () => (i + 1 < n ? setI(i + 1) : setDone(true));
  const restart = () => { setI(0); setPicks(spec.questions.map(() => null)); setFirst(spec.questions.map(() => null)); setDone(false); };

  if (done) {
    const s = scoreQuiz(spec, first);
    return (
      <Shell kind="Quick check" title={spec.title ?? "Check what you just learned"}>
        <div className="cw-pop text-center">
          <p className="text-[40px] font-extrabold leading-none text-orange-deep">{s.right}/{s.total}</p>
          <p className="mt-2 text-[15px] text-ink-2">{s.right === s.total ? "All right on the first try. Keep going." : "Review the explanations, then try the lesson's practice again."}</p>
          <button type="button" onClick={restart} className={`${btnGhost} mt-4`}>Try again</button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell kind="Quick check" title={spec.title ?? "Check what you just learned"} xp={n * XP_FIRST_TRY}>
      <div className="mb-3 flex items-center gap-1.5" aria-label={`Question ${i + 1} of ${n}`}>
        {spec.questions.map((_, k) => <span key={k} className={`h-2 flex-1 rounded-full transition-colors ${k < i || (k === i && answered) ? "bg-orange" : k === i ? "bg-orange/50" : "bg-cream-3"}`} />)}
      </div>
      <fieldset>
        <legend className="mb-3 text-[16px] font-semibold leading-snug text-ink">{i + 1}. {q.q}</legend>
        <div className="grid gap-2" role="radiogroup" aria-label={q.q}>
          {q.options.map((o, j) => {
            const chosen = pick === j;
            const show = answered && (j === q.answer || chosen);
            const cls = show ? (j === q.answer ? "border-emerald-500 bg-emerald-50 text-emerald-950" : "cw-shake border-red-400 bg-red-50 text-red-950") : "border-black/[0.12] bg-white hover:border-orange hover:bg-orange-lighter";
            return (
              <button key={j} type="button" role="radio" aria-checked={chosen} disabled={answered} onClick={() => choose(j)}
                className={`flex min-h-[48px] w-full items-start gap-3 rounded-xl border-2 px-4 py-2.5 text-left text-[15px] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep ${cls}`}>
                <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[12px] font-bold ${show ? (j === q.answer ? "bg-emerald-600 text-white" : "bg-red-500 text-white") : "bg-cream-3 text-ink-2"}`} aria-hidden="true">{show ? (j === q.answer ? "✓" : "✕") : "ABCD"[j]}</span>
                <span>{o}</span>
              </button>
            );
          })}
        </div>
      </fieldset>
      {answered ? <Feedback ok={right}>{q.explain}</Feedback> : <Feedback ok={null}>{null}</Feedback>}
      {answered ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={next} className={btnPrimary}>{i + 1 < n ? "Next question" : "See my score"}</button>
          {!right ? <button type="button" onClick={retry} className={btnGhost}>Try this one again</button> : null}
        </div>
      ) : null}
    </Shell>
  );
}
