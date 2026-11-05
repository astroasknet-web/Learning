import { describe, expect, it } from "vitest";
import { Calculator, formatValue, isErr, SUPPORTED_FUNCTIONS } from "./engine";

const calc = (cells: Record<string, string>) => new Calculator(cells);
const val = (cells: Record<string, string>, ref: string) => calc(cells).value(ref);
const f = (formula: string, cells: Record<string, string> = {}) => val({ ...cells, Z1: formula }, "Z1");

const SALES = {
  A1: "Region", B1: "Product", C1: "Units", D1: "Revenue",
  A2: "North", B2: "Pen", C2: "10", D2: "100",
  A3: "South", B3: "Pen", C3: "20", D3: "200",
  A4: "North", B4: "Book", C4: "5", D4: "250",
  A5: "North", B5: "Pen", C5: "7", D5: "70",
  A6: "South", B6: "Book", C6: "2", D6: "100",
};
const PRICES = { A1: "Code", B1: "Item", C1: "Price", A2: "P1", B2: "Pen", C2: "12", A3: "P2", B3: "Book", C3: "45", A4: "P3", B4: "Bag", C4: "800" };

describe("multi-condition functions", () => {
  it("SUMIFS, COUNTIFS, AVERAGEIFS, MAXIFS, MINIFS", () => {
    expect(f('=SUMIFS(D2:D6,A2:A6,"North",B2:B6,"Pen")', SALES)).toBe(170);
    expect(f('=COUNTIFS(A2:A6,"North",C2:C6,">=7")', SALES)).toBe(2);
    expect(f('=AVERAGEIFS(D2:D6,B2:B6,"Book")', SALES)).toBe(175);
    expect(f('=MAXIFS(D2:D6,A2:A6,"South")', SALES)).toBe(200);
    expect(f('=MINIFS(D2:D6,A2:A6,"North")', SALES)).toBe(70);
  });
  it("mismatched sizes and a missing pair are explained, not guessed", () => {
    const v = f('=SUMIFS(D2:D6,A2:A5,"North")', SALES);
    expect(isErr(v) && v.err).toBe("#VALUE!");
    const w = f("=SUMIFS(D2:D6,A2:A6)", SALES);
    expect(isErr(w) && w.err).toBe("#VALUE!");
  });
  it("SUMPRODUCT multiplies ranges and adds", () => expect(f("=SUMPRODUCT(C2:C6,D2:D6)", SALES)).toBe(10 * 100 + 20 * 200 + 5 * 250 + 7 * 70 + 2 * 100));
});

describe("lookups", () => {
  it("VLOOKUP exact and approximate", () => {
    expect(f('=VLOOKUP("P2",A2:C4,3,FALSE)', PRICES)).toBe(45);
    expect(f('=VLOOKUP("p3",A2:C4,2,FALSE)', PRICES)).toBe("Bag");
    const grades = { A1: "0", B1: "F", A2: "40", B2: "D", A3: "60", B3: "C", A4: "75", B4: "B", A5: "90", B5: "A" };
    expect(f("=VLOOKUP(82,A1:B5,2,TRUE)", grades)).toBe("B");
    expect(f("=VLOOKUP(40,A1:B5,2)", grades)).toBe("D");
  });
  it("VLOOKUP reports a missing key and a bad column", () => {
    const miss = f('=VLOOKUP("P9",A2:C4,3,FALSE)', PRICES);
    expect(isErr(miss) && miss.err).toBe("#N/A");
    const col = f('=VLOOKUP("P1",A2:C4,9,FALSE)', PRICES);
    expect(isErr(col) && col.err).toBe("#REF!");
    expect(f('=IFERROR(VLOOKUP("P9",A2:C4,3,FALSE),"none")', PRICES)).toBe("none");
    expect(f('=IFNA(VLOOKUP("P9",A2:C4,3,FALSE),"none")', PRICES)).toBe("none");
  });
  it("HLOOKUP reads across", () => {
    const t = { A1: "Q1", B1: "Q2", C1: "Q3", A2: "100", B2: "150", C2: "90" };
    expect(f('=HLOOKUP("Q2",A1:C2,2,FALSE)', t)).toBe(150);
  });
  it("XLOOKUP finds in one range and returns from another, with a not-found answer", () => {
    expect(f('=XLOOKUP("Book",B2:B4,C2:C4)', PRICES)).toBe(45);
    expect(f('=XLOOKUP("Lamp",B2:B4,C2:C4,"no such item")', PRICES)).toBe("no such item");
    const n = f('=XLOOKUP("Lamp",B2:B4,C2:C4)', PRICES);
    expect(isErr(n) && n.err).toBe("#N/A");
  });
  it("INDEX and MATCH work together, in both directions", () => {
    expect(f('=INDEX(C2:C4,MATCH("Bag",B2:B4,0))', PRICES)).toBe(800);
    expect(f("=INDEX(A2:C4,2,3)", PRICES)).toBe(45);
    expect(f('=MATCH("Book",B2:B4,0)', PRICES)).toBe(2);
    expect(f("=MATCH(50,A1:A5,1)", { A1: "10", A2: "30", A3: "50", A4: "70", A5: "90" })).toBe(3);
    expect(f("=INDEX(A1:C1,2)", { A1: "x", B1: "y", C1: "z" })).toBe("y");
    expect(isErr(f("=INDEX(A2:C4,9,1)", PRICES))).toBe(true);
  });
  it("CHOOSE, IFS and SWITCH", () => {
    expect(f('=CHOOSE(2,"a","b","c")')).toBe("b");
    expect(f('=IFS(A1>=90,"A",A1>=75,"B",TRUE,"C")', { A1: "80" })).toBe("B");
    expect(f('=SWITCH(A1,1,"one",2,"two","many")', { A1: "2" })).toBe("two");
    expect(f('=SWITCH(A1,1,"one",2,"two","many")', { A1: "9" })).toBe("many");
    expect(isErr(f('=IFS(A1>100,"x")', { A1: "5" }))).toBe(true);
  });
  it("lookups ignore a number that is stored as text and do not confuse 1 with TRUE", () => {
    const t = { A1: "1", B1: "one", A2: "2", B2: "two" };
    expect(f("=VLOOKUP(2,A1:B2,2,FALSE)", t)).toBe("two");
  });
});

describe("text", () => {
  it("LEN LEFT RIGHT MID", () => {
    expect(f('=LEN("GrowQR")')).toBe(6);
    expect(f('=LEFT("GrowQR",4)')).toBe("Grow");
    expect(f('=RIGHT("GrowQR",2)')).toBe("QR");
    expect(f('=MID("GrowQR",5,2)')).toBe("QR");
    expect(f('=LEFT("abc")')).toBe("a");
  });
  it("UPPER LOWER PROPER TRIM", () => {
    expect(f('=UPPER("asha")')).toBe("ASHA");
    expect(f('=LOWER("ASHA")')).toBe("asha");
    expect(f('=PROPER("aSHA kumar-singh")')).toBe("Asha Kumar-Singh");
    expect(f('=TRIM("  a   b  ")')).toBe("a b");
  });
  it("CONCAT, TEXTJOIN and & join text and numbers", () => {
    expect(f('=CONCAT("a",1,"b")')).toBe("a1b");
    expect(f('=CONCATENATE(A1," ",B1)', { A1: "Asha", B1: "Rao" })).toBe("Asha Rao");
    expect(f('=TEXTJOIN(", ",TRUE,A1:A4)', { A1: "x", A2: "", A3: "y", A4: "z" })).toBe("x, y, z");
    expect(f('=TEXTJOIN("-",FALSE,A1:A3)', { A1: "x", A3: "z" })).toBe("x--z");
  });
  it("SUBSTITUTE, FIND, SEARCH, REPT, VALUE", () => {
    expect(f('=SUBSTITUTE("a-b-c","-","")')).toBe("abc");
    expect(f('=SUBSTITUTE("a-b-c","-","+",2)')).toBe("a-b+c");
    expect(f('=FIND("Q","GrowQR")')).toBe(5);
    expect(isErr(f('=FIND("q","GrowQR")'))).toBe(true);
    expect(f('=SEARCH("q","GrowQR")')).toBe(5);
    expect(f('=REPT("ab",3)')).toBe("ababab");
    expect(f('=VALUE("1,250")')).toBe(1250);
    expect(f('=VALUE("12%")')).toBe(0.12);
  });
  it("TEXT formats numbers and dates", () => {
    expect(f('=TEXT(1234.5,"#,##0.00")')).toBe("1,234.50");
    expect(f('=TEXT(0.256,"0.0%")')).toBe("25.6%");
    expect(f('=TEXT(7,"0")')).toBe("7");
    expect(f('=TEXT(42,"0000")')).toBe("0042");
    expect(f('="INV-"&TEXT(3,"0000")')).toBe("INV-0003");
    expect(f('=TEXT(DATE(2026,1,5),"dd-mmm-yyyy")')).toBe("05-Jan-2026");
    expect(f('=TEXT(DATE(2026,3,9),"dddd")')).toBe("Monday");
    expect(f('=TEXT(A1,"mmmm yyyy")', { A1: "2026-07-04" })).toBe("July 2026");
  });
  it("the checks on type: ISNUMBER, ISTEXT, ISBLANK, ISERROR", () => {
    expect(f("=ISNUMBER(A1)", { A1: "5" })).toBe(true);
    expect(f("=ISTEXT(A1)", { A1: "five" })).toBe(true);
    expect(f("=ISBLANK(A9)")).toBe(true);
    expect(f("=ISERROR(1/0)")).toBe(true);
  });
});

describe("dates", () => {
  it("DATE, YEAR, MONTH, DAY and the serial number", () => {
    expect(f("=DATE(2026,1,1)")).toBe(46023);
    expect(f("=YEAR(DATE(2026,7,4))")).toBe(2026);
    expect(f("=MONTH(DATE(2026,7,4))")).toBe(7);
    expect(f("=DAY(DATE(2026,7,4))")).toBe(4);
    expect(f("=DATE(2026,14,1)")).toBe(f("=DATE(2027,2,1)"));
  });
  it("an ISO date typed in a cell works in sums, differences and date functions", () => {
    expect(f("=B1-A1", { A1: "2026-01-01", B1: "2026-03-01" })).toBe(59);
    expect(f("=YEAR(A1)", { A1: "2026-07-04" })).toBe(2026);
    expect(f("=DAYS(B1,A1)", { A1: "2026-01-01", B1: "2026-01-31" })).toBe(30);
    expect(isErr(f("=YEAR(A1)", { A1: "yesterday" }))).toBe(true);
    expect(isErr(f("=YEAR(A1)", { A1: "2026-02-31" }))).toBe(true);
  });
  it("EDATE, EOMONTH, WEEKDAY, DATEDIF, NETWORKDAYS", () => {
    expect(formatValue(f('=EDATE("2026-01-31",1)'), { num: "date" })).toBe("28-Feb-2026");
    expect(formatValue(f('=EOMONTH("2026-02-10",0)'), { num: "date" })).toBe("28-Feb-2026");
    expect(formatValue(f('=EOMONTH("2026-02-10",1)'), { num: "date" })).toBe("31-Mar-2026");
    expect(f('=WEEKDAY("2026-03-09")')).toBe(2);
    expect(f('=WEEKDAY("2026-03-09",2)')).toBe(1);
    expect(f('=DATEDIF("2020-05-15","2026-05-14","Y")')).toBe(5);
    expect(f('=DATEDIF("2020-05-15","2026-05-15","Y")')).toBe(6);
    expect(f('=DATEDIF("2026-01-31","2026-03-30","M")')).toBe(1);
    expect(f('=NETWORKDAYS("2026-03-02","2026-03-08")')).toBe(5);
  });
  it("the date format shows a serial as a date and leaves other numbers alone", () => {
    expect(formatValue(46023, { num: "date" })).toBe("01-Jan-2026");
    expect(formatValue(5, {})).toBe("5");
  });
});

describe("statistics and rounding", () => {
  it("LARGE, SMALL, RANK, PRODUCT, COUNTBLANK, ROWS, COLUMNS", () => {
    const t = { A1: "30", A2: "10", A3: "20", A4: "", A5: "40" };
    expect(f("=LARGE(A1:A5,2)", t)).toBe(30);
    expect(f("=SMALL(A1:A5,1)", t)).toBe(10);
    expect(f("=RANK(30,A1:A5)", t)).toBe(2);
    expect(f("=RANK(30,A1:A5,1)", t)).toBe(3);
    expect(f("=PRODUCT(2,3,4)")).toBe(24);
    expect(f("=COUNTBLANK(A1:A5)", t)).toBe(1);
    expect(f("=ROWS(A1:C4)")).toBe(4);
    expect(f("=COLUMNS(A1:C4)")).toBe(3);
  });
  it("CEILING, FLOOR, TRUNC", () => {
    expect(f("=CEILING(23,5)")).toBe(25);
    expect(f("=FLOOR(23,5)")).toBe(20);
    expect(f("=TRUNC(7.89)")).toBe(7);
    expect(f("=TRUNC(7.891,2)")).toBe(7.89);
  });
});

describe("finance", () => {
  it("NPV, IRR, PV, NPER, RATE agree with Excel", () => {
    expect(f("=NPV(0.1,100,200,300)")).toBeCloseTo(100 / 1.1 + 200 / 1.21 + 300 / 1.331, 6);
    const flows = { A1: "-1000", A2: "300", A3: "400", A4: "500" };
    expect(f("=IRR(A1:A4)", flows) as number).toBeCloseTo(0.0888, 3);
    expect(f("=PV(0.01,12,-100)") as number).toBeCloseTo(1125.51, 2);
    expect(f("=NPER(0.01,-100,1000)") as number).toBeCloseTo(10.59, 2);
    expect(f("=RATE(12,-100,1125.51)") as number).toBeCloseTo(0.01, 4);
    expect(isErr(f("=IRR(A1:A3)", { A1: "10", A2: "20", A3: "30" }))).toBe(true);
  });
});

describe("registry", () => {
  it("lists the new functions as supported, and an unknown name is still #NAME?", () => {
    for (const n of ["SUMIFS", "XLOOKUP", "INDEX", "MATCH", "TEXT", "DATE", "NPV", "IFS"]) expect(SUPPORTED_FUNCTIONS).toContain(n);
    const v = f("=FOO(1)");
    expect(isErr(v) && v.err).toBe("#NAME?");
  });
});

describe("statistics for data analysis", () => {
  const D = { A1: "2", A2: "4", A3: "4", A4: "4", A5: "5", A6: "5", A7: "7", A8: "9" };
  const X = { A1: "1", A2: "2", A3: "3", A4: "4", A5: "5", B1: "2", B2: "4", B3: "5", B4: "4", B5: "5" };
  it("percentiles, quartiles, percent rank and mode", () => {
    expect(f("=PERCENTILE(A1:A8,0.25)", D)).toBe(4);
    expect(f("=QUARTILE(A1:A8,3)", D)).toBe(5.5);
    expect(f("=QUARTILE.INC(A1:A8,2)", D)).toBe(4.5);
    expect(f("=QUARTILE(A1:A8,0)", D)).toBe(2);
    expect(f("=QUARTILE(A1:A8,4)", D)).toBe(9);
    expect(f("=PERCENTRANK.INC(A1:A8,5)", D)).toBe(0.571);
    expect(f("=MODE(A1:A8)", D)).toBe(4);
    expect(isErr(f("=MODE(A1:A3)", { A1: "1", A2: "2", A3: "3" }))).toBe(true);
    expect(isErr(f("=QUARTILE(A1:A8,5)", D))).toBe(true);
  });
  it("sample and population spread", () => {
    expect(f("=STDEV.P(A1:A8)", D)).toBeCloseTo(2, 9);
    expect(f("=STDEV.S(A1:A8)", D)).toBeCloseTo(2.138089935, 8);
    expect(f("=VAR.P(A1:A8)", D)).toBeCloseTo(4, 9);
    expect(f("=VAR.S(A1:A8)", D)).toBeCloseTo(32 / 7, 9);
    expect(f("=GEOMEAN(1,4)")).toBeCloseTo(2, 9);
    expect(f("=SUMSQ(1,2,3)")).toBe(14);
  });
  it("regression helpers", () => {
    expect(f("=RSQ(B1:B5,A1:A5)", X)).toBeCloseTo(0.6, 9);
    expect(f("=FORECAST(6,B1:B5,A1:A5)", X)).toBeCloseTo(5.8, 9);
    expect(f("=FORECAST.LINEAR(0,B1:B5,A1:A5)", X)).toBeCloseTo(2.2, 9);
    expect(f("=COVARIANCE.S(A1:A5,B1:B5)", X)).toBeCloseTo(1.5, 9);
    expect(f("=COVARIANCE.P(A1:A5,B1:B5)", X)).toBeCloseTo(1.2, 9);
  });
  it("z-scores and the normal distribution", () => {
    expect(f("=STANDARDIZE(9,5,2)")).toBe(2);
    expect(f("=NORM.S.DIST(0,TRUE)")).toBeCloseTo(0.5, 6);
    expect(f("=NORM.S.DIST(1.96,TRUE)")).toBeCloseTo(0.9750021, 5);
    expect(f("=NORM.DIST(110,100,10,TRUE)")).toBeCloseTo(0.8413447, 5);
    expect(f("=NORM.DIST(100,100,10,FALSE)")).toBeCloseTo(0.0398942, 6);
    expect(isErr(f("=STANDARDIZE(1,0,0)"))).toBe(true);
  });
});
