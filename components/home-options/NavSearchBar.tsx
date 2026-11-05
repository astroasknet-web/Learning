"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, BookOpen, Search, TrendingUp, X } from "lucide-react";
import type { Hit } from "./nav-data";
import { ICONS, focusRing, useUid } from "./NavParts";
import { matchPages, popularHits, relatedTerms, useCourseHits } from "./nav-suggest";
import { trackNav } from "@/lib/analytics";

type Row = { kind: "term"; term: string } | { kind: "hit"; hit: Hit; section: string } | { kind: "all"; q: string };

/**
 * The always-visible search field in the header (desktop). Typing shows, in one dropdown: related search terms taken from our own pages, matching
 * courses from the catalogue, and matching pages and services. A combobox: arrows move, Enter opens, Tab or a click on a term completes it, Escape closes.
 */
export default function NavSearchBar() {
  const router = useRouter();
  const id = useUid("navbar");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const phrase = q.trim();
  const { courses, busy } = useCourseHits(q, open);

  const rows: Row[] = useMemo(() => {
    if (!phrase) return popularHits().map((hit) => ({ kind: "hit" as const, hit, section: "Popular" }));
    const out: Row[] = relatedTerms(q).map((term) => ({ kind: "term" as const, term }));
    for (const c of courses) out.push({ kind: "hit", section: "Courses", hit: { label: c.title, sub: c.cat_name, href: `/courses/${c.slug}`, group: "Course", icon: "book" } });
    for (const hit of matchPages(q, 6)) out.push({ kind: "hit", section: "Pages and services", hit });
    if (phrase.length >= 2) out.push({ kind: "all", q: phrase });
    return out;
  }, [q, phrase, courses]);

  useEffect(() => { setSel(0); }, [q, courses.length]);
  useEffect(() => {
    if (!open) return;
    const f = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", f);
    return () => document.removeEventListener("pointerdown", f);
  }, [open]);
  useEffect(() => { document.getElementById(`${id}-o${sel}`)?.scrollIntoView({ block: "nearest" }); }, [sel, id]);

  const choose = (r: Row) => {
    if (r.kind === "term") { setQ(r.term + " "); input.current?.focus(); trackNav("nav_search_select", { group: "Related search", label: r.term }); return; }
    setOpen(false);
    if (r.kind === "all") { trackNav("nav_search_select", { group: "Course", label: "all" }); router.push(`/courses?q=${encodeURIComponent(r.q)}`); return; }
    trackNav("nav_search_select", { group: r.hit.group, label: r.hit.label });
    if (r.hit.external) window.open(r.hit.href, "_blank", "noopener,noreferrer"); else router.push(r.hit.href);
  };

  const listId = `${id}-list`;
  const empty = phrase.length >= 2 && !busy && rows.every((r) => r.kind === "all");
  let lastSection = "";
  return (
    <div ref={wrap} className="relative hidden min-w-0 flex-1 min-[1440px]:block min-[1440px]:max-w-[420px] min-[1560px]:max-w-[480px]" role="search">
      <div className={`flex h-[44px] items-center gap-2 rounded-full border bg-white px-4 transition ${open ? "border-ink shadow-[0_8px_30px_-12px_rgba(26,26,26,0.35)]" : "border-black/10 hover:border-black/25"}`}>
        <Search className="h-[18px] w-[18px] shrink-0 text-ink-3" aria-hidden />
        <input
          ref={input} id="nav-search-input" value={q} role="combobox" aria-expanded={open} aria-controls={listId} aria-autocomplete="list" aria-activedescendant={open && rows[sel] ? `${id}-o${sel}` : undefined}
          aria-label="Search courses, tests, internships and more" placeholder="Search courses, tests, internships…" autoComplete="off" spellCheck={false}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") { if (open) { e.stopPropagation(); setOpen(false); } else setQ(""); }
            else if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setSel((s) => Math.min(rows.length - 1, s + 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
            else if (e.key === "Tab" && open && rows[sel]?.kind === "term" && !e.shiftKey) { e.preventDefault(); choose(rows[sel]); }
            else if (e.key === "Enter") { e.preventDefault(); if (open && rows[sel]) choose(rows[sel]); else if (phrase) router.push(`/courses?q=${encodeURIComponent(phrase)}`); }
          }}
          className="h-full min-w-0 flex-1 bg-transparent text-[0.92rem] text-ink outline-none placeholder:text-ink-3"
        />
        {q ? <button type="button" aria-label="Clear search" onClick={() => { setQ(""); input.current?.focus(); }} className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-ink-3 hover:bg-black/[0.06] ${focusRing}`}><X className="h-4 w-4" aria-hidden /></button>
          : <kbd className="hidden shrink-0 rounded-md border border-black/10 bg-cream px-1.5 py-0.5 text-[0.66rem] font-semibold text-ink-3 2xl:inline-block">Ctrl K</kbd>}
      </div>
      {open && (
        <div className="absolute left-0 top-[calc(100%+8px)] z-[60] w-[max(100%,460px)] overflow-hidden rounded-3xl border border-black/[0.08] bg-white shadow-[0_40px_100px_-30px_rgba(26,26,26,0.45)]">
          <ul id={listId} role="listbox" aria-label="Search suggestions" className="max-h-[min(60vh,480px)] overflow-y-auto p-2">
            {rows.map((r, i) => {
              const section = r.kind === "term" ? "Related searches" : r.kind === "hit" ? r.section : "";
              const head = section && section !== lastSection ? <li role="presentation" className="px-3 pb-1 pt-3 text-[0.68rem] font-bold uppercase tracking-[0.16em] text-ink-3 first:pt-2">{section}</li> : null;
              if (section) lastSection = section;
              const on = i === sel;
              let body;
              if (r.kind === "term") body = <><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${on ? "bg-orange text-white" : "bg-black/[0.05] text-ink-3"}`}><TrendingUp className="h-4 w-4" aria-hidden /></span><span className="min-w-0 flex-1 truncate text-[0.94rem] text-ink">{r.term}</span></>;
              else if (r.kind === "all") body = <><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${on ? "bg-orange text-white" : "bg-orange-light text-orange-deep"}`}><Search className="h-4 w-4" aria-hidden /></span><span className="min-w-0 flex-1 truncate text-[0.94rem] font-semibold text-ink">Search all courses for “{r.q}”</span></>;
              else { const I = ICONS[r.hit.icon] ?? BookOpen; body = <><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${on ? "bg-orange text-white" : "bg-orange-light text-orange-deep"}`}><I className="h-4 w-4" aria-hidden /></span><span className="min-w-0 flex-1"><span className="block truncate text-[0.94rem] font-semibold text-ink">{r.hit.label}</span><span className="block truncate text-[0.78rem] text-ink-3">{r.hit.sub}</span></span>{r.hit.external && <ArrowUpRight className="h-4 w-4 text-ink-4" aria-hidden />}</>; }
              return (
                <li key={i + (r.kind === "term" ? r.term : r.kind === "hit" ? r.hit.href : "all")} role="presentation">
                  {head}
                  <div id={`${id}-o${i}`} role="option" aria-selected={on} onMouseEnter={() => setSel(i)} onPointerDown={(e) => e.preventDefault()} onClick={() => choose(r)} className={`flex min-h-[46px] cursor-pointer items-center gap-3 rounded-2xl px-3 py-1.5 transition ${on ? "bg-orange-lighter" : ""}`}>{body}</div>
                </li>
              );
            })}
            {busy && <li role="presentation" className="px-4 py-2.5 text-[0.82rem] text-ink-3">Searching courses…</li>}
            {empty && <li role="presentation" className="px-4 py-6 text-center text-[0.92rem] text-ink-3">No pages or courses match “{phrase}”. Try “python”, “resume” or “Canada”.</li>}
          </ul>
          <div className="flex items-center justify-between border-t border-black/[0.07] bg-cream px-4 py-2 text-[0.72rem] text-ink-3"><span><kbd className="font-semibold">↑↓</kbd> move · <kbd className="font-semibold">Enter</kbd> open · <kbd className="font-semibold">Esc</kbd> close</span></div>
        </div>
      )}
    </div>
  );
}
