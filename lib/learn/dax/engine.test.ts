import { describe, expect, it } from "vitest";
import { Dax, runDax, type DaxModel, type DaxValue } from "./engine";
import { parseDefinitions } from "./parser";

const MODEL: DaxModel = {
  tables: [
    { name: "Products", columns: ["ProductID", "Product", "Category", "Price"], rows: [["P1", "Pen", "Stationery", 10], ["P2", "Book", "Stationery", 50], ["P3", "Lamp", "Home", 100]] },
    { name: "Stores", columns: ["StoreID", "Store", "Region"], rows: [["S1", "Pune", "North"], ["S2", "Chennai", "South"]] },
    { name: "Sales", columns: ["SaleID", "Date", "ProductID", "StoreID", "Qty", "Amount"], rows: [
      [1, "2024-01-10", "P1", "S1", 5, 50], [2, "2024-02-15", "P2", "S1", 2, 100], [3, "2024-03-20", "P3", "S2", 1, 100],
      [4, "2025-01-12", "P1", "S1", 10, 100], [5, "2025-02-10", "P2", "S2", 4, 200], [6, "2025-03-05", "P3", "S1", 3, 300], [7, "2025-03-25", "P1", "S2", 6, 60],
    ] },
    { name: "Dates", columns: [], rows: [], calendar: { from: "2024-01-01", to: "2025-12-31" } },
  ],
  relationships: [{ many: "Sales[ProductID]", one: "Products[ProductID]" }, { many: "Sales[StoreID]", one: "Stores[StoreID]" }, { many: "Sales[Date]", one: "Dates[Date]" }],
  measures: { "Total Sales": "SUM(Sales[Amount])" },
  dateTable: "Dates",
};
const m = (defs: string, name: string, filters: Record<string, DaxValue[]> = {}): DaxValue => new Dax(MODEL, parseDefinitions(defs)).cell(name, filters);
const err = (defs: string, name: string, filters: Record<string, DaxValue[]> = {}): string => { try { m(defs, name, filters); } catch (e) { return (e as Error).message + " " + ((e as { hint?: string }).hint ?? ""); } throw new Error("expected an error"); };

describe("dax: filter context and relationships", () => {
  it("aggregates over the visible rows, and filters flow from dimension tables to the fact table", () => {
    expect(m("X = SUM(Sales[Amount])", "X")).toBe(910);
    expect(m("X = SUM(Sales[Amount])", "X", { "Products[Category]": ["Home"] })).toBe(400);
    expect(m("X = SUM(Sales[Amount])", "X", { "Stores[Region]": ["North"] })).toBe(550);
    expect(m("X = SUM(Sales[Amount])", "X", { "Stores[Region]": ["North"], "Dates[Year]": [2025] })).toBe(400);
    expect(m("X = COUNTROWS(Sales)", "X")).toBe(7);
    expect(m("X = DISTINCTCOUNT(Sales[ProductID])", "X", { "Dates[Year]": [2024] })).toBe(3);
    expect(m("X = AVERAGE(Sales[Qty])", "X")).toBeCloseTo(31 / 7, 6);
    expect(m("X = SUM(Sales[Amount])", "X", { "Products[Category]": ["Nothing"] })).toBeNull();
  });
  it("measures can use other measures", () => {
    expect(m("Half = [Total Sales] / 2", "Half")).toBe(455);
    expect(m("A = [Total Sales]\nB = [A] * 2", "B", { "Products[Category]": ["Home"] })).toBe(800);
  });
});

describe("dax: CALCULATE", () => {
  it("replaces a filter on a column, and adds filters on other columns", () => {
    expect(m("X = CALCULATE([Total Sales], Products[Category] = \"Home\")", "X")).toBe(400);
    expect(m("X = CALCULATE([Total Sales], Products[Category] = \"Home\")", "X", { "Products[Category]": ["Stationery"] })).toBe(400); // replaced
    expect(m("X = CALCULATE([Total Sales], Stores[Region] = \"North\")", "X", { "Products[Category]": ["Home"] })).toBe(300); // added
    expect(m("X = CALCULATE([Total Sales], Dates[Year] = 2025, Products[Category] <> \"Home\")", "X")).toBe(360);
    expect(m("X = CALCULATE([Total Sales], Products[Category] IN { \"Home\", \"Stationery\" })", "X")).toBe(910);
    expect(m("X = CALCULATE([Total Sales], Sales[Qty] >= 5)", "X")).toBe(210); // qty 5, 10, 6 = 50 + 100 + 60
  });
  it("ALL removes filters, ALLEXCEPT keeps some, KEEPFILTERS intersects instead of replacing", () => {
    expect(m("X = CALCULATE([Total Sales], ALL(Products))", "X", { "Products[Category]": ["Home"] })).toBe(910);
    expect(m("X = CALCULATE([Total Sales], ALL(Products[Category]))", "X", { "Products[Category]": ["Home"] })).toBe(910);
    expect(m("X = CALCULATE([Total Sales], ALLEXCEPT(Products, Products[Category]))", "X", { "Products[Category]": ["Home"], "Products[Product]": ["Lamp"] })).toBe(400);
    expect(m("X = CALCULATE([Total Sales], REMOVEFILTERS())", "X", { "Stores[Region]": ["North"] })).toBe(910);
    expect(m("X = CALCULATE([Total Sales], KEEPFILTERS(Products[Category] = \"Home\"))", "X", { "Products[Category]": ["Stationery"] })).toBeNull();
    expect(m("X = CALCULATE([Total Sales], KEEPFILTERS(Products[Category] = \"Home\"))", "X", { "Products[Category]": ["Stationery", "Home"] })).toBe(400);
  });
  it("percent of total with DIVIDE, and FILTER with a condition on several columns", () => {
    expect(m("X = ROUND(DIVIDE([Total Sales], CALCULATE([Total Sales], ALL(Products))), 4)", "X", { "Products[Category]": ["Stationery"] })).toBe(0.5604);
    expect(m("X = CALCULATE([Total Sales], FILTER(Sales, Sales[Qty] >= 5 && Sales[Amount] > 60))", "X")).toBe(100);
    expect(m("X = CALCULATE([Total Sales], FILTER(ALL(Products), Products[Price] >= 50))", "X")).toBe(700);
  });
});

describe("dax: iterators and row context", () => {
  it("SUMX with RELATED, and context transition when a measure is used inside an iterator", () => {
    expect(m("X = SUMX(Sales, Sales[Qty] * RELATED(Products[Price]))", "X")).toBe(910);
    expect(m("X = SUMX(Products, [Total Sales])", "X")).toBe(910);
    expect(m("X = AVERAGEX(VALUES(Products[Category]), [Total Sales])", "X")).toBe(455);
    expect(m("X = MAXX(VALUES(Products[Category]), [Total Sales])", "X")).toBe(510);
    expect(m("X = COUNTX(Sales, Sales[Qty])", "X")).toBe(7);
    expect(m("X = SUMX(FILTER(Sales, Sales[Qty] > 4), Sales[Amount])", "X")).toBe(210);
  });
});

describe("dax: logic and variables", () => {
  it("IF, SWITCH, VAR and RETURN, SELECTEDVALUE, HASONEVALUE", () => {
    const size = "Size =\n  VAR t = [Total Sales]\n  RETURN IF(t >= 500, \"big\", \"small\")";
    expect(m(size, "Size", { "Products[Category]": ["Stationery"] })).toBe("big");
    expect(m(size, "Size", { "Products[Category]": ["Home"] })).toBe("small");
    expect(m("X = SWITCH(TRUE(), [Total Sales] > 800, \"high\", [Total Sales] > 300, \"mid\", \"low\")", "X")).toBe("high");
    expect(m("X = SWITCH(SELECTEDVALUE(Products[Category]), \"Home\", 1, \"Stationery\", 2, 0)", "X", { "Products[Category]": ["Home"] })).toBe(1);
    expect(m("X = SELECTEDVALUE(Products[Category], \"all\")", "X")).toBe("all");
    expect(m("X = IF(HASONEVALUE(Products[Category]), 1, 0)", "X", { "Products[Category]": ["Home"] })).toBe(1);
    expect(m("X = COALESCE(CALCULATE([Total Sales], Products[Category] = \"Nothing\"), 0)", "X")).toBe(0);
    expect(m("X = DIVIDE(1, 0, -1)", "X")).toBe(-1);
    expect(m("X = ISBLANK(CALCULATE([Total Sales], Dates[Year] = 2023))", "X")).toBe(true);
    expect(m("X = ROUND(2.675 * 3, 1) + ABS(-1) + INT(2.9)", "X")).toBe(11); // 8.0 + 1 + 2
  });
});

describe("dax: time intelligence", () => {
  it("same period last year, year to date and date shifting", () => {
    expect(m("X = CALCULATE([Total Sales], SAMEPERIODLASTYEAR(Dates[Date]))", "X", { "Dates[Year]": [2025] })).toBe(250);
    expect(m("X = CALCULATE([Total Sales], SAMEPERIODLASTYEAR(Dates[Date]))", "X", { "Dates[Year]": [2025], "Dates[Month]": ["Mar"] })).toBe(100);
    expect(m("X = TOTALYTD([Total Sales], Dates[Date])", "X", { "Dates[Year]": [2025], "Dates[Month]": ["Mar"] })).toBe(660);
    expect(m("X = TOTALYTD([Total Sales], Dates[Date])", "X", { "Dates[Year]": [2025], "Dates[Month]": ["Feb"] })).toBe(300);
    expect(m("X = CALCULATE([Total Sales], DATESYTD(Dates[Date]))", "X", { "Dates[Year]": [2024], "Dates[Month]": ["Feb"] })).toBe(150);
    expect(m("X = CALCULATE([Total Sales], DATEADD(Dates[Date], -1, YEAR))", "X", { "Dates[Year]": [2025] })).toBe(250);
    expect(m("X = CALCULATE([Total Sales], PREVIOUSMONTH(Dates[Date]))", "X", { "Dates[Year]": [2025], "Dates[Month]": ["Mar"] })).toBe(200);
    expect(m("Growth = DIVIDE([Total Sales] - CALCULATE([Total Sales], SAMEPERIODLASTYEAR(Dates[Date])), CALCULATE([Total Sales], SAMEPERIODLASTYEAR(Dates[Date])))", "Growth", { "Dates[Year]": [2025] })).toBeCloseTo(1.64, 6);
  });
});

describe("dax: the matrix", () => {
  it("builds rows, a total column for column fields, and a total row", () => {
    const r = runDax(MODEL, "X = SUM(Sales[Amount])", [{ label: "by category and year", rows: ["Products[Category]"], cols: ["Dates[Year]"] }], "X");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const mx = r.matrices[0];
    expect(mx.headers).toEqual(["2024", "2025", "Total"]);
    expect(mx.rows.map((x) => [x.header[0], ...x.cells])).toEqual([["Stationery", 150, 360, 510], ["Home", 100, 300, 400]]);
    expect(mx.total).toEqual([250, 660, 910]);
  });
  it("hides rows whose values are all blank, like Power BI", () => {
    const r = runDax(MODEL, "X = CALCULATE([Total Sales], SAMEPERIODLASTYEAR(Dates[Date]))", [{ label: "by year", rows: ["Dates[Year]"] }], "X");
    expect(r.ok && r.matrices[0].rows.map((x) => [x.header[0], x.cells[0]])).toEqual([[2025, 250]]);
  });
});

describe("dax: friendly errors", () => {
  it("names unknown tables, columns, measures and functions, and suggests the likely word", () => {
    expect(err("X = SUM(Sales[Amout])", "X")).toMatch(/no column called "Amout"[\s\S]*Sales\[Amount\]/);
    expect(err("X = SUM(Sale[Amount])", "X")).toMatch(/no table called "Sale"[\s\S]*Sales/);
    expect(err("X = [Total Sale] * 2", "X")).toMatch(/no measure called \[Total Sale\][\s\S]*Total Sales/);
    expect(err("X = SUMM(Sales[Amount])", "X")).toMatch(/not a function[\s\S]*SUM/);
    expect(err("X = RANKX(Products, [Total Sales])", "X")).toMatch(/does not support it/);
  });
  it("explains the classic DAX mistakes", () => {
    expect(err("X = Sales[Amount]", "X")).toMatch(/multiple values[\s\S]*SUM/);
    expect(err("X = [Total Sales] / 0", "X")).toMatch(/division by zero[\s\S]*DIVIDE/);
    expect(err("X = 5 + \"a\"", "X")).toMatch(/text/);
    expect(err("X = SUM(Sales[Amount], 1)", "X")).toMatch(/needs 1 argument/);
    expect(err("X = CALCULATE([Total Sales], 5)", "X")).toMatch(/true\/false/);
    expect(err("X = CALCULATE([Total Sales], Products[Category] = \"Home\" && Stores[Region] = \"North\")", "X")).toMatch(/only one table/);
    expect(err("A = [B]\nB = [A]", "A")).toMatch(/refers back to itself/);
  });
  it("explains syntax slips", () => {
    expect(() => parseDefinitions("X = SUM(Sales[Amount]")).toThrow(/closing bracket/);
    expect(() => parseDefinitions("X = SUM(Sales[Amount)")).toThrow(/never closed/);
    expect(() => parseDefinitions("X = ")).toThrow(/no formula/);
    expect(() => parseDefinitions("SUM(Sales[Amount])")).toThrow(/starts with its name/);
    expect(() => parseDefinitions("X = VAR a = 1")).toThrow(/RETURN/);
    expect(() => parseDefinitions("X = 1 +")).toThrow(/stops too soon/);
  });
  it("reads several measures, multi-line formulas and comments", () => {
    const d = parseDefinitions("// total\nTotal = SUM(Sales[Amount])\n\nHome Share =\n  DIVIDE(\n    CALCULATE([Total], Products[Category] = \"Home\"),\n    [Total]\n  )");
    expect(d.map((x) => x.name)).toEqual(["Total", "Home Share"]);
  });
});
