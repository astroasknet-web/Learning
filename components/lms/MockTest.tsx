"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface MockQ { q: string; options?: string[]; correct?: number; answer?: string; explanation: string; marks?: number; neg?: number; studioTopic?: string | null; difficulty?: number }
export interface MockSec { type: string; title: string; questions: MockQ[] }
/** When present, finishing the mock sends its maths questions to the Mathematics Studio (the page has already tagged each with a taxonomy topic). */
export interface StudioLink { source: string; sourceRef: string; label: string; csrf: string }
interface Props { id: string; title: string; level: string; minutes: number; sections: MockSec[]; note?: string; marking?: string; studio?: StudioLink | null }

const KEY = (id: string) => `lms:test:${id}`;
const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

function isRight(q: MockQ, a: string | undefined): boolean {
  if (a === undefined || a === "") return false;
  if (q.options) return Number(a) === q.correct;
  const x = parseFloat(a), y = parseFloat(q.answer ?? "");
  return Number.isFinite(x) && Number.isFinite(y) ? Math.abs(x - y) < 1e-6 : a.trim() === (q.answer ?? "").trim();
}

/** A timed mock test. Answers stay in this browser; the best score is kept in localStorage. HTML comes pre-rendered from the server. */
export default function MockTest({ id, title, level, minutes, sections, note, marking, studio }: Props) {
  const sent = useRef(false);
  const flat = useMemo(() => sections.flatMap((s, si) => s.questions.map((q, qi) => ({ key: `${si}-${qi}`, sec: s, q }))), [sections]);
  const [phase, setPhase] = useState<"intro" | "run" | "done">("intro");
  const [left, setLeft] = useState(minutes * 60);
  const [ans, setAns] = useState<Record<string, string>>({});
  const [best, setBest] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    try { const v = localStorage.getItem(KEY(id)); if (v) setBest(Number(v)); } catch { /* storage blocked */ }
  }, [id]);

  const total = flat.reduce((n, f) => n + (f.q.marks ?? 1), 0);
  const score = Math.round(flat.reduce((n, f) => { const a = ans[f.key]; if (a === undefined || a === "") return n; return n + (isRight(f.q, a) ? (f.q.marks ?? 1) : -(f.q.neg ?? 0)); }, 0) * 100) / 100;

  const finish = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    setPhase("done");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (phase !== "run") return;
    timer.current = setInterval(() => setLeft((l) => (l <= 1 ? 0 : l - 1)), 1000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [phase]);

  useEffect(() => { if (phase === "run" && left === 0) finish(); }, [left, phase, finish]);

  useEffect(() => {
    if (phase !== "done") return;
    try {
      const prev = Number(localStorage.getItem(KEY(id)) ?? "-1");
      if (score > prev) { localStorage.setItem(KEY(id), String(score)); setBest(score); }
    } catch { /* storage blocked */ }
    // feed the maths questions to the Mathematics Studio (once); a failure never affects the student's result
    if (studio && !sent.current) {
      sent.current = true;
      const items = flat.filter((f) => f.q.studioTopic).map((f) => { const a = ans[f.key]; const skipped = a === undefined || a === ""; return { topic: f.q.studioTopic, difficulty: f.q.difficulty ?? 3, correct: !skipped && isRight(f.q, a), skipped, maxMarks: f.q.marks ?? 1 }; });
      if (items.length) {
        const spent = minutes * 60 - left;
        void fetch("/api/math-studio/mock", { method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ _csrf: studio.csrf, source: studio.source, sourceRef: studio.sourceRef, label: studio.label, totalMs: Math.max(0, spent) * 1000, items }) }).catch(() => {});
      }
    }
  }, [phase, id, score, studio, flat, ans, left, minutes]);

  if (phase === "intro")
    return (
      <div className="rounded-2xl border border-black/[0.08] bg-white p-6 shadow-card">
        <h2 className="text-[22px] font-bold text-ink">{title}</h2>
        <p className="mt-1 text-ink-3">{level}</p>
        <ul className="mt-4 space-y-1 text-[15px] text-ink-2">
          <li>{flat.length} questions in {sections.length} {sections.length === 1 ? "section" : "sections"}</li>
          <li>{minutes} minutes. The test submits itself when time runs out.</li>
          <li>{marking ?? "1 mark for each correct answer."} Worked solutions are shown at the end.</li>
          {note ? <li className="font-semibold text-ink">{note}</li> : null}
          {best !== null ? <li>Your best score on this device: <b>{best}/{total}</b></li> : null}
        </ul>
        <button type="button" onClick={() => setPhase("run")} className="mt-6 min-h-[48px] rounded-lg bg-orange-deep px-7 text-[15px] font-semibold text-white hover:bg-ink">Start the test</button>
      </div>
    );

  const done = phase === "done";
  let n = 0;
  return (
    <div>
      <div className="sticky top-[76px] z-10 mb-4 flex items-center justify-between rounded-xl border border-black/[0.08] bg-white/95 px-4 py-3 shadow-card backdrop-blur">
        <b className="text-[15px] text-ink">{done ? `Score: ${score} / ${total}` : `Answered ${Object.values(ans).filter((v) => v !== "").length} / ${flat.length}`}</b>
        {done ? <span className="text-[14px] text-ink-3">{Math.max(0, Math.round((score / total) * 100))}%</span> : <span className={`font-mono text-[16px] font-bold ${left < 300 ? "text-red-600" : "text-ink"}`} role="timer" aria-label="Time left">{fmt(left)}</span>}
      </div>

      {sections.map((s, si) => (
        <section key={si} className="mb-8" aria-label={s.title}>
          <h3 className="mb-3 text-[17px] font-bold text-ink">{s.title}</h3>
          <ol className="space-y-5">
            {s.questions.map((q, qi) => {
              const key = `${si}-${qi}`;
              const a = ans[key];
              const right = done && isRight(q, a);
              n += 1;
              return (
                <li key={key} className="rounded-xl border border-black/[0.08] bg-white p-4">
                  <div className="text-[15px] text-ink [&_p]:inline" dangerouslySetInnerHTML={{ __html: `<b>${n}.</b> ${q.q}` }} />
                  {q.options ? (
                    <div role="radiogroup" aria-label={`Question ${n}`} className="mt-3 grid gap-2 sm:grid-cols-2">
                      {q.options.map((o, j) => {
                        const sel = a === String(j);
                        const ok = done && j === q.correct;
                        const bad = done && sel && j !== q.correct;
                        return (
                          <button key={j} type="button" role="radio" aria-checked={sel} disabled={done} onClick={() => setAns((p) => ({ ...p, [key]: String(j) }))}
                            className={`min-h-[44px] rounded-lg border px-3 py-2 text-left text-[14px] transition ${ok ? "border-emerald-600 bg-emerald-50" : bad ? "border-red-500 bg-red-50" : sel ? "border-orange bg-orange-lighter" : "border-black/[0.12] hover:border-orange"} disabled:cursor-default`}>
                            <span className="mr-2 font-semibold">{String.fromCharCode(65 + j)}.</span><span dangerouslySetInnerHTML={{ __html: o }} />
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="mt-3">
                      <label className="text-[13px] text-ink-3" htmlFor={`a-${key}`}>Your numerical answer</label>
                      <input id={`a-${key}`} inputMode="decimal" disabled={done} value={a ?? ""} onChange={(e) => setAns((p) => ({ ...p, [key]: e.target.value }))}
                        className={`mt-1 block min-h-[44px] w-40 rounded-lg border px-3 text-[15px] ${done ? (right ? "border-emerald-600 bg-emerald-50" : "border-red-500 bg-red-50") : "border-black/[0.2]"}`} />
                    </div>
                  )}
                  {done ? (
                    <div className="mt-3 rounded-lg bg-cream-2 px-3 py-2 text-[14px] text-ink-2">
                      <b>{right ? "Correct." : q.options ? `Correct answer: ${String.fromCharCode(65 + (q.correct ?? 0))}.` : `Correct answer: ${q.answer}.`}</b>
                      {q.explanation ? <div className="mt-1" dangerouslySetInnerHTML={{ __html: q.explanation }} /> : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </section>
      ))}
      {!done ? <button type="button" onClick={finish} className="min-h-[48px] rounded-lg bg-orange-deep px-7 text-[15px] font-semibold text-white hover:bg-ink">Submit the test</button> : null}
    </div>
  );
}
