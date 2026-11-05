"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { trackPageView } from "@/lib/analytics";

/**
 * Fires a GA4 page_view on every client-side route change. Next.js App
 * Router doesn't send one on its own — only the initial hard load does, via
 * the gtag("config", ...) bootstrap in app/layout.tsx — so every navigation
 * after that first one would otherwise be invisible to GA4.
 *
 * Uses only usePathname (never useSearchParams), matching AttributionCapture's
 * approach, so this needs no Suspense boundary. Skips the first render since
 * that page_view already came from the bootstrap config call — firing again
 * here would double-count the landing page.
 */
export default function PageViewTracker() {
  const pathname = usePathname();
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    trackPageView();
  }, [pathname]);

  return null;
}
