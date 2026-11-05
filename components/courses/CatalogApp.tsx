"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import CourseCard from "./CourseCard";
import SearchBox from "./SearchBox";
import FilterFields, { FilterDrawer, type CatInfo, type FilterValue } from "./Filters";
import { chips, effectiveSort, hasFilters, parseQuery, SORTS, toHref, toParams, type CatalogQuery } from "@/lib/market/catalog-query";
import type { CatalogResult, CourseProgress } from "@/lib/market/catalog-card";
import { trackCatalog } from "@/lib/analytics";

const focus = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep";
const TRY = ["Python", "Excel", "Data analytics", "Artificial intelligence", "Web development", "Digital marketing", "UI UX design", "Cybersecurity"];

interface Props {
  initialQuery: CatalogQuery;
  initial: CatalogResult;
  cats: CatInfo[];
  freeAvailable: boolean;
  hours: number;
  hereCount: number;
  progress: Record<string, CourseProgress>;
  /** Server-rendered discovery sections, shown while no search or filter is active. */
  discovery: ReactNode;
  heading: string;
  intro: string;
}

function Skeletons({ n }: { n: number }) {
  return (
    <ul aria-hidden="true" className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: n }, (_, i) => (
        <li key={i} className="overflow-hidden rounded-2xl border border-black/[0.09] bg-white">
          <div className="aspect-[16/9] animate-pulse bg-cream-3 motion-reduce:animate-none" />
          <div className="space-y-3 p-4">
            <div className="h-3 w-1/3 rounded bg-cream-3" /><div className="h-5 w-4/5 rounded bg-cream-3" /><div className="h-3 w-full rounded bg-cream-3" /><div className="h-3 w-2/3 rounded bg-cream-3" />
            <div className="flex justify-between pt-3"><div className="h-6 w-16 rounded bg-cream-3" /><div className="h-10 w-28 rounded-lg bg-cream-3" /></div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function pageWindow(page: number, pages: number): Array<number | "gap"> {
  const out: Array<number | "gap"> = [];
  for (let p = 1; p <= pages; p++) if (p === 1 || p === pages || Math.abs(p - page) <= 1) out.push(p); else if (out[out.length - 1] !== "gap") out.push("gap");
  return out;
}

export default function CatalogApp({ initialQuery, initial, cats, freeAvailable, hours, hereCount, progress, discovery, heading, intro }: Props) {
  const router = useRouter();
  const catKeys = useMemo(() => cats.map((c) => c.key), [cats]);
  const catName = useCallback((k: string) => cats.find((c) => c.key === k)?.name ?? k, [cats]);
  const [query, setQuery] = useState<CatalogQuery>(initialQuery);
  const [result, setResult] = useState<CatalogResult>(initial);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [draft, setDraft] = useState(initialQuery.q);
  const [drawer, setDrawer] = useState(false);
  const [pending, setPending] = useState<FilterValue>({ cat: [], level: [], len: [], price: [], aud: [], available: false });
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const first = useRef(true);
  const seq = useRef(0);
  const scrollTo = useRef(false);
  const top = useRef<HTMLHeadingElement>(null);
  const typing = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [retry, setRetry] = useState(0);
  const latest = useRef(query);
  latest.current = query;

  // ---- commit a new query: state, and the address bar, so the page can be shared, reloaded and used with Back ----
  const commit = useCallback((next: CatalogQuery, how: "push" | "replace" = "push") => {
    setQuery(next);
    const qs = toParams(next).toString();
    const url = "/courses" + (qs ? "?" + qs : "");
    if (how === "push") window.history.pushState(null, "", url); else window.history.replaceState(null, "", url);
  }, []);

  useEffect(() => {
    const pop = () => { const q = parseQuery(new URLSearchParams(window.location.search), catKeys); setQuery(q); setDraft(q.q); };
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, [catKeys]);

  useEffect(() => { trackCatalog("course_catalog_view", { results: initial.total }); }, [initial.total]);

  // ---- fetch results for the current query; a slower, older answer is cancelled and can never replace a newer one ----
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const mine = ++seq.current;
    const ctl = new AbortController();
    setStatus("loading");
    (async () => {
      try {
        const r = await fetch(`/api/courses/search?${toParams(query).toString()}`, { signal: ctl.signal });
        if (!r.ok) throw new Error(String(r.status));
        const j = (await r.json()) as CatalogResult;
        if (mine !== seq.current) return;
        setResult(j);
        setStatus("idle");
        if (query.q) trackCatalog(j.total ? "course_search" : "course_search_zero_results", { query: query.q, results: j.total });
        if (scrollTo.current) { scrollTo.current = false; top.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }); top.current?.focus({ preventScroll: true }); }
      } catch (e) {
        if ((e as Error).name === "AbortError" || mine !== seq.current) return;
        setStatus("error");
      }
    })();
    return () => ctl.abort();
  }, [query, retry]);

  // ---- typing in the search box commits after a pause; Enter and the button commit at once ----
  const onType = (v: string) => {
    setDraft(v);
    if (typing.current) clearTimeout(typing.current);
    typing.current = setTimeout(() => { const q = latest.current; commit({ ...q, q: v.trim(), page: 1, sort: q.sort === "relevance" && !v.trim() ? "" : q.sort }, "replace"); }, 350);
  };
  const submit = (v: string) => { if (typing.current) clearTimeout(typing.current); commit({ ...query, q: v.trim(), page: 1 }); };
  const clearSearch = () => { if (typing.current) clearTimeout(typing.current); setDraft(""); commit({ ...query, q: "", page: 1, sort: query.sort === "relevance" ? "" : query.sort }); };

  const applyFilters = (v: FilterValue, what: string, value: string) => { trackCatalog("course_filter_change", { filter: what, value }); commit({ ...query, ...v, page: 1 }); };
  const filterValue: FilterValue = { cat: query.cat, level: query.level, len: query.len, price: query.price, aud: query.aud, available: query.available };
  const sortNow = effectiveSort(query);
  const filtered = hasFilters(query);
  const activeChips = chips(query, catName);
  const landing = !filtered && query.page === 1 && !query.sort;
  const from = result.total ? (result.page - 1) * result.size + 1 : 0;
  const to = Math.min(result.total, result.page * result.size);

  // The drawer shows how many courses its pending choices would give.
  useEffect(() => {
    if (!drawer) return;
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/courses/search?${toParams({ ...query, ...pending, page: 1, size: 12 }).toString()}`, { signal: ctl.signal });
        setPendingCount(((await r.json()) as CatalogResult).total);
      } catch { /* keep the last number */ }
    }, 200);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [drawer, pending, query]);

  const openCourse = (slug: string) => router.push(`/courses/${slug}`);
  const openDrawer = () => { setPending(filterValue); setPendingCount(null); setDrawer(true); };
  const goPage = (p: number) => { scrollTo.current = true; commit({ ...query, page: p }); };
  const resetAll = () => { setDraft(""); commit({ ...query, q: "", cat: [], level: [], len: [], price: [], aud: [], available: false, page: 1, sort: "" }); };
  const tryTerm = (t: string) => { setDraft(t); commit({ ...query, q: t, page: 1 }); };

  const sortOptions = Object.entries(SORTS).filter(([k]) => k !== "relevance" || query.q);

  return (
    <>
      {/* Hero */}
      <section aria-labelledby="catalog-h1" className="relative rounded-3xl bg-gradient-to-br from-[#1c1410] via-[#2a1a10] to-[#3b1f10] px-5 py-8 text-white sm:px-10 sm:py-12">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl"><div className="absolute -right-16 -top-16 h-72 w-72 rounded-full bg-orange/25 blur-3xl" /></div>
        <div className="relative max-w-3xl">
          <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-orange-light">GrowQR Learning</p>
          <h1 id="catalog-h1" className="mt-2 text-[28px] font-bold leading-tight tracking-tight !text-white sm:text-[40px]">{heading}</h1>
          <p className="mt-3 max-w-2xl text-[15.5px] leading-relaxed text-white/85 sm:text-[17px]">{intro}</p>
          <div className="mt-6 max-w-2xl text-ink">
            <SearchBox value={draft} onChange={onType} onSubmit={submit} onClear={clearSearch} onOpenCourse={openCourse} />
          </div>
          <div className="mt-4 flex max-w-3xl flex-wrap items-center gap-2" aria-label="Searches to try">
            <span className="text-[13px] text-white/75">Try searching:</span>
            {TRY.map((t) => <button key={t} type="button" onClick={() => tryTerm(t)} className={`min-h-[36px] rounded-full border border-white/30 px-3.5 text-[13px] font-medium text-white hover:bg-white/15 ${focus}`}>{t}</button>)}
          </div>
          <dl className="mt-7 grid max-w-xl grid-cols-3 gap-4 text-center sm:text-left">
            {[[String(result.all), "courses"], [hours.toLocaleString("en-IN"), "hours of learning"], [String(hereCount), "with full lessons now"]].map(([n, l]) => (
              <div key={l}><dd className="text-[22px] font-bold sm:text-[26px]">{n}</dd><dt className="text-[12px] text-white/75 sm:text-[13px]">{l}</dt></div>
            ))}
          </dl>
        </div>
      </section>

      {/* Field shortcuts */}
      <nav aria-label="Browse by field" className="-mx-4 mt-6 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex min-w-max gap-2 pb-2">
          <li><button type="button" aria-pressed={query.cat.length === 0} onClick={() => applyFilters({ ...filterValue, cat: [] }, "field", "all")} className={`inline-flex min-h-[44px] items-center rounded-full border px-4 text-[13.5px] font-medium ${focus} ${query.cat.length === 0 ? "border-ink bg-ink text-white" : "border-black/[0.16] bg-white text-ink-2 hover:bg-cream-3"}`}>All fields</button></li>
          {cats.map((c) => {
            const on = query.cat.includes(c.key);
            return (
              <li key={c.key}>
                <button type="button" aria-pressed={on} onClick={() => applyFilters({ ...filterValue, cat: on ? query.cat.filter((x) => x !== c.key) : [...query.cat, c.key] }, "field", c.key)} className={`inline-flex min-h-[44px] items-center gap-2 rounded-full border px-4 text-[13.5px] font-medium ${focus} ${on ? "border-ink bg-ink text-white" : "border-black/[0.16] bg-white text-ink-2 hover:bg-cream-3"}`}>
                  <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ background: c.c1 }} />{c.name}<span className={on ? "text-white/75" : "text-ink-3"}>{c.n}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {landing ? discovery : null}

      <section aria-labelledby="results-h" className="mt-10">
        <div className="lg:grid lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-8">
          {/* Desktop filters */}
          <aside aria-label="Filters" className="hidden lg:block">
            <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto rounded-2xl border border-black/[0.08] bg-white p-4">
              <div className="mb-3 flex items-center justify-between"><h2 className="text-[16px] font-bold text-ink">Filters</h2>{filtered ? <button type="button" onClick={resetAll} className={`rounded text-[13px] text-ink-3 underline ${focus}`}>Clear all</button> : null}</div>
              <FilterFields value={filterValue} onChange={(v) => applyFilters(v, "filters", "changed")} cats={cats} freeAvailable={freeAvailable} />
            </div>
          </aside>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 id="results-h" ref={top} tabIndex={-1} className="text-[22px] font-bold text-ink outline-none">{filtered ? "Search results" : "All courses"}</h2>
                <p className="mt-0.5 text-[14px] text-ink-3" aria-live="polite" aria-atomic="true">
                  {status === "error" ? "Could not load courses." : result.total === 0 ? `No courses match${query.q ? ` “${query.q}”` : ""}.` : <>Showing <b className="text-ink">{from}&ndash;{to}</b> of <b className="text-ink">{result.total}</b> {result.total === 1 ? "course" : "courses"}{result.total !== result.all ? <> ({result.all} in the catalogue)</> : null}</>}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button type="button" onClick={openDrawer} className={`inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-black/[0.18] bg-white px-4 text-[14px] font-semibold text-ink lg:hidden ${focus}`}>
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
                  Filters{activeChips.filter((c) => c.key !== "q").length ? <span className="rounded-full bg-orange-deep px-2 py-0.5 text-[12px] text-white">{activeChips.filter((c) => c.key !== "q").length}</span> : null}
                </button>
                <div className="flex items-center gap-2">
                  <label htmlFor="catalog-sort" className="text-[13.5px] text-ink-3">Sort by</label>
                  <select id="catalog-sort" value={sortNow} onChange={(e) => { trackCatalog("course_sort_change", { sort: e.target.value }); commit({ ...query, sort: e.target.value === "recommended" && !query.q ? "" : e.target.value, page: 1 }); }} className={`min-h-[44px] rounded-xl border border-black/[0.18] bg-white px-3 text-[14px] text-ink ${focus}`}>
                    {sortOptions.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {activeChips.length ? (
              <ul className="mt-4 flex flex-wrap items-center gap-2" aria-label="Active filters">
                {activeChips.map((c) => (
                  <li key={c.key}>
                    <button type="button" aria-label={`Remove filter: ${c.label}`} onClick={() => { if (c.key === "q") setDraft(""); commit({ ...query, ...c.remove }); }} className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-orange-light px-3.5 text-[13px] font-medium text-orange-deep ${focus}`}>{c.label}<span aria-hidden="true">&times;</span></button>
                  </li>
                ))}
                <li><button type="button" onClick={resetAll} className={`inline-flex min-h-[40px] items-center rounded px-3 text-[13px] text-ink-3 underline ${focus}`}>Clear all filters</button></li>
              </ul>
            ) : null}

            <div className="mt-5" aria-busy={status === "loading"}>
              {status === "loading" ? <Skeletons n={Math.min(result.size, 6)} /> : status === "error" ? (
                <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
                  <h3 className="text-[18px] font-semibold text-red-900">We could not load the courses</h3>
                  <p className="mb-4 mt-1 text-[14px] text-red-800">Check your connection and try again.</p>
                  <button type="button" onClick={() => { setStatus("loading"); setRetry((n) => n + 1); }} className={`min-h-[44px] rounded-lg bg-ink px-5 text-[14px] font-semibold text-white ${focus}`}>Try again</button>
                </div>
              ) : result.items.length ? (
                <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                  {result.items.map((c) => <CourseCard key={c.slug} course={c} progress={progress[c.slug]} onOpen={(slug) => trackCatalog("course_card_open", { slug })} />)}
                </ul>
              ) : (
                <div className="rounded-2xl border border-black/[0.08] bg-white p-8 text-center sm:p-12">
                  <h3 className="text-[18px] font-semibold text-ink">{query.q ? <>No courses found for “{query.q}”</> : "No courses match these filters"}</h3>
                  <p className="mx-auto mb-5 mt-2 max-w-md text-[14.5px] text-ink-3">Check the spelling, try a more general word such as “data” or “marketing”, or remove a filter.</p>
                  <div className="mb-6 flex flex-wrap justify-center gap-2">
                    {cats.slice(0, 4).map((c) => <button key={c.key} type="button" onClick={() => commit({ ...query, q: "", cat: [c.key], level: [], len: [], price: [], aud: [], available: false, page: 1, sort: "" })} className={`min-h-[40px] rounded-full border border-black/[0.16] px-4 text-[13.5px] text-ink-2 hover:bg-cream-3 ${focus}`}>{c.name}</button>)}
                  </div>
                  <button type="button" onClick={resetAll} className={`min-h-[44px] rounded-lg bg-orange-deep px-5 text-[14px] font-semibold text-white hover:bg-ink ${focus}`}>Reset search and filters</button>
                </div>
              )}
            </div>

            {result.pages > 1 && status !== "error" ? (
              <nav aria-label="Pages of courses" className="mt-8 flex flex-wrap items-center justify-center gap-1.5">
                {result.page > 1 ? <a rel="prev" href={toHref(query, { page: result.page - 1 })} onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); goPage(result.page - 1); }} className={`inline-flex min-h-[44px] items-center rounded-lg border border-black/[0.18] bg-white px-4 text-[14px] ${focus}`}>Previous</a> : null}
                {pageWindow(result.page, result.pages).map((p, i) => p === "gap" ? <span key={`g${i}`} aria-hidden="true" className="px-1 text-ink-3">…</span> : (
                  <a key={p} href={toHref(query, { page: p })} aria-current={p === result.page ? "page" : undefined} aria-label={`Page ${p}`} onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); goPage(p); }} className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border px-3 text-[14px] ${focus} ${p === result.page ? "border-ink bg-ink text-white" : "border-black/[0.18] bg-white text-ink"}`}>{p}</a>
                ))}
                {result.page < result.pages ? <a rel="next" href={toHref(query, { page: result.page + 1 })} onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); goPage(result.page + 1); }} className={`inline-flex min-h-[44px] items-center rounded-lg border border-black/[0.18] bg-white px-4 text-[14px] ${focus}`}>Next</a> : null}
              </nav>
            ) : null}
          </div>
        </div>
      </section>

      <FilterDrawer
        open={drawer}
        onClose={() => setDrawer(false)}
        onApply={() => { setDrawer(false); trackCatalog("course_filter_change", { filter: "drawer", value: "applied" }); commit({ ...query, ...pending, page: 1 }); }}
        onReset={() => setPending({ cat: [], level: [], len: [], price: [], aud: [], available: false })}
        count={pendingCount}
      >
        <FilterFields value={pending} onChange={setPending} cats={cats} freeAvailable={freeAvailable} />
      </FilterDrawer>
    </>
  );
}
