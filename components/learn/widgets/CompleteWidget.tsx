"use client";

import { markDone, unmark, useProgress } from "./store";
import type { CompleteSpec } from "@/lib/learn/widgets/types";

/** "Mark this lesson complete" button. Feeds the XP dock and lesson count. */
export function CompleteWidget({ spec, slug }: { spec: CompleteSpec; slug: string }) {
  const p = useProgress(slug);
  const id = `lesson:${spec.id}`;
  const done = Boolean(p.done[id]);
  return (
    <div className="my-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-orange/30 bg-orange-lighter px-5 py-4">
      <p className="text-[15px] font-semibold text-ink">{done ? "Lesson complete. Nicely done." : "Finished reading and trying the activities?"}</p>
      <button type="button" aria-pressed={done} onClick={() => (done ? unmark(slug, id) : markDone(slug, id, 25, "Lesson complete"))}
        className={`inline-flex min-h-[44px] items-center rounded-lg px-5 text-[15px] font-semibold text-white transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep ${done ? "bg-emerald-700 hover:bg-emerald-800" : "bg-orange-deep hover:bg-ink"}`}>
        {done ? "✓ Completed (undo)" : spec.label ?? "Mark complete (+25 XP)"}
      </button>
    </div>
  );
}
