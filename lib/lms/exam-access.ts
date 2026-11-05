import { examProduct } from "./exam-products";
import { productAccess, type ProductAccess } from "./product-access";

export type ExamAccess = ProductAccess & { key: string; title: string; blurb: string };

/** Access to one exam-preparation product, with its name and what it contains for the purchase card. */
export async function examAccess(key: string): Promise<ExamAccess> {
  const p = examProduct(key);
  if (!p) throw new Error(`no exam product for ${key}`);
  return { ...(await productAccess(p.slug, p.rupees)), key, title: p.title, blurb: p.blurb };
}

/** The access to show a purchase card for, or null when the page may be shown (not an exam product, or the visitor owns it). */
export async function lockedExam(key: string | null): Promise<ExamAccess | null> {
  if (!key) return null;
  const a = await examAccess(key);
  return a.open ? null : a;
}
