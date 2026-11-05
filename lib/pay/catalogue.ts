import { PLANS } from "@/lib/market/plans";
import { isNative } from "@/lib/market/lessons";
import catalogue from "@/lib/market/data/courses.json";
import { COURSE_FEE_RUPEES, EXAM_PRODUCTS, RESUME_STUDIO_PRO_RUPEES, SERVICE_PRODUCTS, STUDIO_COURSES } from "./course-fees";
import { ONLINE_PACKAGES, packageSku } from "@/lib/abroad/packages";
import { first, pool, rows, exec, insertId, type Db, type Row } from "./db";

/**
 * Read access to products, prices and tax rules, plus `seedCatalogue`, which adds the products the site already advertises (the
 * Pro, Silver and Gold plans and Resume Studio Pro). Seeding only inserts what is missing: it never overwrites a price someone changed in the admin screen.
 */
export interface Product { id: number; sku: string; kind: string; title: string; description: string; active: boolean; allowGuest: boolean; fulfilRef: string; accessDays: number | null; maxQty: number }
export interface Price { currency: string; amountMinor: number; taxInclusive: boolean }

const toProduct = (r: Row): Product => ({ id: Number(r.id), sku: r.sku, kind: r.kind, title: r.title, description: r.description, active: !!r.active, allowGuest: !!r.allow_guest, fulfilRef: r.fulfil_ref, accessDays: r.access_days === null ? null : Number(r.access_days), maxQty: Number(r.max_qty) });

export async function productsBySku(db: Db, skus: string[]): Promise<Map<string, Product>> {
  if (!skus.length) return new Map();
  const r = await rows(db, "SELECT * FROM pay_products WHERE sku IN ($1) AND active = 1", [skus]);
  return new Map(r.map((x) => [x.sku as string, toProduct(x)]));
}

export async function pricesFor(db: Db, productIds: number[]): Promise<Map<number, Map<string, Price>>> {
  const out = new Map<number, Map<string, Price>>();
  if (!productIds.length) return out;
  const r = await rows(db, "SELECT p.product_id, p.currency, p.amount_minor, p.tax_inclusive FROM pay_prices p JOIN pay_currencies c ON c.code = p.currency AND c.enabled = 1 WHERE p.product_id IN ($1) AND p.active = 1", [productIds]);
  for (const x of r) {
    const m = out.get(Number(x.product_id)) ?? new Map<string, Price>();
    m.set(x.currency, { currency: x.currency, amountMinor: Number(x.amount_minor), taxInclusive: !!x.tax_inclusive });
    out.set(Number(x.product_id), m);
  }
  return out;
}

export async function taxRule(db: Db, country: string): Promise<{ name: string; rateBp: number } | null> {
  const r = await first<{ name: string; rate_bp: number }>(db, "SELECT name, rate_bp FROM pay_tax_rules WHERE country = $1 AND active = 1", [country.toUpperCase()]);
  return r ? { name: r.name, rateBp: Number(r.rate_bp) } : null;
}

export async function listProducts(db: Db = pool): Promise<Array<Product & { prices: Price[] }>> {
  const list = await rows(db, "SELECT * FROM pay_products ORDER BY kind, sku");
  const prices = await rows(db, "SELECT product_id, currency, amount_minor, tax_inclusive FROM pay_prices WHERE active = 1");
  return list.map((p) => ({ ...toProduct(p), prices: prices.filter((x) => Number(x.product_id) === Number(p.id)).map((x) => ({ currency: x.currency, amountMinor: Number(x.amount_minor), taxInclusive: !!x.tax_inclusive })) }));
}

interface SeedProduct { sku: string; kind: string; title: string; description: string; fulfilRef: string; accessDays: number | null; inrMinor: number; active?: boolean }

function seedList(): SeedProduct[] {
  const out: SeedProduct[] = [];
  for (const p of PLANS) {
    if (p.monthly === 0) continue;
    if (!p.annualOnly) out.push({ sku: `plan-${p.key}-monthly`, kind: "plan", title: `${p.name} plan, 1 month`, description: p.tagline, fulfilRef: p.key, accessDays: 30, inrMinor: p.monthly * 100 });
    out.push({ sku: `plan-${p.key}-yearly`, kind: "plan", title: `${p.name} plan, 1 year`, description: p.tagline, fulfilRef: p.key, accessDays: 365, inrMinor: p.yearly * 100 });
  }
  out.push({ sku: "resume-studio-pro", kind: "resume", title: "Resume Studio Pro", description: "All templates and no waiting between saves.", fulfilRef: "studio_pro", accessDays: null, inrMinor: RESUME_STUDIO_PRO_RUPEES * 100 });
  // One product per catalogue course, priced by its category. A course is on sale only when its lessons exist on GrowQR (the others stay
  // off sale, with their price saved, until the lessons are added and someone turns them on in the console).
  const cats = (catalogue as unknown as { categories: Record<string, { name: string }> }).categories;
  for (const c of (catalogue as unknown as { courses: Array<{ slug: string; title: string; cat: string; brief: string }> }).courses) {
    const rupees = COURSE_FEE_RUPEES[cats[c.cat]?.name ?? ""];
    if (!rupees || STUDIO_COURSES.some((x) => x.slug === c.slug)) continue; // a course with its own fee in STUDIO_COURSES is added below
    out.push({ sku: `course-${c.slug}`, kind: "course", title: c.title, description: c.brief ?? "", fulfilRef: c.slug, accessDays: null, inrMinor: rupees * 100, active: isNative(c.slug) });
  }
  for (const c of STUDIO_COURSES) out.push({ sku: `course-${c.slug}`, kind: "course", title: c.title, description: c.description, fulfilRef: c.slug, accessDays: null, inrMinor: c.rupees * 100, active: c.onSale });
  for (const v of SERVICE_PRODUCTS) out.push({ sku: `service-${v.key}`, kind: "consulting", title: v.title, description: v.description, fulfilRef: v.key, accessDays: null, inrMinor: v.rupees * 100 });
  for (const a of ONLINE_PACKAGES) out.push({ sku: packageSku(a.key), kind: "consulting", title: `Overseas education: ${a.name}`, description: a.target, fulfilRef: a.key, accessDays: null, inrMinor: a.from * 100 });
  for (const e of EXAM_PRODUCTS) out.push({ sku: e.sku, kind: "other", title: e.title, description: e.description, fulfilRef: e.sku, accessDays: null, inrMinor: e.rupees * 100, active: false });
  return out;
}

/** Add missing products and their INR prices. Safe to run on every start. */
export async function seedCatalogue(db: Db = pool): Promise<number> {
  let added = 0;
  for (const s of seedList()) {
    const exists = await first(db, "SELECT id FROM pay_products WHERE sku = $1", [s.sku]);
    if (exists) continue;
    const id = await insertId(db, "INSERT INTO pay_products (sku, kind, title, description, fulfil_ref, access_days, active, allow_guest) VALUES ($1,$2,$3,$4,$5,$6,$7,0)", [s.sku, s.kind, s.title, s.description.slice(0, 500), s.fulfilRef, s.accessDays, s.active === false ? 0 : 1]);
    await exec(db, "INSERT IGNORE INTO pay_prices (product_id, currency, amount_minor, tax_inclusive, active) VALUES ($1,'INR',$2,1,1)", [id, s.inrMinor]);
    added++;
  }
  return added;
}
