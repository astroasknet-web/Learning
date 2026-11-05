import { evaluate, names, ExprError } from "./expr";
import { runSql } from "../sql/engine";
import { runDax } from "../dax/engine";
import { computeViz } from "../viz/engine";
import type { EquationSpec, ExplorerSpec, JournalSpec, JournalTxn, Line, QuizSpec, WidgetSpec } from "./types";

/* ------------------------------------------------------------------------------------------------------------------ spec transport */

/** Specs travel in a data attribute as base64 of UTF-8 JSON (no characters that HTML or the sanitiser could touch). */
export function decodeSpec(b64: string): unknown {
  const bin = typeof atob === "function" ? atob(b64) : Buffer.from(b64, "base64").toString("binary");
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

/* ------------------------------------------------------------------------------------------------------------------ journal */

const sortKey = (l: Line) => `${l[0]}|${l[1]}`;
export interface Pick { account: string | null; amount: number }
export interface JournalCheck { ok: boolean; wrong: { dr: boolean[]; cr: boolean[] }; message: string }

/** Judge a student's debit and credit picks for one transaction. Order inside a side does not matter. */
export function checkTxn(t: JournalTxn, dr: Array<string | null>, cr: Array<string | null>): JournalCheck {
  const side = (want: Line[], got: Array<string | null>) => {
    const flags = want.map(() => false);
    const used = new Set<number>();
    got.forEach((g, i) => {
      if (!g) return;
      const j = want.findIndex((w, k) => !used.has(k) && w[0] === g);
      if (j >= 0) { used.add(j); flags[i] = true; }
    });
    return flags;
  };
  const wd = side(t.dr, dr), wc = side(t.cr, cr);
  const complete = dr.length === t.dr.length && cr.length === t.cr.length && dr.every(Boolean) && cr.every(Boolean);
  const ok = complete && wd.every(Boolean) && wc.every(Boolean);
  let message = ok ? t.why : "";
  if (!ok) {
    if (!complete) message = "Choose an account for every line first.";
    else if (dr.some((g, i) => g === t.cr[i]?.[0]) && cr.some((g, i) => g === t.dr[i]?.[0])) message = "Right accounts, wrong sides. Ask which one increases and whether that is a debit or a credit.";
    else message = "Not quite. Think about which accounts change and whether each one goes up or down.";
  }
  return { ok, wrong: { dr: wd, cr: wc }, message };
}

export interface LedgerAccount { name: string; dr: number[]; cr: number[]; balance: number }
export function buildLedger(txns: JournalTxn[], posted: number): { accounts: LedgerAccount[]; totalDr: number; totalCr: number } {
  const map = new Map<string, LedgerAccount>();
  const get = (n: string) => { let a = map.get(n); if (!a) { a = { name: n, dr: [], cr: [], balance: 0 }; map.set(n, a); } return a; };
  let totalDr = 0, totalCr = 0;
  txns.slice(0, posted).forEach((t) => {
    t.dr.forEach(([n, v]) => { get(n).dr.push(v); totalDr += v; });
    t.cr.forEach(([n, v]) => { get(n).cr.push(v); totalCr += v; });
  });
  const accounts = [...map.values()].map((a) => ({ ...a, balance: a.dr.reduce((s, x) => s + x, 0) - a.cr.reduce((s, x) => s + x, 0) }));
  return { accounts, totalDr, totalCr };
}

/* ------------------------------------------------------------------------------------------------------------------ equation lab */

export function equationTotals(spec: EquationSpec, values: Record<string, number>): { A: number; L: number; C: number; balanced: boolean } {
  const sum = (s: "A" | "L" | "C") => spec.items.filter((i) => i.side === s).reduce((n, i) => n + (values[i.key] ?? 0), 0);
  const A = sum("A"), L = sum("L"), C = sum("C");
  return { A, L, C, balanced: A === L + C };
}
export function applyMove(spec: EquationSpec, values: Record<string, number>, move: number): Record<string, number> {
  const next = { ...values };
  for (const [k, d] of Object.entries(spec.moves[move].delta)) next[k] = (next[k] ?? 0) + d;
  return next;
}
export type Direction = "up" | "down" | "same";
/** What happens to total assets (the prediction question is built from the data, never written by hand). */
export function assetDirection(spec: EquationSpec, move: number): Direction {
  const d = spec.items.filter((i) => i.side === "A").reduce((n, i) => n + (spec.moves[move].delta[i.key] ?? 0), 0);
  return d > 0 ? "up" : d < 0 ? "down" : "same";
}

/* ------------------------------------------------------------------------------------------------------------------ explorer */

export function explorerScope(spec: ExplorerSpec, values: Record<string, number>): Record<string, number> {
  const s: Record<string, number> = {};
  for (const i of spec.inputs) s[i.id] = values[i.id] ?? i.value;
  return s;
}
export function explorerOutputs(spec: ExplorerSpec, values: Record<string, number>): Array<{ label: string; value: number; unit?: string; hint?: string }> {
  const scope = explorerScope(spec, values);
  return spec.outputs.map((o) => { let value = NaN; try { value = evaluate(o.expr, scope); } catch { /* shown as n/a */ } return { label: o.label, value, unit: o.unit, hint: o.hint }; });
}
export function explorerSeries(spec: ExplorerSpec, values: Record<string, number>): { x: number[]; series: Array<{ label: string; color: string; y: number[] }> } | null {
  if (!spec.chart) return null;
  const scope = explorerScope(spec, values);
  let max = 0;
  try { max = Math.max(1, Math.min(40, Math.round(evaluate(spec.chart.xmax, scope)))); } catch { return null; }
  const x = Array.from({ length: max + 1 }, (_, k) => k);
  const series = spec.chart.series.map((s) => ({ label: s.label, color: s.color ?? "orange", y: x.map((k) => { try { return evaluate(s.expr, { ...scope, k }); } catch { return NaN; } }) }));
  return { x, series };
}
export function formatValue(v: number, unit?: string): string {
  if (!Number.isFinite(v)) return "n/a";
  if (unit === "rs") return "₹" + Math.round(v).toLocaleString("en-IN");
  if (unit === "pct") return (Math.round(v * 10) / 10).toLocaleString("en-IN") + "%";
  if (unit === "x") return (Math.round(v * 100) / 100).toLocaleString("en-IN") + " times";
  return (Math.round(v * 100) / 100).toLocaleString("en-IN");
}

/* ------------------------------------------------------------------------------------------------------------------ progress */

export interface ProgressState { xp: number; done: Record<string, true> }
export const emptyProgress = (): ProgressState => ({ xp: 0, done: {} });
/** Award XP once per id. Returns the new state and what was actually gained. */
export function award(p: ProgressState, id: string, xp: number): { state: ProgressState; gained: number } {
  if (p.done[id]) return { state: p, gained: 0 };
  const gain = Math.max(0, Math.min(200, Math.trunc(xp)));
  return { state: { xp: p.xp + gain, done: { ...p.done, [id]: true } }, gained: gain };
}
export const levelFor = (xp: number): { title: string; next: number | null } => {
  const steps: Array<[number, string]> = [[0, "Beginner"], [100, "Bookkeeper"], [300, "Junior accountant"], [600, "Senior accountant"], [1000, "Pro"]];
  let cur = steps[0];
  for (const s of steps) if (xp >= s[0]) cur = s;
  const next = steps.find((s) => s[0] > xp);
  return { title: cur[1], next: next ? next[0] : null };
};

export function scoreQuiz(spec: QuizSpec, picks: Array<number | null>): { right: number; total: number } {
  return { right: spec.questions.filter((q, i) => picks[i] === q.answer).length, total: spec.questions.length };
}

/* ------------------------------------------------------------------------------------------------------------------ validation */

/** Returns a list of problems (empty when the spec is good). Used by the unit tests and mirrored by the course authoring tool. */
export function validateSpec(spec: WidgetSpec): string[] {
  const p: string[] = [];
  const need = (c: boolean, m: string) => { if (!c) p.push(m); };
  need(typeof spec.id === "string" && /^[a-z0-9-]{3,60}$/.test(spec.id), "id must be 3-60 chars of a-z, 0-9 and hyphen");
  switch (spec.type) {
    case "quiz":
      need(spec.questions.length > 0, "quiz needs questions");
      spec.questions.forEach((q, i) => { need(q.options.length === 4, `q${i}: 4 options`); need(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length, `q${i}: answer index`); need(q.explain.length > 5, `q${i}: explanation`); });
      break;
    case "journal":
      need(spec.txns.length > 0, "journal needs transactions");
      spec.txns.forEach((t, i) => {
        const dr = t.dr.reduce((n, l) => n + l[1], 0), cr = t.cr.reduce((n, l) => n + l[1], 0);
        need(dr === cr && dr > 0, `txn ${i}: debits ${dr} must equal credits ${cr}`);
        for (const l of [...t.dr, ...t.cr]) need(spec.accounts.includes(l[0]), `txn ${i}: account "${l[0]}" is not in the account list`);
        need(t.why.length > 10, `txn ${i}: explanation`);
      });
      need(new Set(spec.accounts).size === spec.accounts.length && spec.accounts.length >= 4, "accounts must be unique and at least 4");
      break;
    case "equation": {
      need(equationTotals(spec, spec.start).balanced, "starting position must satisfy A = L + C");
      let v = spec.start;
      spec.moves.forEach((m, i) => { v = applyMove(spec, v, i); need(equationTotals(spec, v).balanced, `move ${i} breaks A = L + C`); need(m.why.length > 10, `move ${i}: explanation`); });
      break;
    }
    case "explorer": {
      const scope: Record<string, number> = {};
      spec.inputs.forEach((i) => { need(i.min < i.max && i.value >= i.min && i.value <= i.max && i.step > 0, `input ${i.id}: range`); scope[i.id] = i.value; });
      spec.outputs.forEach((o) => { try { for (const n of names(o.expr)) need(n in scope, `output "${o.label}" uses unknown name ${n}`); need(Number.isFinite(evaluate(o.expr, scope)), `output "${o.label}" is not finite at the defaults`); } catch (e) { p.push(`output "${o.label}": ${(e as ExprError).message}`); } });
      if (spec.chart) {
        try { need(Number.isFinite(evaluate(spec.chart.xmax, scope)), "chart xmax is not finite"); } catch (e) { p.push(`chart xmax: ${(e as Error).message}`); }
        spec.chart.series.forEach((s) => { try { for (let k = 0; k <= 5; k++) need(Number.isFinite(evaluate(s.expr, { ...scope, k })), `series "${s.label}" not finite at k=${k}`); } catch (e) { p.push(`series "${s.label}": ${(e as Error).message}`); } });
      }
      break;
    }
    case "complete":
      break;
    case "hashlab":
      need(spec.start.length > 0 && spec.start.length <= 200, "hashlab start text must be 1-200 characters");
      break;
    case "chainlab":
      need(spec.blocks.length >= 3 && spec.blocks.length <= 5, "chainlab needs 3-5 blocks");
      need(Number.isInteger(spec.difficulty) && spec.difficulty >= 0 && spec.difficulty <= 3, "chainlab difficulty must be 0-3");
      break;
    case "merkle":
      need([4, 8].includes(spec.txs.length), "merkle needs 4 or 8 transactions");
      break;
    case "sqlplay": {
      need(spec.tables.length >= 1 && spec.tables.length <= 6, "sqlplay needs 1-6 tables");
      need(spec.tables.reduce((n, t) => n + t.rows.length, 0) <= 400, "sqlplay sample data is too large (400 rows at most)");
      const r = runSql({ tables: spec.tables }, spec.query);
      need(r.ok, `sqlplay starting query does not run: ${r.ok ? "" : r.error}`);
      break;
    }
    case "daxplay": {
      need(spec.model.tables.length >= 1 && spec.visuals.length >= 1, "daxplay needs a model and at least one visual");
      const r = runDax(spec.model, spec.code, spec.visuals, spec.show);
      need(r.ok, `daxplay starting formula does not run: ${r.ok ? "" : r.error}`);
      break;
    }
    case "vizplay": {
      need(spec.data.fields.length >= 2 && spec.data.rows.length >= 1 && spec.data.rows.length <= 400, "vizplay needs data with at least two fields and 1 to 400 rows");
      const r = computeViz(spec.data, spec.start);
      need(r.ok, `vizplay starting view does not draw: ${r.ok ? "" : r.error}`);
      break;
    }
    case "flashcards":
      need(spec.cards.length >= 3, "need at least 3 cards");
      spec.cards.forEach((c, i) => need(c.front.length > 0 && c.back.length > 0, `card ${i} is empty`));
      break;
  }
  return p;
}
