"use client";

import { useEffect, useState } from "react";

/** Whether the visitor has a portal session (first name and role only): undefined while loading, null when signed out. */
export function usePortalUser(): { name: string; role: string } | null | undefined {
  const [u, setU] = useState<{ name: string; role: string } | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    fetch("/api/portal/me", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((j) => { if (live) setU(j.user ?? null); })
      .catch(() => { if (live) setU(null); });
    return () => { live = false; };
  }, []);
  return u;
}
