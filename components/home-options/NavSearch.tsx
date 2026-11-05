"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, BookOpen, Search } from "lucide-react";
import type { Hit } from "./nav-data";
import { ICONS, focusRing, useFocusTrap, useUid } from "./NavParts";
import { trackNav } from "@/lib/analytics";
import { matchPages, popularHits, relatedTerms, useCourseHits } from "./nav-suggest";

interface CourseHit { slug: string; title: string; cat_name: string }

/**
 * Search from the header: pages and countries are matched in the browser; courses come from the catalogue search (the same scored query the courses page
 * uses), so every result is real. A combobox: arrow keys move, Enter opens, Escape closes and puts focus back where it was.
 */
export default function NavSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const id = useUid("nsearch");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  useFocusTrap(box, open);

  useEffect(() => { if (open) { setQ(""); setSel(0); } }, [open]);
  const { courses, busy } = useCourseHits(q, open);

  const hits: Hit[] & { matched?: number } = useMemo(() => {
    const s = q.trim().toLowerCase();
    const pages = s ? matchPages(q, 6) : popularHits();
    const cs: Hit[] = courses.map((c) => ({ label: c.title, sub: c.cat_name, href: `/courses/${c.slug}`, group: "Course", icon: "book" }));
    const terms: Hit[] = s ? relatedTerms(q, 3).map((w) => ({ label: w, sub: "Related search", href: `/courses?q=${encodeURIComponent(w)}`, group: "Search", icon: "spark" })) : [];
    const all: Hit[] = s ? [...cs, ...pages, ...terms] : pages;
    const matched = all.length;
    if (s.length >= 2) all.push({ label: `Search all courses for “${q.trim()}”`, sub: "Open the catalogue with filters", href: `/courses?q=${encodeURIComponent(q.trim())}`, group: "Course", icon: "book" });
    return Object.assign(all, { matched });
  }, [q, courses]);

  useEffect(() => { setSel(0); }, [q, courses.length]);
  useEffect(() => { list.current?.querySelector<HTMLElement>(`[data-i="${sel}"]`)?.scrollIntoView({ block: "nearest" }); }, [sel]);

  const go = (h: Hit) => {
    trackNav("nav_search_select", { group: h.group, label: h.label });
    onClose();
    if (h.external) window.open(h.href, "_blank", "noopener,noreferrer"); else router.push(h.href);
  };
  if (!open) return null;
  const listId = `${id}-list`;
  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center bg-ink/50 px-3 pt-[8vh] backdrop-blur-sm sm:px-4 sm:pt-[12vh]" onMouseDown={onClose} role="dialog" aria-modal="true" aria-label="Search the site">
      <div ref={box} className="w-full max-w-[640px] overflow-hidden rounded-3xl bg-white shadow-[0_40px_120px_rgba(0,0,0,0.4)]" onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") { e.stopPropagation(); onClose(); }
          else if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(hits.length - 1, s + 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
          else if (e.key === "Enter" && hits[sel]) { e.preventDefault(); go(hits[sel]); }
        }}>
        <div className="flex items-center gap-3 border-b border-black/[0.07] px-4 sm:px-5">
          <Search className="h-5 w-5 shrink-0 text-ink-3" aria-hidden />
          <input data-autofocus value={q} onChange={(e) => setQ(e.target.value)} role="combobox" aria-expanded="true" aria-controls={listId} aria-autocomplete="list" aria-activedescendant={hits[sel] ? `${id}-o${sel}` : undefined}
            placeholder="Search courses, tests, internships, countries…" aria-label="Search the site" autoComplete="off" spellCheck={false} className="h-16 min-w-0 flex-1 bg-transparent text-[1.05rem] outline-none placeholder:text-ink-3" />
          <button type="button" onClick={onClose} className={`rounded-md border border-black/10 px-2 py-1 text-[0.72rem] font-semibold text-ink-3 ${focusRing}`} aria-label="Close search">Esc</button>
        </div>
        <ul ref={list} id={listId} role="listbox" aria-label="Results" className="max-h-[52vh] overflow-y-auto p-2">
          {!q && <li role="presentation" className="px-3 pb-1 pt-2 text-[0.68rem] font-bold uppercase tracking-[0.16em] text-ink-3">Popular</li>}
          {(hits.matched ?? hits.length) === 0 && q.trim().length >= 2 && !busy && <li role="presentation" className="px-4 py-10 text-center text-[0.95rem] text-ink-3">No matches for “{q.trim()}”. Try “python”, “resume” or “Canada”, or search the whole catalogue below.</li>}
          {hits.map((h, i) => {
            const I = ICONS[h.icon] ?? BookOpen;
            return (
              <li key={h.group + h.label + h.href} id={`${id}-o${i}`} data-i={i} role="option" aria-selected={i === sel}>
                <button type="button" tabIndex={-1} onMouseEnter={() => setSel(i)} onClick={() => go(h)} className={`flex min-h-[48px] w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition ${i === sel ? "bg-orange-lighter" : ""}`}>
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${i === sel ? "bg-orange text-white" : "bg-orange-light text-orange-deep"}`}><I className="h-4 w-4" aria-hidden /></span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-[0.94rem] font-semibold text-ink">{h.label}</span><span className="block truncate text-[0.78rem] text-ink-3">{h.sub}</span></span>
                  <span className="hidden rounded-full bg-black/[0.05] px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-wider text-ink-3 sm:inline">{h.group}</span>
                  {h.external && <ArrowUpRight className="h-4 w-4 text-ink-4" aria-hidden />}
                </button>
              </li>
            );
          })}
          {busy && <li role="presentation" className="px-4 py-3 text-[0.82rem] text-ink-3">Searching courses…</li>}
        </ul>
        <div className="flex items-center justify-between border-t border-black/[0.07] bg-cream px-5 py-2.5 text-[0.72rem] text-ink-3"><span><kbd className="font-semibold">↑↓</kbd> move · <kbd className="font-semibold">Enter</kbd> open · <kbd className="font-semibold">Esc</kbd> close</span><span className="hidden sm:inline">Ctrl or ⌘ K</span></div>
      </div>
    </div>
  );
}
