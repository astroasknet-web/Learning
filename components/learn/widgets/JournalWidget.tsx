"use client";

import { useMemo, useState } from "react";
import { buildLedger, checkTxn } from "@/lib/learn/widgets/engine";
import type { JournalSpec } from "@/lib/learn/widgets/types";
import { awardXp } from "./store";
import { btnGhost, btnPrimary, Feedback, rs, Shell } from "./ui";

const XP_FIRST = 20, XP_LATER = 8;

/**
 * Journal simulator. A transaction appears; the student picks the debit and credit accounts. A right answer posts the entry, the T-accounts
 * update and the running trial balance shows debits equal credits. Wrong answers explain the rule; after two misses the answer can be shown.
 */
export function JournalWidget({ spec, slug }: { spec: JournalSpec; slug: string }) {
  const n = spec.txns.length;
  const [posted, setPosted] = useState(0);
  const [dr, setDr] = useState<Array<string | null>>([]);
  const [cr, setCr] = useState<Array<string | null>>([]);
  const [tries, setTries] = useState(0);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [wrong, setWrong] = useState<{ dr: boolean[]; cr: boolean[] } | null>(null);
  const [score, setScore] = useState(0);
  const t = posted < n ? spec.txns[posted] : null;
  const drSel = t ? t.dr.map((_, i) => dr[i] ?? null) : [];
  const crSel = t ? t.cr.map((_, i) => cr[i] ?? null) : [];
  const ledger = useMemo(() => buildLedger(spec.txns, posted), [spec.txns, posted]);

  const reset = () => { setDr([]); setCr([]); setTries(0); setWrong(null); };
  const submit = () => {
    if (!t) return;
    const r = checkTxn(t, drSel, crSel);
    if (r.ok) {
      const gain = tries === 0 ? XP_FIRST : XP_LATER;
      awardXp(slug, `${spec.id}:${posted}`, gain, "Journal entry");
      if (tries === 0) setScore((s) => s + 1);
      setMsg({ ok: true, text: t.why });
      setPosted(posted + 1);
      reset();
    } else {
      setTries(tries + 1);
      setWrong(r.wrong);
      setMsg({ ok: false, text: r.message });
    }
  };
  const reveal = () => { if (!t) return; setDr(t.dr.map((l) => l[0])); setCr(t.cr.map((l) => l[0])); setWrong(null); setMsg({ ok: false, text: "Here is the entry. Read why, then post it." }); };
  const restart = () => { setPosted(0); setScore(0); setMsg(null); reset(); };

  const select = (side: "dr" | "cr", i: number, v: string) => {
    const set = side === "dr" ? setDr : setCr;
    const cur = side === "dr" ? drSel : crSel;
    set(cur.map((x, k) => (k === i ? v || null : x)));
    setWrong(null);
  };

  const row = (side: "dr" | "cr", lines: Array<[string, number]>, sel: Array<string | null>) =>
    lines.map((l, i) => {
      const bad = wrong ? !wrong[side][i] : false;
      return (
        <div key={`${side}${i}`} className="flex items-center gap-2">
          <span className={`w-9 shrink-0 text-[12px] font-bold uppercase tracking-wide ${side === "dr" ? "text-emerald-800" : "text-blue-800"}`}>{side === "dr" ? "Debit" : "Credit"}</span>
          <label className="sr-only" htmlFor={`${spec.id}-${posted}-${side}${i}`}>{side === "dr" ? "Debit" : "Credit"} account {i + 1}</label>
          <select id={`${spec.id}-${posted}-${side}${i}`} value={sel[i] ?? ""} onChange={(e) => select(side, i, e.target.value)} aria-invalid={bad}
            className={`min-h-[44px] min-w-0 flex-1 rounded-lg border-2 bg-white px-3 text-[15px] text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-deep ${bad ? "cw-shake border-red-400" : "border-black/[0.15]"}`}>
            <option value="">Choose account&hellip;</option>
            {spec.accounts.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <span className="w-24 shrink-0 text-right text-[15px] font-semibold tabular-nums text-ink">{rs(l[1])}</span>
        </div>
      );
    });

  return (
    <Shell kind="Try it: journal" title={spec.title} intro={spec.intro} xp={n * XP_FIRST}>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div>
          <div className="mb-3 flex items-center gap-1.5" aria-label={`Transaction ${Math.min(posted + 1, n)} of ${n}`}>
            {spec.txns.map((_, k) => <span key={k} className={`h-2 flex-1 rounded-full transition-colors ${k < posted ? "bg-emerald-500" : k === posted ? "bg-orange" : "bg-cream-3"}`} />)}
          </div>
          {t ? (
            <div key={posted} className="cw-rise rounded-xl border border-black/[0.1] bg-cream-2 p-4">
              <p className="text-[12px] font-bold uppercase tracking-wide text-ink-3">Transaction {posted + 1} of {n}</p>
              <p className="mt-1 text-[16px] font-semibold leading-snug text-ink">{t.text}</p>
              <div className="mt-4 space-y-2">{row("dr", t.dr, drSel)}</div>
              <div className="mt-2 space-y-2 pl-6">{row("cr", t.cr, crSel)}</div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={submit} className={btnPrimary}>Post entry</button>
                {tries >= 2 ? <button type="button" onClick={reveal} className={btnGhost}>Show me the entry</button> : null}
              </div>
            </div>
          ) : (
            <div className="cw-pop rounded-xl border border-emerald-300 bg-emerald-50 p-5 text-center">
              <p className="text-[32px]" aria-hidden="true">&#127881;</p>
              <p className="text-[18px] font-bold text-emerald-900">All {n} entries posted</p>
              <p className="mt-1 text-[15px] text-emerald-900">{score} of {n} right on the first try. Total debits {rs(ledger.totalDr)} equal total credits {rs(ledger.totalCr)}, so your trial balance agrees.</p>
              <button type="button" onClick={restart} className={`${btnGhost} mt-3`}>Do it again</button>
            </div>
          )}
          {msg ? <Feedback ok={msg.ok}>{msg.text}</Feedback> : <Feedback ok={null}>{null}</Feedback>}
        </div>

        <div aria-label="Ledger accounts so far">
          <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-ink-3">Your ledger</p>
          {ledger.accounts.length === 0 ? <p className="rounded-xl border border-dashed border-black/[0.18] p-4 text-[14px] text-ink-3">Post your first entry and the T-accounts appear here.</p> : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {ledger.accounts.map((a) => (
                <div key={a.name} className="cw-pop rounded-lg border border-black/[0.1] bg-white p-2.5 text-[13px]">
                  <p className="border-b border-ink/70 pb-1 text-center font-bold text-ink">{a.name}</p>
                  <div className="grid grid-cols-2 divide-x divide-ink/60">
                    <ul className="list-none space-y-0.5 py-1 pr-2 text-right tabular-nums text-emerald-900">{a.dr.map((v, k) => <li key={k}>{v.toLocaleString("en-IN")}</li>)}</ul>
                    <ul className="list-none space-y-0.5 py-1 pl-2 tabular-nums text-blue-900">{a.cr.map((v, k) => <li key={k}>{v.toLocaleString("en-IN")}</li>)}</ul>
                  </div>
                  <p className="border-t border-black/[0.12] pt-1 text-center font-semibold text-ink">{a.balance >= 0 ? "Dr" : "Cr"} balance {Math.abs(a.balance).toLocaleString("en-IN")}</p>
                </div>
              ))}
            </div>
          )}
          <p className={`mt-3 rounded-lg px-3 py-2 text-[13.5px] font-semibold ${ledger.totalDr === ledger.totalCr ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-900"}`} role="status">
            Trial balance: debits {rs(ledger.totalDr)} {ledger.totalDr === ledger.totalCr ? "=" : "≠"} credits {rs(ledger.totalCr)}
          </p>
        </div>
      </div>
    </Shell>
  );
}
