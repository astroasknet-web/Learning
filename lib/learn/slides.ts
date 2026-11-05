/**
 * The presentation playground's model. A deck is plain JSON (no HTML from the student is ever rendered as HTML): titles and bullet
 * text are strings, shapes are numbers and colours from a fixed palette. That makes decks safe to store, check and export.
 */
export type Layout = "title" | "title-content" | "two-column" | "section" | "blank";
export const LAYOUTS: Array<{ id: Layout; label: string }> = [
  { id: "title", label: "Title slide" }, { id: "title-content", label: "Title and bullets" }, { id: "two-column", label: "Two columns" }, { id: "section", label: "Section heading" }, { id: "blank", label: "Blank" },
];
export interface Shape { id: string; kind: "rect" | "circle" | "arrow"; x: number; y: number; w: number; h: number; fill: string }
export interface Slide { id: string; layout: Layout; title: string; body: string; body2: string; bg?: string; shapes: Shape[] }
export interface Deck { theme: string; slides: Slide[] }

export interface Theme { id: string; label: string; bg: string; title: string; text: string; accent: string }
export const THEMES: Theme[] = [
  { id: "clean", label: "Clean", bg: "#ffffff", title: "#14213d", text: "#333333", accent: "#d95d2b" },
  { id: "ocean", label: "Ocean", bg: "#0b3d5c", title: "#ffffff", text: "#e6f2f8", accent: "#ffb703" },
  { id: "forest", label: "Forest", bg: "#f1f7ee", title: "#1b4332", text: "#2d3a30", accent: "#2d6a4f" },
  { id: "slate", label: "Slate", bg: "#1f2937", title: "#f9fafb", text: "#d1d5db", accent: "#f59e0b" },
];
export const PALETTE = ["#d95d2b", "#2563eb", "#059669", "#7c3aed", "#db2777", "#facc15", "#111827", "#ffffff"];
export const MAX_SLIDES = 30;
export const MAX_SHAPES = 20;
const CANVAS = { w: 960, h: 540 };
export { CANVAS };

export const themeOf = (id: string): Theme => THEMES.find((t) => t.id === id) ?? THEMES[0];
let n = 0;
export const newId = (p: string): string => `${p}${Date.now().toString(36)}${(n++).toString(36)}`;
export const newSlide = (layout: Layout = "title-content"): Slide => ({ id: newId("s"), layout, title: "", body: "", body2: "", shapes: [] });
export const emptyDeck = (): Deck => ({ theme: "clean", slides: [{ ...newSlide("title"), title: "", body: "" }] });

const str = (v: unknown, max: number): string => (typeof v === "string" ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").slice(0, max) : "");
const num = (v: unknown, lo: number, hi: number, d: number): number => { const x = Number(v); return Number.isFinite(x) ? Math.max(lo, Math.min(hi, Math.round(x))) : d; };
const colour = (v: unknown, d: string): string => (typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : d);

/** Accept anything the browser (or a hostile client) sends and return a well-formed deck within the limits. */
export function sanitizeDeck(raw: unknown): Deck {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const slides = (Array.isArray(o.slides) ? o.slides : []).slice(0, MAX_SLIDES).map((s0, i): Slide => {
    const s = (s0 && typeof s0 === "object" ? s0 : {}) as Record<string, unknown>;
    const layout = LAYOUTS.some((l) => l.id === s.layout) ? (s.layout as Layout) : "title-content";
    const shapes = (Array.isArray(s.shapes) ? s.shapes : []).slice(0, MAX_SHAPES).map((h0, j): Shape => {
      const h = (h0 && typeof h0 === "object" ? h0 : {}) as Record<string, unknown>;
      return { id: str(h.id, 24) || `h${i}-${j}`, kind: h.kind === "circle" || h.kind === "arrow" ? h.kind : "rect", x: num(h.x, 0, CANVAS.w, 40), y: num(h.y, 0, CANVAS.h, 40), w: num(h.w, 10, CANVAS.w, 120), h: num(h.h, 10, CANVAS.h, 80), fill: colour(h.fill, PALETTE[0]) };
    });
    return { id: str(s.id, 24) || `s${i}`, layout, title: str(s.title, 140), body: str(s.body, 1200), body2: str(s.body2, 1200), bg: s.bg ? colour(s.bg, "") || undefined : undefined, shapes };
  });
  return { theme: THEMES.some((t) => t.id === o.theme) ? (o.theme as string) : "clean", slides: slides.length ? slides : emptyDeck().slides };
}

export const bullets = (body: string): string[] => body.split(/\r?\n/).map((l) => l.replace(/^\s*[-*•]\s*/, "").trim()).filter(Boolean);
export const deckText = (d: Deck): string => d.slides.flatMap((s) => [s.title, s.body, s.body2]).join(" \n ").toLowerCase();

const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** A self-contained slideshow file (arrow keys / click to move). Student text is escaped; there is no script that reads student input as code. */
export function deckToHtmlFile(deckIn: Deck, title: string): string {
  const deck = sanitizeDeck(deckIn);
  const t = themeOf(deck.theme);
  const sl = deck.slides.map((s) => {
    const bg = s.bg ?? t.bg;
    const li = (b: string) => `<ul>${bullets(b).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`;
    const shapes = s.shapes.map((h) => `<div class="sh ${h.kind}" style="left:${(h.x / CANVAS.w) * 100}%;top:${(h.y / CANVAS.h) * 100}%;width:${(h.w / CANVAS.w) * 100}%;height:${(h.h / CANVAS.h) * 100}%;background:${h.fill}"></div>`).join("");
    const body = s.layout === "two-column" ? `<div class="cols"><div>${li(s.body)}</div><div>${li(s.body2)}</div></div>` : s.layout === "blank" ? "" : s.layout === "title" || s.layout === "section" ? `<p class="sub">${esc(s.body)}</p>` : li(s.body);
    return `<section class="slide ${s.layout}" style="background:${bg}">${s.layout === "blank" ? "" : `<h1>${esc(s.title)}</h1>`}${body}${shapes}</section>`;
  }).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>
*{box-sizing:border-box}body{margin:0;background:#111;font-family:system-ui,sans-serif}.slide{position:relative;aspect-ratio:16/9;width:min(100vw,177.7vh);margin:0 auto 1rem;padding:5% 7%;color:${t.text};overflow:hidden}
h1{margin:0 0 .6em;color:${t.title};font-size:clamp(1.4rem,4.2vw,3rem)}ul{margin:0;padding-left:1.2em;font-size:clamp(1rem,2.4vw,1.8rem);line-height:1.5}.title,.section{display:flex;flex-direction:column;justify-content:center}.sub{font-size:clamp(1rem,2.6vw,2rem);margin:0}.cols{display:grid;grid-template-columns:1fr 1fr;gap:4%}
.sh{position:absolute;opacity:.92}.circle{border-radius:50%}.arrow{clip-path:polygon(0 30%,60% 30%,60% 0,100% 50%,60% 100%,60% 70%,0 70%)}.slide li::marker{color:${t.accent}}
@media print{body{background:#fff}.slide{page-break-after:always;margin:0;width:100%}}</style></head><body>${sl}</body></html>`;
}
