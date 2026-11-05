"use client";

import { useEffect, useId, useRef, useState } from "react";
import { highlight, tokenize } from "@/lib/market/catalog-query";
import type { Suggestion } from "@/lib/market/catalog-search";
import { trackCatalog } from "@/lib/analytics";

const focus = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep";

/**
 * The catalogue search field: a WAI-ARIA combobox with a list of suggestions. Typing updates the results (debounced by the caller through onChange); the suggestions
 * come from /api/courses/suggest, and an older answer can never replace a newer one. Arrow keys move through the list, Enter opens the highlighted course (or
 * searches the typed phrase), Escape closes the list, and the clear button empties the field.
 */
export default function SearchBox({ value, onChange, onSubmit, onClear, onOpenCourse }: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (v: string) => void;
  onClear: () => void;
  onOpenCourse: (slug: string) => void;
}) {
  const id = useId();
  const listId = `${id}-list`;
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const seq = useRef(0);
  const terms = tokenize(value);

  useEffect(() => {
    const phrase = value.trim();
    if (phrase.length < 2) { setItems([]); setLoading(false); return; }
    const mine = ++seq.current;
    const ctl = new AbortController();
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/courses/suggest?q=${encodeURIComponent(phrase)}`, { signal: ctl.signal });
        const j = (await r.json()) as Suggestion[];
        if (mine === seq.current) { setItems(Array.isArray(j) ? j : []); setActive(-1); }
      } catch { /* aborted or offline: the list simply stays as it was */ }
      if (mine === seq.current) setLoading(false);
    }, 150);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [value]);

  useEffect(() => {
    const away = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, []);

  const showList = open && value.trim().length >= 2;
  const pick = (s: Suggestion) => { trackCatalog("course_suggestion_select", { slug: s.slug }); setOpen(false); onOpenCourse(s.slug); };

  return (
    <div ref={box} className="relative w-full">
      <form
        role="search"
        onSubmit={(e) => { e.preventDefault(); setOpen(false); onSubmit(value); }}
        className="flex w-full items-stretch gap-2"
      >
        <div className="relative flex-1">
          <label htmlFor={`${id}-q`} className="sr-only">Search courses by title, skill or topic</label>
          <svg aria-hidden="true" viewBox="0 0 24 24" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
          <input
            id={`${id}-q`}
            name="q"
            type="text"
            role="combobox"
            aria-expanded={showList}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={showList && active >= 0 ? `${id}-opt-${active}` : undefined}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            enterKeyHint="search"
            maxLength={80}
            value={value}
            placeholder="Search courses, skills or topics, e.g. python, excel, figma"
            onChange={(e) => { onChange(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown" && items.length) { e.preventDefault(); setOpen(true); setActive((a) => (a + 1) % items.length); }
              else if (e.key === "ArrowUp" && items.length) { e.preventDefault(); setActive((a) => (a <= 0 ? items.length - 1 : a - 1)); }
              else if (e.key === "Escape") { setOpen(false); setActive(-1); }
              else if (e.key === "Enter" && showList && active >= 0 && items[active]) { e.preventDefault(); pick(items[active]); }
            }}
            className={`min-h-[52px] w-full rounded-xl border border-black/[0.14] bg-white pl-12 pr-12 text-[16px] text-ink placeholder:text-ink-3 ${focus}`}
          />
          {value ? (
            <button type="button" aria-label="Clear search" onClick={() => { onClear(); setItems([]); setOpen(false); (document.getElementById(`${id}-q`) as HTMLInputElement | null)?.focus(); }} className={`absolute right-2 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-ink-3 hover:bg-cream-3 ${focus}`}>
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          ) : null}
        </div>
        <button type="submit" className={`min-h-[52px] shrink-0 rounded-xl bg-orange-deep px-5 text-[15px] font-semibold text-white hover:bg-ink sm:px-7 ${focus}`}>Search</button>
      </form>

      <div
        id={listId}
        role="listbox"
        aria-label="Course suggestions"
        hidden={!showList}
        className="absolute left-0 right-0 top-full z-30 mt-2 max-h-[70vh] overflow-auto rounded-xl border border-black/[0.1] bg-white p-1 text-left shadow-[0_12px_32px_rgba(16,24,40,0.18)]"
      >
        {items.map((s, i) => (
          <div
            key={s.slug}
            id={`${id}-opt-${i}`}
            role="option"
            aria-selected={i === active}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => pick(s)}
            onMouseEnter={() => setActive(i)}
            className={`flex min-h-[48px] cursor-pointer items-center gap-3 rounded-lg px-3 py-2 ${i === active ? "bg-cream-3" : ""}`}
          >
            <span aria-hidden="true" className="h-8 w-8 shrink-0 rounded-lg" style={{ background: `linear-gradient(135deg, ${s.c1}, ${s.c2})` }} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14.5px] font-medium text-ink">{highlight(s.title, terms).map((p, k) => (p.hit ? <mark key={k} className="rounded-sm bg-orange-light text-ink">{p.t}</mark> : <span key={k}>{p.t}</span>))}</span>
              <span className="block truncate text-[12px] text-ink-3">{s.cat_name}{s.here ? " · Lessons available" : ""}</span>
            </span>
          </div>
        ))}
        {!items.length ? (
          <p role="status" className="px-3 py-3 text-[14px] text-ink-3">{loading ? "Searching…" : <>No course titles match “{value.trim()}”. Press Enter to search every field.</>}</p>
        ) : null}
      </div>
    </div>
  );
}
