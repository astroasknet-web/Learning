"use client";

import { useEffect, useRef } from "react";
import { AUDS, LENS, LEVELS, PRICES, type CatalogQuery } from "@/lib/market/catalog-query";

const focus = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep";

export interface CatInfo { key: string; name: string; c1: string; c2: string; n: number }
export type FilterValue = Pick<CatalogQuery, "cat" | "level" | "len" | "price" | "aud" | "available">;

const toggle = (list: string[], v: string): string[] => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

function Group({ legend, children }: { legend: string; children: React.ReactNode }) {
  return (
    <fieldset className="border-0 p-0">
      <legend className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-ink-3">{legend}</legend>
      <div className="space-y-0.5">{children}</div>
    </fieldset>
  );
}

function Check({ checked, onChange, label, count }: { checked: boolean; onChange: () => void; label: string; count?: number }) {
  return (
    <label className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg px-1 text-[14.5px] text-ink-2 hover:bg-cream-3">
      <input type="checkbox" checked={checked} onChange={onChange} className={`h-5 w-5 shrink-0 accent-orange-deep ${focus}`} />
      <span className="flex-1">{label}</span>
      {count !== undefined ? <span className="text-[12px] text-ink-3">{count}</span> : null}
    </label>
  );
}

/** The filter controls. Used in the desktop sidebar (changes apply at once) and in the mobile drawer (changes apply with the Apply button). */
export default function FilterFields({ value, onChange, cats, freeAvailable }: { value: FilterValue; onChange: (v: FilterValue) => void; cats: CatInfo[]; freeAvailable: boolean }) {
  const set = (patch: Partial<FilterValue>) => onChange({ ...value, ...patch });
  const prices = Object.entries(PRICES).filter(([k]) => k !== "free" || freeAvailable);
  return (
    <div className="space-y-6">
      <Group legend="Field">
        {cats.map((c) => <Check key={c.key} checked={value.cat.includes(c.key)} onChange={() => set({ cat: toggle(value.cat, c.key) })} label={c.name} count={c.n} />)}
      </Group>
      <Group legend="Level">
        {Object.entries(LEVELS).map(([k, v]) => <Check key={k} checked={value.level.includes(k)} onChange={() => set({ level: toggle(value.level, k) })} label={v} />)}
      </Group>
      <Group legend="Duration">
        {Object.entries(LENS).map(([k, v]) => <Check key={k} checked={value.len.includes(k)} onChange={() => set({ len: toggle(value.len, k) })} label={v} />)}
      </Group>
      <Group legend="Price">
        {prices.map(([k, v]) => <Check key={k} checked={value.price.includes(k)} onChange={() => set({ price: toggle(value.price, k) })} label={v} />)}
      </Group>
      <Group legend="Best for">
        {Object.entries(AUDS).map(([k, v]) => <Check key={k} checked={value.aud.includes(k)} onChange={() => set({ aud: toggle(value.aud, k) })} label={v} />)}
      </Group>
      <Group legend="Availability">
        <Check checked={value.available} onChange={() => set({ available: !value.available })} label="Lessons available now" />
      </Group>
    </div>
  );
}

/** A modal drawer for small screens: focus moves in when it opens, Tab stays inside, Escape or the backdrop closes it, and the page behind does not scroll. */
export function FilterDrawer({ open, onClose, onApply, onReset, children, count }: { open: boolean; onClose: () => void; onApply: () => void; onReset: () => void; children: React.ReactNode; count: number | null }) {
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);
  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.querySelector<HTMLElement>("button, input")?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key !== "Tab" || !panel.current) return;
      const f = [...panel.current.querySelectorAll<HTMLElement>("button, input, a[href], select")].filter((el) => !el.hasAttribute("disabled"));
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("keydown", key); document.body.style.overflow = prev; (opener.current as HTMLElement | null)?.focus?.(); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div aria-hidden="true" onClick={onClose} className="absolute inset-0 bg-black/50" />
      <div ref={panel} role="dialog" aria-modal="true" aria-label="Filter courses" className="absolute inset-x-0 bottom-0 flex max-h-[92vh] flex-col rounded-t-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-black/[0.08] px-5 py-3">
          <h2 className="text-[18px] font-bold text-ink">Filters</h2>
          <button type="button" onClick={onClose} aria-label="Close filters" className={`inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-cream-3 ${focus}`}>
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        <div className="flex gap-3 border-t border-black/[0.08] py-3 pl-5 pr-20">
          <button type="button" onClick={onReset} className={`min-h-[48px] flex-1 rounded-xl border border-black/[0.18] text-[15px] font-semibold text-ink ${focus}`}>Reset</button>
          <button type="button" onClick={onApply} className={`min-h-[48px] flex-[2] rounded-xl bg-orange-deep text-[15px] font-semibold text-white hover:bg-ink ${focus}`}>{count === null ? "Show courses" : `Show ${count} ${count === 1 ? "course" : "courses"}`}</button>
        </div>
      </div>
    </div>
  );
}
