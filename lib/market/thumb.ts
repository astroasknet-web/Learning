/**
 * Course cover art. Every course gets its own cover, built from facts about that course: its category colours, its subject glyph (the
 * `icon` field) and a pattern, angle and side chosen from a hash of its slug. The covers used to be a bare category-colour gradient, so
 * every course in a category (18 of them in Blockchain) looked identical; the glyph artwork shipped with the catalogue was never drawn.
 */
export type Pattern = "rings" | "dots" | "stripes" | "bubbles" | "waves" | "blocks";
export const PATTERNS: Pattern[] = ["rings", "dots", "stripes", "bubbles", "waves", "blocks"];
export const ANGLES = [120, 150, 200, 235];

export interface Shape { x: number; y: number; r: number; o: number; rot: number }
export interface ThumbSpec {
  pattern: Pattern; angle: number; side: "left" | "right"; from: string; to: string; accent: string; icon: string; shapes: Shape[]; signature: string;
}

/** FNV-1a: a stable 32-bit hash, so a course always gets the same cover on every server and every deploy. */
export function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Darken a #rrggbb colour by `t` (0 to 1) so white text and glyphs stay readable on every category colour. */
export function darken(hex: string, t: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#334155";
  const n = parseInt(m[1], 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v * (1 - t))));
  return "#" + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => ch(v).toString(16).padStart(2, "0")).join("");
}

export function thumbSpec(slug: string, icon: string, c1: string, c2: string): ThumbSpec {
  const h = hash(slug);
  const r = rng(h);
  const pattern = PATTERNS[h % PATTERNS.length];
  const angle = ANGLES[(h >>> 3) % ANGLES.length];
  const side = (h >>> 5) % 2 === 0 ? "left" : "right";
  const n = pattern === "bubbles" ? 7 : pattern === "blocks" ? 5 : pattern === "rings" ? 3 : 6;
  const shapes: Shape[] = Array.from({ length: n }, () => ({ x: Math.round(r() * 320), y: Math.round(r() * 180), r: Math.round(14 + r() * 46), o: Math.round((0.08 + r() * 0.12) * 100) / 100, rot: Math.round(r() * 90) }));
  return { pattern, angle, side, from: darken(c1, 0.38), to: darken(c2, 0.42), accent: darken(c1, 0.55), icon, shapes, signature: [icon, pattern, angle, side].join("|") };
}
