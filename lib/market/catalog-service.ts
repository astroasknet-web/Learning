import * as courses from "./courses";
import { isNative } from "./lessons";
import { searchCatalog } from "./catalog-search";
import type { CatalogResult } from "./catalog-card";
import { toCard } from "./catalog-card-server";
import type { CatalogQuery } from "./catalog-query";

/** One catalogue query as card data: the matching page, how many matched, and how many courses exist in all (the two are shown separately). */
export async function runCatalog(q: CatalogQuery): Promise<CatalogResult> {
  const [page, all] = await Promise.all([searchCatalog(q), courses.total()]);
  return { items: page.items.map((c) => toCard(c, isNative(c.slug))), total: page.total, all, pages: page.pages, page: page.page, size: q.size };
}
