import data from "./data/templates.json";

/**
 * The Resume Studio catalogue: 45 templates = 6 core formats and 8 regional presets, each in several visual styles.
 * A template id is "<format>-<style>", e.g. chrono-classic or de-modern. The constants are exported from the PHP app
 * (scripts/studio-export-data.php) so both stay identical.
 */
export type Ats = "safe" | "caution";
export interface Template {
  id: string;
  format: string;
  region: string | null;
  structure: string;
  style: string;
  name: string;
  format_name: string;
  style_name: string;
  about: string;
  paper: string;
  date_style: string;
  personal: string[];
  ats: Ats;
  free: boolean;
}

export const FORMATS = data.formats as unknown as Record<string, [string, string, string]>;
export const REGIONS = data.regions as unknown as Record<string, [string, string, string, string[], string, string]>;
export const STYLES = data.styles as unknown as Record<string, [string, string, string]>;
export const FREE = data.free as string[];
export const LEVELS = data.levels as Record<string, string>;
export const INDUSTRIES = data.industries as Record<string, string>;
export const GOALS = data.goals as Record<string, string>;
const OFFER = data.offer as Record<string, string[]>;
const DEFAULT_POPULAR = data.default_popular as string[];

let cache: Record<string, Template> | null = null;

export function all(): Record<string, Template> {
  if (cache) return cache;
  const out: Record<string, Template> = {};
  for (const [key, styles] of Object.entries(OFFER)) {
    const isRegion = key in REGIONS;
    for (const style of styles) {
      const id = `${key}-${style}`;
      const fmtAts = isRegion ? "safe" : FORMATS[key][2];
      out[id] = {
        id,
        format: key,
        region: isRegion ? key : null,
        structure: isRegion ? REGIONS[key][4] : key,
        style,
        name: `${isRegion ? REGIONS[key][0] : FORMATS[key][0]} · ${STYLES[style][0]}`,
        format_name: isRegion ? REGIONS[key][0] : FORMATS[key][0],
        style_name: STYLES[style][0],
        about: isRegion ? REGIONS[key][5] : FORMATS[key][1],
        paper: isRegion ? REGIONS[key][1] : "A4",
        date_style: isRegion ? REGIONS[key][2] : "my",
        personal: isRegion ? REGIONS[key][3] : [],
        ats: fmtAts === "safe" && STYLES[style][1] === "safe" ? "safe" : "caution",
        free: FREE.includes(id),
      };
    }
  }
  return (cache = out);
}

export const get = (id: string): Template | null => all()[id] ?? null;
export const exists = (id: string): boolean => id in all();

export function regionOptions(): Record<string, string> {
  const o: Record<string, string> = { other: "Other / not sure" };
  for (const [k, r] of Object.entries(REGIONS)) o[k] = r[0];
  return o;
}

export interface Prefs { region?: string; level?: string; industry?: string; goal?: string }

/** Rank templates for a person; returns up to three ids (best overall region match, best career format, best free one). */
export function recommend(prefs: Prefs, rq: number | null, pro: boolean): string[] {
  const region = prefs.region ?? "other";
  const level = prefs.level ?? "";
  const industry = prefs.industry ?? "";
  const goal = prefs.goal ?? "";
  const tpls = all();
  const scores: Record<string, number> = {};
  for (const [id, t] of Object.entries(tpls)) {
    let s = 0;
    if (t.region !== null && t.region === region) s += 50;
    const f = t.format;
    const structure = t.structure;
    if (structure === "chrono" || f === "chrono") {
      s += level === "student" || level === "early" ? 30 : level === "mid" ? 25 : level === "senior" ? 20 : 10;
    }
    if (f === "hybrid") s += (goal === "change" ? 35 : 0) + (level === "mid" ? 15 : 8);
    if (f === "functional") s += goal === "change" ? 15 : 0;
    if (f === "executive") s += (level === "executive" ? 45 : level === "senior" ? 15 : 0) + (goal === "promotion" ? 10 : 0);
    if (f === "academic") s += (level === "academic" ? 50 : 0) + (goal === "academic" ? 40 : 0) + (industry === "education" ? 15 : 0);
    if (f === "creative") s += industry === "creative" ? 35 : 0;
    if (f === "us_fed" && industry === "government" && region === "us") s += 40;
    if (industry === "government" && f === "us_fed" && region !== "us") s -= 10;
    if (rq !== null && rq < 55 && (t.style === "minimal" || t.style === "classic")) s += 12;
    if (t.ats === "caution" && industry !== "creative") s -= 12;
    if (t.style === "classic") s += 2;
    scores[id] = s;
  }
  // PHP arsort is stable (8.0+), as is Array.sort.
  const ranked = Object.keys(scores).sort((a, b) => scores[b] - scores[a]);
  let pick: string[] = [];
  const add = (id: string | null) => { if (id !== null && !pick.includes(id)) pick.push(id); };
  const first = (keep: (id: string) => boolean): string | null => ranked.find(keep) ?? null;
  if (region !== "other") add(first((id) => tpls[id].region === region));
  add(first((id) => tpls[id].region === null));
  if (!pro && !pick.some((id) => tpls[id].free)) add(first((id) => tpls[id].free));
  for (const id of ranked) {
    if (pick.length >= 3) break;
    add(id);
  }
  pick = pick.slice(0, 3);
  pick.sort((x, y) => scores[y] - scores[x]);
  return pick;
}

/** Popular templates by actual use, topped up from sensible defaults. */
export function popular(usage: Record<string, number>, exclude: string[] = []): string[] {
  const used = Object.keys(usage).sort((a, b) => usage[b] - usage[a]);
  const out: string[] = [];
  for (const id of [...used, ...DEFAULT_POPULAR]) {
    if (exists(id) && !exclude.includes(id) && !out.includes(id)) out.push(id);
    if (out.length >= 3) break;
  }
  return out;
}
