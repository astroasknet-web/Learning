import { describe, expect, it } from "vitest";
import { alternatives, chips, effectiveSort, emptyQuery, hasFilters, highlight, parseQuery, tokenize, toHref, toParams } from "./catalog-query";

const KEYS = ["data", "ai", "design"];

describe("parseQuery", () => {
  it("keeps valid values and drops unknown ones", () => {
    const q = parseQuery(new URLSearchParams("q=  Python   Basics &cat=data,nope,ai&level=beginner,expert&len=short&price=u400,free&aud=College,Alien&available=1&sort=az&page=3&size=12"), KEYS);
    expect(q).toMatchObject({ q: "Python Basics", cat: ["data", "ai"], level: ["beginner"], len: ["short"], price: ["u400", "free"], aud: ["College"], available: true, sort: "az", page: 3, size: 12 });
  });
  it("rejects bad sorts, pages and sizes, and caps the phrase", () => {
    const q = parseQuery({ sort: "id; DROP TABLE courses", page: "-5", size: "9999", q: "x".repeat(300) }, KEYS);
    expect(q.sort).toBe("");
    expect(q.page).toBe(1);
    expect(q.size).toBe(24);
    expect(Array.from(q.q).length).toBe(80);
    expect(parseQuery({ page: "99999" }, KEYS).page).toBe(500);
  });
  it("relevance only applies to a search", () => {
    expect(parseQuery({ sort: "relevance" }, KEYS).sort).toBe("");
    expect(parseQuery({ sort: "relevance", q: "excel" }, KEYS).sort).toBe("relevance");
    expect(effectiveSort(parseQuery({ q: "excel" }, KEYS))).toBe("relevance");
    expect(effectiveSort(parseQuery({}, KEYS))).toBe("recommended");
  });
  it("strips control characters and squeezes whitespace", () => {
    expect(parseQuery({ q: "a\u0000b\n\tc" }, KEYS).q).toBe("a b c");
  });
});

describe("URL round trip", () => {
  it("writes only what differs from the default and reads back the same query", () => {
    const q = parseQuery(new URLSearchParams("q=excel&cat=data&level=beginner,advanced&sort=price-asc&page=2"), KEYS);
    expect(parseQuery(toParams(q), KEYS)).toEqual(q);
    expect(toHref(emptyQuery())).toBe("/courses");
    expect(toHref(q, { page: 1 })).not.toContain("page=");
  });
  it("hasFilters", () => {
    expect(hasFilters(emptyQuery())).toBe(false);
    expect(hasFilters({ ...emptyQuery(), price: ["free"] })).toBe(true);
  });
});

describe("tokenize", () => {
  it("lower-cases, drops filler and duplicates", () => {
    expect(tokenize("Courses for  Business Analytics")).toEqual(["business", "analytics"]);
    expect(tokenize("Python python PYTHON")).toEqual(["python"]);
  });
  it("keeps symbols that belong to a name and joins phrases", () => {
    expect(tokenize("C++ and C#")).toEqual(["c++", "c#"]);
    expect(tokenize("artificial intelligence basics")).toEqual(["artificial intelligence", "basics"]);
  });
  it("keeps the words when everything is filler, and caps the terms", () => {
    expect(tokenize("free courses")).toEqual(["free", "courses"]);
    expect(tokenize("a b c d e f g h i j").length).toBeLessThanOrEqual(6);
  });
  it("synonyms", () => {
    expect(alternatives("ai")).toContain("artificial intelligence");
    expect(alternatives("python")).toEqual(["python"]);
  });
});

describe("chips and highlight", () => {
  it("one removable chip per active filter, and removing it keeps the rest", () => {
    const q = parseQuery(new URLSearchParams("q=excel&cat=data,ai&level=beginner"), KEYS);
    const cs = chips(q, (k) => k.toUpperCase());
    expect(cs.map((c) => c.key)).toEqual(["q", "cat:data", "cat:ai", "level:beginner"]);
    const next = { ...q, ...cs.find((c) => c.key === "cat:data")!.remove };
    expect(next.cat).toEqual(["ai"]);
    expect(next.q).toBe("excel");
    expect(next.level).toEqual(["beginner"]);
  });
  it("highlight returns plain parts, never HTML", () => {
    expect(highlight("Python for <b>Data</b>", ["python", "data"])).toEqual([{ t: "Python", hit: true }, { t: " for <b>", hit: false }, { t: "Data", hit: true }, { t: "</b>", hit: false }]);
    expect(highlight("abc", ["("])).toEqual([{ t: "abc", hit: false }]);
  });
});
