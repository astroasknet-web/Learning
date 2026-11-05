import { describe, expect, it } from "vitest";
import { evaluate, names, parse, ExprError } from "./expr";
import { applyMove, assetDirection, award, buildLedger, checkTxn, decodeSpec, emptyProgress, equationTotals, explorerOutputs, explorerSeries, formatValue, levelFor, scoreQuiz, validateSpec } from "./engine";
import type { EquationSpec, ExplorerSpec, JournalSpec, QuizSpec } from "./types";

describe("expression evaluator", () => {
  it("does arithmetic with the right precedence", () => {
    expect(evaluate("2+3*4", {})).toBe(14);
    expect(evaluate("(2+3)*4", {})).toBe(20);
    expect(evaluate("2^3^2", {})).toBe(512); // right associative
    expect(evaluate("-2^2", {})).toBe(-4);
    expect(evaluate("(cost-residual)/life", { cost: 500000, residual: 50000, life: 5 })).toBe(90000);
    expect(evaluate("cost*(1-rate/100)^k", { cost: 500000, rate: 20, k: 3 })).toBeCloseTo(256000, 6);
    expect(evaluate("round(10/3,2)", {})).toBe(3.33);
    expect(evaluate("max(1,min(5,9))", {})).toBe(5);
  });
  it("returns NaN for undefined results and throws for bad text", () => {
    expect(evaluate("1/0", {})).toBeNaN();
    expect(evaluate("2^1000", {})).toBeNaN();
    expect(() => evaluate("1+", {})).toThrow(ExprError);
    expect(() => evaluate("x+1", {})).toThrow(/Unknown name/);
    expect(() => evaluate("alert(1)", {})).toThrow(/Unknown function/);
    expect(() => evaluate("a.b", { a: 1 })).toThrow(ExprError);
    expect(() => evaluate("1; 2", {})).toThrow(ExprError);
  });
  it("cannot reach prototypes or run code", () => {
    expect(() => evaluate("constructor", {})).toThrow(/Unknown name/);
    expect(() => evaluate("__proto__", {})).toThrow(/Unknown name/);
    expect(() => evaluate("toString(1)", {})).toThrow(/Unknown function/);
    expect(() => parse("(".repeat(100) + "1" + ")".repeat(100))).toThrow(/nested/);
    expect(() => parse("1+".repeat(200) + "1")).toThrow(/too long/);
  });
  it("lists the names an expression uses", () => {
    expect(names("a*(b+c)-min(a,d)").sort()).toEqual(["a", "b", "c", "d"]);
  });
});

const journal: JournalSpec = {
  type: "journal", id: "demo-journal", title: "Demo", accounts: ["Cash", "Capital", "Furniture", "Purchases", "Anil"],
  txns: [
    { text: "Owner invests 1,00,000", dr: [["Cash", 100000]], cr: [["Capital", 100000]], why: "Cash (asset) rises: debit. Capital rises: credit." },
    { text: "Bought furniture 30,000 cash", dr: [["Furniture", 30000]], cr: [["Cash", 30000]], why: "Furniture (asset) rises: debit. Cash falls: credit." },
    { text: "Goods bought, part cash part credit", dr: [["Purchases", 40000]], cr: [["Cash", 10000], ["Anil", 30000]], why: "Purchases is debited; cash and Anil are credited by their parts." },
  ],
};

describe("journal widget logic", () => {
  it("accepts the right accounts and rejects wrong ones", () => {
    expect(checkTxn(journal.txns[0], ["Cash"], ["Capital"]).ok).toBe(true);
    const wrong = checkTxn(journal.txns[0], ["Capital"], ["Cash"]);
    expect(wrong.ok).toBe(false);
    expect(wrong.message).toMatch(/wrong sides/);
    expect(checkTxn(journal.txns[0], ["Furniture"], ["Capital"]).ok).toBe(false);
    expect(checkTxn(journal.txns[0], [null], ["Capital"]).message).toMatch(/every line/);
  });
  it("ignores order inside a side and handles compound entries", () => {
    expect(checkTxn(journal.txns[2], ["Purchases"], ["Anil", "Cash"]).ok).toBe(true);
    expect(checkTxn(journal.txns[2], ["Purchases"], ["Cash", "Cash"]).ok).toBe(false);
  });
  it("builds a ledger whose totals always agree", () => {
    const l = buildLedger(journal.txns, 3);
    expect(l.totalDr).toBe(170000);
    expect(l.totalCr).toBe(170000);
    expect(l.accounts.find((a) => a.name === "Cash")!.balance).toBe(100000 - 30000 - 10000);
    expect(l.accounts.find((a) => a.name === "Anil")!.balance).toBe(-30000);
    expect(buildLedger(journal.txns, 0).accounts).toEqual([]);
  });
  it("validates specs", () => {
    expect(validateSpec(journal)).toEqual([]);
    const bad: JournalSpec = { ...journal, txns: [{ ...journal.txns[0], cr: [["Capital", 5]] }] };
    expect(validateSpec(bad).join()).toMatch(/must equal/);
    const missing: JournalSpec = { ...journal, txns: [{ ...journal.txns[0], dr: [["Nope", 100000]] }] };
    expect(validateSpec(missing).join()).toMatch(/not in the account list/);
  });
});

const eq: EquationSpec = {
  type: "equation", id: "demo-eq", title: "Demo",
  items: [{ key: "cash", label: "Cash", side: "A" }, { key: "stock", label: "Stock", side: "A" }, { key: "cred", label: "Creditors", side: "L" }, { key: "cap", label: "Capital", side: "C" }],
  start: { cash: 100, stock: 0, cred: 0, cap: 100 },
  moves: [
    { text: "Buy goods on credit 50", delta: { stock: 50, cred: 50 }, why: "Stock and creditors both rise." },
    { text: "Pay creditors 20", delta: { cash: -20, cred: -20 }, why: "Cash and creditors both fall." },
    { text: "Swap cash for stock 10", delta: { cash: -10, stock: 10 }, why: "One asset replaces another." },
  ],
};
describe("equation lab logic", () => {
  it("keeps A = L + C through every move and predicts the asset direction", () => {
    expect(validateSpec(eq)).toEqual([]);
    let v = eq.start;
    v = applyMove(eq, v, 0);
    expect(equationTotals(eq, v)).toEqual({ A: 150, L: 50, C: 100, balanced: true });
    expect(assetDirection(eq, 0)).toBe("up");
    expect(assetDirection(eq, 1)).toBe("down");
    expect(assetDirection(eq, 2)).toBe("same");
  });
  it("rejects a move that breaks the equation", () => {
    const broken: EquationSpec = { ...eq, moves: [{ text: "x", delta: { cash: 10 }, why: "this is not balanced" }] };
    expect(validateSpec(broken).join()).toMatch(/breaks A = L \+ C/);
  });
});

const ex: ExplorerSpec = {
  type: "explorer", id: "demo-explorer", title: "Depreciation",
  inputs: [{ id: "cost", label: "Cost", min: 100000, max: 1000000, step: 10000, value: 500000, unit: "rs" }, { id: "res", label: "Scrap value", min: 0, max: 200000, step: 5000, value: 50000, unit: "rs" }, { id: "life", label: "Life", min: 2, max: 10, step: 1, value: 5, unit: "yrs" }, { id: "rate", label: "WDV rate", min: 5, max: 50, step: 1, value: 20, unit: "pct" }],
  outputs: [{ label: "SLM per year", expr: "(cost-res)/life", unit: "rs" }, { label: "WDV year 1", expr: "cost*rate/100", unit: "rs" }, { label: "Broken", expr: "cost/(life-life)", unit: "rs" }],
  chart: { xmax: "life", xlabel: "Year", series: [{ label: "SLM", expr: "cost-(cost-res)/life*k", color: "orange" }, { label: "WDV", expr: "cost*(1-rate/100)^k", color: "blue" }] },
};
describe("explorer logic", () => {
  it("computes outputs and a series from the inputs", () => {
    const out = explorerOutputs(ex, {});
    expect(out[0].value).toBe(90000);
    expect(out[1].value).toBe(100000);
    expect(Number.isNaN(out[2].value)).toBe(true);
    const s = explorerSeries(ex, { life: 4 })!;
    expect(s.x).toEqual([0, 1, 2, 3, 4]);
    expect(s.series[0].y[4]).toBe(50000);
    expect(s.series[1].y[1]).toBeCloseTo(400000, 6);
    expect(formatValue(90000, "rs")).toBe("₹90,000");
    expect(formatValue(NaN)).toBe("n/a");
    expect(formatValue(7, "x")).toBe("7 times");
  });
  it("validation catches a non-finite output", () => {
    expect(validateSpec(ex).join()).toMatch(/not finite/);
    expect(validateSpec({ ...ex, outputs: ex.outputs.slice(0, 2) })).toEqual([]);
    expect(validateSpec({ ...ex, outputs: [{ label: "x", expr: "nope+1" }] }).join()).toMatch(/Unknown name|unknown name/);
  });
});

describe("quiz, progress and transport", () => {
  const quiz: QuizSpec = { type: "quiz", id: "demo-quiz", questions: [{ q: "q", options: ["a", "b", "c", "d"], answer: 2, explain: "because c" }, { q: "q2", options: ["a", "b", "c", "d"], answer: 0, explain: "because a" }] };
  it("scores and validates", () => {
    expect(scoreQuiz(quiz, [2, 1])).toEqual({ right: 1, total: 2 });
    expect(scoreQuiz(quiz, [null, null])).toEqual({ right: 0, total: 2 });
    expect(validateSpec(quiz)).toEqual([]);
    expect(validateSpec({ ...quiz, questions: [{ ...quiz.questions[0], answer: 7 }] }).join()).toMatch(/answer index/);
  });
  it("awards XP once per id and never goes negative", () => {
    let p = emptyProgress();
    let r = award(p, "a", 10); p = r.state; expect(r.gained).toBe(10);
    r = award(p, "a", 10); p = r.state; expect(r.gained).toBe(0);
    r = award(p, "b", -5); expect(r.gained).toBe(0);
    r = award(p, "c", 5000); expect(r.gained).toBe(200);
    expect(levelFor(0).title).toBe("Beginner");
    expect(levelFor(150)).toEqual({ title: "Bookkeeper", next: 300 });
    expect(levelFor(5000).next).toBeNull();
  });
  it("round-trips a spec through base64 with non-ASCII text", () => {
    const spec = { id: "x", text: "Rs ₹1,00,000 – café \"quoted\" <b>" };
    const b64 = Buffer.from(JSON.stringify(spec), "utf8").toString("base64");
    expect(decodeSpec(b64)).toEqual(spec);
  });
});
