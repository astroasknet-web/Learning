import fs from "node:fs";
import path from "node:path";
import { Marked } from "marked";
import { cleanHtml } from "@/lib/market/lessons";

/**
 * Vedic Mathematics course imported from Vidaara (content/lms/vedic/): 30 modules in English and Hindi (Markdown),
 * three levels, the 16 Sutras and 13 Sub-Sutras. Built by scripts/import-vidaara-vedic.mjs. No database.
 */
export interface Sutra { n: number; sanskrit?: string; translit: string; meaning: string }
export interface Level { n: number; name: string; tag: string; hours: string; emoji: string; blurb: string }
export interface VModule { num: number; level: number; title: string; slug: string; sutra: string; topics: string[]; available: boolean; hasEnglish: boolean; hasHindi: boolean }
export interface Curriculum { sutras: Sutra[]; subSutras: Sutra[]; levels: Level[]; modules: VModule[] }

const ROOT = path.join(process.cwd(), "content", "lms", "vedic");
let cur: Curriculum | null = null;

export function curriculum(): Curriculum {
  if (cur) return cur;
  try { cur = JSON.parse(fs.readFileSync(path.join(ROOT, "curriculum.json"), "utf8")) as Curriculum; } catch { cur = { sutras: [], subSutras: [], levels: [], modules: [] }; }
  return cur;
}
export const vmodule = (slug: string): VModule | null => curriculum().modules.find((m) => m.slug === slug && m.available) ?? null;
export function adjacent(num: number): { prev: VModule | null; next: VModule | null } {
  const list = curriculum().modules.filter((m) => m.available);
  const i = list.findIndex((m) => m.num === num);
  return { prev: i > 0 ? list[i - 1] : null, next: i >= 0 && i < list.length - 1 ? list[i + 1] : null };
}

export interface Heading { id: string; text: string; level: number }
const cache = new Map<string, { html: string; toc: Heading[] }>();
const plainText = (h: string) => h.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();

/** Renders one module's Markdown to sanitised HTML, with ids on the h1 and h2 headings for a contents list. */
export function moduleHtml(slug: string, lang: "en" | "hi"): { html: string; toc: Heading[] } | null {
  if (!/^module-\d+$/.test(slug)) return null;
  const key = `${slug}:${lang}`;
  const hit = cache.get(key);
  if (hit) return hit;
  let md: string;
  try { md = fs.readFileSync(path.join(ROOT, "modules", `${slug}${lang === "hi" ? ".hi" : ""}.md`), "utf8"); } catch { return null; }
  const toc: Heading[] = [];
  const used = new Map<string, number>();
  const m = new Marked({ gfm: true, breaks: false });
  m.use({
    renderer: {
      heading(text: string, level: number) {
        const base = plainText(text).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "section";
        const n = used.get(base) ?? 0;
        used.set(base, n + 1);
        const id = n ? `${base}-${n + 1}` : base;
        if (level <= 2) toc.push({ id, text: plainText(text), level });
        return `<h${level} id="${id}">${text}</h${level}>\n`;
      },
    },
  });
  const html = cleanHtml(m.parse(md, { async: false }) as string);
  const out = { html, toc };
  cache.set(key, out);
  return out;
}
