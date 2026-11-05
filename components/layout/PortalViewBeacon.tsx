"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/** Counts a page view in the first-party, cookie-less table that the admin analytics reads (no cookies, no IP stored). Runs on every route change. */
export default function PortalViewBeacon() {
  const pathname = usePathname();
  useEffect(() => {
    try {
      const body = JSON.stringify({ path: pathname, ref: document.referrer });
      if (!(navigator.sendBeacon && navigator.sendBeacon("/api/t", new Blob([body], { type: "application/json" })))) void fetch("/api/t", { method: "POST", body, keepalive: true });
    } catch {
      /* analytics must never break a page */
    }
  }, [pathname]);
  return null;
}
