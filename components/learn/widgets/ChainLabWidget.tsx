"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChainLabSpec } from "@/lib/learn/widgets/types";
import { buildChain, checkChain, mine, type Block } from "@/lib/learn/widgets/chain";
import { awardXp } from "./store";
import { btnGhost, btnPrimary, Shell } from "./ui";

/**
 * A toy blockchain you can break. Each block holds its data, a nonce and the previous block's hash. Edit any block and it, and every block
 * after it, turns red. Mining (searching for a nonce whose hash starts with enough zeros) repairs one block at a time, which shows why rewriting history is costly.
 */
export function ChainLabWidget({ spec, slug }: { spec: ChainLabSpec; slug: string }) {
  const [difficulty, setDifficulty] = useState(Math.min(spec.difficulty, 3));
  const [blocks, setBlocks] = useState<Block[]>(() => buildChain(spec.blocks, Math.min(spec.difficulty, 3)));
  const [busy, setBusy] = useState<number | null>(null);
  const [tries, setTries] = useState<number | null>(null);
  const [tampered, setTampered] = useState(false);
  const [done, setDone] = useState(false);
  const cancel = useRef(false);
  const state = useMemo(() => checkChain(blocks, difficulty), [blocks, difficulty]);
  const allValid = state.valid.every(Boolean);
  useEffect(() => () => { cancel.current = true; }, []);

  useEffect(() => {
    if (tampered && allValid && !done) { setDone(true); awardXp(slug, spec.id, 25, "Chain lab"); }
  }, [tampered, allValid, done, slug, spec.id]);

  const edit = (i: number, data: string) => {
    setTampered(true);
    setBlocks((bs) => bs.map((b, k) => (k === i ? { ...b, data } : b)));
  };

  /** Re-link a block to its (possibly changed) predecessor and mine it, in slices so the page stays responsive. */
  const remine = async (i: number) => {
    cancel.current = false;
    setBusy(i);
    let total = 0;
    const prev = i === 0 ? blocks[0].prev : state.hashes[i - 1];
    let b: Block = { ...blocks[i], prev };
    let from = 0;
    for (;;) {
      const r = mine(b, difficulty, from, 20000);
      total += r ? r.tries : 20000;
      if (r) { b = { ...b, nonce: r.nonce }; break; }
      from += 20000;
      await new Promise((res) => setTimeout(res, 0));
      if (cancel.current) { setBusy(null); return; }
    }
    setBlocks((bs) => bs.map((x, k) => (k === i ? b : x)));
    setTries(total);
    setBusy(null);
  };

  return (
    <Shell kind="Chain lab" title={spec.title} intro={spec.intro} xp={25}>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <label className="text-[14px] font-semibold text-ink-2" htmlFor={`${spec.id}-d`}>Mining difficulty: hash must start with <b>{difficulty}</b> zero{difficulty === 1 ? "" : "s"}</label>
        <input id={`${spec.id}-d`} type="range" min={0} max={3} value={difficulty} onChange={(e) => { setDifficulty(Number(e.target.value)); setTampered(true); }} className="w-36 accent-orange-deep" />
      </div>
      <ol className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2" aria-label="Blocks in the chain">
        {blocks.map((b, i) => {
          const ok = state.valid[i];
          return (
            <li key={b.index} className={`rounded-xl border-2 p-3 transition ${ok ? "border-emerald-500 bg-emerald-50" : "border-red-500 bg-red-50"}`}>
              <div className="flex items-center justify-between">
                <b className="text-[14px] text-ink">Block {b.index}</b>
                <span className={`rounded-full px-2 py-0.5 text-[11.5px] font-bold ${ok ? "bg-emerald-600 text-white" : "bg-red-600 text-white"}`}>{ok ? "valid" : "broken"}</span>
              </div>
              <label className="mt-2 block text-[12px] font-semibold text-ink-3" htmlFor={`${spec.id}-b${i}`}>Data</label>
              <input id={`${spec.id}-b${i}`} value={b.data} maxLength={60} onChange={(e) => edit(i, e.target.value)} className="w-full rounded-lg border border-black/[0.18] bg-white px-2 py-1.5 text-[14px]" />
              <dl className="mt-2 space-y-1 font-mono text-[11.5px] text-ink-2">
                <div><dt className="inline font-semibold">prev: </dt><dd className="inline break-all">{b.prev.slice(0, 14)}…</dd></div>
                <div><dt className="inline font-semibold">nonce: </dt><dd className="inline">{b.nonce}</dd></div>
                <div><dt className="inline font-semibold">hash: </dt><dd className="inline break-all">{state.hashes[i].slice(0, 14)}…</dd></div>
              </dl>
              {!ok ? <button type="button" disabled={busy !== null} onClick={() => remine(i)} className={`${btnPrimary} mt-2 !min-h-[38px] !px-3 !text-[13.5px]`}>{busy === i ? "Mining…" : "Re-link and mine"}</button> : null}
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-[14px] text-ink-2" aria-live="polite">
        {allValid ? (tampered ? "The chain is valid again. Notice that you had to repair every block after your edit." : "Every block links to the one before it. Try changing some text in Block 2.") : "A change in one block breaks its own hash, and every later block no longer points to the right hash. Repair them in order, one block at a time."}
        {tries !== null ? ` The last mining run took ${tries.toLocaleString("en-IN")} tries.` : ""}
      </p>
      <div className="mt-2"><button type="button" className={btnGhost} onClick={() => { setBlocks(buildChain(spec.blocks, difficulty)); setTampered(false); setTries(null); }}>Reset the chain</button></div>
    </Shell>
  );
}
