"use client";

import { useEffect } from "react";
import { captureFirstTouch } from "@/lib/attribution";

/**
 * Snapshots first-touch marketing attribution (UTMs, gclid, landing page,
 * referrer) into sessionStorage on the first page load of a session — before
 * client-side navigation strips the query params. Mounted once in
 * app/layout.tsx; renders nothing. Reads window.location directly instead of
 * useSearchParams, so it needs no Suspense boundary.
 */
export default function AttributionCapture() {
  useEffect(() => {
    captureFirstTouch();
  }, []);

  return null;
}
