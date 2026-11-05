"use client";

/** Downloads the table with the given id as CSV, in the browser. Cells that start with = + - @ are prefixed so a spreadsheet never runs them as formulas. */
export function CsvButton({ tableId, name }: { tableId: string; name: string }) {
  const go = () => {
    const t = document.getElementById(tableId);
    if (!t) return;
    const cell = (v: string) => {
      const s = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
      return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = Array.from(t.querySelectorAll("tr")).filter((r) => !r.querySelector("td[colspan]")).map((r) => Array.from(r.children).map((c) => cell((c.textContent ?? "").trim())).join(","));
    const url = URL.createObjectURL(new Blob(["﻿" + lines.join("\n") + "\n"], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `growqr-${name.replace(/[^a-z0-9_]/g, "")}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };
  return <button type="button" onClick={go} title="Download as CSV" className="min-h-[36px] px-3 rounded-md border border-black/[0.15] text-[12px] font-semibold hover:bg-cream-2">CSV</button>;
}
