"use client";

import { useState } from "react";
import type { Activity, ActivityState } from "@/lib/learn/types";

/** Optional AI helper. Only shown when the server has AI switched on. The student decides whether their work is shared. */
export default function AssistantPanel({ slug, activity, state }: { slug: string; activity: Activity; state: ActivityState }) {
  const [q, setQ] = useState("");
  const [share, setShare] = useState(false);
  const [level, setLevel] = useState<"beginner" | "intermediate">("beginner");
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<{ text: string; shared: boolean } | null>(null);
  const [err, setErr] = useState("");

  const ask = async () => {
    setBusy(true); setErr(""); setOut(null);
    try {
      const r = await fetch("/api/learn/assist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, activityId: activity.id, question: q, share, level, state: share ? state : undefined }) });
      const j = (await r.json()) as { answer?: string; error?: string; sharedWork?: boolean };
      if (!r.ok || !j.answer) setErr(j.error ?? "The assistant could not answer. The hints above still work.");
      else setOut({ text: j.answer, shared: Boolean(j.sharedWork) });
    } catch {
      setErr("The assistant is not reachable right now. Everything else on this page still works.");
    } finally { setBusy(false); }
  };

  return (
    <details className="rounded-2xl border border-black/[0.09] bg-white p-4 sm:p-5">
      <summary className="cursor-pointer text-[16px] font-bold text-ink">Ask the learning assistant (optional)</summary>
      <div className="mt-3 space-y-3">
        <p className="text-[13.5px] text-ink-3">An AI helper can explain an idea in simpler words or give a hint. It can make mistakes, so check anything important. It does not mark your work: use <b>Check my work</b> for that.</p>
        <div><label htmlFor="ai-q" className="block text-[13px] font-medium text-ink">Your question</label>
          <textarea id="ai-q" value={q} onChange={(e) => setQ(e.target.value)} maxLength={400} rows={3} placeholder="For example: What does a cell range like B2:B5 mean?" className="mt-1 w-full rounded-lg border border-black/[0.2] p-2 text-[15px]" /></div>
        <div className="flex flex-wrap items-center gap-4">
          <label className="inline-flex min-h-[44px] items-center gap-2 text-[14px] text-ink-2"><input type="checkbox" className="h-5 w-5 accent-orange-deep" checked={share} onChange={(e) => setShare(e.target.checked)} />Share my current work with the assistant</label>
          <label className="inline-flex items-center gap-2 text-[14px] text-ink-2">Explain for
            <select value={level} onChange={(e) => setLevel(e.target.value as "beginner" | "intermediate")} className="min-h-[40px] rounded-md border border-black/[0.2] px-2"><option value="beginner">a beginner</option><option value="intermediate">someone with some experience</option></select></label>
        </div>
        <p className="text-[12.5px] text-ink-3">{share ? "A text copy of your work will be sent to the AI service to answer this question." : "Your work stays private. The assistant will only see your question."} Please do not type personal details.</p>
        <button type="button" disabled={busy || q.trim().length < 3} onClick={ask} className="inline-flex min-h-[44px] items-center rounded-lg bg-ink px-5 text-[14px] font-semibold text-white hover:bg-orange-deep disabled:opacity-50">{busy ? "Thinking..." : "Ask"}</button>
        <div aria-live="polite">
          {err ? <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-[14px] text-amber-900">{err}</p> : null}
          {out ? <div className="rounded-lg bg-cream-2 p-3"><p className="whitespace-pre-wrap text-[14.5px] text-ink">{out.text}</p><p className="mt-2 text-[12px] text-ink-3">{out.shared ? "This answer used the text of your work that you shared." : "This answer did not use your work, because you did not share it."}</p></div> : null}
        </div>
      </div>
    </details>
  );
}
