import { asciiLower, byteLen, escapeRe, phpRound, phpTrim, trimChars } from "../qrscore/php";
import { esc } from "../studio/renderer";

/**
 * Search over the internship list (port of Portal\JobSearch). Deterministic, no external service.
 *
 *  - every word you type must be found, in any order ("python developer" finds a Python role titled "Backend Developer");
 *  - words match whole words, the start of a word ("pyth") and, for longer words, part of a word;
 *  - common synonyms are understood ("dev" = developer, "js" = javascript, "front-end" = frontend, "wfh" = remote);
 *  - noise words are ignored ("intern", "internship", "jobs", "for", ...);
 *  - title, skills, company, field, location, work mode, perks and the description are searched, in that order of weight;
 *  - when nothing matches, a likely typo is corrected ("reactt" -> "react"), else the closest roles are offered as "related".
 */
export interface SearchJob {
  title: string;
  company: string;
  cat: string;
  loc: string;
  mode: string;
  skills: string[];
  perks: string[];
  badge: string;
  about: string;
  posted: number;
  _score?: number;
  _fields?: string[];
  [k: string]: unknown;
}

const STOP = new Set(["a", "an", "and", "the", "for", "in", "at", "of", "to", "with", "on", "or", "my", "me", "i", "want", "need", "looking", "find", "any", "some",
  "intern", "interns", "internship", "internships", "job", "jobs", "role", "roles", "position", "positions", "opening", "openings", "vacancy", "paid", "fresher", "freshers", "near"]);

/** Words that mean the same thing for searching. Each group is interchangeable. */
const SYN: string[][] = [
  ["developer", "dev", "engineer", "programmer", "development", "coder"],
  ["frontend", "ui"],
  ["backend", "server"],
  ["fullstack", "full"],
  ["javascript", "js"], ["typescript", "ts"], ["nodejs", "node"], ["reactjs", "react"],
  ["ml", "machine learning"], ["ai", "artificial intelligence"], ["nlp", "language"],
  ["data", "analytics", "analyst", "analysis"], ["bi", "dashboard", "dashboards"],
  ["ux", "user experience", "design", "designer"], ["ui", "user interface"],
  ["seo", "search engine"], ["hr", "human resources", "recruitment", "recruiter", "talent"],
  ["finance", "financial", "accounting", "accountant", "accounts"],
  ["marketing", "growth", "digital marketing", "social media"],
  ["content", "writing", "writer", "copywriting", "copywriter", "blog"],
  ["wfh", "remote", "work from home", "online"],
  ["qa", "tester", "testing", "quality"],
  ["pm", "product", "product manager"], ["cs", "computer science"], ["cloud", "aws", "azure"],
  ["bengaluru", "bangalore"], ["gurugram", "gurgaon"], ["mumbai", "bombay"], ["kolkata", "calcutta"], ["chennai", "madras"],
];

/** PHP rawurlencode(): like encodeURIComponent but also escapes ! ' ( ) *. */
const rawurlencode = (s: string): string => encodeURIComponent(s).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());

const WEIGHT: Record<string, number> = { title: 10, skills: 8, company: 7, cat: 5, loc: 4, mode: 4, perks: 2, about: 1.5 };
const WS = " \\t\\n\\x0B\\f\\r"; // PCRE \s without the UCP flag: ASCII whitespace only

/** lower-case, "front-end" / "front end" -> "frontend", keep letters, digits, + # . */
export function normalize(input: string): string {
  let s = input.toLowerCase();
  s = s.replace(new RegExp(`\\b(front|back|full)[${WS}\\-]+(end|stack)\\b`, "g"), "$1$2");
  s = s.replace(/(?<=\p{L})-(?=\p{L})/gu, "");
  s = s.replace(new RegExp(`[^\\p{L}\\p{N}+#.${WS}]+`, "gu"), " ");
  return phpTrim(s.replace(new RegExp(`[${WS}]+`, "g"), " "));
}

/** The meaningful words of a query. */
export function terms(q: string): string[] {
  const out: string[] = [];
  for (const raw of normalize(Array.from(q).slice(0, 120).join("")).split(" ")) {
    const w = trimChars(raw, ".");
    if (w !== "" && !STOP.has(w) && !out.includes(w)) out.push(w);
  }
  return out.slice(0, 8);
}

/** The word itself plus its synonyms. */
function alts(t: string): string[] {
  let a = [t];
  for (const g of SYN) if (g.includes(t)) a = a.concat(g);
  return [...new Set(a)];
}

type Fields = Record<string, string>;

function fieldsOf(j: SearchJob): Fields {
  const f: Fields = {
    title: String(j.title), skills: (j.skills ?? []).join(" "), company: String(j.company), cat: String(j.cat),
    loc: String(j.loc), mode: String(j.mode) + (String(j.mode) === "Remote" ? " wfh work from home" : ""),
    perks: (j.perks ?? []).join(" ") + " " + String(j.badge), about: String(j.about),
  };
  const out: Fields = {};
  for (const [k, v] of Object.entries(f)) out[k] = normalize(v);
  return out;
}

/** How well one search word matches one field: 1 = whole word, .85 = start of a word, .55 = inside a word, 0 = no. */
function fieldMatch(alt: string, text: string): number {
  if (text === "") return 0;
  if (alt.includes(" ")) return (" " + text + " ").includes(" " + alt + " ") ? 1 : 0;
  let best = 0;
  const altLen = byteLen(alt);
  for (const raw of text.split(" ")) {
    const w = trimChars(raw, ".");
    if (w === alt) return 1;
    if (altLen >= 3 && w.startsWith(alt)) best = Math.max(best, 0.85);
    else if (altLen >= 4 && w.includes(alt)) best = Math.max(best, 0.55);
  }
  return best;
}

/** [score for this word, the field names it hit] */
function termScore(term: string, fields: Fields): [number, string[]] {
  let best = 0;
  const hits: string[] = [];
  alts(term).forEach((alt, i) => {
    const factor = i === 0 ? 1 : 0.6; // the word as typed clearly beats a synonym
    for (const [name, text] of Object.entries(fields)) {
      if (i > 0 && name === "about") continue; // synonyms are not trusted in free-text descriptions
      const m = fieldMatch(alt, text) * WEIGHT[name] * factor;
      if (m > 0) {
        if (!hits.includes(name)) hits.push(name);
        best = Math.max(best, m);
      }
    }
  });
  return [best + (hits.length > 1 ? 1 : 0), hits];
}

export interface SearchResult<J extends SearchJob = SearchJob> {
  jobs: J[];
  terms: string[];
  mode: "all" | "strict" | "related" | "corrected";
  corrected: string | null;
  original: string;
}

export function run<J extends SearchJob>(jobs: J[], q: string): SearchResult<J> {
  const ts = terms(q);
  const original = phpTrim(q);
  if (!ts.length) return { jobs, terms: [], mode: "all", corrected: null, original };
  const docs = jobs.map(fieldsOf);
  const strict = pass(jobs, docs, ts, true);
  if (strict.length) return { jobs: strict, terms: highlightTerms(ts), mode: "strict", corrected: null, original };
  // Nothing matched every word: try fixing a typo against words that really exist in the listings.
  const vocab = vocabulary(docs);
  const fixed: string[] = [];
  let changed = false;
  for (const t of ts) {
    const c = nearest(t, vocab, docs);
    fixed.push(c ?? t);
    changed = changed || (c !== null && c !== t);
  }
  if (changed) {
    const again = pass(jobs, docs, fixed, true);
    if (again.length) return { jobs: again, terms: highlightTerms(fixed), mode: "corrected", corrected: fixed.join(" "), original };
  }
  const related = pass(jobs, docs, ts, false);
  return { jobs: related, terms: highlightTerms(ts), mode: related.length ? "related" : "strict", corrected: null, original };
}

function pass<J extends SearchJob>(jobs: J[], docs: Fields[], ts: string[], all: boolean): J[] {
  let res: J[] = [];
  const phrase = ts.join(" ");
  jobs.forEach((job, i) => {
    let score = 0;
    let matched = 0;
    let hitFields: string[] = [];
    for (const t of ts) {
      const [s, hf] = termScore(t, docs[i]);
      if (s > 0) {
        matched++;
        score += s;
        hitFields = hitFields.concat(hf);
      }
    }
    if ((all && matched < ts.length) || (!all && matched === 0)) return;
    if (ts.length > 1 && docs[i].title.includes(phrase)) score += 12;
    if (matched === ts.length && ts.length > 1) score += 5;
    res.push({ ...job, _score: phpRound(score, 2), _fields: [...new Set(hitFields)] });
  });
  // stable sort: higher score first, then newer (smaller "posted")
  res.sort((a, b) => (b._score as number) - (a._score as number) || a.posted - b.posted);
  if (all && ts.length >= 2 && res.length > 2 && (res[0]._score as number) >= 20) {
    const top = res[0]._score as number;
    res = res.filter((r) => (r._score as number) >= top * 0.4);
  }
  return res;
}

/** Words that are worth highlighting (the word, its synonyms). */
function highlightTerms(ts: string[]): string[] {
  const out = new Set<string>();
  for (const t of ts) for (const a of alts(t)) if (byteLen(a) >= 2 && !a.includes(" ")) out.add(a);
  return [...out];
}

/** word => how many listings use it (from titles, skills, companies and fields). */
function vocabulary(docs: Fields[]): Map<string, number> {
  const v = new Map<string, number>();
  for (const d of docs) {
    for (const f of ["title", "skills", "company", "cat"]) {
      for (const raw of d[f].split(" ")) {
        const w = trimChars(raw, ".");
        if (byteLen(w) >= 3) v.set(w, (v.get(w) ?? 0) + 1);
      }
    }
  }
  return v;
}

/** PHP levenshtein(): byte-wise. */
function levenshtein(a: string, b: string): number {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  let prev = Array.from({ length: y.length + 1 }, (_, j) => j);
  for (let i = 1; i <= x.length; i++) {
    const cur = [i];
    for (let j = 1; j <= y.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[y.length];
}

/** The real word closest to a mistyped one, or null when the word is fine / nothing is close. */
function nearest(t: string, vocab: Map<string, number>, docs: Fields[]): string | null {
  const tl = byteLen(t);
  if (tl < 4 || vocab.has(t)) return null;
  for (const d of docs) if (termScore(t, d)[0] > 0) return null; // already matches somewhere: leave it alone
  const max = tl <= 5 ? 1 : 2;
  let best: string | null = null;
  let bestD = 99;
  for (const [w, n] of vocab) {
    if (Math.abs(byteLen(w) - tl) > max) continue;
    const d = levenshtein(t, w);
    if (d < bestD || (d === bestD && best !== null && n > (vocab.get(best) as number))) {
      best = w;
      bestD = d;
    }
  }
  return bestD <= max ? best : null;
}

/** Escaped HTML for `text` with the search words wrapped in <mark>. */
export function highlight(text: string, ts: string[]): string {
  const list = ts.filter((t) => byteLen(String(t)) >= 2).sort((a, b) => byteLen(b) - byteLen(a));
  if (!list.length || text === "") return esc(text);
  const re = new RegExp("(?<![\\p{L}\\p{N}])(" + list.map(escapeRe).join("|") + ")[\\p{L}\\p{N}]*", "giu");
  let out = "";
  let pos = 0;
  for (const m of text.matchAll(re)) {
    const off = m.index as number;
    out += esc(text.slice(pos, off)) + "<mark>" + esc(m[0]) + "</mark>";
    pos = off + m[0].length;
  }
  return out + esc(text.slice(pos));
}

export interface Suggestion { type: string; label: string; sub: string; url: string }

/** Suggestions for the search box: roles, skills, companies and fields that match what has been typed. */
export function suggest(jobs: SearchJob[], q: string, limit = 8): Suggestion[] {
  const ts = terms(q);
  const items = new Map<string, Suggestion & { rank: number }>();
  const add = (type: string, label: string, sub: string, url: string, rank: number) => {
    const k = type + "|" + label.toLowerCase();
    const cur = items.get(k);
    if (label !== "" && (!cur || cur.rank < rank)) items.set(k, { type, label, sub, url, rank });
  };
  const strip = (all: Array<Suggestion & { rank: number }>): Suggestion[] => all.map(({ rank: _r, ...rest }) => rest);
  const plural = (n: number) => `${n}${n === 1 ? " role" : " roles"}`;
  if (!ts.length) {
    // Nothing typed: the most common skills are the best prompts.
    const skills = new Map<string, number>();
    for (const j of jobs) for (const s of j.skills ?? []) skills.set(String(s), (skills.get(String(s)) ?? 0) + 1);
    for (const [s, n] of [...skills.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit)) add("skill", s, plural(n), "/internships?q=" + rawurlencode(s), n);
    return strip([...items.values()]).slice(0, limit);
  }
  const last = ts[ts.length - 1];
  const norm = normalize(q);
  const count = (field: "skills" | "company" | "cat", value: string): number =>
    jobs.filter((j) => (Array.isArray(j[field]) ? (j[field] as string[]).includes(value) : String(j[field]) === value)).length;
  const lastRe = new RegExp("(^| )" + escapeRe(last), "u");
  const starts = (text: string): boolean => text.startsWith(norm) || lastRe.test(text);
  for (const j of jobs) {
    const ti = normalize(String(j.title));
    if (starts(ti)) add("role", String(j.title), String(j.company), "/internships?q=" + rawurlencode(String(j.title)), ti.startsWith(norm) ? 90 : 70);
    for (const s of j.skills ?? []) {
      if (starts(normalize(String(s)))) {
        const n = count("skills", String(s));
        add("skill", String(s), plural(n), "/internships?q=" + rawurlencode(String(s)), 80 + n / 100);
      }
    }
    if (starts(normalize(String(j.company)))) {
      const n = count("company", String(j.company));
      add("company", String(j.company), plural(n), "/internships?q=" + rawurlencode(String(j.company)), 75);
    }
    if (starts(normalize(String(j.cat)))) {
      const n = count("cat", String(j.cat));
      add("field", String(j.cat), plural(n), "/internships?cat=" + rawurlencode(String(j.cat)), 60);
    }
  }
  if (!items.size) {
    // a typo? offer the closest real word
    const docs = jobs.map(fieldsOf);
    const c = nearest(last, vocabulary(docs), docs);
    if (c !== null) add("did-you-mean", c, "Did you mean?", "/internships?q=" + rawurlencode(c), 50);
  }
  return strip([...items.values()].sort((a, b) => b.rank - a.rank)).slice(0, limit);
}
