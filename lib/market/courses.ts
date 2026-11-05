import { all, one, tx, val } from "../portal/db";

/**
 * The course catalogue (116 Vidaara courses; port of Portal\Courses). data/courses.json is the editable source; sync() upserts it into
 * Postgres, so pages query SQL while content is still managed as one file. Run `npx tsx scripts/courses-sync.ts` after editing the file.
 */
export const FEATURED = ["python-foundations", "front-end-development", "data-analytics-python-sql", "ui-ux-design-figma", "prompt-engineering", "corporate-readiness-interview", "digital-marketing-foundations", "advanced-excel"];

export const LEVEL_GROUPS: Record<string, [string, string[]]> = {
  beginner: ["Beginner", ["B", "B→I"]],
  intermediate: ["Intermediate", ["I", "I→A"]],
  advanced: ["Advanced", ["A", "P", "E"]],
};
export const PAGE_SIZE = 24;

export const PATHS: Array<{ key: string; title: string; tag: string; slugs: string[] }> = [
  { key: "data-analyst", title: "Data Analyst", tag: "Turn numbers into decisions", slugs: ["basic-microsoft-excel", "sql-for-data-business", "data-analytics-python-sql", "business-analytics-power-bi"] },
  { key: "web-developer", title: "Web Developer", tag: "Build and ship real products", slugs: ["git-github", "front-end-development", "api-development", "dsa-for-interviews"] },
  { key: "ai-engineer", title: "AI Engineer", tag: "From Python to generative AI", slugs: ["python-foundations", "machine-learning-python", "deep-learning-neural-networks", "generative-ai-llm-development"] },
  { key: "ux-designer", title: "UI/UX Designer", tag: "Design products people love", slugs: ["graphic-design-canva", "ui-ux-design-figma", "photoshop-illustrator"] },
  { key: "digital-marketer", title: "Digital Marketer", tag: "Grow audiences and revenue", slugs: ["digital-marketing-foundations", "seo", "performance-marketing-ads", "social-media-marketing"] },
  { key: "cloud-devops", title: "Cloud & DevOps Engineer", tag: "Run software at scale", slugs: ["cloud-computing-fundamentals", "linux-shell-scripting", "devops-cicd", "docker-kubernetes"] },
  { key: "career-ready", title: "Interview Ready", tag: "Communicate and get hired", slugs: ["spoken-english", "business-communication", "corporate-readiness-interview"] },
  { key: "web3", title: "Web3 Developer", tag: "Smart contracts and dApps", slugs: ["intro-blockchain-web3", "ethereum-smart-contracts", "solidity-programming-beginners"] },
];

export interface Course {
  id: number; slug: string; title: string; category: string; level: string; level_label: string; tags: string; hours: string; hours_num: number; modules: number;
  weeks: string; pace: string; badge: string; icon: string; prereq: string; best_for: string; brief: string; hands_on: string; outcome: string; sort: number;
  cat_name: string; c1: string; c2: string; learn: string[]; tag_list: string[];
  /** The course fee in paise (rupees x 100), from the payment catalogue; null when no fee is set. Shown on cards and pages whether or not the course can be bought yet. */
  fee_minor: number | null;
  /** What a student can pay today, in paise: null unless the course is on sale. Cards show this, never the price of a course that cannot be bought yet. */
  price_minor: number | null;
}

/** The price someone can pay right now (product on sale, active INR price), in paise; null when the course is not for sale. */
export const SALE_MINOR = "(SELECT pr.amount_minor FROM pay_products pp JOIN pay_prices pr ON pr.product_id = pp.id AND pr.currency = 'INR' AND pr.active = 1 WHERE pp.sku = CONCAT('course-', c.slug) AND pp.active = 1 LIMIT 1)";
export const SELECT = "SELECT c.*, cc.name AS cat_name, cc.c1, cc.c2, " + SALE_MINOR + " AS sale_minor, (SELECT pr.amount_minor FROM pay_products pp JOIN pay_prices pr ON pr.product_id = pp.id AND pr.currency = 'INR' AND pr.active = 1 WHERE pp.sku = CONCAT('course-', c.slug) LIMIT 1) AS fee_minor FROM courses c JOIN course_categories cc ON cc.key_name = c.category";

/**
 * Courses taught outside the lesson player (Vedic Mathematics lives at /vedic-math: 30 modules, module 1 free, the rest with a plan). Their catalogue
 * row was seeded once with an early outline and a seeded shop price, so what the listing shows comes from here: the real size, (its own fee comes from the shop).
 */
const PLAN_TAUGHT: Record<string, Partial<Course>> = {
  "vedic-mathematics": { modules: 30, hours: "About 150 to 180 hrs", hours_num: 150, weeks: "", pace: "Self-paced" },
};

export function map(r: Record<string, unknown>): Course {
  let learn: string[] = [];
  try {
    const v = JSON.parse(String(r.learn_json ?? "[]"));
    if (Array.isArray(v)) learn = v.map(String);
  } catch {
    /* none */
  }
  const tags = String(r.tags ?? "");
  const { learn_json: _l, ...rest } = r;
  const course = { ...(rest as object), learn, tag_list: tags === "" ? [] : tags.split(","), hours_num: Number(r.hours_num), modules: Number(r.modules), fee_minor: r.fee_minor === null || r.fee_minor === undefined ? null : Number(r.fee_minor), price_minor: r.sale_minor === null || r.sale_minor === undefined ? null : Number(r.sale_minor) } as Course;
  return Object.prototype.hasOwnProperty.call(PLAN_TAUGHT, course.slug) ? { ...course, ...PLAN_TAUGHT[course.slug] } : course;
}

const esc = (s: string) => s.replace(/[\\%_]/g, (c) => "\\" + c);


export async function categories(): Promise<Array<{ key: string; name: string; c1: string; c2: string; n: number }>> {
  const rows = await all<Record<string, unknown>>(
    `SELECT cc.key_name AS key, cc.name, cc.c1, cc.c2, COUNT(c.id) AS n FROM course_categories cc LEFT JOIN courses c ON c.category = cc.key_name
     GROUP BY cc.key_name, cc.name, cc.c1, cc.c2, cc.sort ORDER BY cc.sort`,
  );
  return rows.map((r) => ({ key: String(r.key), name: String(r.name), c1: String(r.c1), c2: String(r.c2), n: Number(r.n) }));
}

export async function total(): Promise<number> {
  return Number(await val("SELECT COUNT(*) FROM courses"));
}

export async function bySlug(slug: string): Promise<Course | null> {
  const r = await one(SELECT + " WHERE c.slug = $1", [slug]);
  return r ? map(r) : null;
}

/** Featured courses for the homepage, in the curated order. */
export async function featured(limit = 6): Promise<Course[]> {
  const rows = (await all(SELECT + " WHERE c.slug = ANY($1::text[])", [FEATURED])).map(map);
  rows.sort((a, b) => FEATURED.indexOf(a.slug) - FEATURED.indexOf(b.slug));
  return rows.slice(0, limit);
}

export interface CourseFilters { only?: string[]; q?: string; cat?: string; level?: string; aud?: string; len?: string; sort?: string; page?: number }
export interface CoursePage { items: Course[]; total: number; pages: number; page: number }

export async function search(f: CourseFilters): Promise<CoursePage> {
  const where = ["1=1"];
  const p: unknown[] = [];
  const add = (v: unknown): string => {
    p.push(v);
    return "$" + p.length;
  };
  const q = (f.q ?? "").trim();
  let order = "c.sort ASC";
  if (q !== "") {
    const like = add("%" + esc(q) + "%");
    where.push(`(c.title ILIKE ${like} OR c.brief ILIKE ${like} OR c.learn_json ILIKE ${like} OR c.badge ILIKE ${like} OR c.best_for ILIKE ${like})`);
    order = `CASE WHEN c.title ILIKE ${like} THEN 0 WHEN c.brief ILIKE ${like} THEN 1 ELSE 2 END, c.sort ASC`;
  }
  if (f.only) where.push(`c.slug = ANY(${add(f.only)}::text[])`);
  if (f.cat) where.push(`c.category = ${add(f.cat)}`);
  if (f.level && LEVEL_GROUPS[f.level]) where.push(`c.level = ANY(${add(LEVEL_GROUPS[f.level][1])}::text[])`);
  if (f.aud) where.push(`${add(f.aud)} = ANY(string_to_array(c.tags, ','))`);
  if (f.len === "short") where.push("c.hours_num > 0 AND c.hours_num <= 15");
  else if (f.len === "medium") where.push("c.hours_num > 15 AND c.hours_num <= 40");
  else if (f.len === "long") where.push("c.hours_num > 40");
  if (f.sort === "short") order = "c.hours_num ASC, c.sort ASC";
  else if (f.sort === "long") order = "c.hours_num DESC, c.sort ASC";
  else if (f.sort === "az") order = "c.title ASC";
  const w = where.join(" AND ");
  const totalN = Number(await val(`SELECT COUNT(*) FROM courses c WHERE ${w}`, p));
  const pages = Math.max(1, Math.ceil(totalN / PAGE_SIZE));
  const page = Math.min(Math.max(1, f.page ?? 1), pages);
  const rows = await all(`${SELECT} WHERE ${w} ORDER BY ${order} LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}`, p);
  return { items: rows.map(map), total: totalN, pages, page };
}

/** Courses that teach the given skills (title / learn list), best matches first. */
export async function forSkills(skills: string[], limit = 3, excludeSlugs: string[] = []): Promise<Array<Course & { for_skill: string }>> {
  const out = new Map<string, Course & { for_skill: string }>();
  for (const raw of skills) {
    const s = raw.trim();
    if (s === "") continue;
    const like = "%" + esc(s) + "%";
    const rows = await all(`${SELECT} WHERE c.title ILIKE $1 OR c.brief ILIKE $1 OR c.learn_json ILIKE $1 ORDER BY (c.title ILIKE $1) DESC, c.sort ASC LIMIT 2`, [like]);
    for (const r of rows.map(map)) if (!out.has(r.slug) && !excludeSlugs.includes(r.slug)) out.set(r.slug, { ...r, for_skill: s });
    if (out.size >= limit) break;
  }
  return [...out.values()].slice(0, limit);
}

export async function bySlugs(slugs: string[]): Promise<Course[]> {
  if (!slugs.length) return [];
  const rows = (await all(SELECT + " WHERE c.slug = ANY($1::text[])", [slugs])).map(map);
  return rows.sort((a, b) => slugs.indexOf(a.slug) - slugs.indexOf(b.slug));
}

export interface Path { key: string; title: string; tag: string; courses: Course[]; hours: number; c1: string; c2: string; icon: string }
/** Career paths with their courses resolved and hours totalled. */
export async function paths(): Promise<Path[]> {
  const out: Path[] = [];
  for (const p of PATHS) {
    const courses = await bySlugs(p.slugs);
    if (courses.length < 2) continue;
    out.push({ key: p.key, title: p.title, tag: p.tag, courses, hours: courses.reduce((a, c) => a + c.hours_num, 0), c1: courses[0].c1, c2: courses[0].c2, icon: courses[0].icon });
  }
  return out;
}

export async function totalHours(): Promise<number> {
  return Number(await val("SELECT COALESCE(SUM(hours_num), 0) FROM courses"));
}

/** Fast type-ahead suggestions (titles first, then topic matches). */
export async function suggest(q: string, limit = 7): Promise<Array<{ slug: string; title: string; cat_name: string }>> {
  q = q.trim();
  if (Array.from(q).length < 2) return [];
  const e = esc(q);
  return all(
    `SELECT c.slug, c.title, cc.name AS cat_name FROM courses c JOIN course_categories cc ON cc.key_name = c.category
     WHERE c.title ILIKE $1 OR c.brief ILIKE $1 OR c.learn_json ILIKE $1
     ORDER BY (c.title ILIKE $2) DESC, (c.title ILIKE $1) DESC, c.sort ASC LIMIT ${Math.trunc(limit)}`,
    ["%" + e + "%", e + "%"],
  );
}

/** Other courses in the same category. */
export async function related(course: Pick<Course, "category" | "slug" | "hours_num">, limit = 3): Promise<Course[]> {
  const rows = await all(`${SELECT} WHERE c.category = $1 AND c.slug <> $2 ORDER BY ABS(c.hours_num - $3) ASC, c.sort ASC LIMIT ${Math.trunc(limit)}`, [course.category, course.slug, course.hours_num]);
  return rows.map(map);
}

// ---- sync from JSON -------------------------------------------------------------------------------------------------

interface CatalogueFile {
  categories: Record<string, { name: string; c1?: string; c2?: string }>;
  courses: Array<Record<string, unknown>>;
}

/** Upsert the catalogue (categories, courses) from the parsed JSON and drop courses that are no longer in it. Returns the number of courses. */
export async function sync(j: CatalogueFile): Promise<number> {
  if (!j || !j.courses?.length || !j.categories) throw new Error("courses.json is not in the expected format");
  return tx(async (c) => {
    let i = 0;
    for (const [key, cat] of Object.entries(j.categories)) {
      await c.query(
        `INSERT INTO course_categories (key_name, name, c1, c2, sort) VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (key_name) DO UPDATE SET name = EXCLUDED.name, c1 = EXCLUDED.c1, c2 = EXCLUDED.c2, sort = EXCLUDED.sort`,
        [key, cat.name, cat.c1 ?? "#4338ca", cat.c2 ?? "#818cf8", i++],
      );
    }
    const slugs: string[] = [];
    let n = 0;
    for (const x of j.courses) {
      const hrs = String(x.hours ?? "");
      const num = /(\d+)/.exec(hrs);
      await c.query(
        `INSERT INTO courses (slug, title, category, level, level_label, tags, hours, hours_num, modules, weeks, pace, badge, icon, prereq, best_for, brief, learn_json, hands_on, outcome, sort)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
         ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, level = EXCLUDED.level, level_label = EXCLUDED.level_label, tags = EXCLUDED.tags,
           hours = EXCLUDED.hours, hours_num = EXCLUDED.hours_num, modules = EXCLUDED.modules, weeks = EXCLUDED.weeks, pace = EXCLUDED.pace, badge = EXCLUDED.badge, icon = EXCLUDED.icon,
           prereq = EXCLUDED.prereq, best_for = EXCLUDED.best_for, brief = EXCLUDED.brief, learn_json = EXCLUDED.learn_json, hands_on = EXCLUDED.hands_on, outcome = EXCLUDED.outcome, sort = EXCLUDED.sort`,
        [
          String(x.slug), String(x.title), String(x.cat), String(x.level ?? "B"), String(x.levelLabel ?? ""), ((x.tags as string[]) ?? []).join(","),
          hrs, num ? parseInt(num[1], 10) : 0, Math.trunc(Number(x.modules ?? 0)), String(x.weeks ?? ""), String(x.pace ?? ""), String(x.badge ?? ""), String(x.icon ?? "sparkles"),
          String(x.prereq ?? ""), String(x.bestFor ?? ""), String(x.brief ?? ""), JSON.stringify(((x.learn as unknown[]) ?? []).map(String)), String(x.handsOn ?? ""), String(x.outcome ?? ""), n,
        ],
      );
      slugs.push(String(x.slug));
      n++;
    }
    // Courses removed from the file disappear from the site.
    await c.query("DELETE FROM courses WHERE slug <> ALL($1::text[])", [slugs]);
    return n;
  });
}

export async function ensureSynced(read: () => CatalogueFile): Promise<void> {
  if ((await total()) === 0) await sync(read());
}

