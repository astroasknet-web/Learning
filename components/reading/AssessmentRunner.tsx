"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { ClientQuestion, ClientUnit, RunnerState } from "@/lib/reading/store";

type Resp = number | number[] | string | null;
interface Result { correct: boolean; explanation: string; reveal: unknown }

const btn = "inline-flex min-h-[48px] items-center justify-center rounded-lg px-5 text-[15px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep disabled:cursor-not-allowed disabled:opacity-50";
const primary = `${btn} bg-orange text-white hover:bg-orange-dark`;
const light = `${btn} border border-black/15 bg-white text-ink hover:border-orange`;
const clock = (s: number): string => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, "0")}`;

/** A passage as readable text: paragraphs, and lines that start with "|" shown as a small table. */
export function PassageText({ body }: { body: string }) {
  const blocks = body.split(/\n{2,}/);
  return (
    <div className="space-y-4 text-[18px] leading-[1.85] text-ink">
      {blocks.map((b, i) => {
        const lines = b.split("\n");
        if (lines.every((l) => l.trim().startsWith("|"))) {
          const rows = lines.map((l) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim()));
          return (
            <div key={i} className="overflow-x-auto"><table className="w-full min-w-[18rem] border-collapse text-[16px]"><thead><tr>{rows[0].map((c) => <th key={c} scope="col" className="border border-black/20 bg-cream-3 px-3 py-2 text-left font-semibold">{c}</th>)}</tr></thead>
              <tbody>{rows.slice(1).map((r, j) => <tr key={j}>{r.map((c, k) => k === 0 ? <th key={k} scope="row" className="border border-black/20 px-3 py-2 text-left font-medium">{c}</th> : <td key={k} className="border border-black/20 px-3 py-2">{c}</td>)}</tr>)}</tbody></table></div>
          );
        }
        return <p key={i}>{b}</p>;
      })}
    </div>
  );
}

export default function AssessmentRunner({ state, csrf, title }: { state: RunnerState; csrf: string; title: string }) {
  const router = useRouter();
  const units = state.units;
  const [u, setU] = useState(() => { const i = units.findIndex((_, k) => !state.reads[String(k)]?.done); return state.hidePassage ? 0 : i === -1 ? units.length - 1 : i; });
  const [phase, setPhase] = useState<"intro" | "read" | "answer">(() => (state.hidePassage ? "intro" : state.reads[String(u)]?.done ? "answer" : "read"));
  const [qi, setQi] = useState(0);
  const [answers, setAnswers] = useState<Record<number, Resp>>(() => Object.fromEntries(state.saved.map((s) => [s.questionId, s.selected])));
  const [results, setResults] = useState<Record<number, Result>>(() => Object.fromEntries(state.saved.filter((s) => s.correct !== undefined).map((s) => [s.questionId, { correct: !!s.correct, explanation: s.explanation ?? "", reveal: s.reveal }])));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [showPassage, setShowPassage] = useState(true);
  const [tick, setTick] = useState(0);
  const [pendingSel, setPendingSel] = useState<Record<number, Resp>>({});
  const clientStart = useRef(Date.now());
  const skew = state.serverNow - Date.now();
  const qStart = useRef<{ id: number; at: number } | null>(null);
  const spent = useRef<Record<number, number>>({});
  const finished = useRef(false);

  const unit: ClientUnit = units[u];
  const q: ClientQuestion | undefined = unit.questions[qi];
  const total = units.reduce((a, x) => a + x.questions.length, 0);
  const answeredCount = Object.entries(answers).filter(([, v]) => v !== null && v !== "" && !(Array.isArray(v) && v.every((x) => x === -1))).length;

  useEffect(() => { const t = setInterval(() => setTick((x) => x + 1), 1000); return () => clearInterval(t); }, []);
  void tick;

  const post = useCallback(async (path: string, body: Record<string, unknown>): Promise<Record<string, unknown> | null> => {
    try {
      const res = await fetch(`/api/reading-studio/${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, id: state.publicId, _csrf: csrf }), credentials: "same-origin" });
      const json = (await res.json()) as Record<string, unknown>;
      if (!res.ok || json.ok === false) { setError(String(json.error ?? "Something went wrong. Please try again.")); return null; }
      setError("");
      return json;
    } catch {
      setError("The connection dropped. Your earlier answers are saved; please try again.");
      return null;
    }
  }, [csrf, state.publicId]);

  // time spent on the current question (only while the question is on screen and the tab is visible)
  const stopClock = useCallback(() => { const s = qStart.current; if (s) { spent.current[s.id] = (spent.current[s.id] ?? 0) + (Date.now() - s.at); qStart.current = null; } }, []);
  useEffect(() => {
    if (phase !== "answer" || !q) return;
    qStart.current = { id: q.id, at: Date.now() };
    const vis = () => { if (document.hidden) stopClock(); else if (!qStart.current) qStart.current = { id: q.id, at: Date.now() }; };
    document.addEventListener("visibilitychange", vis);
    return () => { document.removeEventListener("visibilitychange", vis); stopClock(); };
  }, [phase, q, stopClock]);

  // on a phone the questions come first and the passage is one tap away; on a wide screen the two sit side by side
  useEffect(() => { if (phase === "answer") setShowPassage(window.matchMedia("(min-width: 1024px)").matches); }, [phase, u]);

  // start of reading is noted on the server clock
  useEffect(() => { if (phase === "read" && !state.hidePassage) void post("phase", { unit: u, phase: "read_start" }); }, [phase, u, post, state.hidePassage]);

  const elapsed = Math.floor((Date.now() - clientStart.current + (state.serverNow - state.startedAt)) / 1000);
  const remaining = state.timedSecs === null ? null : state.timedSecs - Math.floor((Date.now() + skew - state.startedAt) / 1000);

  const finish = useCallback(async () => {
    if (finished.current) return;
    finished.current = true; stopClock(); setBusy(true);
    const r = await post("finish", {});
    if (r) router.push(`/reading-studio/results/${state.publicId}`);
    else { finished.current = false; setBusy(false); }
  }, [post, router, state.publicId, stopClock]);

  useEffect(() => { if (remaining !== null && remaining <= 0 && !finished.current) void finish(); }, [remaining, finish]);

  const save = async (qq: ClientQuestion, value: Resp): Promise<Result | null> => {
    stopClock();
    const ms = spent.current[qq.id] ?? 0;
    qStart.current = { id: qq.id, at: Date.now() };
    const r = await post("answer", { qid: qq.id, r: value, ms });
    if (!r) return null;
    if (r.locked && r.correct !== undefined) return { correct: Boolean(r.correct), explanation: String(r.explanation ?? ""), reveal: r.reveal };
    return null;
  };

  const choose = async (qq: ClientQuestion, value: Resp) => {
    if (results[qq.id]) return;
    if (state.feedback) { setPendingSel((p) => ({ ...p, [qq.id]: value })); return; }
    setAnswers((a) => ({ ...a, [qq.id]: value }));
    await save(qq, value);
  };

  const check = async (qq: ClientQuestion) => {
    const value = pendingSel[qq.id] ?? null;
    if (value === null || value === "") return;
    setBusy(true);
    const r = await save(qq, value);
    setBusy(false);
    if (r) { setResults((x) => ({ ...x, [qq.id]: r })); setAnswers((a) => ({ ...a, [qq.id]: value })); }
  };

  const doneReading = async () => {
    setBusy(true);
    const r = await post("phase", { unit: u, phase: "read_done" });
    setBusy(false);
    if (r) { setPhase("answer"); setQi(0); setShowPassage(true); window.scrollTo({ top: 0 }); }
  };

  const nextUnit = () => { setU(u + 1); setQi(0); setPhase(state.hidePassage ? "answer" : "read"); window.scrollTo({ top: 0 }); };
  const unitDone = unit.questions.every((x) => answers[x.id] !== undefined && answers[x.id] !== null);
  const lastQ = qi === unit.questions.length - 1;

  // keyboard: 1-5 or A-E choose, left and right arrows move between questions
  useEffect(() => {
    if (phase !== "answer" || !q) return;
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" && (t as HTMLInputElement).type === "text" || t.tagName === "SELECT" || t.tagName === "TEXTAREA")) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === "ArrowRight" && qi < unit.questions.length - 1) { setQi(qi + 1); e.preventDefault(); }
      if (e.key === "ArrowLeft" && qi > 0) { setQi(qi - 1); e.preventDefault(); }
      if ((q.format === "mcq" || q.format === "conclusion" || q.format === "tf") && !results[q.id]) {
        const n = (q.options as string[]).length;
        const idx = /^[1-9]$/.test(e.key) ? Number(e.key) - 1 : /^[a-eA-E]$/.test(e.key) ? e.key.toLowerCase().charCodeAt(0) - 97 : -1;
        if (idx >= 0 && idx < n) { void choose(q, idx); e.preventDefault(); }
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  const status = (qq: ClientQuestion): string => (results[qq.id] ? (results[qq.id].correct ? "correct" : "incorrect") : answers[qq.id] !== undefined && answers[qq.id] !== null ? "answered" : "open");

  const header: ReactNode = (
    <div className="sticky top-0 z-10 -mx-4 mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-black/10 bg-cream/95 px-4 py-2.5 backdrop-blur sm:mx-0 sm:rounded-xl sm:border sm:px-4" role="group" aria-label="Assessment status">
      <p className="text-[14px] font-semibold text-ink">{title}{units.length > 1 ? ` · Passage ${u + 1} of ${units.length}` : ""}</p>
      <p className="text-[14px] text-ink-2" aria-label={remaining !== null ? "Time left" : "Time elapsed"}>{remaining !== null ? <>Time left <strong className={remaining < 60 ? "text-orange-deep" : ""}>{clock(remaining)}</strong></> : <>Time <strong>{clock(elapsed)}</strong></>} · Answered <strong>{answeredCount}</strong> of {total}</p>
    </div>
  );

  if (phase === "intro") return (
    <div>{header}
      <section className="rounded-2xl border border-black/[0.08] bg-white p-6 shadow-card">
        <h2 className="text-[20px] font-semibold text-ink">Answer from memory</h2>
        <p className="mt-2 max-w-prose text-[15.5px] leading-relaxed text-ink-2">You read this passage earlier: <strong>{unit.title}</strong>. The passage is not shown now, so these questions show what you kept. There is nothing to lose: it is a snapshot, not a verdict.</p>
        <button type="button" className={`${primary} mt-5`} onClick={() => setPhase("answer")}>Start recall questions</button>
      </section>
    </div>
  );

  if (phase === "read") return (
    <div>{header}
      <article className="mx-auto max-w-[44rem] rounded-2xl border border-black/[0.08] bg-white p-6 shadow-card sm:p-9" aria-labelledby="rd-passage-title">
        <p className="text-[12.5px] font-semibold uppercase tracking-wide text-ink-3">Read the passage</p>
        <h2 id="rd-passage-title" className="mb-5 mt-1 text-[24px] font-semibold leading-tight text-ink">{unit.title}</h2>
        <PassageText body={unit.body ?? ""} />
        <div className="mt-8 border-t border-black/10 pt-5">
          <p className="mb-3 text-[13.5px] text-ink-3">Read at your normal pace, once, then continue. Your reading time is recorded as an estimate from when this page opened to when you press the button; it is not a measure of how you read.</p>
          <button type="button" className={primary} onClick={doneReading} disabled={busy}>I have finished reading</button>
        </div>
        {error ? <p role="alert" className="mt-3 text-[14px] text-orange-deep">{error}</p> : null}
      </article>
    </div>
  );

  const res = q ? results[q.id] : undefined;
  const sel = q ? (state.feedback ? (res ? answers[q.id] : pendingSel[q.id]) ?? answers[q.id] : answers[q.id]) : null;

  return (
    <div>{header}
      <div className={`grid gap-5 ${state.hidePassage ? "" : showPassage ? "lg:grid-cols-[1.05fr_1fr]" : ""}`}>
        {!state.hidePassage ? (
          <aside className="lg:sticky lg:top-16 lg:max-h-[calc(100vh-6rem)] lg:self-start lg:overflow-y-auto" aria-label="Passage">
            <button type="button" className={`${light} mb-2 w-full`} onClick={() => setShowPassage(!showPassage)} aria-expanded={showPassage}>{showPassage ? "Hide passage" : "Show passage"}</button>
            {showPassage ? <div className="rounded-2xl border border-black/[0.08] bg-white p-5 shadow-card"><h2 className="mb-3 text-[20px] font-semibold text-ink">{unit.title}</h2><PassageText body={unit.body ?? ""} /></div> : null}
          </aside>
        ) : null}
        <div>
          <nav aria-label="Question navigation" className="mb-3 rounded-xl border border-black/[0.08] bg-white p-3">
            <p className="mb-2 text-[12.5px] font-medium text-ink-3">Questions</p>
            <ol className="flex flex-wrap gap-2">
              {unit.questions.map((x, i) => { const st = status(x); return (
                <li key={x.id}><button type="button" onClick={() => setQi(i)} aria-current={i === qi ? "step" : undefined} aria-label={`Question ${i + 1}, ${st === "open" ? "not answered" : st}`}
                  className={`flex h-11 w-11 items-center justify-center rounded-lg border text-[14px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep ${i === qi ? "border-ink bg-ink text-white" : st === "open" ? "border-black/20 bg-white text-ink" : st === "incorrect" ? "border-[#B4410F] bg-orange-light text-orange-deep" : "border-[#0F766E] bg-[#E3F2EF] text-[#0B5A54]"}`}>{i + 1}{st === "correct" ? <span className="sr-only"> correct</span> : null}</button></li>); })}
            </ol>
          </nav>
          {q ? (
            <section className="rounded-2xl border border-black/[0.08] bg-white p-5 shadow-card sm:p-6" aria-labelledby="rd-q">
              <p className="text-[12.5px] font-semibold uppercase tracking-wide text-ink-3">Question {qi + 1} of {unit.questions.length}</p>
              <h3 id="rd-q" className="mt-1 text-[18px] font-semibold leading-snug text-ink">{q.stem}</h3>
              <div className="mt-4"><AnswerInput key={q.id} q={q} value={sel} locked={!!res} reveal={res?.reveal} onChange={(v) => void choose(q, v)} /></div>
              {res ? (
                <div role="status" className={`mt-4 rounded-xl border p-4 text-[15px] leading-relaxed ${res.correct ? "border-[#0F766E] bg-[#E3F2EF] text-[#0B3F3B]" : "border-[#B4410F] bg-orange-lighter text-ink"}`}>
                  <p className="font-semibold">{res.correct ? "Correct" : "Not quite"}</p>
                  <p className="mt-1">{res.explanation}</p>
                </div>
              ) : null}
              <div className="mt-5 flex flex-wrap gap-3">
                {state.feedback && !res ? <button type="button" className={primary} disabled={busy || pendingSel[q.id] === undefined || pendingSel[q.id] === null || pendingSel[q.id] === ""} onClick={() => check(q)}>Check answer</button> : null}
                <button type="button" className={light} disabled={qi === 0} onClick={() => setQi(qi - 1)}>Previous</button>
                {!lastQ ? <button type="button" className={res || !state.feedback ? primary : light} onClick={() => setQi(qi + 1)}>Next question</button> : null}
              </div>
              <p className="mt-3 text-[12.5px] text-ink-4">Keyboard: press 1 to 4 (or A to D) to choose, and the left and right arrow keys to move between questions.</p>
            </section>
          ) : null}
          {error ? <p role="alert" className="mt-3 rounded-lg bg-amber-50 p-3 text-[14px] text-amber-900">{error}</p> : null}
          <div className="mt-4 rounded-xl border border-black/[0.08] bg-white p-4">
            {u < units.length - 1 ? (
              <button type="button" className={primary} onClick={nextUnit} disabled={busy}>{unitDone ? "Next passage" : "Continue to next passage"}</button>
            ) : !confirm ? (
              <button type="button" className={unitDone || lastQ ? primary : light} onClick={() => (answeredCount < total ? setConfirm(true) : void finish())} disabled={busy}>{state.feedback ? "Finish practice" : "Hand in my answers"}</button>
            ) : (
              <div role="alertdialog" aria-label="Unanswered questions">
                <p className="text-[14.5px] text-ink-2">You have {total - answeredCount} unanswered question{total - answeredCount === 1 ? "" : "s"}. They will count as missed. Hand in anyway?</p>
                <div className="mt-3 flex flex-wrap gap-3"><button type="button" className={primary} onClick={() => void finish()} disabled={busy}>Hand in anyway</button><button type="button" className={light} onClick={() => setConfirm(false)}>Keep working</button></div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AnswerInput({ q, value, locked, reveal, onChange }: { q: ClientQuestion; value: Resp; locked: boolean; reveal: unknown; onChange: (v: Resp) => void }) {
  const name = `q${q.id}`;
  if (q.format === "short") {
    return (
      <div>
        <label htmlFor={name} className="text-[14px] font-medium text-ink-2">Your answer</label>
        <input id={name} type="text" inputMode="text" autoComplete="off" maxLength={80} disabled={locked} defaultValue={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} className="mt-1 min-h-[48px] w-full max-w-sm rounded-lg border border-black/20 bg-white px-3 text-[16px] text-ink focus:border-orange focus:outline-none" />
        {locked && reveal !== undefined ? <p className="mt-2 text-[14px] text-ink-2">Accepted answer: <strong>{String(reveal)}</strong></p> : null}
      </div>
    );
  }
  if (q.format === "match") {
    const o = q.options as { left: string[]; right: string[] };
    const cur = Array.isArray(value) ? value : o.left.map(() => -1);
    const key = Array.isArray(reveal) ? (reveal as number[]) : null;
    return (
      <div className="space-y-3">
        {o.left.map((l, i) => (
          <div key={l} className="grid items-center gap-2 sm:grid-cols-[1fr_1fr]">
            <label htmlFor={`${name}-${i}`} className="text-[15px] font-medium text-ink">{l}</label>
            <select id={`${name}-${i}`} disabled={locked} value={cur[i]} onChange={(e) => { const n = [...cur]; n[i] = Number(e.target.value); onChange(n); }} className="min-h-[48px] rounded-lg border border-black/20 bg-white px-3 text-[15px] text-ink focus:border-orange focus:outline-none">
              <option value={-1}>Choose…</option>
              {o.right.map((r, k) => <option key={r} value={k}>{r}</option>)}
            </select>
            {locked && key ? <p className="text-[13px] text-ink-3 sm:col-span-2">{cur[i] === key[i] ? "✓ " : "Correct pairing: "}{o.right[key[i]]}</p> : null}
          </div>
        ))}
      </div>
    );
  }
  const opts = q.options as string[];
  const key = typeof reveal === "number" ? reveal : null;
  return (
    <fieldset>
      <legend className="sr-only">Choose one answer</legend>
      <div className="space-y-2.5">
        {opts.map((o, i) => {
          const picked = value === i;
          const isKey = locked && key === i;
          const wrongPick = locked && picked && key !== i;
          return (
            <label key={i} className={`flex min-h-[52px] cursor-pointer items-start gap-3 rounded-xl border-2 px-4 py-3 text-[16px] leading-snug ${isKey ? "border-[#0F766E] bg-[#E3F2EF]" : wrongPick ? "border-[#B4410F] bg-orange-lighter" : picked ? "border-ink bg-cream-2" : "border-black/15 bg-white hover:border-orange"} ${locked ? "cursor-default" : ""}`}>
              <input type="radio" name={name} className="mt-1.5 h-4 w-4 shrink-0" checked={picked} disabled={locked} onChange={() => onChange(i)} />
              <span><span className="mr-1.5 font-semibold text-ink-3">{String.fromCharCode(65 + i)}.</span>{o}{isKey ? <span className="ml-2 text-[13px] font-semibold text-[#0B5A54]">(correct answer)</span> : null}{wrongPick ? <span className="ml-2 text-[13px] font-semibold text-orange-deep">(your choice)</span> : null}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
