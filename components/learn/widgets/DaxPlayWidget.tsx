"use client";

import { useState } from "react";
import type { DaxPlaySpec } from "@/lib/learn/widgets/types";
import DaxLab from "../DaxLab";
import { awardXp } from "./store";
import { Shell } from "./ui";

/** A live DAX window in the lesson. Running three different working formulas earns the XP; nothing is sent anywhere. */
export function DaxPlayWidget({ spec, slug }: { spec: DaxPlaySpec; slug: string }) {
  const [code, setCode] = useState(spec.code);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [done, setDone] = useState(false);
  return (
    <Shell kind="DAX playground" title={spec.title} intro={spec.intro} xp={15}>
      <DaxLab
        model={spec.model}
        visuals={spec.visuals}
        show={spec.show}
        code={code}
        label={spec.title}
        onChange={setCode}
        onRun={(r) => {
          if (!r.ok) return;
          const next = new Set(seen).add(code.replace(/\s+/g, " ").trim().toLowerCase());
          setSeen(next);
          if (next.size >= 3 && !done) { setDone(true); awardXp(slug, spec.id, 15, "DAX playground"); }
        }}
      />
      <p className="mt-3 text-[13px] text-ink-3">Change the formula and run it again; try your own ideas. {done ? "Nice: you have run three different working formulas." : `${Math.min(seen.size, 3)} of 3 different working formulas run for the XP.`}</p>
    </Shell>
  );
}
