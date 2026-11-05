"use client";

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";

/** The route that renders the home page pinned to enterprise mode. */
const ENTERPRISE_HOME_PATH = "/enterprise";

/**
 * Individual / Enterprise mode state for the home page.
 *
 * The Hero's top-left toggle pill writes to this context; the Squad
 * section reads from it to filter the 15-agent roster down to the 9
 * character agents (Individual) or 6 capability agents (Enterprise).
 *
 * Keep the provider wrapping ONLY the sections that need it (Hero +
 * Squad today) so the rest of the page can stay server-rendered.
 */
export type HomeMode = "individual" | "enterprise";

interface HomeModeContextValue {
  mode: HomeMode;
  setMode: (mode: HomeMode) => void;
}

const HomeModeContext = createContext<HomeModeContextValue | null>(null);

export function HomeModeProvider({
  children,
  forceMode,
}: {
  children: ReactNode;
  /**
   * Pin the mode and ignore the toggle. Used by pages that intentionally
   * render a single mode (e.g. /version2 — individual only).
   */
  forceMode?: HomeMode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  // The /enterprise route pins the home page to enterprise. Everywhere
  // else, mode is local state (set by the toggle or programmatically, e.g. by
  // the /solutions/enterprise page).
  const pinnedEnterprise = pathname === ENTERPRISE_HOME_PATH;
  const [stateMode, setModeState] = useState<HomeMode>("individual");

  const setMode = (newMode: HomeMode) => {
    if (forceMode) return;
    // On the home routes the mode IS the route, so navigate and let the
    // destination drive the mode (`/enterprise` is pinned; `/` defaults to
    // individual). We deliberately do NOT also setModeState here: doing both
    // flips the current page in place one frame before the navigation lands,
    // which reads as a double render / extra reload when toggling.
    if (pathname === "/" || pathname === ENTERPRISE_HOME_PATH) {
      router.push(newMode === "enterprise" ? ENTERPRISE_HOME_PATH : "/");
      return;
    }
    // Elsewhere (e.g. programmatic set on /solutions/enterprise, or /agents,
    // which drives its own URL-synced mode locally — see AgentsDirectory.tsx)
    // there is no shared route to navigate to, so update local state directly.
    setModeState(newMode);
  };

  const mode = forceMode ?? (pinnedEnterprise ? "enterprise" : stateMode);

  return (
    <HomeModeContext.Provider value={{ mode, setMode }}>
      {children}
    </HomeModeContext.Provider>
  );
}

/**
 * Subscribe to the shared Individual/Enterprise toggle. Safe to call from
 * outside the provider — returns a no-op fallback so other pages that
 * render Hero/Squad in isolation don't crash.
 */
export function useHomeMode(): HomeModeContextValue {
  const ctx = useContext(HomeModeContext);
  if (ctx) return ctx;
  return { mode: "individual", setMode: () => undefined };
}
