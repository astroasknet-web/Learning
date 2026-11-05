"use client";

import { useMemo, useRef, useState } from "react";
import type { HashLabSpec } from "@/lib/learn/widgets/types";
import { bitsDifferent, sha256 } from "@/lib/learn/widgets/sha256";
import { awardXp } from "./store";
import { btnGhost, Shell } from "./ui";

/** Type anything and watch its SHA-256 fingerprint. Change one letter and about half of the 256 bits flip: the "avalanche" that makes tampering visible. */
export function HashLabWidget({ spec, slug }: { spec: HashLabSpec; slug: string }) {
  const [text, setText] = useState(spec.start);
  const base = useRef(sha256(spec.start));
  const hash = useMemo(() => sha256(text), [text]);
  const changed = bitsDifferent(base.current, hash);
  const [seen, setSeen] = useState<Set<string>>(() => new Set([sha256(spec.start)]));
  const [done, setDone] = useState(false);

  const onChange = (v: string) => {
    setText(v);
    const h = sha256(v);
    if (!seen.has(h)) {
      const next = new Set(seen).add(h);
      setSeen(next);
      if (next.size >= 4 && !done) { setDone(true); awardXp(slug, spec.id, 15, "Hash lab"); }
    }
  };
  const flipOne = () => onChange(text.length ? text.slice(0, -1) + (text.endsWith("!") ? "?" : "!") : "a");

  return (
    <Shell kind="Hash lab" title={spec.title} intro={spec.intro} xp={15}>
      <label className="block text-[13px] font-semibold text-ink-2" htmlFor={`${spec.id}-in`}>Type here</label>
      <textarea id={`${spec.id}-in`} value={text} onChange={(e) => onChange(e.target.value)} rows={2} maxLength={200}
        className="mt-1 w-full rounded-xl border border-black/[0.18] bg-white px-3 py-2 text-[16px] text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-deep" />
      <div className="mt-3 rounded-xl bg-ink p-3">
        <p className="text-[11px] font-bold uppercase tracking-widest text-white/60">SHA-256 fingerprint (256 bits, shown as 64 hex digits)</p>
        <p className="mt-1 break-all font-mono text-[14px] leading-relaxed text-emerald-300" aria-live="polite">{hash}</p>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" onClick={flipOne} className={btnGhost}>Change the last character</button>
        <p className="text-[14px] text-ink-2">Compared with the starting text, <b>{changed}</b> of 256 bits are different{changed > 0 ? ` (${Math.round((changed / 256) * 100)}%)` : ""}.</p>
      </div>
      <p className="mt-2 text-[13px] text-ink-3">Try it: the same text always gives the same hash, but even a tiny change gives one that looks completely unrelated. {done ? "Nice: you have explored four different inputs." : `Explored ${Math.min(seen.size, 4)} of 4 different inputs for the XP.`}</p>
    </Shell>
  );
}
