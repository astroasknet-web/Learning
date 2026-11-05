"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { mark } from "@/lib/mathspeed/mark";
import type { Visual } from "@/lib/mathspeed/types";
import DataVisual from "./DataVisual";

/**
 * The practice screen. Keyboard first: the answer box is focused, Enter submits, and for multiple choice the keys 1 to 4 pick an option.
 * Practice modes show right or wrong at once (the answer is sent to the page for that); assessments show nothing until the end.
 * Right or wrong is decided again on the server from the session's plan, so nothing here can change a result.
 */
export interface ClientQuestion {
  prompt: string;
  kind: "number" | "choice" | "text";
  options?: string[];
  unit?: string;
  visual?: Visual;
  allowedMs: number;
  /** Only sent in practice modes, which give immediate feedback. */
  answer?: string;
  tol?: number;
  lowest?: boolean;
  working?: string[];
}

interface Props {
  title: string;
  sessionId: string;
  csrf: string;
  questions: ClientQuestion[];
  /** Seconds on the clock for a timed drill; 0 for no clock. */
  seconds: number;
  feedback: boolean;
  /** "sample" runs entirely in the page and saves nothing (the public try-it). */
  mode?: "session" | "sample";
  after?: ReactNode;
}

type Recorded = { r: string; ms: number };

function Runner({ title, sessionId, csrf, questions, seconds, feedback, mode = "session", after }: Props) {
  const router = useRouter();
  const [i, setI] = useState(0);
  const [value, setValue] = useState("");
  const [phase, setPhase] = useState<"ask" | "right" | "wrong">("ask");
  const [left, setLeft] = useState(seconds);
  const [finished, setFinished] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<{ right: number; total: number } | null>(null);
  const results = useRef<Recorded[]>([]);
  const startedAt = useRef(0);
  const deadline = useRef(0);
  const input = useRef<HTMLInputElement>(null);
  const advance = useRef<ReturnType<typeof setTimeout> | null>(null);
  const q = questions[Math.min(i, questions.length - 1)];

  const submit = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    if (mode === "sample") {
      const right = results.current.filter((r, k) => questions[k] && mark({ kind: questions[k].kind, answer: questions[k].answer ?? "", tol: questions[k].tol, lowest: questions[k].lowest, unit: questions[k].unit }, r.r).correct).length;
      setSummary({ right, total: questions.length });
      setBusy(false);
      return;
    }
    try {
      const res = await fetch("/api/math-speed/submit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ _csrf: csrf, id: sessionId, responses: results.current }) });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || "We could not save this round. Check your connection and try again.");
      router.push(`/math-speed/results/${sessionId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "We could not save this round.");
      setBusy(false);
    }
  }, [busy, csrf, mode, questions, router, sessionId]);

  const finish = useCallback(() => {
    setFinished(true);
    void submit();
  }, [submit]);

  const next = useCallback(() => {
    setPhase("ask");
    setValue("");
    if (i + 1 >= questions.length) { finish(); return; }
    setI(i + 1);
    startedAt.current = performance.now();
  }, [finish, i, questions.length]);

  const record = useCallback((r: string) => {
    if (finished || phase !== "ask") return;
    const ms = Math.round(performance.now() - startedAt.current);
    results.current[i] = { r, ms };
    if (!feedback || !q.answer) { next(); return; }
    const ok = r !== "" && mark({ kind: q.kind, answer: q.answer, tol: q.tol, lowest: q.lowest, unit: q.unit }, r).correct;
    setPhase(ok ? "right" : "wrong");
    if (ok) advance.current = setTimeout(next, 380);
  }, [feedback, finished, i, next, phase, q]);

  // start the clocks on the first render
  useEffect(() => {
    startedAt.current = performance.now();
    if (seconds > 0) deadline.current = Date.now() + seconds * 1000;
    return () => { if (advance.current) clearTimeout(advance.current); };
  }, [seconds]);

  useEffect(() => {
    if (seconds <= 0 || finished) return;
    const t = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000));
      setLeft(remaining);
      if (remaining <= 0) { clearInterval(t); finish(); }
    }, 200);
    return () => clearInterval(t);
  }, [seconds, finished, finish]);

  useEffect(() => { if (phase === "ask") input.current?.focus(); }, [phase, i]);

  // keys: Enter continues after a wrong answer; 1-4 pick a choice
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (finished) return;
      if (phase === "wrong" && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); next(); return; }
      if (phase === "ask" && q.kind === "choice" && q.options && /^[1-9]$/.test(e.key)) {
        const opt = q.options[Number(e.key) - 1];
        if (opt !== undefined) { e.preventDefault(); record(opt); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finished, next, phase, q, record]);

  useEffect(() => {
    if (finished || mode === "sample") return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [finished, mode]);

  if (summary) {
    return (
      <div className="rounded-2xl border border-black/[0.08] bg-white p-6 text-center shadow-card">
        <p className="text-[32px] font-bold text-ink">{summary.right} of {summary.total}</p>
        <p className="mt-1 text-[15px] text-ink-3">That was a free taste of the practice screen. Nothing was saved.</p>
        <div className="mt-4">{after}</div>
      </div>
    );
  }

  if (finished) {
    return (
      <div className="rounded-2xl border border-black/[0.08] bg-white p-8 text-center shadow-card" role="status" aria-live="polite">
        <p className="text-[18px] font-semibold text-ink">{error ? "Almost there" : "Marking your answers..."}</p>
        {error ? (
          <>
            <p className="mt-2 text-[14px] text-red-700">{error}</p>
            <button type="button" onClick={() => void submit()} disabled={busy} className="mt-4 inline-flex min-h-[48px] items-center rounded-lg bg-orange px-6 text-[15px] font-semibold text-white hover:bg-orange-dark disabled:opacity-60">Try again</button>
          </>
        ) : null}
      </div>
    );
  }

  const total = questions.length;
  const wrongShown = phase === "wrong" && q.answer !== undefined;
  const slow = Math.max(1, q.allowedMs);
  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-3 flex items-center justify-between gap-3 text-[13.5px] text-ink-3">
        <span className="font-semibold text-ink">{title}</span>
        <span aria-live="off">{seconds > 0 ? <b className={`tabular-nums ${left <= 10 ? "text-red-700" : "text-ink"}`}>{left}s</b> : null} {seconds > 0 ? "· " : ""}Question {Math.min(i + 1, total)} of {total}</span>
      </div>
      <div className="mb-4 h-2 overflow-hidden rounded-full bg-cream-3" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={i} aria-label="Progress"><div className="h-full rounded-full bg-orange transition-all" style={{ width: `${(i / total) * 100}%` }} /></div>

      <div className="rounded-2xl border border-black/[0.08] bg-white p-5 shadow-card sm:p-7">
        <div key={i} className="mb-4 h-1.5 overflow-hidden rounded-full bg-cream-3" aria-hidden><div className="h-full rounded-full bg-orange/70 [animation:shrink_linear_forwards]" style={{ animationDuration: `${slow}ms` }} /></div>
        <style>{"@keyframes shrink{from{width:100%}to{width:0%}}"}</style>
        {q.visual ? <div className="mb-4"><DataVisual visual={q.visual} /></div> : null}
        <p className="text-[22px] font-semibold leading-snug text-ink sm:text-[26px]" id="q-prompt" aria-live="polite">{q.prompt}</p>

        {q.kind === "choice" && q.options ? (
          <div className="mt-5 grid gap-2 sm:grid-cols-2" role="group" aria-labelledby="q-prompt">
            {q.options.map((o, k) => (
              <button key={o} type="button" disabled={phase !== "ask"} onClick={() => record(o)} className="flex min-h-[52px] items-center gap-3 rounded-xl border border-black/15 bg-cream px-4 text-left text-[17px] font-semibold text-ink hover:border-orange hover:bg-orange-lighter focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange disabled:opacity-60">
                <kbd className="grid h-7 w-7 place-items-center rounded-md bg-white text-[13px] font-bold text-ink-3 shadow-sm">{k + 1}</kbd>
                {o}
              </button>
            ))}
          </div>
        ) : (
          <form className="mt-5 flex items-stretch gap-2" onSubmit={(e) => { e.preventDefault(); if (value.trim() !== "") record(value.trim()); }}>
            <label className="sr-only" htmlFor="answer">Your answer</label>
            <input id="answer" ref={input} value={value} onChange={(e) => setValue(e.target.value)} disabled={phase !== "ask"} autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} inputMode={q.kind === "text" ? "text" : "text"} enterKeyHint="done" maxLength={40} aria-describedby="q-prompt" className="min-h-[56px] w-full min-w-0 rounded-xl border-2 border-black/20 bg-white px-4 text-[24px] font-semibold tabular-nums text-ink outline-none focus:border-orange disabled:bg-cream-2" placeholder={q.unit ? `Answer (${q.unit})` : "Type your answer"} />
            <button type="submit" disabled={phase !== "ask" || value.trim() === ""} className="min-h-[56px] shrink-0 rounded-xl bg-orange px-5 text-[16px] font-semibold text-white hover:bg-orange-dark disabled:opacity-50">Enter</button>
          </form>
        )}

        <div className="mt-3 min-h-[1.5rem] text-[15px]" aria-live="assertive">
          {phase === "right" ? <span className="font-semibold text-green-700">Correct</span> : null}
          {wrongShown ? (
            <div className="rounded-xl bg-red-50 p-3 text-red-900">
              <p className="font-semibold">Not quite. The answer is {q.answer}{q.unit && q.kind === "number" ? ` ${q.unit}` : ""}.</p>
              {q.working?.length ? <ul className="mt-1 list-disc pl-5 text-[14px]">{q.working.map((w) => <li key={w}>{w}</li>)}</ul> : null}
              <button type="button" onClick={next} className="mt-2 inline-flex min-h-[44px] items-center rounded-lg bg-ink px-4 text-[14px] font-semibold text-white">Continue (Enter)</button>
            </div>
          ) : null}
        </div>

        {phase === "ask" ? (
          <div className="mt-2 flex items-center justify-between text-[12.5px] text-ink-4">
            <span>{q.kind === "choice" ? "Press 1 to 4 to choose." : "Type the answer and press Enter."}</span>
            <button type="button" onClick={() => record("")} className="underline hover:text-ink">Skip this one</button>
          </div>
        ) : null}
      </div>
      {error ? <p className="mt-3 text-[14px] text-red-700" role="alert">{error}</p> : null}
    </div>
  );
}

/** Shows what is about to happen and waits for Enter, so a timed round never starts before the student is ready. */
export default function DrillRunner(props: Props & { intro?: string[] }) {
  const [go, setGo] = useState(false);
  useEffect(() => {
    if (go) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Enter") { e.preventDefault(); setGo(true); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);
  if (go) return <Runner {...props} />;
  return (
    <div className="mx-auto w-full max-w-2xl rounded-2xl border border-black/[0.08] bg-white p-6 text-center shadow-card sm:p-8">
      <h2 className="text-[22px] font-bold text-ink">{props.title}</h2>
      <p className="mt-2 text-[15px] text-ink-3">{props.questions.length} questions{props.seconds > 0 ? `, ${props.seconds} seconds on the clock` : ""}.{props.feedback ? " You will see each answer at once." : " Your results come at the end."}</p>
      {props.intro?.length ? <ul className="mx-auto mt-3 max-w-md list-disc pl-5 text-left text-[14.5px] text-ink-2">{props.intro.map((t) => <li key={t}>{t}</li>)}</ul> : null}
      <p className="mt-4 text-[13.5px] text-ink-4">Type your answer and press Enter. For choices, press 1 to 4.</p>
      <button type="button" autoFocus onClick={() => setGo(true)} className="mt-5 inline-flex min-h-[52px] items-center justify-center rounded-lg bg-orange px-8 text-[16px] font-semibold text-white hover:bg-orange-dark">Start (press Enter)</button>
    </div>
  );
}
