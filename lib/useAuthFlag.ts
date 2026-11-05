"use client";

import { useEffect, useState } from "react";

/**
 * Reads the cross-subdomain auth flag the app sets on login:
 *   document.cookie = "gq_auth=1; domain=.growqr.ai; path=/; secure; samesite=lax"
 * (cleared with max-age=0 on logout).
 *
 * This is NOT a security check — it only toggles marketing-site CTAs
 * (e.g. "Get Started" → "Dashboard"). The real session still lives in the
 * app. Starts false on first render to stay hydration-safe, then reads the
 * cookie after mount.
 */
export function useAuthFlag() {
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    const has = document.cookie.split("; ").some((c) => {
      const [key, value] = c.split("=");
      return key === "gq_auth" && value && value !== "0";
    });
    setLoggedIn(has);
  }, []);

  return loggedIn;
}
