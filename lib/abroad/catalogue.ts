import { all, one, tx, val } from "../portal/db";
import { phpRound } from "../qrscore/php";

/**
 * Study-abroad catalogue (countries, universities) and the deterministic Safe / Target / Reach fit engine (port of Portal\Abroad).
 * Everything the engine uses is explicit and editable in data/study-abroad.json. Selectivity bands and cost ranges are EDITORIAL
 * ESTIMATES, not official statistics and not admission predictions.
 */
export const FIELDS = ["Computer Science & IT", "Data Science & AI", "Engineering", "Business & Management", "Economics & Finance", "Design & Arts", "Health & Life Sciences", "Sciences", "Law & Social Sciences"];

export const STAGES: Record<string, [string, string]> = {
  ONBOARDING: ["Profile", "Tell us about your academics, budget and goals"],
  DOC_COLLECTION: ["Documents", "Upload and verify your documents"],
  IN_REVIEW: ["Review", "A counselor reviews your application"],
  APPLIED: ["Applied", "Your application is sent to the university"],
  OFFER_RECEIVED: ["Offer", "Compare offers and plan your funds"],
  VISA_PREP: ["Visa", "Prepare your visa file"],
  ALUMNI: ["Arrived", "Settle in and join the alumni network"],
};

/** Minimum academic index (0-100) a typical admit shows, by editorial selectivity band. */
const BAND_THRESHOLD: Record<number, number> = { 1: 55, 2: 62, 3: 70, 4: 78, 5: 86 };
/** Typical English requirement in IELTS terms, by band. */
const BAND_ENGLISH: Record<number, number> = { 1: 6.0, 2: 6.0, 3: 6.5, 4: 6.5, 5: 7.0 };

export interface Country {
  key: string; name: string; code: string; currency: string; c1: string; c2: string; fx: number; reviewed?: string;
  tuition: { low: number; mid: number; high: number; [k: string]: number };
  living: { low: number; high: number };
  visa?: { name: string; steps: string[] };
  [k: string]: unknown;
}
export interface University {
  id: number; slug: string; country_key: string; name: string; city: string; type: string; url: string; band: number; cost_tier: string; levels: string;
  fields: string[]; level_list: string[]; english_taught: boolean; blurb: string; sort: number;
}
export interface Profile {
  academic_index: number | null; field: string; budget_inr: number | null; countries: string; english_eq: number | null; level: string;
}
export interface Cost { currency: string; tuition: number; living: number; total_local: number; total_inr: number; tuition_inr: number }
export interface Fit {
  category: "Safe" | "Target" | "Reach"; score: number; reasons: string[]; cautions: string[]; cost: Cost; within_budget: boolean | null; english_ok: boolean | null; english_need: number;
}
export type Recommended = University & { fit: Fit };

// ---- sync from JSON -------------------------------------------------------------------------------------------------------

interface CatalogueFile {
  fx: Record<string, number>;
  reviewed?: string;
  countries: Array<Record<string, unknown> & { key: string; name: string; code: string; currency: string }>;
  universities: Array<Record<string, unknown> & { slug: string; country: string; name: string; city: string; type: string; url: string; band: number; cost: string; levels: string[]; fields: string[] }>;
}

/** Upsert countries and universities. Universities removed from the file are kept: students may have shortlists or applications that reference them. */
export async function sync(j: CatalogueFile): Promise<number> {
  if (!j?.countries?.length || !j?.universities?.length) throw new Error("study-abroad.json is not in the expected format");
  return tx(async (c) => {
    let i = 0;
    for (const x of j.countries) {
      const meta = { ...x, fx: j.fx?.[x.currency] ?? 1, reviewed: j.reviewed ?? "" };
      await c.query(
        `INSERT INTO sa_countries (key_name, name, code, currency, data_json, sort) VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (key_name) DO UPDATE SET name = EXCLUDED.name, code = EXCLUDED.code, currency = EXCLUDED.currency, data_json = EXCLUDED.data_json, sort = EXCLUDED.sort`,
        [x.key, x.name, x.code, x.currency, JSON.stringify(meta), i++],
      );
    }
    let n = 0;
    for (const x of j.universities) {
      await c.query(
        `INSERT INTO sa_universities (slug, country_key, name, city, type, url, band, cost_tier, levels, fields_json, english_taught, blurb, sort)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         ON CONFLICT (slug) DO UPDATE SET country_key = EXCLUDED.country_key, name = EXCLUDED.name, city = EXCLUDED.city, type = EXCLUDED.type, url = EXCLUDED.url, band = EXCLUDED.band,
           cost_tier = EXCLUDED.cost_tier, levels = EXCLUDED.levels, fields_json = EXCLUDED.fields_json, english_taught = EXCLUDED.english_taught, blurb = EXCLUDED.blurb, sort = EXCLUDED.sort`,
        [x.slug, x.country, x.name, x.city, x.type, x.url, Math.trunc(Number(x.band)), x.cost, x.levels.join(","), JSON.stringify(x.fields), x.english_taught ? 1 : 0, String(x.blurb ?? ""), n++],
      );
    }
    return n;
  });
}

// ---- catalogue ------------------------------------------------------------------------------------------------------------

function mapCountry(r: Record<string, unknown>): Country {
  let d: Record<string, unknown> = {};
  try {
    d = JSON.parse(String(r.data_json ?? "{}")) ?? {};
  } catch {
    /* none */
  }
  return { key: String(r.key_name), name: String(r.name), code: String(r.code), currency: String(r.currency), ...d } as Country;
}

export async function countries(): Promise<Record<string, Country & { n: number }>> {
  const out: Record<string, Country & { n: number }> = {};
  for (const r of await all("SELECT c.*, (SELECT COUNT(*) FROM sa_universities u WHERE u.country_key = c.key_name) AS n FROM sa_countries c ORDER BY c.sort")) {
    const c = mapCountry(r);
    out[c.key] = { ...c, n: Number(r.n) };
  }
  return out;
}

export async function country(key: string): Promise<Country | null> {
  const r = await one("SELECT * FROM sa_countries WHERE key_name = $1", [key]);
  return r ? mapCountry(r) : null;
}

export function mapUni(r: Record<string, unknown>): University {
  let fields: string[] = [];
  try {
    const v = JSON.parse(String(r.fields_json ?? "[]"));
    if (Array.isArray(v)) fields = v.map(String);
  } catch {
    /* none */
  }
  const levels = String(r.levels ?? "");
  const { fields_json: _f, ...rest } = r;
  return { ...(rest as object), id: Number(r.id), band: Number(r.band), fields, level_list: levels === "" ? [] : levels.split(","), english_taught: Number(r.english_taught) === 1 } as University;
}

export async function university(slug: string): Promise<University | null> {
  const r = await one("SELECT * FROM sa_universities WHERE slug = $1", [slug]);
  return r ? mapUni(r) : null;
}

export async function universityById(id: number): Promise<University | null> {
  const r = await one("SELECT * FROM sa_universities WHERE id = $1", [id]);
  return r ? mapUni(r) : null;
}

export interface UniFilter { country?: string; field?: string; level?: string; type?: string; q?: string; band?: string; sort?: string }

export async function universities(f: UniFilter = {}): Promise<University[]> {
  const w = ["1=1"];
  const p: unknown[] = [];
  const add = (v: unknown) => (p.push(v), "$" + p.length);
  const esc = (s: string) => s.replace(/[\\%_]/g, (c) => "\\" + c);
  if (f.country) w.push(`country_key = ${add(f.country)}`);
  if (f.type === "public" || f.type === "private") w.push(`type = ${add(f.type)}`);
  if (f.level === "UG" || f.level === "PG") w.push(`${add(f.level)} = ANY(string_to_array(levels, ','))`); // PHP used MySQL's FIND_IN_SET here, which Postgres does not have
  if (f.field) w.push(`fields_json LIKE ${add("%" + esc(JSON.stringify(f.field)) + "%")}`);
  if (f.q) {
    const like = add("%" + esc(f.q) + "%");
    w.push(`(name ILIKE ${like} OR city ILIKE ${like})`);
  }
  const order = ({ name: "name ASC", selective: "band DESC, name ASC", open: "band ASC, name ASC" } as Record<string, string>)[f.sort ?? ""] ?? "band DESC, sort ASC";
  return (await all(`SELECT * FROM sa_universities WHERE ${w.join(" AND ")} ORDER BY ${order}`, p)).map(mapUni);
}

export async function totalUniversities(): Promise<number> {
  return Number(await val("SELECT COUNT(*) FROM sa_universities"));
}

// ---- cost -----------------------------------------------------------------------------------------------------------------

/** Indicative annual cost (tuition + living) in local currency and INR. */
export function cost(uni: Pick<University, "cost_tier">, c: Pick<Country, "tuition" | "living" | "fx" | "currency">): Cost {
  const tuition = Number(c.tuition[uni.cost_tier] ?? c.tuition.mid);
  const living = (Number(c.living.low) + Number(c.living.high)) / 2;
  const fx = Number(c.fx ?? 1);
  return {
    currency: c.currency,
    tuition: Math.round(tuition),
    living: Math.round(living),
    total_local: Math.round(tuition + living),
    total_inr: Math.round((tuition + living) * fx),
    tuition_inr: Math.round(tuition * fx),
  };
}

// ---- conversions ------------------------------------------------------------------------------------------------------------

/** Academic index on a 0-100 scale from the score type the student reports. */
export function academicIndex(type: string, value: number): number {
  const v = type === "cgpa10" ? value * 9.5 : type === "gpa4" ? value * 25 : value; // widely used CGPA-to-percentage approximation
  return Math.max(0, Math.min(100, phpRound(v, 2)));
}

/** Approximate IELTS equivalent of an English test score (ETS / PTE published comparisons). */
export function englishEq(test: string, score: number): number | null {
  if (test === "IELTS") return Math.max(0, Math.min(9, phpRound(score * 2) / 2));
  const table: Record<string, Array<[number, number]>> = {
    TOEFL: [[118, 9], [115, 8.5], [110, 8], [102, 7.5], [94, 7], [79, 6.5], [60, 6], [46, 5.5], [35, 5]],
    PTE: [[84, 8.5], [79, 8], [73, 7.5], [65, 7], [58, 6.5], [50, 6], [42, 5.5], [36, 5]],
  };
  const t = table[test];
  if (!t) return null;
  for (const [min, eq] of t) if (score >= min) return eq;
  return 4.5;
}

export const requiredEnglish = (uni: Pick<University, "band">): number => BAND_ENGLISH[uni.band] ?? 6.5;

// ---- fit engine -------------------------------------------------------------------------------------------------------------

const fixed1 = (n: number) => n.toFixed(1);

/**
 * Safe / Target / Reach plus an explainable 0-100 fit score.
 * Weights: academics 40, field 25, budget 20, country preference 10, English 5.
 */
export function fit(profile: Profile, uni: University, c: Country): Fit {
  const index = Number(profile.academic_index ?? 0);
  const gap = index - BAND_THRESHOLD[uni.band];
  // The more selective the university, the less room below its typical level still counts as a Target.
  const targetFloor = ({ 1: -8, 2: -7, 3: -6, 4: -4, 5: 0 } as Record<number, number>)[uni.band] ?? -6;
  let category: Fit["category"] = gap >= 8 ? "Safe" : gap >= targetFloor ? "Target" : "Reach";
  if (uni.band >= 5 && category === "Safe") category = "Target"; // the most selective institutions are never a safe bet

  const reasons: string[] = [];
  const cautions: string[] = [];
  const academic = Math.max(0, Math.min(100, 50 + gap * 2.5));
  reasons.push(gap >= 0 ? "Your academic profile is at or above the typical level for this university" : "Your academic profile is below the typical level for this university");

  const inField = profile.field !== "" && uni.fields.includes(profile.field);
  const fieldScore = profile.field === "" ? 50 : inField ? 100 : 30;
  if (inField) reasons.push("Strong in " + profile.field);
  else if (profile.field !== "") cautions.push(profile.field + " is not one of its listed strengths");

  const cst = cost(uni, c);
  const budget = Math.trunc(Number(profile.budget_inr ?? 0));
  let within: boolean | null = null;
  let budgetScore = 60;
  if (budget > 0) {
    const ratio = cst.total_inr / budget;
    within = ratio <= 1;
    budgetScore = ratio <= 1 ? 100 : ratio <= 1.25 ? 60 : 20;
    if (within) reasons.push("Within your yearly budget");
    else cautions.push("Estimated cost is " + phpRound((ratio - 1) * 100) + "% above your yearly budget");
  }

  const prefs = String(profile.countries ?? "").split(",").filter((x) => x !== "" && x !== "0");
  const countryScore = !prefs.length ? 60 : prefs.includes(c.key) ? 100 : 40;
  if (prefs.length && prefs.includes(c.key)) reasons.push("In a country you chose");

  const need = requiredEnglish(uni);
  const eq = profile.english_eq !== null && profile.english_eq !== undefined ? Number(profile.english_eq) : null;
  const englishOk = eq === null ? null : eq >= need;
  const englishScore = eq === null ? 50 : eq >= need ? 100 : 40;
  if (eq === null) cautions.push("Add an English test score; this university typically expects about IELTS " + fixed1(need));
  else if (eq < need) cautions.push("Typical English requirement is about IELTS " + fixed1(need) + " (yours is " + fixed1(eq) + ")");

  const score = Math.round(academic * 0.4 + fieldScore * 0.25 + budgetScore * 0.2 + countryScore * 0.1 + englishScore * 0.05);
  return { category, score: Math.max(0, Math.min(100, score)), reasons, cautions, cost: cst, within_budget: within, english_ok: englishOk, english_need: need };
}

/** Fit for every university that offers the student's level, best first. */
export function rank(profile: Profile, unis: University[], cs: Record<string, Country>): Recommended[] {
  const out: Recommended[] = [];
  for (const u of unis) {
    const c = cs[u.country_key];
    if (!c) continue;
    if (!u.level_list.includes(profile.level)) continue;
    out.push({ ...u, fit: fit(profile, u, c) });
  }
  return out.sort((a, b) => b.fit.score - a.fit.score);
}

export async function recommend(profile: Profile, cs: Record<string, Country>, only?: UniFilter): Promise<Recommended[]> {
  return rank(profile, await universities(only ?? {}), cs);
}

export function inr(amount: number): string {
  const trim = (s: string) => s.replace(/0+$/, "").replace(/\.$/, "");
  if (amount >= 10000000) return "Rs " + trim((amount / 10000000).toFixed(2)) + " crore";
  if (amount >= 100000) return "Rs " + trim((amount / 100000).toFixed(1)) + " lakh";
  return "Rs " + Math.trunc(amount).toLocaleString("en-US");
}
