/** Pure helpers for the read-aloud feature (no DOM), so the chunking and settings rules can be unit-tested. */

export interface A11ySettings { fontscale: number; contrast: boolean; dyslexia: boolean; reduceMotion: boolean; rate: number; voice: string }
export const DEFAULTS: A11ySettings = { fontscale: 0, contrast: false, dyslexia: false, reduceMotion: false, rate: 1, voice: "" };
export const STORAGE_KEY = "growqr.a11y";
export const MAX_FONTSCALE = 3;
export const RATES = [0.75, 1, 1.25, 1.5];

/** Parse saved settings defensively: anything unexpected falls back to the default for that field. */
export function parseSettings(raw: string | null): A11ySettings {
  let o: Record<string, unknown> = {};
  try {
    const v = raw ? JSON.parse(raw) : {};
    if (v && typeof v === "object") o = v as Record<string, unknown>;
  } catch {
    /* defaults */
  }
  const fs = Math.trunc(Number(o.fontscale));
  const rate = Number(o.rate);
  return {
    fontscale: Number.isFinite(fs) ? Math.min(MAX_FONTSCALE, Math.max(0, fs)) : 0,
    contrast: o.contrast === true,
    dyslexia: o.dyslexia === true,
    reduceMotion: o.reduceMotion === true,
    rate: RATES.includes(rate) ? rate : 1,
    voice: typeof o.voice === "string" ? o.voice.slice(0, 200) : "",
  };
}

/** Split text into utterance-safe pieces (<= max chars), breaking at sentence ends, then spaces. */
export function chunkText(text: string, max = 220): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const out: string[] = [];
  let cur = "";
  for (const s of clean.match(/[^.!?।]+[.!?।]*\s*/g) ?? [clean]) {
    if ((cur + s).length <= max) {
      cur += s;
      continue;
    }
    if (cur.trim()) out.push(cur.trim());
    cur = "";
    let rest = s;
    while (rest.length > max) {
      let cut = rest.lastIndexOf(" ", max);
      if (cut < max / 2) cut = max;
      out.push(rest.slice(0, cut).trim());
      rest = rest.slice(cut);
    }
    cur = rest;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** Best voice for English: the saved one, else an Indian English voice, else any English voice. */
export function pickVoice<T extends { name: string; lang: string }>(voices: T[], saved: string): T | null {
  if (!voices.length) return null;
  const byName = saved ? voices.find((v) => v.name === saved) : undefined;
  if (byName) return byName;
  const en = voices.filter((v) => v.lang.toLowerCase().startsWith("en"));
  return en.find((v) => v.lang.toLowerCase().replace("_", "-") === "en-in") ?? en[0] ?? null;
}
