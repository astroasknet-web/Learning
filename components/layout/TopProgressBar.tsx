"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

/** Module-level counter so each navigation gets a unique key, forcing remount. */
let navCounter = 0;

/**
 * Thin top-of-page progress bar, mounted site-wide in the root layout.
 *
 * Gives an immediate "your click registered" signal on every in-app
 * navigation (card click, CTA redirect, tab → detail page):
 *  1. Starts (creeps slowly toward ~75%) the moment a Link is clicked — by
 *     patching window.history.pushState, which the App Router calls
 *     synchronously on navigation.
 *  2. Completes (snaps to 100%, fades out) once `usePathname` reports the new
 *     route has actually rendered.
 *
 * Subtle by design — 2.5px, brand orange, no layout shift.
 */
export default function TopProgressBar() {
  const pathname = usePathname();
  const [barKey, setBarKey] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const firstRender = useRef(true);

  /* ── Intercept pushState to detect navigation start ── */
  useEffect(() => {
    const origPush = window.history.pushState.bind(window.history);

    window.history.pushState = function (data: unknown, unused: string, url?: string | URL | null) {
      clearTimeout(hideTimer.current);
      navCounter += 1;
      setBarKey(navCounter);
      setDone(false);
      return origPush(data, unused, url);
    };

    return () => {
      window.history.pushState = origPush;
    };
  }, []);

  /* ── Detect route change completion ── */
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setDone(true);
    hideTimer.current = setTimeout(() => setBarKey(null), 700);
    return () => clearTimeout(hideTimer.current);
  }, [pathname]);

  return (
    <AnimatePresence>
      {barKey !== null && (
        <motion.div
          key={barKey}
          aria-hidden="true"
          className="fixed top-0 left-0 right-0 z-[9999] h-[2.5px] bg-orange pointer-events-none"
          initial={{ scaleX: 0, opacity: 1 }}
          animate={
            !done
              ? /* slowly creep towards 75% while the page loads */
                {
                  scaleX: 0.75,
                  opacity: 1,
                  transition: { duration: 12, ease: [0.05, 0.1, 0.2, 1] },
                }
              : /* snap to full width, then fade out */
                {
                  scaleX: 1,
                  opacity: 0,
                  transition: {
                    scaleX: { duration: 0.2, ease: "easeOut" },
                    opacity: { delay: 0.2, duration: 0.35 },
                  },
                }
          }
          style={{ transformOrigin: "0% 50%" }}
        />
      )}
    </AnimatePresence>
  );
}
