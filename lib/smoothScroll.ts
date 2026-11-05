import type Lenis from "lenis";

/**
 * Tiny registry for the site-wide Lenis instance.
 *
 * Lenis (see SmoothScroll.tsx) drives desktop scrolling via its own wheel
 * handler, so `body { overflow: hidden }` alone does NOT stop the page from
 * scrolling behind an open overlay — Lenis keeps animating the document.
 * Overlays must call `lockSmoothScroll()` on open and `unlockSmoothScroll()`
 * on close so Lenis pauses while they're up, then resumes.
 */
let instance: Lenis | null = null;

export function setLenis(l: Lenis | null) {
  instance = l;
}

/** Pause Lenis so the page underneath can't scroll while an overlay is open. */
export function lockSmoothScroll() {
  instance?.stop();
}

/** Resume Lenis once the overlay closes. */
export function unlockSmoothScroll() {
  instance?.start();
}
