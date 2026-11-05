/**
 * The course catalogue's query vocabulary, as pure code: which filters and sorts exist, how a URL (or the API's query string) becomes a validated
 * query, how a search phrase is split into terms, and how a query becomes a URL again. The page, the search API and the browser all use this one
 * file, so the URL always means the same thing everywhere. Nothing here touches the database.
 */
export const LEVELS: Record<string, string> = { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" };
export const LENS: Record<string, string> = { short: "Up to 15 hours", medium: "15 to 40 hours", long: "More than 40 hours" };
export const PRICES: Record<string, string> = { free: "Free", u400: "Under ₹400", m600: "₹400 to ₹599", o600: "₹600 and above" };
export const AUDS: Record<string, string> = { College: "College students", Fresher: "Freshers", Mid: "Mid-career", Senior: "Senior leaders", Founder: "Founders" };
export const SORTS: Record<string, string> = {
  relevance: "Most relevant",
  recommended: "Recommended",
  az: "Title A to Z",
  za: "Title Z to A",
  "price-asc": "Price: low to high",
  "price-desc": "Price: high to low",
  short: "Shortest first",
  long: "Longest first",
};
export const PAGE_SIZES = [12, 24, 48] as const;
export const DEFAULT_PAGE_SIZE = 24;

export interface CatalogQuery {
  q: string;
  /** Selected category keys, any of them. */
  cat: string[];
  level: string[];
  len: string[];
  price: string[];
  aud: string[];
  /** Only courses whose lessons are on GrowQR now. */
  available: boolean;
  sort: string;
  page: number;
  size: number;
}

export const emptyQuery = (): CatalogQuery => ({ q: "", cat: [], level: [], len: [], price: [], aud: [], available: false, sort: "", page: 1, size: DEFAULT_PAGE_SIZE });

type Raw = Record<string, string | string[] | undefined> | URLSearchParams;
const get = (raw: Raw, k: string): string => {
  const v = raw instanceof URLSearchParams ? raw.get(k) : raw[k];
  return (Array.isArray(v) ? v[0] : v) ?? "";
};
const list = (raw: Raw, k: string, allowed: (v: string) => boolean): string[] => [...new Set(get(raw, k).split(",").map((x) => x.trim()).filter(allowed))];

/** Whitespace squeezed, control characters dropped, at most 80 characters. */
export const cleanPhrase = (s: string): string => Array.from(s.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim()).slice(0, 80).join("");

/** Validate raw input (a URL's search params or a Next searchParams object). Unknown values are dropped, never passed on. */
export function parseQuery(raw: Raw, categoryKeys: string[]): CatalogQuery {
  const q = cleanPhrase(get(raw, "q"));
  const sortRaw = get(raw, "sort");
  const size = Number(get(raw, "size"));
  const sort = SORTS[sortRaw] ? sortRaw : "";
  return {
    q,
    cat: list(raw, "cat", (v) => categoryKeys.includes(v)),
    level: list(raw, "level", (v) => !!LEVELS[v]),
    len: list(raw, "len", (v) => !!LENS[v]),
    price: list(raw, "price", (v) => !!PRICES[v]),
    aud: list(raw, "aud", (v) => !!AUDS[v]),
    available: get(raw, "available") === "1",
    sort: sort === "relevance" && q === "" ? "" : sort,
    page: Math.min(500, Math.max(1, Math.trunc(Number(get(raw, "page"))) || 1)),
    size: (PAGE_SIZES as readonly number[]).includes(size) ? size : DEFAULT_PAGE_SIZE,
  };
}

/** The sort that really applies: relevance when there is a search phrase and nothing else was asked for, otherwise the owner's recommended order. */
export const effectiveSort = (q: CatalogQuery): string => q.sort || (q.q ? "relevance" : "recommended");

/** The query as URL search params, leaving out everything that is at its default so URLs stay short and canonical. */
export function toParams(q: CatalogQuery, over: Partial<CatalogQuery> = {}): URLSearchParams {
  const v = { ...q, ...over };
  const p = new URLSearchParams();
  if (v.q) p.set("q", v.q);
  if (v.cat.length) p.set("cat", v.cat.join(","));
  if (v.level.length) p.set("level", v.level.join(","));
  if (v.len.length) p.set("len", v.len.join(","));
  if (v.price.length) p.set("price", v.price.join(","));
  if (v.aud.length) p.set("aud", v.aud.join(","));
  if (v.available) p.set("available", "1");
  if (v.sort && !(v.sort === "relevance" && v.q)) p.set("sort", v.sort);
  if (v.size !== DEFAULT_PAGE_SIZE) p.set("size", String(v.size));
  if (v.page > 1) p.set("page", String(v.page));
  return p;
}
export const toHref = (q: CatalogQuery, over: Partial<CatalogQuery> = {}): string => { const s = toParams(q, over).toString(); return "/courses" + (s ? "?" + s : ""); };

export const hasFilters = (q: CatalogQuery): boolean => !!(q.q || q.cat.length || q.level.length || q.len.length || q.price.length || q.aud.length || q.available);

/** Words that say nothing about which course is meant ("courses for business analytics" is about business analytics). */
const STOP = new Set(["course", "courses", "class", "classes", "for", "with", "and", "the", "of", "in", "to", "a", "an", "on", "my", "me", "i", "want", "learn", "learning", "how", "about", "best", "online", "free"]);

/**
 * Split a search phrase into the terms every course must match. Lower-cased, punctuation removed (but c++, c# and .net keep their symbols), common filler
 * words dropped, duplicates removed, at most 6 terms. If everything was filler ("free courses") the original words are kept so the search still means something.
 */
export function tokenize(phrase: string): string[] {
  let text = cleanPhrase(phrase).toLowerCase();
  const joined: string[] = [];
  for (const ph of PHRASES) if (text.includes(ph)) { joined.push(ph); text = text.split(ph).join(" "); }
  const words = [...joined, ...text.replace(/[^\p{L}\p{N}+#.\s-]/gu, " ").split(/\s+/).map((w) => w.replace(/^[.-]+|[.-]+$/g, "")).filter(Boolean)];
  const kept = words.filter((w) => !STOP.has(w));
  return [...new Set(kept.length ? kept : words)].slice(0, 6);
}

/** Phrases that are one idea: kept together as a single term, so "artificial intelligence" can also be found as "AI". */
const PHRASES = ["artificial intelligence", "machine learning", "deep learning", "user experience", "user interface", "power bi", "search engine optimization"];

/** Words that mean the same thing in course titles and descriptions. A term matches a course if the term or any of its synonyms does. */
const SYNONYMS: Record<string, string[]> = {
  ai: ["artificial intelligence"], "artificial intelligence": ["ai"],
  ml: ["machine learning"], "machine learning": ["ml"],
  js: ["javascript"], javascript: ["js"],
  ux: ["user experience"], "user experience": ["ux"],
  ui: ["user interface"], "user interface": ["ui"],
  seo: ["search engine optimization"], "search engine optimization": ["seo"],
  excel: ["spreadsheet", "spreadsheets"],
};

/** The term and its synonyms: any one of them counts as a match for the term. */
export const alternatives = (term: string): string[] => [term, ...(Object.prototype.hasOwnProperty.call(SYNONYMS, term) ? SYNONYMS[term] : [])];

/** Escape LIKE wildcards in a term. */
export const likeEscape = (s: string): string => s.replace(/[\\%_]/g, (c) => "\\" + c);

export interface Chip { key: string; label: string; remove: Partial<CatalogQuery> }
/** The active filters as removable chips; `remove` is what to change to drop that one chip and keep everything else. */
export function chips(q: CatalogQuery, catName: (key: string) => string): Chip[] {
  const out: Chip[] = [];
  if (q.q) out.push({ key: "q", label: `“${q.q}”`, remove: { q: "", page: 1 } });
  for (const c of q.cat) out.push({ key: `cat:${c}`, label: catName(c), remove: { cat: q.cat.filter((x) => x !== c), page: 1 } });
  for (const v of q.level) out.push({ key: `level:${v}`, label: LEVELS[v], remove: { level: q.level.filter((x) => x !== v), page: 1 } });
  for (const v of q.len) out.push({ key: `len:${v}`, label: LENS[v], remove: { len: q.len.filter((x) => x !== v), page: 1 } });
  for (const v of q.price) out.push({ key: `price:${v}`, label: PRICES[v], remove: { price: q.price.filter((x) => x !== v), page: 1 } });
  for (const v of q.aud) out.push({ key: `aud:${v}`, label: AUDS[v], remove: { aud: q.aud.filter((x) => x !== v), page: 1 } });
  if (q.available) out.push({ key: "available", label: "Lessons available now", remove: { available: false, page: 1 } });
  return out;
}

/** Split `text` into parts that match a search term and parts that do not, as plain data (the caller renders it, so no HTML is ever built from user input). */
export function highlight(text: string, terms: string[]): Array<{ t: string; hit: boolean }> {
  const ts = terms.filter((t) => t.length > 0).sort((a, b) => b.length - a.length);
  if (!ts.length) return [{ t: text, hit: false }];
  const re = new RegExp("(" + ts.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")", "gi");
  return text.split(re).filter((s) => s !== "").map((s) => ({ t: s, hit: ts.some((t) => t.toLowerCase() === s.toLowerCase()) }));
}
