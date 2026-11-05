/**
 * The Word-style playground's document model: a small, safe subset of HTML. Everything a student writes is run through
 * sanitizeDoc() before it is stored, checked, exported or shown again, so pasted or hand-crafted HTML cannot carry scripts,
 * event handlers, links, images or styles beyond the handful of formatting options the editor offers.
 */
const TAGS = new Set(["p", "div", "br", "h1", "h2", "h3", "b", "strong", "i", "em", "u", "ul", "ol", "li", "table", "thead", "tbody", "tr", "td", "th", "span", "font"]);
const DROP_WITH_CONTENT = /<\s*(script|style|iframe|object|embed|noscript|template|svg|math|title|head)\b[\s\S]*?(<\s*\/\s*\1\s*>|$)/gi;
const ALIGN = new Set(["left", "center", "right", "justify"]);
export const MAX_DOC_CHARS = 60_000;

/** Keep only text-align, font-size (8 to 48 px) and font-weight/font-style/text-decoration keywords from a style attribute. */
function cleanStyle(style: string): string {
  const out: string[] = [];
  for (const part of style.split(";")) {
    const [kRaw, ...rest] = part.split(":");
    const k = (kRaw ?? "").trim().toLowerCase();
    const v = rest.join(":").trim().toLowerCase();
    if (k === "text-align" && ALIGN.has(v)) out.push(`text-align: ${v}`);
    else if (k === "font-size") { const m = /^(\d{1,2})px$/.exec(v); if (m && +m[1] >= 8 && +m[1] <= 48) out.push(`font-size: ${m[1]}px`); }
    else if (k === "font-weight" && (v === "bold" || v === "700" || v === "600")) out.push("font-weight: bold");
    else if (k === "font-style" && v === "italic") out.push("font-style: italic");
    else if (k === "text-decoration" && /^underline\b/.test(v)) out.push("text-decoration: underline");
  }
  return out.join("; ");
}

export function sanitizeDoc(html: string): string {
  let s = html.slice(0, MAX_DOC_CHARS * 2).replace(/<!--[\s\S]*?-->/g, "").replace(DROP_WITH_CONTENT, "");
  s = s.replace(/<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g, (_m, close: string, tag: string, attrs: string) => {
    const t = tag.toLowerCase();
    if (!TAGS.has(t)) return "";
    if (close) return `</${t}>`;
    if (t === "br") return "<br>";
    let a = "";
    const sm = /\sstyle\s*=\s*("([^"]*)"|'([^']*)')/i.exec(" " + attrs);
    const style = sm ? cleanStyle(sm[2] ?? sm[3] ?? "") : "";
    if (style) a += ` style="${style}"`;
    if (t === "font") { const z = /\ssize\s*=\s*["']?([1-7])/i.exec(" " + attrs); if (z) a += ` size="${z[1]}"`; }
    if (t === "td" || t === "th") { const cs = /\scolspan\s*=\s*["']?(\d)/i.exec(" " + attrs); if (cs) a += ` colspan="${cs[1]}"`; }
    return `<${t}${a}>`;
  });
  // A stray < or > that is not part of an allowed tag becomes text.
  s = s.replace(/<(?!\/?(?:p|div|br|h[1-3]|b|strong|i|em|u|ul|ol|li|table|thead|tbody|tr|td|th|span|font)\b)/gi, "&lt;");
  return s.slice(0, MAX_DOC_CHARS);
}

const decode = (s: string): string => s.replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
export const plainText = (html: string): string => decode(html.replace(/<\s*\/?(p|div|br|h[1-3]|li|tr|ul|ol|table)\b[^>]*>/gi, " ").replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();

export interface DocStats {
  words: number; chars: number; text: string;
  headings: Array<{ level: number; text: string }>;
  paragraphs: Array<{ text: string; words: number }>;
  lists: Array<{ type: "ul" | "ol"; items: number }>;
  tables: Array<{ rows: number; cols: number }>;
  bold: boolean; italic: boolean; underline: boolean;
  aligned: { center: boolean; right: boolean; justify: boolean };
  sizes: number[];
}

/** Look inside a sanitised document and report what it contains. */
export function analyzeDoc(html0: string): DocStats {
  const html = sanitizeDoc(html0);
  const text = plainText(html);
  const headings = [...html.matchAll(/<h([1-3])\b[^>]*>([\s\S]*?)<\/h\1>/gi)].map((m) => ({ level: +m[1], text: plainText(m[2]) })).filter((h) => h.text !== "");
  // Paragraphs: <p> blocks, plus loose <div> lines and top-level text, minus headings, lists and tables.
  const stripped = html.replace(/<h[1-3]\b[\s\S]*?<\/h[1-3]>/gi, "\n").replace(/<(ul|ol|table)\b[\s\S]*?<\/\1>/gi, "\n");
  const paragraphs = stripped.split(/<\/?(?:p|div)\b[^>]*>|<br\s*\/?>|\n/gi).map((x) => plainText(x)).filter((x) => x !== "").map((t) => ({ text: t, words: t.split(/\s+/).filter(Boolean).length }));
  const lists = [...html.matchAll(/<(ul|ol)\b[^>]*>([\s\S]*?)<\/\1>/gi)].map((m) => ({ type: m[1].toLowerCase() as "ul" | "ol", items: (m[2].match(/<li\b/gi) ?? []).length })).filter((l) => l.items > 0);
  const tables = [...html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)].map((m) => {
    const rows = m[1].match(/<tr\b[\s\S]*?<\/tr>/gi) ?? [];
    return { rows: rows.length, cols: Math.max(0, ...rows.map((r) => (r.match(/<t[dh]\b/gi) ?? []).length)) };
  });
  const sizes = [...html.matchAll(/font-size:\s*(\d+)px/gi)].map((m) => +m[1]);
  for (const m of html.matchAll(/<font\b[^>]*\ssize="([1-7])"/gi)) sizes.push(8 + +m[1] * 4); // legacy <font size> from older browsers
  return {
    words: text === "" ? 0 : text.split(/\s+/).length, chars: text.length, text, headings, paragraphs, lists, tables,
    bold: /<(b|strong)\b/i.test(html) || /font-weight:\s*bold/i.test(html),
    italic: /<(i|em)\b/i.test(html) || /font-style:\s*italic/i.test(html),
    underline: /<u\b/i.test(html) || /text-decoration:\s*underline/i.test(html),
    aligned: { center: /text-align:\s*center/i.test(html), right: /text-align:\s*right/i.test(html), justify: /text-align:\s*justify/i.test(html) },
    sizes,
  };
}

/** A complete, print-ready HTML file of the student's document. */
export function docToHtmlFile(html: string, title: string): string {
  const safeTitle = title.replace(/[<>&"]/g, "");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeTitle}</title><style>body{font-family:Georgia,'Times New Roman',serif;max-width:720px;margin:2rem auto;padding:0 1rem;line-height:1.6;color:#111}table{border-collapse:collapse;width:100%}td,th{border:1px solid #888;padding:.35rem .6rem}@media print{body{margin:0}}</style></head><body>${sanitizeDoc(html)}</body></html>`;
}
