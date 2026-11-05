import { describe, expect, it } from "vitest";
import { computeViz, type VizData, type VizSpec } from "./engine";
import { formatValue, layoutViz, niceTicks } from "./layout";

const DATA: VizData = {
  fields: [
    { name: "Region", role: "dimension", type: "string" }, { name: "Category", role: "dimension", type: "string" },
    { name: "Order Date", role: "dimension", type: "date" }, { name: "Sales", role: "measure", type: "number" }, { name: "Profit", role: "measure", type: "number" },
  ],
  rows: [["West", "A", "2025-01-10", 99125, 20], ["East", "B", "2025-02-10", 7584, -10], ["West", "B", "2025-03-10", 28556, 30], ["East", "A", "2025-03-11", 500, -5]],
};
const draw = (spec: VizSpec) => { const r = computeViz(DATA, spec); if (!r.ok) throw new Error(r.error); return layoutViz(r); };

describe("viz layout", () => {
  it("the ticks always reach the largest value, so no bar sticks out of the chart", () => {
    for (const max of [99125, 7, 1234, 80000, 0.9, 1_000_000]) { const t = niceTicks(0, max); expect(t[t.length - 1]).toBeGreaterThanOrEqual(max); expect(t[0]).toBe(0); }
    expect(niceTicks(-3473, 2116).some((v) => v === 0)).toBe(true);
  });
  it("a bar chart draws one bar per mark, a stacked one per segment", () => {
    const d = draw({ columns: [{ field: "Region" }], rows: [{ field: "Sales" }] });
    expect(d.shapes.filter((s) => s.t === "rect")).toHaveLength(2);
    expect(d.caption).toMatch(/bar chart of SUM\(Sales\) by Region/);
    const s = draw({ columns: [{ field: "Region" }], rows: [{ field: "Sales" }], color: { field: "Category" } });
    expect(s.shapes.filter((x) => x.t === "rect")).toHaveLength(4);
    expect(s.legend.map((l) => l.label)).toEqual(["A", "B"]);
  });
  it("lines, scatter, heat map, pie and tables each draw something sensible", () => {
    expect(draw({ columns: [{ field: "Order Date", date: "month" }], rows: [{ field: "Sales" }] }).shapes.some((s) => s.t === "path")).toBe(true);
    expect(draw({ columns: [{ field: "Sales" }], rows: [{ field: "Profit" }], detail: [{ field: "Region" }] }).shapes.filter((s) => s.t === "circle")).toHaveLength(2);
    expect(draw({ mark: "square", columns: [{ field: "Region" }], rows: [{ field: "Category" }], color: { field: "Profit" } }).shapes.filter((s) => s.t === "rect")).toHaveLength(4);
    expect(draw({ mark: "pie", columns: [], rows: [], size: { field: "Sales" }, color: { field: "Category" } }).shapes.filter((s) => s.t === "path")).toHaveLength(2);
    const t = draw({ columns: [{ field: "Region" }], rows: [{ field: "Category" }], label: { field: "Sales" } });
    expect(t.table?.headers).toEqual(["Category / Region", "East", "West"]);
    expect(draw({ columns: [], rows: [] }).caption).toMatch(/Drag fields/);
  });
  it("numbers read well", () => {
    expect(formatValue(1234567)).toBe("12,34,567");
    expect(formatValue(0.5, "% of total of SUM(Sales)")).toBe("50%");
    expect(formatValue(null)).toBe("");
    expect(formatValue(12.3456)).toBe("12.35");
  });
});
