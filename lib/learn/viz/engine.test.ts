import { describe, expect, it } from "vitest";
import { computeViz, type Cell, type VizData, type VizResult, type VizSpec } from "./engine";
import { parseCalc } from "./calc";

const DATA: VizData = {
  fields: [
    { name: "Order Date", role: "dimension", type: "date" }, { name: "Region", role: "dimension", type: "string" }, { name: "Category", role: "dimension", type: "string" },
    { name: "Customer", role: "dimension", type: "string" }, { name: "Sales", role: "measure", type: "number" }, { name: "Profit", role: "measure", type: "number" },
  ],
  rows: [
    ["2025-01-15", "West", "Furniture", "A", 100, 20], ["2025-01-20", "East", "Furniture", "B", 200, -10], ["2025-02-10", "West", "Technology", "A", 300, 90], ["2025-02-20", "East", "Technology", "C", 400, 100],
    ["2025-03-05", "West", "Furniture", "B", 150, 30], ["2025-03-15", "East", "Office", "A", 50, 5], ["2025-03-25", "West", "Office", "C", 120, 24], ["2025-03-30", "East", "Technology", "B", 250, 50],
  ],
  calcs: {},
};
const run = (spec: VizSpec, calcs: Record<string, string> = {}): VizResult => {
  const r = computeViz({ ...DATA, calcs }, spec);
  if (!r.ok) throw new Error(r.error + " " + (r.hint ?? ""));
  return r;
};
const fail = (spec: VizSpec, calcs: Record<string, string> = {}): string => { const r = computeViz({ ...DATA, calcs }, spec); if (r.ok) throw new Error("expected an error"); return r.error + " " + (r.hint ?? ""); };
const flat = (r: VizResult): Cell[][] => r.points.map((p) => [...p.dims, ...p.meas]);

describe("viz: the basic charts", () => {
  it("a bar chart: a dimension on Columns and a measure on Rows", () => {
    const r = run({ columns: [{ field: "Region" }], rows: [{ field: "Sales" }] });
    expect(r.kind).toBe("bar-v");
    expect(r.measLabels).toEqual(["SUM(Sales)"]);
    expect(flat(r)).toEqual([["East", 900], ["West", 670]]);
  });
  it("a horizontal bar chart when the measure is on Columns, sorted, with a top N", () => {
    const r = run({ columns: [{ field: "Sales" }], rows: [{ field: "Category" }], sort: { dir: "desc" } });
    expect(r.kind).toBe("bar-h");
    expect(flat(r)).toEqual([["Technology", 950], ["Furniture", 450], ["Office", 170]]);
    expect(flat(run({ columns: [{ field: "Sales" }], rows: [{ field: "Category" }], sort: { dir: "asc" }, top: 2 }))).toEqual([["Office", 170], ["Furniture", 450]]);
  });
  it("a stacked bar chart: a Color dimension splits each bar", () => {
    const r = run({ columns: [{ field: "Region" }], rows: [{ field: "Sales" }], color: { field: "Category" } });
    expect(r.seriesDim).toBe(1);
    expect(flat(r)).toEqual([["East", "Furniture", 200], ["East", "Office", 50], ["East", "Technology", 650], ["West", "Furniture", 250], ["West", "Office", 120], ["West", "Technology", 300]]);
  });
  it("a line chart: a date on Columns is a line, at the level you choose", () => {
    const r = run({ columns: [{ field: "Order Date", date: "month" }], rows: [{ field: "Sales" }] });
    expect(r.kind).toBe("line");
    expect(r.dimLabels).toEqual(["MONTH(Order Date)"]);
    expect(flat(r)).toEqual([["Jan 2025", 300], ["Feb 2025", 700], ["Mar 2025", 570]]);
    expect(flat(run({ columns: [{ field: "Order Date" }], rows: [{ field: "Sales" }] }))).toEqual([["2025", 1570]]);
    expect(run({ mark: "bar", columns: [{ field: "Order Date", date: "month" }], rows: [{ field: "Sales" }] }).kind).toBe("bar-v");
  });
  it("a scatter plot: measures on both shelves, one mark per detail value", () => {
    const r = run({ columns: [{ field: "Sales" }], rows: [{ field: "Profit" }], detail: [{ field: "Customer" }] });
    expect(r.kind).toBe("scatter");
    expect(flat(r)).toEqual([["A", 450, 115], ["B", 600, 70], ["C", 520, 124]]);
  });
  it("a text table and a heat map: dimensions on both shelves", () => {
    const t = run({ columns: [{ field: "Region" }], rows: [{ field: "Category" }], label: { field: "Sales" } });
    expect(t.kind).toBe("crosstab");
    const h = run({ mark: "square", columns: [{ field: "Region" }], rows: [{ field: "Category" }], color: { field: "Profit" } });
    expect(h.kind).toBe("heat");
    expect(flat(h).find((x) => x[0] === "West" && x[1] === "Technology")).toEqual(["West", "Technology", 90]);
  });
  it("a pie chart: a measure for the angle, a dimension for the colour", () => {
    const r = run({ mark: "pie", columns: [], rows: [], size: { field: "Sales" }, color: { field: "Category" } });
    expect(r.kind).toBe("pie");
    expect(flat(r)).toEqual([["Furniture", 450], ["Office", 170], ["Technology", 950]]);
  });
  it("aggregations other than SUM, and counting a dimension", () => {
    expect(flat(run({ columns: [{ field: "Region" }], rows: [{ field: "Sales", agg: "avg" }] }))).toEqual([["East", 225], ["West", 167.5]]);
    expect(flat(run({ columns: [{ field: "Region" }], rows: [{ field: "Customer", agg: "countd" }] }))).toEqual([["East", 3], ["West", 3]]);
    expect(flat(run({ columns: [{ field: "Region" }], rows: [{ field: "Sales", agg: "max" }] }))).toEqual([["East", 400], ["West", 300]]);
    expect(fail({ columns: [{ field: "Region" }], rows: [{ field: "Category", agg: "sum" }] })).toMatch(/cannot be used on the dimension/);
  });
});

describe("viz: filters, quick table calculations", () => {
  it("dimension filters keep rows; measure filters keep marks", () => {
    expect(flat(run({ columns: [{ field: "Region" }], rows: [{ field: "Sales" }], filters: [{ field: "Category", values: ["Technology"] }] }))).toEqual([["East", 650], ["West", 300]]);
    expect(flat(run({ columns: [{ field: "Region" }], rows: [{ field: "Sales" }], filters: [{ field: "Sales", min: 800 }] }))).toEqual([["East", 900]]);
  });
  it("running total, percent of total, rank and difference along the axis", () => {
    const m = (quick: "running" | "pct" | "rank" | "diff"): Cell[] => run({ columns: [{ field: "Order Date", date: "month" }], rows: [{ field: "Sales", quick }] }).points.map((p) => p.meas[0]);
    expect(m("running")).toEqual([300, 1000, 1570]);
    expect(m("pct").map((v) => Math.round((v as number) * 1000) / 1000)).toEqual([0.191, 0.446, 0.363]);
    expect(m("rank")).toEqual([3, 1, 2]);
    expect(m("diff")).toEqual([null, 400, -130]);
    expect(run({ columns: [{ field: "Order Date", date: "month" }], rows: [{ field: "Sales", quick: "running" }] }).measLabels).toEqual(["Running total of SUM(Sales)"]);
  });
});

describe("viz: calculated fields", () => {
  it("an aggregate calculation is worked out per mark (a ratio of sums)", () => {
    const r = run({ columns: [{ field: "Region" }], rows: [{ field: "Profit Ratio" }] }, { "Profit Ratio": "SUM([Profit]) / SUM([Sales])" });
    expect(r.measLabels).toEqual(["Profit Ratio"]);
    expect(r.points.map((p) => Math.round((p.meas[0] as number) * 10000) / 10000)).toEqual([0.1611, 0.2448]);
  });
  it("a row-level text calculation becomes a dimension; a row-level number a measure", () => {
    const flag = run({ columns: [{ field: "Profit Flag" }], rows: [{ field: "Sales" }] }, { "Profit Flag": 'IF [Profit] < 0 THEN "Loss" ELSEIF [Profit] > 50 THEN "Big win" ELSE "Win" END' });
    expect(flat(flag)).toEqual([["Big win", 700], ["Loss", 200], ["Win", 670]]);
    const margin = run({ columns: [{ field: "Region" }], rows: [{ field: "Margin" }] }, { Margin: "[Sales] - [Profit]" });
    expect(flat(margin)).toEqual([["East", 755], ["West", 506]]);
    expect(flat(run({ columns: [{ field: "Region" }], rows: [{ field: "Size" }] }, { Size: 'CASE [Region] WHEN "West" THEN "W" ELSE "E" END' }))).toBeTruthy();
  });
  it("FIXED fixes the level of detail whatever is in the view", () => {
    const calcs = { "Region Total": "{ FIXED [Region] : SUM([Sales]) }", "Share of Region": "SUM([Sales]) / MAX([Region Total])" };
    const r = run({ columns: [{ field: "Region" }], rows: [{ field: "Share of Region" }], color: { field: "Category" } }, calcs);
    expect(r.points.map((p) => [p.dims[0], p.dims[1], Math.round((p.meas[0] as number) * 1000) / 1000])).toEqual([["East", "Furniture", 0.222], ["East", "Office", 0.056], ["East", "Technology", 0.722], ["West", "Furniture", 0.373], ["West", "Office", 0.179], ["West", "Technology", 0.448]]);
    expect(flat(run({ columns: [{ field: "Region" }], rows: [{ field: "Avg Customer Sales" }] }, { "Customer Total": "{ FIXED [Customer] : SUM([Sales]) }", "Avg Customer Sales": "AVG([Customer Total])" }))).toBeTruthy();
  });
  it("INCLUDE and EXCLUDE change the level of detail relative to the view", () => {
    const inc = run({ columns: [{ field: "Region" }], rows: [{ field: "Avg per Customer" }] }, { "Avg per Customer": "AVG({ INCLUDE [Customer] : SUM([Sales]) })" });
    expect(inc.points.map((p) => [p.dims[0], Math.round((p.meas[0] as number) * 1000) / 1000])).toEqual([["East", 300], ["West", 223.333]]);
    const exc = run({ columns: [{ field: "Region" }], rows: [{ field: "Share" }], color: { field: "Category" } }, { Share: "SUM([Sales]) / SUM({ EXCLUDE [Category] : SUM([Sales]) })" });
    expect(exc.points.find((p) => p.dims[0] === "West" && p.dims[1] === "Furniture")!.meas[0]).toBeCloseTo(250 / 670, 6);
  });
});

describe("viz: friendly errors", () => {
  it("explains unknown fields, mixed aggregates and syntax slips", () => {
    expect(fail({ columns: [{ field: "Regon" }], rows: [{ field: "Sales" }] })).toMatch(/no field called "Regon"/);
    expect(fail({ columns: [{ field: "Region" }], rows: [{ field: "X" }] }, { X: "SUM([Sales]) / [Profit]" })).toMatch(/without being aggregated/);
    expect(fail({ columns: [{ field: "Region" }], rows: [{ field: "X" }] }, { X: "SUM([Sale])" })).toMatch(/no field called \[Sale\][\s\S]*Sales/);
    expect(fail({ columns: [{ field: "Region" }], rows: [{ field: "X" }] }, { X: "IF [Sales] > 1 THEN 1" })).toMatch(/END/);
    expect(fail({ columns: [{ field: "Region" }], rows: [{ field: "X" }] }, { X: "SUM([Sales]" })).toMatch(/closing bracket/);
    expect(fail({ columns: [{ field: "Region" }], rows: [{ field: "X" }] }, { X: "{ INCLUDE [Customer] : SUM([Sales]) }" })).toMatch(/wrapped in an aggregate/);
    expect(() => parseCalc("")).toThrow(/empty/);
    expect(() => parseCalc("[Sales] +")).toThrow(/stops too soon/);
  });
  it("an empty view says what to do", () => {
    const r = run({ columns: [], rows: [] });
    expect(r.kind).toBe("empty");
    expect(r.note).toMatch(/Drag fields/);
  });
});
