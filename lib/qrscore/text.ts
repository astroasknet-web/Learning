import { escapeRe, phpTrim } from "./php";

/** Text utilities shared by extraction and scoring. Pure and deterministic (port of Support\Text). */

/** Normalise line endings and strip control characters, keeping newlines and tabs. */
export function normalize(raw: string): string {
  const t = raw.replace(/\r\n|\r/g, "\n");
  return t.replace(/[^\P{C}\n\t]+/gu, "");
}

/** Lower-cased, whitespace-collapsed copy used for matching. */
export function fold(s: string): string {
  return s.toLowerCase().replace(/\s+/gu, " ").trim();
}

const tokenCache = new Map<string, RegExp>();

function tokenRe(foldedNeedle: string): RegExp {
  let re = tokenCache.get(foldedNeedle);
  if (!re) {
    re = new RegExp("(?<![a-z0-9])" + escapeRe(foldedNeedle) + "(?![a-z0-9])", "u");
    tokenCache.set(foldedNeedle, re);
  }
  return re;
}

function hasToken(foldedHaystack: string, foldedNeedle: string): boolean {
  if (foldedNeedle === "") return false;
  return tokenRe(foldedNeedle).test(foldedHaystack);
}

/** True if the haystack contains any needle as a whole token or phrase (case-insensitive). */
export function containsAny(haystack: string, needles: readonly string[]): boolean {
  const h = fold(haystack);
  for (const n of needles) {
    if (hasToken(h, fold(n))) return true;
  }
  return false;
}

/** The needles found in the haystack (whole-token, de-duplicated, in order). */
export function findAll(haystack: string, needles: readonly string[]): string[] {
  const h = fold(haystack);
  const hits = new Set<string>();
  for (const n of needles) {
    if (hasToken(h, fold(n))) hits.add(n);
  }
  return Array.from(hits);
}

/** Trimmed, non-empty lines. */
export function lines(text: string): string[] {
  const out: string[] = [];
  for (const line of text.split("\n")) {
    const t = phpTrim(line);
    if (t !== "") out.push(t);
  }
  return out;
}

/** Distinct 4-digit years (19xx / 20xx) in ascending order. */
export function years(text: string): number[] {
  const m = text.match(/(?:19|20)\d{2}/g) ?? [];
  return Array.from(new Set(m.map((x) => parseInt(x, 10)))).sort((a, b) => a - b);
}

export function clampInt(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.trunc(v)));
}
