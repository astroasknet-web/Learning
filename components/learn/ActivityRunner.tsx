"use client";

import Link from "next/link";
import { useCallback, useState, useTransition } from "react";
import { runChecks } from "@/lib/learn/checks";
import { initialState } from "@/lib/learn/activities";
import type { Activity, ActivityState, RunResult } from "@/lib/learn/types";
import { submitActivity, type SubmitReply } from "@/app/courses/[slug]/learn/activity-actions";
import ClassifyBoard from "./ClassifyBoard";
import SheetGrid from "./SheetGrid";
import SqlLab from "./SqlLab";
import DaxLab from "./DaxLab";
import VizLab from "./VizLab";
import SlideStudio from "./SlideStudio";
import WordPad from "./WordPad";
import AssistantPanel from "./AssistantPanel";

/** Lab text marks emphasis with **double asterisks**; show it as bold instead of printing the asterisks. */
function bold(s: string) {
  return s.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : part));
}

/**
 * Runs one activity: shows the task, the right playground, the checks, hints that are asked for (not pushed), and records the result.
 * The checks run here for instant feedback and again on the server for the result that counts.
 */
const LEVEL: Record<string, string> = { beginner: "Beginner", intermediate: "Intermediate", challenge: "Challenge" };
const KIND: Record<string, string> = { word: "Document", sheet: "Spreadsheet", slides: "Presentation", classify: "Sort and decide", sql: "SQL practice", dax: "DAX practice", viz: "Viz builder" };
const btnPrimary = "inline-flex min-h-[48px] items-center justify-center rounded-lg bg-orange-deep px-6 text-[15px] font-semibold text-white hover:bg-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep disabled:opacity-50";
const btnGhost = "inline-flex min-h-[48px] items-center justify-center rounded-lg border border-black/[0.18] bg-white px-5 text-[15px] font-medium text-ink hover:bg-cream-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep disabled:opacity-50";

export default function ActivityRunner({ slug, activity, initial, signedIn, aiEnabled, backHref, nextHref, nextLabel }: { slug: string; activity: Activity; initial: ActivityState; signedIn: boolean; aiEnabled: boolean; backHref: string; nextHref: string; nextLabel: string }) {
  const [state, setState] = useState<ActivityState>(initial);
  const [version, setVersion] = useState(0);
  const [run, setRun] = useState<RunResult | null>(null);
  const [hints, setHints] = useState<Set<string>>(new Set());
  const [explains, setExplains] = useState<Set<string>>(new Set());
  const [reply, setReply] = useState<SubmitReply | null>(null);
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();

  const toggle = (set: Set<string>, id: string, fn: (s: Set<string>) => void) => { const n = new Set(set); n.has(id) ? n.delete(id) : n.add(id); fn(n); };

  const send = useCallback((mode: "check" | "save") => {
    const local = mode === "check" ? runChecks(activity, state) : null;
    if (local) setRun(local);
    setNote("");
    start(async () => {
      try {
        const r = await submitActivity(slug, activity.id, state, mode);
        setReply(r);
        if (!r.ok) { setNote(r.error ?? "Something went wrong."); return; }
        if (r.run) setRun(r.run);
        setNote(mode === "save" ? (r.saved === "account" ? "Saved to your account." : "Not saved: log in as a student to keep your work.") : "");
      } catch {
        setNote("We could not reach the server. Your feedback above is still correct, but this attempt was not recorded.");
      }
    });
  }, [activity, slug, state]);

  const reset = () => {
    if (!window.confirm("Reset this exercise to its starting point? Your changes to it will be lost.")) return;
    setState(initialState(activity));
    setVersion((v) => v + 1);
    setRun(null);
    setReply(null);
    setNote("Exercise reset.");
  };

  const marks = state.kind === "classify" && run ? Object.fromEntries(run.results.map((r) => [r.id, r.passed])) : undefined;
  const passedAll = run?.allPassed;
  const label = activity.title;

  return (
    <div className="space-y-6">
      <header>
        <p className="flex flex-wrap items-center gap-2 text-[13px] text-ink-3">
          <span className="rounded-full bg-cream-3 px-2.5 py-1 font-semibold text-ink-2">{KIND[activity.kind]}</span>
          <span>{LEVEL[activity.level]}</span><span aria-hidden="true">&middot;</span><span>about {activity.minutes} min</span><span aria-hidden="true">&middot;</span><span>{activity.xp} XP</span>
          {activity.required ? <span className="rounded-full bg-orange-light px-2.5 py-1 font-semibold text-orange-deep">Counts toward the module</span> : null}
        </p>
        <h1 className="mt-2 text-[26px] font-bold leading-tight text-ink sm:text-[32px]">{activity.title}</h1>
        <p className="mt-2 max-w-3xl text-[16px] text-ink-2">{bold(activity.scenario)}</p>
      </header>

      <section aria-labelledby="goal-h" className="grid gap-4 rounded-2xl border border-black/[0.09] bg-white p-4 sm:grid-cols-[1fr_1fr] sm:p-5">
        <div><h2 id="goal-h" className="text-[14px] font-semibold uppercase tracking-wide text-ink-3">Your goal</h2><p className="mt-1 text-[15px] text-ink">{bold(activity.objective)}</p></div>
        <div><h2 className="text-[14px] font-semibold uppercase tracking-wide text-ink-3">Steps</h2><ol className="mt-1 list-decimal space-y-1 pl-5 text-[14.5px] text-ink-2">{activity.steps.map((s, i) => <li key={i}>{bold(s)}</li>)}</ol></div>
      </section>

      <section aria-label="Workspace" key={version}>
        {state.kind === "word" ? <WordPad html={state.html} label={label} onChange={(html) => setState({ kind: "word", html })} /> : null}
        {state.kind === "sheet" ? <SheetGrid sheet={state.sheet} view={activity.view} label={label} onChange={(sheet) => setState({ kind: "sheet", sheet })} /> : null}
        {state.kind === "slides" ? <SlideStudio deck={state.deck} label={label} onChange={(deck) => setState({ kind: "slides", deck })} /> : null}
        {state.kind === "sql" && activity.sql ? <SqlLab tables={activity.sql.tables} query={state.query} label={label} onChange={(query) => setState({ kind: "sql", query })} /> : null}
        {state.kind === "dax" && activity.dax ? <DaxLab model={activity.dax.model} visuals={activity.dax.visuals} show={activity.dax.show} code={state.code} label={label} onChange={(code) => setState({ kind: "dax", code })} /> : null}
        {state.kind === "viz" && activity.viz ? <VizLab data={activity.viz.data} value={{ spec: state.spec, calcs: state.calcs }} label={label} allowCalcs={activity.viz.allowCalcs} onChange={(v) => setState({ kind: "viz", spec: v.spec, calcs: v.calcs })} /> : null}
        {state.kind === "classify" && activity.classify ? <ClassifyBoard data={activity.classify} answers={state.answers} marks={marks} onChange={(answers) => setState({ kind: "classify", answers })} /> : null}
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={btnPrimary} onClick={() => send("check")} disabled={pending}>{pending ? "Checking..." : "Check my work"}</button>
        {state.kind !== "classify" ? <button type="button" className={btnGhost} onClick={() => send("save")} disabled={pending}>Save</button> : null}
        <button type="button" className={btnGhost} onClick={reset} disabled={pending}>Reset exercise</button>
        <p className="text-[13px] text-ink-3" role="status" aria-live="polite">{note || (signedIn ? "Your work is saved to your account when you press Check or Save." : "You are not logged in as a student, so this work is not saved. You can still download it.")}</p>
      </div>

      <section aria-labelledby="checks-h" className="rounded-2xl border border-black/[0.09] bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="checks-h" className="text-[18px] font-bold text-ink">{run ? `${run.passed} of ${run.total} checks passed` : "What will be checked"}</h2>
          {run ? <p className="text-[13px] text-ink-3">Hints and explanations are here when you want them.</p> : null}
        </div>
        {passedAll ? (
          <div role="status" className="mt-3 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-950">
            <p className="text-[16px] font-bold">Well done: every check passed.</p>
            {reply?.saved === "account" ? (
              <p className="mt-1 text-[14px]">You now have {reply.xp} XP ({reply.level}).{reply.newBadges.length ? ` New badge: ${reply.newBadges.join(", ")}.` : ""}{reply.courseComplete ? " You finished the whole course." : reply.moduleComplete ? " This module is now complete." : ""}</p>
            ) : (
              <p className="mt-1 text-[14px]">{signedIn ? "We could not record this attempt, so it will not count yet. Try Check my work again." : "Log in as a student to save your progress and earn XP and badges."}</p>
            )}
            <div className="mt-3 flex flex-wrap gap-2"><Link href={nextHref} className={btnPrimary}>{nextLabel}</Link><Link href={backHref} className={btnGhost}>Back to the module</Link></div>
          </div>
        ) : null}
        <ul className="mt-3 space-y-2">
          {(run ? run.results : activity.checks.map((c) => ({ id: c.id, label: c.label, passed: false, message: "", hint: c.hint, explain: c.explain }))).map((r) => (
            <li key={r.id} className={`rounded-lg border p-3 ${run ? (r.passed ? "border-emerald-200 bg-emerald-50/60" : "border-amber-200 bg-amber-50/60") : "border-black/[0.08]"}`}>
              <div className="flex items-start gap-2.5">
                <span aria-hidden="true" className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[12px] font-bold ${run ? (r.passed ? "bg-emerald-700 text-white" : "bg-amber-600 text-white") : "bg-cream-3 text-ink-3"}`}>{run ? (r.passed ? "✓" : "!") : "○"}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14.5px] font-medium text-ink"><span className="sr-only">{run ? (r.passed ? "Passed: " : "Needs work: ") : "To check: "}</span>{r.label}</p>
                  {run && !r.passed ? <p className="mt-0.5 text-[13.5px] text-ink-2">{r.message}</p> : null}
                  {run && !r.passed ? (
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      <button type="button" className="min-h-[36px] rounded-md border border-black/[0.18] bg-white px-3 text-[13px] hover:bg-cream-2" aria-expanded={hints.has(r.id)} onClick={() => toggle(hints, r.id, setHints)}>{hints.has(r.id) ? "Hide hint" : "Give me a hint"}</button>
                      <button type="button" className="min-h-[36px] rounded-md border border-black/[0.18] bg-white px-3 text-[13px] hover:bg-cream-2" aria-expanded={explains.has(r.id)} onClick={() => toggle(explains, r.id, setExplains)}>{explains.has(r.id) ? "Hide explanation" : "Explain the answer"}</button>
                    </div>
                  ) : null}
                  {run && !r.passed && hints.has(r.id) ? <p className="mt-1.5 rounded-md bg-white px-3 py-2 text-[13.5px] text-ink-2"><b>Hint:</b> {r.hint}</p> : null}
                  {run && !r.passed && explains.has(r.id) ? <p className="mt-1.5 rounded-md bg-white px-3 py-2 text-[13.5px] text-ink-2"><b>Explanation:</b> {r.explain}</p> : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {aiEnabled ? <AssistantPanel slug={slug} activity={activity} state={state} /> : null}
    </div>
  );
}
