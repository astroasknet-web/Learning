import NAMES from "./college-names.json";

/**
 * The bundled college list (github.com/astroasknet-web/colleges-list-): names only, no place. It backs the signup type-ahead when the
 * `institutions` table has fewer matches than the dropdown can show, or when the database is not reachable. Pure and server-side.
 */
const key = (s: string) => s.toLowerCase().replace(/&/g, " and ").replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/g, " ").trim();

const INDEX = (NAMES as string[]).map((name) => {
  const norm = key(name);
  return { name, norm, words: norm.split(" ") };
});

/** Best matches first: the name starts with the typed text, then every typed word starts a word of the name, then the text appears inside it. */
export function searchBundled(raw: string, limit = 8): string[] {
  const q = key(Array.from(raw).slice(0, 60).join(""));
  if (Array.from(q).length < 2) return [];
  const tokens = q.split(" ");
  const scored: Array<{ name: string; score: number }> = [];
  for (const c of INDEX) {
    let score = -1;
    if (c.norm.startsWith(q)) score = 0;
    else if (tokens.every((t) => c.words.some((w) => w.startsWith(t)))) score = 1;
    else if (c.norm.includes(q)) score = 2;
    if (score >= 0) scored.push({ name: c.name, score });
  }
  scored.sort((a, b) => a.score - b.score || a.name.length - b.name.length || a.name.localeCompare(b.name));
  return scored.slice(0, limit).map((s) => s.name);
}
