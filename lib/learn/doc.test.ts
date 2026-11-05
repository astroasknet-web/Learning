import { describe, expect, it } from "vitest";
import { analyzeDoc, docToHtmlFile, plainText, sanitizeDoc } from "./doc";
import { bullets, deckToHtmlFile, emptyDeck, sanitizeDeck, MAX_SLIDES } from "./slides";

describe("document sanitiser", () => {
  it("keeps the formatting the editor produces", () => {
    const html = '<h1 style="text-align: center; font-size: 28px">Title</h1><p><b>Bold</b> <i>it</i> <u>un</u></p><ul><li>a</li></ul><table><tr><td colspan="2">x</td></tr></table>';
    expect(sanitizeDoc(html)).toBe(html);
  });
  it("removes scripts, handlers, links, images, iframes and odd styles", () => {
    const bad = '<p onclick="alert(1)" style="background:url(javascript:x);position:fixed;text-align:center">hi<script>alert(1)</script></p><a href="javascript:alert(1)">l</a><img src=x onerror=alert(1)><iframe src="//evil"></iframe><style>*{display:none}</style><svg onload=alert(1)></svg><form action=/x><input name=a></form>';
    const out = sanitizeDoc(bad);
    expect(out).not.toMatch(/script|onclick|onerror|javascript|<a |<img|iframe|<style|svg|<form|<input|position|background|url\(/i);
    expect(out).toContain("hi");
    expect(out).toContain("text-align: center");
  });
  it("turns stray angle brackets into text and caps the length", () => {
    expect(sanitizeDoc("1 < 2 and <b>ok</b>")).toBe("1 &lt; 2 and <b>ok</b>");
    expect(sanitizeDoc("x".repeat(500_000)).length).toBeLessThanOrEqual(60_000);
    expect(sanitizeDoc("")).toBe("");
  });
  it("analyses structure, formatting and word counts", () => {
    const d = analyzeDoc('<h1>Report</h1><h2>One</h2><p>Hello brave new world</p><ol><li>a</li><li>b</li></ol><table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table><p style="text-align: right"><b>Sign</b></p>');
    expect(d.headings.map((h) => h.level)).toEqual([1, 2]);
    expect(d.paragraphs.map((p) => p.text)).toContain("Hello brave new world");
    expect(d.lists).toEqual([{ type: "ol", items: 2 }]);
    expect(d.tables).toEqual([{ rows: 2, cols: 2 }]);
    expect(d.bold).toBe(true);
    expect(d.aligned.right).toBe(true);
    expect(d.words).toBeGreaterThan(8);
    expect(analyzeDoc("").words).toBe(0);
    expect(plainText("<p>a&nbsp;&amp;&nbsp;b</p>")).toBe("a & b");
  });
  it("exports a print-ready file with only sanitised content", () => {
    const f = docToHtmlFile('<p>ok</p><script>x</script>', 'My <b>doc</b> "x"');
    expect(f).toContain("<p>ok</p>");
    expect(f).not.toContain("<script");
    expect(f).toContain("<title>My bdoc/b x</title>");
  });
});

describe("slide deck", () => {
  it("sanitises anything a client sends", () => {
    const d = sanitizeDeck({ theme: "nope", slides: Array.from({ length: 80 }, (_, i) => ({ id: "s" + i, layout: "bad", title: "t".repeat(500), body: 5, shapes: [{ fill: "javascript:x", x: "a", w: -4, kind: "evil" }] })) });
    expect(d.theme).toBe("clean");
    expect(d.slides.length).toBe(MAX_SLIDES);
    expect(d.slides[0].title.length).toBe(140);
    expect(d.slides[0].body).toBe("");
    expect(d.slides[0].shapes[0]).toMatchObject({ kind: "rect", x: 40, w: 10 });
    expect(sanitizeDeck(null).slides.length).toBe(1);
    expect(sanitizeDeck({ slides: [] }).slides.length).toBe(1);
  });
  it("reads bullet lines", () => { expect(bullets("- one\n* two\n• three\n\n  four ")).toEqual(["one", "two", "three", "four"]); });
  it("exports an HTML slideshow that escapes student text and has no scripts", () => {
    const deck = { ...emptyDeck(), slides: [{ id: "a", layout: "title-content" as const, title: '<img src=x onerror=alert(1)>', body: "- <b>x</b>", body2: "", shapes: [] }] };
    const f = deckToHtmlFile(deck, 'T"itle');
    expect(f).not.toMatch(/<script|<img /); // the text 'onerror=alert(1)' may appear, but only as escaped, visible text
    expect(f).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(f).toContain("&lt;b&gt;x&lt;/b&gt;");
  });
});
