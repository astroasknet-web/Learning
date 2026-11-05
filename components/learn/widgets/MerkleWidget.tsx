"use client";

import { useMemo, useState } from "react";
import type { MerkleSpec } from "@/lib/learn/widgets/types";
import { merkleLevels } from "@/lib/learn/widgets/chain";
import { awardXp } from "./store";
import { Shell } from "./ui";

/** A Merkle tree: transactions are hashed, then pairs of hashes are hashed again, up to one root. Change one transaction and the root changes, so one short number protects the whole block. */
export function MerkleWidget({ spec, slug }: { spec: MerkleSpec; slug: string }) {
  const [txs, setTxs] = useState<string[]>(spec.txs);
  const [edited, setEdited] = useState<Set<number>>(new Set());
  const levels = useMemo(() => merkleLevels(txs), [txs]);
  const original = useMemo(() => merkleLevels(spec.txs), [spec.txs]);
  const top = levels.length - 1;
  const rootChanged = levels[top][0] !== original[top][0];

  const edit = (i: number, v: string) => {
    setTxs((t) => t.map((x, k) => (k === i ? v : x)));
    setEdited((s) => {
      const n = new Set(s).add(i);
      if (n.size >= 2 && !s.has(i)) awardXp(slug, spec.id, 15, "Merkle tree");
      return n;
    });
  };

  return (
    <Shell kind="Merkle tree" title={spec.title} intro={spec.intro} xp={15}>
      <div className="space-y-3">
        {[...levels].reverse().map((lv, ri) => {
          const li = top - ri;
          return (
            <div key={li}>
              <p className="mb-1 text-[11.5px] font-bold uppercase tracking-widest text-ink-3">{li === top ? "Merkle root" : li === 0 ? "Transaction hashes" : `Level ${li}`}</p>
              <div className="flex flex-wrap gap-2">
                {lv.map((h, i) => {
                  const diff = h !== original[li][i];
                  return <span key={i} className={`rounded-lg border px-2 py-1 font-mono text-[12px] transition ${diff ? "border-red-500 bg-red-50 text-red-900" : "border-emerald-500 bg-emerald-50 text-emerald-900"}`}>{h.slice(0, 10)}…</span>;
                })}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-[13px] font-semibold text-ink-2">Transactions (edit any of them)</p>
      <ul className="mt-1 grid gap-2 sm:grid-cols-2">
        {txs.map((t, i) => (
          <li key={i}><label className="sr-only" htmlFor={`${spec.id}-t${i}`}>Transaction {i + 1}</label>
            <input id={`${spec.id}-t${i}`} value={t} maxLength={50} onChange={(e) => edit(i, e.target.value)} className="w-full rounded-lg border border-black/[0.18] bg-white px-2 py-1.5 text-[14px]" /></li>
        ))}
      </ul>
      <p className="mt-3 text-[14px] text-ink-2" aria-live="polite">{rootChanged ? "The root is different now, so everyone who holds the original root can tell the block was altered. Only the red hashes on the path from your change to the root had to be recomputed." : "Everything matches the original root. Edit a transaction to see which hashes change."}</p>
    </Shell>
  );
}
