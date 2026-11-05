import { describe, expect, it } from "vitest";
import { analyse, chartData, Calculator, emptySheet, exportCsv, filterRows, formatValue, importCsv, isErr, parseFormula, setCell, sortRows, type SheetState } from "./engine";

const sheet = (cells: Record<string, string>): SheetState => ({ ...emptySheet(), cells });
const val = (cells: Record<string, string>, ref: string) => new Calculator(cells).value(ref);
const f = (formula: string, extra: Record<string, string> = {}) => val({ A1: formula, ...extra }, "A1");

describe("spreadsheet formulas", () => {
  it("does arithmetic with the right precedence", () => {
    expect(f("=1+2*3")).toBe(7);
    expect(f("=(1+2)*3")).toBe(9);
    expect(f("=2^3^2")).toBe(512);
    expect(f("=-2^2")).toBe(4); // unary minus binds first, as in a spreadsheet
    expect(f("=10/4")).toBe(2.5);
    expect(f("=50%")).toBe(0.5);
    expect(f("=200*10%")).toBe(20);
    expect(f("=1+2-3")).toBe(0);
  });
  it("sums, averages and counts ranges, skipping text and blanks", () => {
    const d = { B2: "10", B3: "20", B4: "abc", B5: "", B6: "30" };
    expect(f("=SUM(B2:B6)", d)).toBe(60);
    expect(f("=AVERAGE(B2:B6)", d)).toBe(20);
    expect(f("=MIN(B2:B6)", d)).toBe(10);
    expect(f("=MAX(B2:B6)", d)).toBe(30);
    expect(f("=COUNT(B2:B6)", d)).toBe(3);
    expect(f("=COUNTA(B2:B6)", d)).toBe(4);
    expect(f("=SUM(B2,B3,5)", d)).toBe(35);
    expect(f("=SUM(B2:B3)*2", d)).toBe(60);
  });
  it("evaluates IF lazily with comparisons and text", () => {
    expect(f('=IF(B1>=40,"Pass","Fail")', { B1: "55" })).toBe("Pass");
    expect(f('=IF(B1>=40,"Pass","Fail")', { B1: "12" })).toBe("Fail");
    expect(f("=IF(B1>=40,1)", { B1: "12" })).toBe(false);
    expect(f("=IF(1,B9/0,5)")).toSatisfy(isErr); // the chosen branch is evaluated
    expect(f("=IF(0,B9/0,5)")).toBe(5); // the other branch is never evaluated
    expect(f('=IF(B1="done","yes","no")', { B1: "Done" })).toBe("yes"); // text compare ignores case
  });
  it("supports the extra helpers", () => {
    const d = { B2: "40", B3: "39", B4: "75", C2: "Pass", C3: "Fail", C4: "Pass" };
    expect(f('=COUNTIF(C2:C4,"Pass")', d)).toBe(2);
    expect(f('=COUNTIF(B2:B4,">=40")', d)).toBe(2);
    expect(f('=SUMIF(C2:C4,"Pass",B2:B4)', d)).toBe(115);
    expect(f("=ROUND(2.567,1)")).toBe(2.6);
    expect(f("=ROUND(2.5)")).toBe(3);
    expect(f("=ABS(-4)")).toBe(4);
    expect(f("=AND(1>0,2>1)")).toBe(true);
    expect(f("=OR(1>2,2>1)")).toBe(true);
    expect(f("=NOT(1>2)")).toBe(true);
    expect(f('="a"&"b"&1')).toBe("ab1");
  });
  it("reports beginner-friendly errors instead of crashing", () => {
    const e = (formula: string, extra: Record<string, string> = {}) => f(formula, extra) as { err: string; msg: string };
    expect(e("=1/0").err).toBe("#DIV/0!");
    expect(e("=B1/B2", { B1: "5" }).err).toBe("#DIV/0!"); // empty cell is 0
    expect(e("=AVERAGE(B1:B3)").err).toBe("#DIV/0!");
    expect(e('=1+"abc"').err).toBe("#VALUE!");
    expect(e("=B1+1", { B1: "hello" }).err).toBe("#VALUE!");
    expect(e("=FOO(1)").err).toBe("#NAME?");
    expect(e("=hello").err).toBe("#NAME?");
    expect(e("=A1").err).toBe("#CIRC!");
    expect(e("=ZZ999").err).toBe("#REF!");
    expect(e("=SUM(B2:B5").err).toBe("#ERROR!");
    expect(e("=SUM(B2:B5").msg).toMatch(/closing bracket|closed/);
    expect(e("=1+").err).toBe("#ERROR!");
    expect(e("=").err).toBe("#ERROR!");
    expect(e("=1 2").err).toBe("#ERROR!");
    expect(e("=B2:B3").err).toBe("#VALUE!"); // a bare range is not a value
    expect(e("=IF(B1,1,2)", { B1: "text" }).err).toBe("#VALUE!");
  });
  it("detects circular chains through several cells and still calculates the rest", () => {
    const c = new Calculator({ A1: "=B1+1", B1: "=C1+1", C1: "=A1+1", D1: "7", E1: "=D1*2" });
    expect((c.value("A1") as { err: string }).err).toBe("#CIRC!");
    expect(c.value("E1")).toBe(14);
  });
  it("recalculates dependents when a cell changes", () => {
    const s = sheet({ A1: "2", A2: "3", A3: "=A1*A2", A4: "=A3+1" });
    expect(new Calculator(s.cells).value("A4")).toBe(7);
    setCell(s, "A1", "10");
    expect(new Calculator(s.cells).value("A4")).toBe(31);
    expect(setCell(s, "A1", "")).toBe(true);
    expect(new Calculator(s.cells).value("A4")).toBe(1);
  });
  it("never runs text as code: hostile input is just an unknown name, text or a parse error", () => {
    for (const bad of ["=constructor", "=alert(1)", "=this", "=process.exit()", "=__proto__", "=Function('return 1')()", '=eval("1+1")', "=window.location", "=`x`", "=a=>a", "=1;2"]) {
      const v = f(bad);
      expect(isErr(v), bad).toBe(true);
    }
    expect(Object.prototype.hasOwnProperty.call({}, "polluted")).toBe(false);
    expect(f("=SUM(" + "(".repeat(100) + "1" + ")".repeat(100) + ")")).toSatisfy(isErr); // too deep, not a stack overflow
    expect(isErr(f("=" + "1+".repeat(400) + "1"))).toBe(true); // too long
  });
  it("rejects cells and numbers that are off the sheet or malformed", () => {
    const s = emptySheet();
    expect(setCell(s, "AA1", "x")).toBe(false);
    expect(setCell(s, "A101", "x")).toBe(false);
    expect(setCell(s, "A1", "x".repeat(501))).toBe(false);
    expect(setCell(s, "B2", "5")).toBe(true);
    expect(isErr(f("=1.2.3"))).toBe(true);
  });
  it("tells you which cells and functions a formula uses", () => {
    const a = analyse(parseFormula("=SUM(B2:B4)+C1"));
    expect([...a.refs].sort()).toEqual(["B2", "B3", "B4", "C1"]);
    expect([...a.fns]).toEqual(["SUM"]);
    expect(a.ranges).toEqual([{ c1: 1, r1: 1, c2: 1, r2: 3 }]);
  });
  it("formats numbers for display", () => {
    expect(formatValue(0.1 + 0.2)).toBe("0.3");
    expect(formatValue(1234.5, { num: "currency" })).toBe("₹1,234.50");
    expect(formatValue(0.256, { num: "percent" })).toBe("25.6%");
    expect(formatValue(3.14159, { num: "dec2" })).toBe("3.14");
    expect(formatValue(null)).toBe("");
    expect(formatValue(true)).toBe("TRUE");
  });
});

describe("sorting, filtering, charts and CSV", () => {
  const data = { A1: "Name", B1: "Marks", A2: "Asha", B2: "72", A3: "Ravi", B3: "55", A4: "Meena", B4: "91", A5: "Dev", B5: "" };
  it("sorts rows by a column, blanks last, keeping each row together", () => {
    const s = sheet({ ...data });
    sortRows(s, 1, 4, 1, "desc", 1);
    expect([s.cells.A2, s.cells.A3, s.cells.A4, s.cells.A5]).toEqual(["Meena", "Asha", "Ravi", "Dev"]);
    expect(s.cells.B2).toBe("91");
    expect(s.cells.A1).toBe("Name"); // header untouched
    sortRows(s, 1, 4, 0, "asc", 1);
    expect([s.cells.A2, s.cells.A3, s.cells.A4, s.cells.A5]).toEqual(["Asha", "Dev", "Meena", "Ravi"]);
  });
  it("filters rows with a number, an operator or a text fragment", () => {
    const s = sheet({ ...data });
    expect(filterRows(s, 1, 4, 1, ">=70")).toEqual([2, 4]); // Ravi 55 and blank are hidden (rows 3 and 5 -> idx 2, 4)
    expect(filterRows(s, 1, 4, 0, "me")).toEqual([1, 2, 4]);
    expect(filterRows(s, 1, 4, 1, "")).toEqual([]);
  });
  it("builds chart data and explains problems", () => {
    const s = sheet({ ...data });
    expect(chartData(s, { type: "bar", labels: "A2:A4", values: "B2:B4" })).toMatchObject({ ok: true, labels: ["Asha", "Ravi", "Meena"], values: [72, 55, 91] });
    expect(chartData(s, { type: "bar", labels: "A2:A4", values: "B2:B5" }).problem).toMatch(/same number/);
    expect(chartData(s, { type: "pie", labels: "A2:A5", values: "A2:A5" }).problem).toMatch(/not numbers/);
    expect(chartData(s, { type: "line", labels: "", values: "" }).ok).toBe(false);
  });
  it("round-trips CSV, including quotes, commas and line breaks", () => {
    const csv = importCsv('Name,Note\n"Ravi, K","said ""hi"""\nAsha,"two\nlines"\n');
    expect(csv).toMatchObject({ rows: 3, cols: 2 });
    const c = (csv as { cells: Record<string, string> }).cells;
    expect(c).toMatchObject({ A2: "Ravi, K", B2: 'said "hi"', B3: "two\nlines" });
    const out = exportCsv(sheet(c));
    expect(importCsv(out)).toMatchObject({ cells: c });
  });
  it("limits CSV size and shape, and neutralises formulas on export", () => {
    expect(importCsv("a".repeat(200_000))).toHaveProperty("error");
    const wide = importCsv(Array.from({ length: 150 }, () => Array.from({ length: 40 }, () => "1").join(",")).join("\n")) as { rows: number; cols: number; truncated: boolean };
    expect(wide).toMatchObject({ rows: 100, cols: 26, truncated: true });
    const s = sheet({ A1: "=cmd|calc", B1: "-5", C1: "=SUM(B1:B1)", D1: "+x" });
    const out = exportCsv({ ...s, cells: { ...s.cells, A1: '=HYPERLINK("x")' } });
    expect(out).toContain('"#NAME?"'); // an unknown name exports as the error label, never as a live formula
    expect(out).toContain("\"'+x\""); // text that starts with + gets an apostrophe
    expect(out).toContain('"-5"'); // real negative numbers are left alone
    expect(importCsv("")).toHaveProperty("error");
  });
});

describe("more spreadsheet functions", () => {
  const d = { B2: "10", B3: "20", B4: "30", B5: "40", C2: "a", C3: "b", C4: "a", C5: "a" };
  it("rounds, roots and remainders", () => {
    expect(f("=SQRT(81)")).toBe(9);
    expect(f("=SQRT(-1)")).toMatchObject({ err: "#VALUE!" });
    expect(f("=INT(-2.5)")).toBe(-3);
    expect(f("=MOD(10,3)")).toBe(1);
    expect(f("=MOD(-1,3)")).toBe(2);
    expect(f("=MOD(5,0)")).toMatchObject({ err: "#DIV/0!" });
    expect(f("=POWER(2,10)")).toBe(1024);
    expect(f("=ROUNDUP(2.341,2)")).toBe(2.35);
    expect(f("=ROUNDDOWN(2.349,2)")).toBe(2.34);
    expect(f("=ROUNDUP(-2.341,2)")).toBe(-2.35);
    expect(f("=ROUNDUP(2.3,1)")).toBe(2.3);
  });
  it("describes data: median, standard deviation, variance", () => {
    expect(f("=MEDIAN(B2:B5)", d)).toBe(25);
    expect(f("=MEDIAN(B2:B4)", d)).toBe(20);
    expect(f("=VAR(B2:B5)", d)).toBeCloseTo(166.6667, 3);
    expect(f("=STDEV(B2:B5)", d)).toBeCloseTo(12.9099, 3);
    expect(f("=STDEV(B2)", d)).toMatchObject({ err: "#DIV/0!" });
  });
  it("conditional averages and error trapping", () => {
    expect(f("=AVERAGEIF(C2:C5,\"a\",B2:B5)", d)).toBe((10 + 30 + 40) / 3);
    expect(f("=AVERAGEIF(C2:C5,\"z\",B2:B5)", d)).toMatchObject({ err: "#DIV/0!" });
    expect(f("=IFERROR(1/0,\"none\")")).toBe("none");
    expect(f("=IFERROR(4/2,\"none\")")).toBe(2);
  });
  it("loan payment and future value follow the spreadsheet sign convention", () => {
    expect(f("=ROUND(PMT(0.01,12,10000),2)")).toBe(-888.49);
    expect(f("=PMT(0,10,1000)")).toBe(-100);
    expect(f("=ROUND(FV(0.01,12,-100),2)")).toBe(1268.25);
    expect(f("=FV(0,10,-100)")).toBe(1000);
    expect(f("=PMT(0.01,0,1000)")).toMatchObject({ err: "#VALUE!" });
  });
});

describe("relationships between two columns", () => {
  // x in B, a rising y (y = 2x + 1) in C and a falling y in D; the formula goes in A1.
  const d = { B1: "1", B2: "2", B3: "3", B4: "4", C1: "3", C2: "5", C3: "7", C4: "9", D1: "9", D2: "7", D3: "5", D4: "3" };
  it("correlation is 1 for a rising line and -1 for a falling one", () => {
    expect(f("=CORREL(B1:B4,C1:C4)", d)).toBeCloseTo(1, 10);
    expect(f("=CORREL(B1:B4,D1:D4)", d)).toBeCloseTo(-1, 10);
  });
  it("slope and intercept describe the line y = 2x + 1 (first range is y, second is x)", () => {
    expect(f("=SLOPE(C1:C4,B1:B4)", d)).toBeCloseTo(2, 10);
    expect(f("=INTERCEPT(C1:C4,B1:B4)", d)).toBeCloseTo(1, 10);
    expect(f("=SLOPE(D1:D4,B1:B4)", d)).toBeCloseTo(-2, 10);
  });
  it("reports unusable input", () => {
    expect(f("=CORREL(B1:B4,C1:C3)", d)).toMatchObject({ err: "#N/A" });
    expect(f("=CORREL(B1,C1)", d)).toMatchObject({ err: "#VALUE!" });
    expect(f("=SLOPE(C1:C4,E1:E4)", d)).toMatchObject({ err: "#DIV/0!" });
  });
});
