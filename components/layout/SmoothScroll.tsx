"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Lenis from "lenis";
import { setLenis } from "@/lib/smoothScroll";

/**
 * Site-wide smooth scroll (desktop only).
 *
 * Mounts once at the root. Lenis drives the visual scroll on DESKTOP pointer
 * devices only. There is no longer any GSAP / ScrollTrigger coupling — the
 * scroll-reveal system was removed (see Reveal.tsx) because it left sections
 * blank on cold first loads. Lenis here is purely a smoothing layer and never
 * hides or gates content, so it cannot cause blank-content bugs.
 *
 * MOBILE: Lenis is disabled entirely on touch/coarse-pointer devices — native
 * scroll is already smooth, and Lenis was blocking the main thread there.
 * Respects `prefers-reduced-motion` (falls back to native scroll).
 * Admin routes are skipped (Lenis interferes with dashboard scroll).
 * Horizontal scroll regions (agent rails) are handled per-axis by Lenis's
 * `allowNestedScroll` — horizontal wheel scrolls the rail, vertical wheel still
 * scrolls the page. They must NOT carry `data-lenis-prevent`, which would make
 * Lenis ignore all axes there and freeze the page while hovering the rail.
 * Overlays with their own scroll (compare modal, agent sheet) still use it.
 */
export default function SmoothScroll() {
  const pathname = usePathname();

  useEffect(() => {
    // Skip on admin routes — Lenis interferes with normal dashboard scroll
    if (pathname.startsWith("/admin")) return;

    // Skip Lenis on touch/mobile — native scroll is fast enough and Lenis was
    // causing a ~60s scroll freeze on mobile Chrome.
    const isTouch =
      typeof window !== "undefined" &&
      window.matchMedia("(pointer: coarse)").matches;
    if (isTouch) return;

    const prefersReduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduce) return;

    const lenis = new Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      syncTouch: false,
      wheelMultiplier: 1,
      touchMultiplier: 1.4,
      // Horizontal rails (agent squads, related personas) sit inside this
      // vertically-smooth-scrolled page. Without this, Lenis and the rail's
      // own native scroll can both try to own a wheel tick — the browser and
      // Lenis's virtual scroll position drift apart and the page reads as
      // "stuck" the next time you scroll. This lets Lenis detect a genuinely
      // scrollable nested element and hand the gesture off to it natively.
      allowNestedScroll: true,
    });

    // Expose the instance so overlays can stop()/start() it — see smoothScroll.ts.
    setLenis(lenis);

    let rafId = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    };
    rafId = requestAnimationFrame(raf);

    // Anchor links → Lenis smooth scroll (override native jump)
    const onAnchorClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const a = target?.closest("a") as HTMLAnchorElement | null;
      if (!a) return;
      const href = a.getAttribute("href");
      if (!href || !href.startsWith("#") || href.length < 2) return;
      const el = document.querySelector(href);
      if (!el) return;
      e.preventDefault();
      lenis.scrollTo(el as HTMLElement, { offset: -24, duration: 1.2 });
    };
    document.addEventListener("click", onAnchorClick);

    return () => {
      document.removeEventListener("click", onAnchorClick);
      cancelAnimationFrame(rafId);
      setLenis(null);
      lenis.destroy();
    };
  }, [pathname]);

  return null;
}
