"use client";

import { useState } from "react";
import type { SqlPlaySpec } from "@/lib/learn/widgets/types";
import SqlLab from "../SqlLab";
import { awardXp } from "./store";
import { Shell } from "./ui";

/** A live SQL window in the lesson. Running three different queries that work earns the XP; nothing is sent anywhere. */
export function SqlPlayWidget({ spec, slug }: { spec: SqlPlaySpec; slug: string }) {
  const [q, setQ] = useState(spec.query);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [done, setDone] = useState(false);
  return (
    <Shell kind="SQL playground" title={spec.title} intro={spec.intro} xp={15}>
      <SqlLab
        tables={spec.tables}
        query={q}
        label={spec.title}
        onChange={setQ}
        onRun={(r) => {
          if (!r.ok) return;
          const next = new Set(seen).add(q.replace(/\s+/g, " ").trim().toLowerCase());
          setSeen(next);
          if (next.size >= 3 && !done) { setDone(true); awardXp(slug, spec.id, 15, "SQL playground"); }
        }}
      />
      <p className="mt-3 text-[13px] text-ink-3">Change the query and run it again; try your own ideas. {done ? "Nice: you have run three different queries." : `${Math.min(seen.size, 3)} of 3 different working queries run for the XP.`}</p>
    </Shell>
  );
}
