"use client";

import { useState } from "react";
import type { VizPlaySpec } from "@/lib/learn/widgets/types";
import VizLab, { type VizState } from "../VizLab";
import { awardXp } from "./store";
import { Shell } from "./ui";

/** A live viz builder in the lesson. Building four different working views earns the XP; nothing is sent anywhere. */
export function VizPlayWidget({ spec, slug }: { spec: VizPlaySpec; slug: string }) {
  const [v, setV] = useState<VizState>({ spec: JSON.parse(JSON.stringify(spec.start)), calcs: {} });
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [done, setDone] = useState(false);
  const onChange = (next: VizState): void => {
    setV(next);
    if (next.spec.columns.length + next.spec.rows.length === 0) return;
    const id = JSON.stringify([next.spec, next.calcs]);
    if (!seen.has(id)) {
      const s = new Set(seen).add(id);
      setSeen(s);
      if (s.size >= 5 && !done) { setDone(true); awardXp(slug, spec.id, 15, "Viz builder"); }
    }
  };
  return (
    <Shell kind="Viz builder" title={spec.title} intro={spec.intro} xp={15}>
      <VizLab data={spec.data} value={v} label={spec.title} onChange={onChange} allowCalcs={spec.allowCalcs} />
      <p className="mt-3 text-[13px] text-ink-3">Add fields, change the mark and try your own ideas. {done ? "Nice: you have explored five different views." : `${Math.min(seen.size, 5)} of 5 different views explored for the XP.`}</p>
    </Shell>
  );
}
