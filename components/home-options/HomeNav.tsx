"use client";

import CartLink from "@/components/pay/CartLink";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, ChevronDown, LifeBuoy, LogOut, Menu, Search, X } from "lucide-react";
import { useAuthFlag } from "@/lib/useAuthFlag";
import { usePortalUser } from "@/lib/usePortalUser";
import { useIsLive } from "@/components/layout/CurrencyProvider";
import { useSeekerWaitlist } from "@/components/seeker/SeekerWaitlistModal";
import { logoutAction } from "@/app/(portal)/actions";
import { trackNav } from "@/lib/analytics";
import { ACCOUNT_LINKS, MENUS, SUPPORT_LINK, type NavLink, type NavMenu } from "./nav-data";
import { Group, Row, focusRing, isCurrent, useFocusTrap, useOutside, ICONS } from "./NavParts";
import NavSearch from "./NavSearch";
import NavSearchBar from "./NavSearchBar";

/** Panel widths: wide enough for their columns, never wider than the screen. */
const PANEL_W: Record<NavMenu["id"], string> = { learn: "min(1120px, calc(100vw - 32px))", careers: "min(1060px, calc(100vw - 32px))", abroad: "min(1000px, calc(100vw - 32px))", resources: "min(700px, calc(100vw - 32px))", solutions: "min(1000px, calc(100vw - 32px))" };
const COLS: Record<NavMenu["id"], string> = { learn: "lg:grid-cols-[1.1fr_1fr_1.2fr]", careers: "lg:grid-cols-3", abroad: "lg:grid-cols-[0.8fr_0.9fr_1.3fr]", resources: "lg:grid-cols-2", solutions: "lg:grid-cols-3" };

const menuHasCurrent = (m: NavMenu, pathname: string | null) => m.groups.some((g) => g.links.some((l) => !l.external && !l.href.includes("?") && isCurrent(pathname, l.href)));

function Panel({ m, onNav, pathname, signedIn }: { m: NavMenu; onNav: (l: NavLink) => void; pathname: string | null; signedIn: boolean }) {
  return (
    <div>
      <div className={`grid gap-x-6 gap-y-5 ${COLS[m.id]}`}>
        {m.groups.map((g) => <Group key={g.title} g={g} onNav={onNav} pathname={pathname} signedIn={signedIn} />)}
      </div>
      {m.footer && (
        <Link href={m.footer.href} onClick={() => onNav(m.footer as NavLink)} className={`group mt-4 flex items-center justify-between gap-3 rounded-2xl bg-cream px-4 py-3 transition hover:bg-orange-lighter ${focusRing}`}>
          <span><span className="block text-[0.92rem] font-bold text-ink">{m.footer.label}</span><span className="block text-[0.8rem] text-ink-3">{m.footer.desc}</span></span>
          <ArrowRight className="h-4 w-4 shrink-0 text-orange-deep transition group-hover:translate-x-0.5" aria-hidden />
        </Link>
      )}
    </div>
  );
}

function AccountMenu({ user, onNav }: { user: { name: string; role: string }; onNav: (l: NavLink) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  useOutside(ref, open, () => setOpen(false));
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); btn.current?.focus(); } };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [open]);
  const links = ACCOUNT_LINKS[user.role] ?? ACCOUNT_LINKS.student;
  const first = user.name.split(" ")[0] || "Account";
  return (
    <div ref={ref} className="relative hidden md:block" onKeyDown={(e) => { if (e.key === "Escape" && open) { setOpen(false); btn.current?.focus(); } }} onBlur={(e) => { if (open && !ref.current?.contains(e.relatedTarget as Node)) setOpen(false); }}>
      <button ref={btn} type="button" aria-expanded={open} aria-haspopup="true" aria-controls="account-menu" onClick={() => setOpen((o) => !o)} className={`flex min-h-[44px] items-center gap-2 rounded-full border border-black/10 bg-white/80 py-1 pl-1 pr-3 text-[0.88rem] font-semibold text-ink-2 transition hover:bg-white ${focusRing}`}>
        <span aria-hidden className="grid h-9 w-9 place-items-center rounded-full bg-orange text-[0.9rem] font-bold text-white">{first.slice(0, 1).toUpperCase()}</span>
        <span className="max-w-[8rem] truncate">{first}</span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open && (
        <div id="account-menu" className="absolute right-0 top-[calc(100%+10px)] z-50 w-[260px] rounded-2xl border border-black/[0.08] bg-white p-2 shadow-[0_30px_80px_-24px_rgba(26,26,26,0.45)]">
          <p className="px-3 pb-1 pt-2 text-[0.68rem] font-bold uppercase tracking-[0.16em] text-ink-3">Signed in as {first}</p>
          <ul>{links.map((l) => <li key={l.href}><AccountRow l={l} pathname={pathname} onNav={(x) => { setOpen(false); onNav(x); }} /></li>)}</ul>
          <form action={logoutAction} className="mt-1 border-t border-black/[0.07] pt-1">
            <button type="submit" className={`flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 text-left text-[0.9rem] font-semibold text-ink-3 transition hover:bg-red-50 hover:text-red-700 ${focusRing}`}><LogOut className="h-[18px] w-[18px]" aria-hidden /> Log out</button>
          </form>
        </div>
      )}
    </div>
  );
}

function AccountRow({ l, pathname, onNav }: { l: NavLink; pathname: string | null; onNav: (l: NavLink) => void }) {
  const I = ICONS[l.icon];
  const cur = isCurrent(pathname, l.href);
  return (
    <Link href={l.href} aria-current={cur ? "page" : undefined} onClick={() => onNav(l)} className={`flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-[0.92rem] font-semibold text-ink-2 transition hover:bg-cream ${cur ? "bg-orange-lighter" : ""} ${focusRing}`}>
      <I className="h-[18px] w-[18px] text-orange-deep" aria-hidden />{l.label}{cur && <span className="sr-only">(current page)</span>}
    </Link>
  );
}

export default function HomeNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState<NavMenu["id"] | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [mAcc, setMAcc] = useState<NavMenu["id"] | null>("learn");
  const [search, setSearch] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const triggers = useRef<Partial<Record<NavMenu["id"], HTMLButtonElement | null>>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loggedIn = useAuthFlag();
  const isLive = useIsLive();
  const { openWaitlist } = useSeekerWaitlist();
  const portalUser = usePortalUser(); // undefined while loading, null when signed out
  const signedIn = !!portalUser;

  const cancel = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } };
  const show = (id: NavMenu["id"]) => { cancel(); setOpen((o) => { if (o !== id) trackNav("nav_menu_open", { menu: id }); return id; }); };
  const hideSoon = () => { cancel(); timer.current = setTimeout(() => setOpen(null), 180); };
  const onNav = useCallback((l: NavLink) => { trackNav("nav_link_click", { label: l.label, href: l.href }); setOpen(null); setDrawer(false); }, []);

  useOutside(navRef, open !== null, () => setOpen(null));
  useFocusTrap(drawerRef, drawer);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  useEffect(() => { setOpen(null); setDrawer(false); }, [pathname]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); const bar = document.getElementById("nav-search-input"); if (bar && bar.offsetParent !== null) { bar.focus(); return; } setSearch((p) => { if (!p) trackNav("nav_search_open", { via: "keyboard" }); return !p; }); }
      if (e.key === "Escape") { setDrawer(false); setOpen((o) => { if (o) triggers.current[o]?.focus(); return null; }); }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);
  useEffect(() => { document.body.style.overflow = drawer || search ? "hidden" : ""; return () => { document.body.style.overflow = ""; }; }, [drawer, search]);
  // A desktop-sized window never keeps the phone menu open.
  useEffect(() => { const mq = window.matchMedia("(min-width: 1180px)"); const f = () => { if (mq.matches) setDrawer(false); }; mq.addEventListener("change", f); return () => mq.removeEventListener("change", f); }, []);

  const cta = loggedIn
    ? { label: "Dashboard", onClick: () => window.location.assign("https://app.growqr.ai/home") }
    : !isLive
      ? { label: "Get started free", onClick: () => openWaitlist("home-options-nav") }
      : { label: "Get started free", onClick: () => window.location.assign("https://app.growqr.ai/signup") };
  const runCta = () => { trackNav("nav_cta_click", { label: cta.label }); cta.onClick(); };
  const openSearch = (via: string) => { trackNav("nav_search_open", { via }); setSearch(true); };

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50" onPointerLeave={(e) => { if (e.pointerType === "mouse") hideSoon(); }} onPointerEnter={(e) => { if (e.pointerType === "mouse") cancel(); }}>
        <div className={`mx-auto px-3 transition-[padding] duration-200 md:px-6 ${scrolled ? "pt-2" : "pt-3"}`}>
          <nav ref={navRef} aria-label="Primary" onKeyDown={(e) => { if (e.key === "Escape" && open) { const id = open; setOpen(null); triggers.current[id]?.focus(); } }}
            onBlur={(e) => { if (open && !navRef.current?.contains(e.relatedTarget as Node)) setOpen(null); }}
            className={`relative mx-auto flex h-[60px] max-w-[1440px] items-center gap-2 2xl:max-w-[1560px] rounded-[22px] border px-3 transition-[background-color,box-shadow,border-color] duration-200 md:h-[64px] md:px-4 ${scrolled || open || drawer ? "border-black/[0.08] bg-white/95 shadow-[0_10px_40px_-18px_rgba(26,26,26,0.35)] backdrop-blur-xl" : "border-transparent bg-white/70 backdrop-blur-md"}`}>
            <Link href="/" aria-label="GrowQR home" className={`mr-1 flex shrink-0 items-center rounded-lg md:mr-4 ${focusRing}`}><Image src="/growqr-logo.png" alt="GrowQR" width={400} height={200} priority className="h-[32px] w-auto select-none md:h-[36px]" /></Link>

            <ul className="hidden items-center gap-0.5 min-[1180px]:flex">
              {MENUS.map((m) => {
                const isOpen = open === m.id;
                const here = menuHasCurrent(m, pathname);
                return (
                  <li key={m.id} onPointerEnter={(e) => { if (e.pointerType === "mouse") show(m.id); }}>
                    <button ref={(el) => { triggers.current[m.id] = el; }} type="button" aria-expanded={isOpen} aria-controls={`menu-${m.id}`} onClick={() => (isOpen ? setOpen(null) : show(m.id))}
                      className={`relative flex min-h-[44px] items-center gap-1 whitespace-nowrap rounded-full px-2.5 text-[0.92rem] font-semibold transition xl:px-3.5 ${isOpen ? "bg-orange-light text-orange-deep" : "text-ink-2 hover:bg-black/[0.04]"} ${focusRing}`}>
                      {m.label}<ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden />
                      {here && <><span aria-hidden className="absolute inset-x-4 -bottom-0.5 h-[3px] rounded-full bg-orange" /><span className="sr-only">(current section)</span></>}
                    </button>
                    {isOpen && (
                      <div id={`menu-${m.id}`} role="region" aria-label={`${m.label} menu`} className="absolute left-1/2 top-[calc(100%+10px)] z-50 -translate-x-1/2 rounded-[28px] border border-black/[0.08] bg-white p-5 shadow-[0_40px_100px_-30px_rgba(26,26,26,0.45)] motion-safe:animate-[navIn_.16s_ease-out]" style={{ width: PANEL_W[m.id] }}>
                        <Panel m={m} onNav={onNav} pathname={pathname} signedIn={signedIn} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

            <NavSearchBar />

            <div className="ml-auto flex items-center gap-1.5 md:gap-2">
              <button type="button" onClick={() => openSearch("button")} aria-label="Search the site" className={`hidden min-h-[44px] items-center gap-2 rounded-full border border-black/10 bg-white/70 px-3 text-[0.84rem] text-ink-3 transition hover:bg-white md:inline-flex min-[1440px]:hidden ${focusRing}`}>
                <Search className="h-4 w-4" aria-hidden />
              </button>
              <button type="button" onClick={() => openSearch("icon")} aria-label="Search the site" className={`grid h-11 w-11 place-items-center rounded-full border border-black/10 bg-white/70 md:hidden ${focusRing}`}><Search className="h-[18px] w-[18px]" aria-hidden /></button>
              <Link href={SUPPORT_LINK.href} onClick={() => onNav(SUPPORT_LINK)} aria-label="Support: raise a ticket" title="Support: raise a ticket" className={`hidden min-h-[44px] items-center gap-2 whitespace-nowrap rounded-full border border-black/10 bg-white/70 px-3 text-[0.9rem] font-semibold text-ink-2 transition hover:border-ink hover:bg-white min-[1180px]:inline-flex ${focusRing}`}><LifeBuoy className="h-[18px] w-[18px]" aria-hidden /><span className="hidden min-[1500px]:inline">Support</span></Link>
              <CartLink />
              {portalUser === undefined ? (
                <span aria-hidden className="hidden h-[44px] w-[230px] md:block" />
              ) : portalUser ? (
                <AccountMenu user={portalUser} onNav={onNav} />
              ) : (
                <>
                  <Link href="/login" onClick={() => trackNav("nav_link_click", { label: "Log in", href: "/login" })} className={`hidden min-h-[44px] items-center whitespace-nowrap rounded-full px-3 text-[0.9rem] font-semibold text-ink-2 transition hover:bg-black/[0.04] md:inline-flex ${focusRing}`}>Log in</Link>
                  <button type="button" onClick={runCta} className={`hidden min-h-[44px] items-center gap-1.5 whitespace-nowrap rounded-full bg-orange px-4 text-[0.9rem] font-bold text-white shadow-[0_10px_24px_-10px_rgba(255,106,47,0.7)] transition hover:bg-orange-dark md:inline-flex ${focusRing}`}>{cta.label}<ArrowRight className="h-4 w-4" aria-hidden /></button>
                </>
              )}
              <button type="button" aria-label={drawer ? "Close menu" : "Open menu"} aria-expanded={drawer} aria-controls="mobile-nav" onClick={() => setDrawer((d) => { if (!d) trackNav("nav_mobile_open"); return !d; })} className={`grid h-11 w-11 place-items-center rounded-full border border-black/10 bg-white/70 min-[1180px]:hidden ${focusRing}`}>{drawer ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}</button>
            </div>
          </nav>
        </div>
      </header>

      {/* phone and tablet menu */}
      {drawer && (
        <div id="mobile-nav" ref={drawerRef} role="dialog" aria-modal="true" aria-label="Menu" className="fixed inset-0 z-[49] overflow-y-auto overscroll-contain bg-cream pt-[84px] min-[1180px]:hidden">
          <div className="mx-auto max-w-[640px] px-5 pb-40 pt-3">
            <button type="button" onClick={() => { setDrawer(false); openSearch("drawer"); }} className={`mb-4 flex min-h-[52px] w-full items-center gap-3 rounded-2xl border border-black/10 bg-white px-4 text-left text-[0.95rem] text-ink-3 ${focusRing}`}><Search className="h-5 w-5" aria-hidden />Search courses, tests, internships…</button>
            <Link href={SUPPORT_LINK.href} onClick={() => onNav(SUPPORT_LINK)} className={`mb-4 flex min-h-[52px] w-full items-center gap-3 rounded-2xl border border-black/10 bg-white px-4 text-left text-[0.95rem] font-semibold text-ink ${focusRing}`}><LifeBuoy className="h-5 w-5" aria-hidden />Support<span className="ml-auto text-[0.82rem] font-normal text-ink-3">Raise a ticket</span></Link>
            {MENUS.map((m) => {
              const isOpen = mAcc === m.id;
              return (
                <div key={m.id} className="border-b border-black/[0.08]">
                  <button type="button" onClick={() => setMAcc((a) => (a === m.id ? null : m.id))} aria-expanded={isOpen} aria-controls={`m-${m.id}`} className={`flex min-h-[56px] w-full items-center justify-between text-left text-[1.15rem] font-bold text-ink ${focusRing}`}>
                    {m.label}<ChevronDown className={`h-5 w-5 text-ink-3 transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden />
                  </button>
                  {isOpen && (
                    <div id={`m-${m.id}`} className="pb-4">
                      {m.groups.map((g) => <div key={g.title} className="mb-3"><Group g={g} onNav={onNav} pathname={pathname} signedIn={signedIn} /></div>)}
                      {m.footer && <Row l={m.footer} onNav={onNav} pathname={pathname} signedIn={signedIn} />}
                    </div>
                  )}
                </div>
              );
            })}
            {portalUser && (
              <div className="mt-4"><p className="px-2.5 pb-1 text-[0.68rem] font-bold uppercase tracking-[0.16em] text-ink-3">Your account</p>
                <ul>{(ACCOUNT_LINKS[portalUser.role] ?? ACCOUNT_LINKS.student).map((l) => <li key={l.href}><AccountRow l={l} pathname={pathname} onNav={onNav} /></li>)}</ul>
              </div>
            )}
          </div>
          <div className="fixed inset-x-0 bottom-0 z-10 flex gap-2.5 border-t border-black/[0.08] bg-white/95 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
            {portalUser ? (
              <form action={logoutAction} className="flex flex-1"><button type="submit" className={`flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-2xl border border-black/10 text-[0.95rem] font-bold text-ink ${focusRing}`}><LogOut className="h-4 w-4" aria-hidden />Log out</button></form>
            ) : (
              <>
                <Link href="/login" onClick={() => onNav({ label: "Log in", href: "/login", icon: "student" })} className={`flex min-h-[52px] flex-1 items-center justify-center rounded-2xl border border-black/10 text-[0.95rem] font-bold text-ink ${focusRing}`}>Log in</Link>
                <button type="button" onClick={() => { setDrawer(false); runCta(); }} className={`flex min-h-[52px] flex-[1.4] items-center justify-center gap-2 rounded-2xl bg-orange text-[0.95rem] font-bold text-white ${focusRing}`}>{cta.label}<ArrowRight className="h-4 w-4" aria-hidden /></button>
              </>
            )}
          </div>
        </div>
      )}

      <NavSearch open={search} onClose={() => setSearch(false)} />
      <style>{`@keyframes navIn{from{opacity:0;transform:translate(-50%,-6px)}to{opacity:1;transform:translate(-50%,0)}}`}</style>
    </>
  );
}
