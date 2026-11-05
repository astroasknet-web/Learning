"use client";

import { useEffect, useState } from "react";
import { levelFor } from "@/lib/learn/widgets/engine";
import { onGain, useProgress } from "./store";

/** Floating XP/level chip plus a "+N XP" toast. Purely local motivation; hidden until the visitor has earned something. */
export function ProgressDock({ slug }: { slug: string }) {
  const p = useProgress(slug);
  const [toast, setToast] = useState<{ xp: number; label: string; n: number } | null>(null);
  useEffect(() => {
    let n = 0;
    let t: ReturnType<typeof setTimeout> | undefined;
    const off = onGain((g) => { n += 1; setToast({ ...g, n }); clearTimeout(t); t = setTimeout(() => setToast(null), 2200); });
    return () => { off(); clearTimeout(t); };
  }, []);
  const lv = levelFor(p.xp);
  const lessons = Object.keys(p.done).filter((k) => k.startsWith("lesson:")).length;
  if (p.xp === 0 && !toast) return null;
  return (
    <div className="pointer-events-none fixed bottom-3 left-3 z-40 flex flex-col items-start gap-2 sm:bottom-5 sm:left-5">
      {toast ? <p key={toast.n} role="status" className="cw-rise rounded-full bg-orange-deep px-4 py-2 text-[14px] font-bold text-white shadow-card">+{toast.xp} XP{toast.label ? ` · ${toast.label}` : ""}</p> : null}
      <p className="rounded-full border border-orange/30 bg-white/95 px-4 py-2 text-[13px] font-semibold text-ink shadow-card backdrop-blur" aria-label={`${p.xp} experience points, level ${lv.title}, ${lessons} lessons completed`}>
        <span aria-hidden="true">&#9889;</span> {p.xp} XP &middot; {lv.title}{lessons ? ` · ${lessons} done` : ""}
      </p>
    </div>
  );
}
