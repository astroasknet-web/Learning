"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  ArrowUpRight, Award, BadgeCheck, BookOpen, Bot, Briefcase, Building2, CalendarDays, FileText, Fingerprint, Globe2, GraduationCap, IndianRupee, Laptop,
  LifeBuoy, ListChecks, Library, Mail, Mic, Newspaper, QrCode, Rocket, Route, School, ShieldCheck, Sparkles, Telescope, UserRound, UserSearch, Users, Zap, Compass, type LucideIcon,
} from "lucide-react";
import type { IconKey, NavGroup, NavLink } from "./nav-data";

export const ICONS: Record<IconKey, LucideIcon> = {
  qr: QrCode, passport: Fingerprint, bot: Bot, studio: FileText, briefcase: Briefcase, gig: Zap, tracker: ListChecks, rocket: Rocket,
  book: BookOpen, path: Route, ebook: Library, globe: Globe2, shield: ShieldCheck, student: GraduationCap, pro: UserRound, coach: Compass,
  free: Laptop, startup: Rocket, recruit: UserSearch, enterprise: Building2, institute: School, experts: Award, events: CalendarDays,
  community: Users, blog: Newspaper, about: BadgeCheck, contact: Mail, vision: Telescope, post: Briefcase, spark: Sparkles, money: IndianRupee, doc: FileText, help: LifeBuoy, mic: Mic,
};

export const focusRing = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep";

/** Whether `href` is the page being viewed (or a page under it). Query strings are ignored. */
export function isCurrent(pathname: string | null, href: string): boolean {
  if (!pathname || href.startsWith("http")) return false;
  const base = href.split("?")[0];
  return base === "/" ? pathname === "/" : pathname === base || pathname.startsWith(base + "/");
}

export type OnNav = (link: NavLink) => void;

/** One link in a menu: icon, label, a short description, and a tag when it helps. External links open in a new tab and say so. */
export function Row({ l, onNav, pathname, signedIn }: { l: NavLink; onNav: OnNav; pathname: string | null; signedIn: boolean }) {
  const I = ICONS[l.icon];
  const current = isCurrent(pathname, l.href) && l.href !== "/courses?cat=";
  const cls = `group flex items-start gap-3 rounded-2xl p-2.5 transition hover:bg-cream ${current ? "bg-orange-lighter" : ""} ${focusRing}`;
  const inner = (
    <>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-orange-light text-orange-deep transition group-hover:bg-orange group-hover:text-white"><I className="h-[18px] w-[18px]" aria-hidden /></span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.94rem] font-semibold text-ink">
          {l.label}
          {l.badge && <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[0.62rem] font-bold uppercase tracking-wider text-emerald-800">{l.badge}</span>}
          {l.account && !signedIn && <span className="rounded-full bg-black/[0.06] px-1.5 py-0.5 text-[0.62rem] font-bold uppercase tracking-wider text-ink-3">Sign in</span>}
          {l.external && <><ArrowUpRight className="h-3.5 w-3.5 text-ink-4" aria-hidden /><span className="sr-only">(opens in a new tab)</span></>}
          {current && <span className="sr-only">(current page)</span>}
        </span>
        {l.desc && <span className="block text-[0.8rem] leading-snug text-ink-3">{l.desc}</span>}
      </span>
    </>
  );
  return l.external ? (
    <a href={l.href} target="_blank" rel="noopener noreferrer" className={cls} onClick={() => onNav(l)}>{inner}</a>
  ) : (
    <Link href={l.href} className={cls} aria-current={current ? "page" : undefined} onClick={() => onNav(l)}>{inner}</Link>
  );
}

export const GroupHead = ({ children }: { children: ReactNode }) => <p className="mb-2 px-2.5 text-[0.68rem] font-bold uppercase tracking-[0.16em] text-ink-3">{children}</p>;

/** A group of links: rows, or compact chips for a long list of short names (countries, fields). */
export function Group({ g, onNav, pathname, signedIn }: { g: NavGroup; onNav: OnNav; pathname: string | null; signedIn: boolean }) {
  const rows = g.chips ? [] : g.links.slice(0, g.chipsFrom ?? g.links.length);
  const chips = g.chips ? g.links : g.links.slice(g.chipsFrom ?? g.links.length);
  return (
    <div>
      <GroupHead>{g.title}</GroupHead>
      {rows.length > 0 && <ul>{rows.map((l) => <li key={l.href + l.label}><Row l={l} onNav={onNav} pathname={pathname} signedIn={signedIn} /></li>)}</ul>}
      {chips.length > 0 && (
        <ul className={`flex flex-wrap gap-1.5 px-1 ${rows.length ? "mt-3" : ""}`}>
          {chips.map((l) => (
            <li key={l.href}><Link href={l.href} onClick={() => onNav(l)} aria-current={isCurrent(pathname, l.href) ? "page" : undefined} className={`inline-flex min-h-[40px] items-center rounded-full border border-black/[0.1] px-3.5 text-[0.84rem] font-semibold text-ink-2 transition hover:border-orange hover:bg-orange-lighter ${focusRing}`}>{l.label}</Link></li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Close when a click lands outside `ref`, and report focus leaving it. */
export function useOutside(ref: React.RefObject<HTMLElement | null>, active: boolean, onOutside: () => void) {
  useEffect(() => {
    if (!active) return;
    const down = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onOutside(); };
    document.addEventListener("mousedown", down);
    return () => document.removeEventListener("mousedown", down);
  }, [ref, active, onOutside]);
}

/** Keeps Tab inside `ref` while `active`, moves focus in when it opens and gives it back to the opener when it closes. */
export function useFocusTrap(ref: React.RefObject<HTMLElement | null>, active: boolean) {
  const opener = useRef<Element | null>(null);
  useEffect(() => {
    if (!active) return;
    opener.current = document.activeElement;
    const first = ref.current?.querySelector<HTMLElement>("[data-autofocus], input, button, a[href]");
    first?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !ref.current) return;
      const f = [...ref.current.querySelectorAll<HTMLElement>("a[href], button, input, [tabindex]:not([tabindex='-1'])")].filter((el) => !el.hasAttribute("disabled") && el.offsetParent !== null);
      if (!f.length) return;
      const a = f[0], z = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    };
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("keydown", key); (opener.current as HTMLElement | null)?.focus?.(); };
  }, [ref, active]);
}

export const useUid = (p: string) => `${p}-${useId().replace(/:/g, "")}`;
export const useBool = (init = false) => useState(init);
