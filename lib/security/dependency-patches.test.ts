import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guards the manual dependency patches (see SECURITY-NOTES.md). If a later `npm install` brings back an unpatched copy, these fail.
 */
const req = createRequire(import.meta.url);
// Read package.json straight from disk: some packages (sharp) do not export it through require().
const version = (name: string): string => (JSON.parse(readFileSync(path.join(process.cwd(), "node_modules", name, "package.json"), "utf8")) as { version: string }).version;
const atLeast = (v: string, min: string): boolean => {
  const a = v.split(".").map(Number), b = min.split(".").map(Number);
  for (let i = 0; i < 3; i++) { if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0); }
  return true;
};

describe("patched dependencies", () => {
  it("braces: refuses deeply nested patterns instead of exhausting the stack (GHSA-vfj7-8cjw-p6xm)", () => {
    const braces = req("braces") as { (p: string): string[]; expand(p: string): string[] };
    expect(atLeast(version("braces"), "3.0.4")).toBe(true);
    expect(braces.expand("a{b,c}d")).toEqual(["abd", "acd"]);
    expect(braces("{1..3}")).toBeTruthy();
    const deep = "{".repeat(4900) + "a,b" + "}".repeat(4900); // within the 10,000 character limit
    expect(() => braces.expand(deep)).toThrow(/Brace nesting/);
    expect(() => braces(deep)).toThrow(/Brace nesting/);
    const ok = "{a,".repeat(60) + "x" + "}".repeat(60);
    expect(() => braces.expand(ok)).not.toThrow(); // ordinary use is unaffected
  });
  it("sharp, source-map-js and postcss-selector-parser are at their patched versions", () => {
    expect(atLeast(version("sharp"), "0.35.5")).toBe(true);
    expect(atLeast(version("source-map-js"), "1.2.2")).toBe(true);
    expect(atLeast(version("postcss-selector-parser"), "7.1.6")).toBe(true);
  });
});
