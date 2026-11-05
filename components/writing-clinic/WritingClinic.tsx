"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Check, Clock, Lock, Shuffle, Stethoscope } from "lucide-react";
import { EXAMS, examByKey, type ExamKey } from "@/lib/writing-clinic/exams";
import { evaluateWriting, type Result } from "@/lib/writing-clinic/score";

interface Entry { at: number; exam: string; task: string; score: number; max: number; words: number }
const KEY = "wc-history-v1";
const USE_KEY = "wc-month-v1";

/** Essay checks used this calendar month on this device (kept on the device, like the history). */
function usedThisMonth(): number {
  const m = new Date().toISOString().slice(0, 7);
  try { const u = JSON.parse(localStorage.getItem(USE_KEY) ?? "{}") as { m?: string; n?: number }; return u.m === m ? Number(u.n) || 0 : 0; } catch { return 0; }
}
function countUse(): void {
  const m = new Date().toISOString().slice(0, 7);
  try { localStorage.setItem(USE_KEY, JSON.stringify({ m, n: usedThisMonth() + 1 })); } catch { /* private mode: the allowance is a soft limit */ }
}

function loadHistory(): Entry[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "[]") as Entry[]; } catch { return []; }
}
function saveHistory(list: Entry[]): void {
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, 12))); } catch { /* private mode: history is optional */ }
}
const mmss = (s: number): string => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export interface Allowance {
  /** Essay checks allowed each month, or null for unlimited. */
  monthly: number | null;
  /** Where "Get the studio" goes (the checkout, or the log-in page first for a visitor). */
  buyHref: string;
  /** The studio's price in rupees, when it is on sale. */
  price: number | null;
}

export default function WritingClinic({ allowance }: { allowance: Allowance }) {
  const [examKey, setExamKey] = useState<ExamKey>("ielts");
  const exam = examByKey(examKey);
  const [taskKey, setTaskKey] = useState(exam.tasks[0].key);
  const task = exam.tasks.find((t) => t.key === taskKey) ?? exam.tasks[0];
  const [prompt, setPrompt] = useState(task.prompts[0]);
  const [text, setText] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [history, setHistory] = useState<Entry[]>([]);
  const [secs, setSecs] = useState(0);
  const [used, setUsed] = useState(0);
  const [running, setRunning] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setHistory(loadHistory()); setUsed(usedThisMonth()); }, []);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  const words = useMemo(() => (text.toLowerCase().match(/[a-z']+/g) ?? []).length, [text]);

  function pickExam(k: ExamKey) {
    const e = examByKey(k);
    setExamKey(k); setTaskKey(e.tasks[0].key); setPrompt(e.tasks[0].prompts[0]); setResult(null); setSecs(0); setRunning(false);
  }
  function pickTask(k: string) {
    const t = exam.tasks.find((x) => x.key === k) ?? exam.tasks[0];
    setTaskKey(t.key); setPrompt(t.prompts[0]); setResult(null);
  }
  function shuffle() {
    const others = task.prompts.filter((p) => p !== prompt);
    setPrompt(others[Math.floor(Math.random() * others.length)] ?? prompt);
  }
  const locked = allowance.monthly !== null && used >= allowance.monthly;
  function check() {
    if (locked) return;
    const r = evaluateWriting(exam, task, text);
    setResult(r); setRunning(false);
    if (r.overall > 0) {
      countUse(); setUsed(usedThisMonth());
      const next = [{ at: Date.now(), exam: exam.short, task: task.name, score: r.overall, max: r.max, words: r.wordCount }, ...history];
      setHistory(next); saveHistory(next);
    }
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);
  }

  const over = running && secs > task.minutes * 60;

  return (
    <div id="practice" className="scroll-mt-24 rounded-[28px] border border-black/10 bg-white p-4 shadow-sm sm:p-7">
      <div role="tablist" aria-label="Choose your exam" className="flex flex-wrap gap-2">
        {EXAMS.map((e) => (
          <button key={e.key} role="tab" aria-selected={e.key === examKey} onClick={() => pickExam(e.key)}
            className={`min-h-[42px] rounded-full border px-4 text-[0.9rem] font-medium transition ${e.key === examKey ? "border-ink bg-ink text-white" : "border-black/15 text-ink-2 hover:bg-cream-2"}`}>
            {e.short}
          </button>
        ))}
      </div>
      <p className="mt-3 text-[0.92rem] text-ink-3">{exam.blurb}</p>

      <div className="mt-5 grid gap-6 lg:grid-cols-[1.35fr,1fr]">
        <div>
          {exam.tasks.length > 1 ? (
            <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Task type">
              {exam.tasks.map((t) => (
                <button key={t.key} aria-pressed={t.key === taskKey} onClick={() => pickTask(t.key)}
                  className={`min-h-[38px] rounded-lg px-3 text-[0.85rem] font-medium ${t.key === taskKey ? "bg-cream-3 text-ink" : "text-ink-3 hover:bg-cream-2"}`}>{t.name}</button>
              ))}
            </div>
          ) : <p className="mb-3 text-[0.85rem] font-medium text-ink">{task.name}</p>}

          <div className="rounded-2xl bg-cream-2 p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="text-[0.74rem] font-semibold uppercase tracking-[0.12em] text-ink-4">Your prompt · {task.minWords}+ words · {task.minutes} min</p>
              <button onClick={shuffle} className="inline-flex min-h-[32px] items-center gap-1 rounded-lg px-2 text-[0.8rem] font-medium text-ink-2 hover:bg-white"><Shuffle className="h-3.5 w-3.5" aria-hidden />Another prompt</button>
            </div>
            <p className="mt-2 text-[1rem] leading-relaxed text-ink">{prompt}</p>
          </div>

          <label htmlFor="wc-text" className="mt-4 block text-[0.85rem] font-medium text-ink">Your answer</label>
          <textarea id="wc-text" value={text} onChange={(e) => setText(e.target.value)} rows={13} spellCheck
            placeholder="Write or paste your answer here. Separate paragraphs with a blank line."
            className="mt-1.5 w-full rounded-2xl border border-black/15 bg-white p-4 text-[1rem] leading-relaxed text-ink outline-none focus:border-ink" />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <p className={`text-[0.85rem] ${words >= task.minWords ? "text-emerald-700" : "text-ink-4"}`}>{words} words{words < task.minWords ? ` · ${task.minWords - words} to go` : " · length reached"}</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setRunning((r) => !r)} className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border px-3 text-[0.85rem] font-medium ${over ? "border-red-300 text-red-700" : "border-black/15 text-ink-2"}`}>
                <Clock className="h-4 w-4" aria-hidden />{running ? mmss(secs) : secs ? `${mmss(secs)} paused` : `Start ${task.minutes}-min timer`}
              </button>
              {locked ? (
                <Link href={allowance.buyHref} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-orange px-5 text-[0.95rem] font-semibold text-white transition hover:bg-orange-dark"><Lock className="h-4 w-4" aria-hidden />Unlock the studio{allowance.price ? ` · ₹${allowance.price}` : ""}</Link>
              ) : (
              <button onClick={check} disabled={!text.trim()} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-ink px-5 text-[0.95rem] font-semibold text-white transition hover:opacity-90 disabled:opacity-40">
                <Stethoscope className="h-4 w-4" aria-hidden />Check my writing
              </button>
              )}
            </div>
          </div>
        </div>

        <div ref={resultRef} aria-live="polite">
          {result && result.overall > 0 ? (
            <div className="rounded-2xl border border-black/10 p-5">
              <p className="text-[0.74rem] font-semibold uppercase tracking-[0.12em] text-ink-4">Your estimate</p>
              <p className="mt-1 flex items-baseline gap-2">
                <span className="text-[3rem] font-semibold leading-none text-ink">{result.overall.toFixed(1)}</span>
                <span className="text-[0.95rem] text-ink-4">{exam.scaleName} out of {result.max}</span>
              </p>
              <ul className="mt-4 space-y-3">
                {exam.criteria.map((c, i) => (
                  <li key={c}>
                    <div className="flex justify-between text-[0.85rem]"><span className="text-ink-2">{c}</span><span className="font-semibold text-ink">{result.criteria[i].toFixed(1)}</span></div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-cream-3"><div className="h-full rounded-full bg-ink" style={{ width: `${(result.criteria[i] / result.max) * 100}%` }} /></div>
                  </li>
                ))}
              </ul>
              {result.working.length ? (<>
                <p className="mt-5 text-[0.85rem] font-semibold text-emerald-800">Working well</p>
                <ul className="mt-1.5 space-y-1.5 text-[0.88rem] text-ink-2">{result.working.map((w) => <li key={w} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />{w}</li>)}</ul>
              </>) : null}
              {result.improve.length ? (<>
                <p className="mt-4 text-[0.85rem] font-semibold text-amber-800">Push it up</p>
                <ul className="mt-1.5 list-disc space-y-1.5 pl-5 text-[0.88rem] text-ink-2">{result.improve.map((w) => <li key={w}>{w}</li>)}</ul>
              </>) : null}
              <p className="mt-5 text-[0.76rem] leading-relaxed text-ink-4">{result.note}</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-black/15 p-6 text-[0.92rem] text-ink-3">
              {locked ? (
                <>
                  <p className="font-medium text-ink">You have used your {allowance.monthly} free essay checks this month.</p>
                  <p className="mt-1">The English Writing Studio gives you unlimited checks for IELTS, SAT, GRE and GMAT writing{allowance.price ? ` for a one-time ₹${allowance.price}` : ""}. Your free checks come back next month.</p>
                  <Link href={allowance.buyHref} className="mt-4 inline-flex min-h-[44px] items-center rounded-xl bg-orange px-5 font-semibold text-white hover:bg-orange-dark">Unlock the studio</Link>
                </>
              ) : allowance.monthly !== null ? (
                <p className="mb-2 text-[0.82rem] text-ink-4">{Math.max(0, allowance.monthly - used)} of {allowance.monthly} essay checks left this month.</p>
              ) : null}
              <p className="font-medium text-ink">Your result appears here.</p>
              <p className="mt-1">Write your answer, press <span className="font-medium">Check my writing</span>, and see your score on each of the four criteria with a short list of what to fix first.</p>
            </div>
          )}

          <details className="mt-4 rounded-2xl border border-black/10 p-4 text-[0.88rem]">
            <summary className="cursor-pointer font-medium text-ink">Tips for {exam.short}</summary>
            <div className="mt-3 space-y-3">
              {exam.tips.map((t) => (
                <div key={t.title}><p className="font-semibold text-ink">{t.title}</p><ul className="mt-1 list-disc space-y-1 pl-5 text-ink-3">{t.points.map((p) => <li key={p}>{p}</li>)}</ul></div>
              ))}
            </div>
          </details>

          {history.length ? (
            <div className="mt-4 rounded-2xl border border-black/10 p-4">
              <div className="flex items-center justify-between"><p className="text-[0.85rem] font-semibold text-ink">Your recent checks</p>
                <button onClick={() => { setHistory([]); saveHistory([]); }} className="text-[0.78rem] text-ink-4 underline">Clear</button></div>
              <ul className="mt-2 space-y-1 text-[0.84rem] text-ink-3">
                {history.slice(0, 5).map((h) => (
                  <li key={h.at} className="flex justify-between"><span>{h.exam}, {h.words} words</span><span className="font-medium text-ink">{h.score.toFixed(1)}/{h.max}</span></li>
                ))}
              </ul>
              <p className="mt-2 text-[0.74rem] text-ink-4">Saved on this device only.</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
