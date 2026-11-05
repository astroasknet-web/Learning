import { all, val } from "../portal/db";
import { nativeSlugs } from "./lessons";
import { LEVEL_GROUPS, SALE_MINOR, SELECT, map, type Course } from "./courses";
import { alternatives, effectiveSort, likeEscape, tokenize, type CatalogQuery } from "./catalog-query";

/**
 * Catalogue search, filters, sorting and paging, all in SQL (the catalogue never goes to the browser to be filtered there).
 *
 * Matching: the phrase is split into terms (tokenize). Every term must match at least one of the course's searchable fields (title, short description, what you
 * learn, badge, audience tags, best-for, outcome, hands-on project, level, field), so "python data" never returns a course that only mentions one of them.
 * A term matches at the start of a word, so a partial keyword ("pyth") finds Python; terms of three letters or fewer ("ai", "sql", "c") must be whole words, so "ai" never matches inside "maintain".
 *
 * Relevance: the exact title is worth the most, then a title that starts with or contains the phrase, then, per term, a hit in the title, in the field and tags,
 * in what you learn, in the descriptive text. Ties fall to the owner's recommended order and then the course id, so paging is stable.
 */
export interface CatalogPage { items: Course[]; total: number; pages: number; page: number }

const FIELDS = ["c.title", "c.brief", "c.learn_json", "c.badge", "c.tags", "c.best_for", "c.outcome", "c.hands_on", "c.level_label", "cc.name"];
const SHORT_TERM = 3;
const SALE = SALE_MINOR;
const escRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

interface Built { where: string; score: string; params: unknown[] }

export function build(q: CatalogQuery): Built {
  const params: unknown[] = [];
  const add = (v: unknown): string => { params.push(v); return "$" + params.length; };
  const where: string[] = ["1=1"];
  const terms = tokenize(q.q);
  let score = "0";
  if (terms.length) {
    const phrase = terms.join(" ");
    const exact = add(phrase), starts = add(likeEscape(phrase) + "%"), has = add("%" + likeEscape(phrase) + "%");
    const parts = [`(CASE WHEN LOWER(c.title) = ${exact} THEN 1000 ELSE 0 END)`, `(CASE WHEN c.title ILIKE ${starts} THEN 400 ELSE 0 END)`, `(CASE WHEN c.title ILIKE ${has} THEN 300 ELSE 0 END)`];
    for (const t of terms) {
      // A term matches at the start of a word, so a partial keyword ("pyth") finds Python but "ai" never matches inside "maintain"; very short terms must be whole words.
      const one = (col: string, w: string): string => `${col} REGEXP ${add("\\b" + escRe(w) + (w.length <= SHORT_TERM ? "\\b" : ""))}`;
      const hit = (col: string): string => "(" + alternatives(t).map((w) => one(col, w)).join(" OR ") + ")";
      where.push("(" + FIELDS.map(hit).join(" OR ") + ")");
      parts.push(
        `(CASE WHEN ${hit("c.title")} THEN 60 ELSE 0 END)`,
        `(CASE WHEN ${hit("c.badge")} OR ${hit("cc.name")} OR ${hit("c.tags")} THEN 30 ELSE 0 END)`,
        `(CASE WHEN ${hit("c.learn_json")} THEN 25 ELSE 0 END)`,
        `(CASE WHEN ${hit("c.best_for")} OR ${hit("c.outcome")} OR ${hit("c.hands_on")} THEN 12 ELSE 0 END)`,
        `(CASE WHEN ${hit("c.brief")} THEN 10 ELSE 0 END)`,
      );
    }
    score = parts.join(" + ");
  }
  if (q.cat.length) where.push(`c.category IN (${q.cat.map(add).join(",")})`);
  if (q.level.length) where.push(`c.level IN (${q.level.flatMap((l) => LEVEL_GROUPS[l]?.[1] ?? []).map(add).join(",")})`);
  if (q.len.length) {
    const r: Record<string, string> = { short: "c.hours_num <= 15", medium: "(c.hours_num > 15 AND c.hours_num <= 40)", long: "c.hours_num > 40" };
    where.push("(" + q.len.map((l) => r[l]).join(" OR ") + ")");
  }
  if (q.price.length) {
    const unpriced = `NOT EXISTS (SELECT 1 FROM pay_products pf JOIN pay_prices pp2 ON pp2.product_id = pf.id AND pp2.currency = 'INR' AND pp2.amount_minor > 0 WHERE pf.sku = CONCAT('course-', c.slug))`;
    const pr: Record<string, () => string> = {
      u400: () => `(${SALE}) < 40000`,
      m600: () => `((${SALE}) >= 40000 AND (${SALE}) < 60000)`,
      o600: () => `(${SALE}) >= 60000`,
      free: () => `(c.slug = ANY(${add(nativeSlugs())}::text[]) AND ${unpriced})`, // taught here and never given a price in the shop
    };
    where.push("(" + q.price.map((p) => pr[p]()).join(" OR ") + ")");
  }
  if (q.aud.length) where.push("(" + q.aud.map((a) => `${add(a)} = ANY(string_to_array(c.tags, ','))`).join(" OR ") + " OR 'All' = ANY(string_to_array(c.tags, ',')))");
  if (q.available) where.push(`c.slug = ANY(${add(nativeSlugs())}::text[])`);
  return { where: where.join(" AND "), score, params };
}

const ORDER: Record<string, (score: string) => string> = {
  relevance: (s) => `(${s}) DESC, c.sort ASC, c.id ASC`,
  recommended: () => "c.sort ASC, c.id ASC",
  az: () => "c.title ASC, c.id ASC",
  za: () => "c.title DESC, c.id ASC",
  "price-asc": () => `(${SALE}) IS NULL, (${SALE}) ASC, c.title ASC, c.id ASC`,
  "price-desc": () => `(${SALE}) IS NULL, (${SALE}) DESC, c.title ASC, c.id ASC`,
  short: () => "c.hours_num ASC, c.sort ASC, c.id ASC",
  long: () => "c.hours_num DESC, c.sort ASC, c.id ASC",
};

export async function searchCatalog(q: CatalogQuery): Promise<CatalogPage> {
  const b = build(q);
  const from = "FROM courses c JOIN course_categories cc ON cc.key_name = c.category";
  const total = Number(await val(`SELECT COUNT(*) ${from} WHERE ${b.where}`, b.params));
  const pages = Math.max(1, Math.ceil(total / q.size));
  const page = Math.min(q.page, pages);
  const order = (ORDER[effectiveSort(q)] ?? ORDER.recommended)(b.score);
  const rows = await all(`${SELECT} WHERE ${b.where} ORDER BY ${order} LIMIT ${q.size} OFFSET ${(page - 1) * q.size}`, b.params);
  return { items: rows.map(map), total, pages, page };
}

/** Courses taught here that have never been priced, so the Free filter is only offered when it would show something. */
export async function freeCount(): Promise<number> {
  return Number(await val(`SELECT COUNT(*) FROM courses c WHERE c.slug = ANY($1::text[]) AND NOT EXISTS (SELECT 1 FROM pay_products pf JOIN pay_prices pp2 ON pp2.product_id = pf.id AND pp2.currency = 'INR' AND pp2.amount_minor > 0 WHERE pf.sku = CONCAT('course-', c.slug))`, [nativeSlugs()]));
}

export interface Suggestion { slug: string; title: string; cat_name: string; c1: string; c2: string; icon: string; here: boolean }

/** Type-ahead: the best few matches for what has been typed so far, with the same matching and scoring as the search. */
export async function suggestCatalog(phrase: string, limit = 6): Promise<Suggestion[]> {
  if (tokenize(phrase).join("").length < 2) return [];
  const b = build({ q: phrase, cat: [], level: [], len: [], price: [], aud: [], available: false, sort: "relevance", page: 1, size: limit });
  const rows = await all<Record<string, unknown>>(
    `SELECT c.slug, c.title, cc.name AS cat_name, cc.c1, cc.c2, c.icon FROM courses c JOIN course_categories cc ON cc.key_name = c.category WHERE ${b.where} ORDER BY (${b.score}) DESC, c.sort ASC, c.id ASC LIMIT ${Math.trunc(limit)}`,
    b.params,
  );
  const native = new Set(nativeSlugs());
  return rows.map((r) => ({ slug: String(r.slug), title: String(r.title), cat_name: String(r.cat_name), c1: String(r.c1), c2: String(r.c2), icon: String(r.icon), here: native.has(String(r.slug)) }));
}
