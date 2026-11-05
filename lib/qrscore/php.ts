/**
 * Small PHP-compatible helpers.
 *
 * The scoring engine was written in PHP and its exact outputs (scores, thresholds) must carry over unchanged, so the
 * handful of PHP built-ins whose behaviour differs from JavaScript are re-implemented here once.
 */

/** PHP round(): half away from zero, with PHP's pre-rounding to 15 significant digits (so round(1.005, 2) === 1.01). */
export function phpRound(value: number, places = 0): number {
  if (!Number.isFinite(value) || value === 0) return value;
  const f = Math.pow(10, Math.abs(places));
  const pre = Number(value.toPrecision(15));
  const scaled = places >= 0 ? pre * f : pre / f;
  const rounded = Math.sign(scaled) * Math.round(Math.abs(scaled));
  return places >= 0 ? rounded / f : rounded * f;
}

/** PHP str_word_count(): runs of letters, apostrophes and hyphens (ASCII letters, as in the C locale). */
export function strWordCount(s: string): number {
  let t = s;
  if (t.startsWith("'") || t.startsWith("-")) t = t.slice(1);
  if (t.endsWith("-")) t = t.slice(0, -1);
  const m = t.match(/[A-Za-z'-]+/g);
  return m ? m.length : 0;
}

/** PHP ucwords(): upper-case the first letter of each whitespace-delimited word (ASCII only). */
export function ucwords(s: string): string {
  return s.replace(/(^|[ \t\r\n\f\v])([a-z])/g, (_m, a: string, b: string) => a + b.toUpperCase());
}

/** PHP strtolower() (PHP 8): ASCII letters only, leaves other characters untouched. */
export function asciiLower(s: string): string {
  return s.replace(/[A-Z]+/g, (m) => m.toLowerCase());
}

/** PHP trim() with an explicit character list. */
export function trimChars(s: string, chars: string): string {
  const set = new Set(Array.from(chars));
  const a = Array.from(s);
  let i = 0;
  let j = a.length;
  while (i < j && set.has(a[i])) i++;
  while (j > i && set.has(a[j - 1])) j--;
  return a.slice(i, j).join("");
}

export function ltrimChars(s: string, chars: string): string {
  const set = new Set(Array.from(chars));
  const a = Array.from(s);
  let i = 0;
  while (i < a.length && set.has(a[i])) i++;
  return a.slice(i).join("");
}

export function rtrimChars(s: string, chars: string): string {
  const set = new Set(Array.from(chars));
  const a = Array.from(s);
  let j = a.length;
  while (j > 0 && set.has(a[j - 1])) j--;
  return a.slice(0, j).join("");
}

/** PHP trim() default whitespace: space, \t \n \r \0 \x0B. */
export function phpTrim(s: string): string {
  return trimChars(s, " \t\n\r\0\x0B");
}

/** mb_strlen() in code points (not UTF-16 units). */
export function mbLen(s: string): number {
  let n = 0;
  for (const _ of s) n++;
  return n;
}

/** mb_substr($s, 0, $n). */
export function mbHead(s: string, n: number): string {
  return Array.from(s).slice(0, n).join("");
}

/** Escape text for use inside a RegExp (valid with and without the u flag). */
export function escapeRe(s: string): string {
  return s.replace(/[\\^$.*+?()[\]{}|/]/g, (c) => "\\" + c);
}

/** Escape text for use inside a [...] character class (valid with the u flag). */
export function escapeClass(s: string): string {
  return s.replace(/[\\\]^-]/g, (c) => "\\" + c);
}

/** PHP ltrim() with a character list, working on UTF-8 BYTES like PHP does (multi-byte characters in the list are sets of bytes). */
export function ltrimBytes(s: string, chars: string): string {
  const set = new Set(Buffer.from(chars, "utf8"));
  const b = Buffer.from(s, "utf8");
  let i = 0;
  while (i < b.length && set.has(b[i])) i++;
  return b.subarray(i).toString("utf8");
}

/**
 * The UTF-8 bytes of a string as a "byte string", so a regex runs with PHP's non-/u semantics (one char per byte, ASCII-only
 * classes). Bytes >= 0x80 map to U+4E00+byte (CJK: no case folding, never whitespace), so /i and \s cannot match them by accident.
 * Build patterns for such strings with bin() on the literal parts too, e.g. bin("–").
 */
export function bin(s: string): string {
  let out = "";
  for (const b of Buffer.from(s, "utf8")) out += b < 0x80 ? String.fromCharCode(b) : String.fromCharCode(0x4e00 + b);
  return out;
}

/** strlen() in bytes (UTF-8). */
export function byteLen(s: string): number {
  return Buffer.byteLength(s, "utf8");
}

/** PHP's strict array equality for lists of numbers. */
export function sameList(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/** Count regex matches (preg_match_all without capture needs). */
export function countMatches(re: RegExp, s: string): number {
  const flags = re.flags.includes("g") ? re.flags : re.flags + "g";
  const m = s.match(new RegExp(re.source, flags));
  return m ? m.length : 0;
}

/** The current year; tests may pin it so golden files stay valid. */
let pinnedYear: number | null = null;
export function setNowYear(y: number | null): void {
  pinnedYear = y;
}
export function nowYear(): number {
  return pinnedYear ?? new Date().getFullYear();
}

/** Inverse of bin(). */
export function unbin(s: string): string {
  const bytes: number[] = [];
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0;
    bytes.push(c >= 0x4e80 && c <= 0x4eff ? c - 0x4e00 : c);
  }
  return Buffer.from(bytes).toString("utf8");
}

/** PHP trim() with a character list, on UTF-8 bytes. */
export function trimBytes(s: string, chars: string): string {
  const set = new Set(Buffer.from(chars, "utf8"));
  const b = Buffer.from(s, "utf8");
  let i = 0;
  let j = b.length;
  while (i < j && set.has(b[i])) i++;
  while (j > i && set.has(b[j - 1])) j--;
  return b.subarray(i, j).toString("utf8");
}

/** PHP's `$x ?: null` for strings: empty and "0" are falsy. */
export function orNull(s: string | null | undefined): string | null {
  return s === undefined || s === null || s === "" || s === "0" ? null : s;
}

/** PCRE (non-UTF) whitespace for \s: space, \t, \n, \v, \f, \r. */
export const WS = "[ \t\n\x0B\f\r]";

/**
 * Build a RegExp from a PCRE pattern that PHP ran WITHOUT the /u flag: \s and \S then mean ASCII whitespace only
 * (space, \t, \n, \v, \f, \r), not no-break space or other Unicode spaces as in JavaScript.
 */
export function rx(src: string, flags = ""): RegExp {
  const WSC = " \t\n\x0B\f\r";
  let out = "";
  let inClass = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === "\\" && i + 1 < src.length) {
      const n = src[i + 1];
      if (n === "s") out += inClass ? WSC : "[" + WSC + "]";
      else if (n === "S" && !inClass) out += "[^" + WSC + "]";
      else out += c + n;
      i++;
      continue;
    }
    if (c === "[" && !inClass) inClass = true;
    else if (c === "]" && inClass) inClass = false;
    out += c;
  }
  return new RegExp(out, flags);
}
