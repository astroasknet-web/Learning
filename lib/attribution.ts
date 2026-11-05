import type { AttributionPayload } from "@/lib/forms/schemas";

/**
 * First-touch marketing attribution (locked decision A4: sessionStorage).
 *
 * On the first page load of a browser session, AttributionCapture (mounted in
 * app/layout.tsx) snapshots the UTM parameters, gclid, landing page and
 * referrer into sessionStorage. Later navigations never overwrite it — the
 * first touch is the touch that earned the visit. Forms attach the snapshot
 * (plus the submit-time page path) to their POST bodies via
 * getAttributionPayload(); the server sanitizes it again before persisting.
 * GA4 event tracking (lib/analytics.ts) reads the same snapshot for
 * page_view and generate_lead, so both systems share one source of truth.
 *
 * sessionStorage keeps the consent footprint minimal: no cookie, dies with
 * the tab. Everything is wrapped in try/catch — private mode or blocked
 * storage must degrade to null attribution, never to a broken form.
 */

const STORAGE_KEY = "growqr.attribution.v1";

/** The session-scoped first-touch snapshot (page_path is added at submit time). */
type FirstTouch = Omit<AttributionPayload, "page_path">;

const toNull = (value: string | null | undefined): string | null => (value ? value : null);

/**
 * Pure core: derive the first-touch snapshot from location parts. Split out
 * from the storage wrapper so the parsing rules are unit-testable in node.
 */
export function buildFirstTouch(parts: {
  search: string;
  pathname: string;
  referrer: string;
}): FirstTouch {
  const params = new URLSearchParams(parts.search);
  const search = params.toString();

  return {
    utm_source: toNull(params.get("utm_source")),
    utm_medium: toNull(params.get("utm_medium")),
    utm_campaign: toNull(params.get("utm_campaign")),
    utm_term: toNull(params.get("utm_term")),
    utm_content: toNull(params.get("utm_content")),
    gclid: toNull(params.get("gclid")),
    landing_page: search ? `${parts.pathname}?${search}` : parts.pathname,
    referrer: toNull(parts.referrer),
  };
}

/**
 * Snapshot the current location as the session's first touch — a no-op when
 * one is already stored or when storage is unavailable.
 */
export function captureFirstTouch(): void {
  if (typeof window === "undefined") return;
  try {
    if (window.sessionStorage.getItem(STORAGE_KEY)) return;
    const firstTouch = buildFirstTouch({
      search: window.location.search,
      pathname: window.location.pathname,
      referrer: document.referrer,
    });
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(firstTouch));
  } catch {
    // Storage blocked (private mode, embedded webview) — attribution stays null.
  }
}

const EMPTY_FIRST_TOUCH: FirstTouch = {
  utm_source: null,
  utm_medium: null,
  utm_campaign: null,
  utm_term: null,
  utm_content: null,
  gclid: null,
  landing_page: null,
  referrer: null,
};

function readFirstTouch(): FirstTouch {
  try {
    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    if (!stored) return { ...EMPTY_FIRST_TOUCH };
    // Only pick the known keys: a stale/foreign value in the slot must not
    // inject arbitrary fields (the server allowlists again regardless).
    const parsed = JSON.parse(stored) as Record<string, unknown>;
    const pick = (key: keyof FirstTouch): string | null =>
      typeof parsed[key] === "string" ? (parsed[key] as string) : null;
    return {
      utm_source: pick("utm_source"),
      utm_medium: pick("utm_medium"),
      utm_campaign: pick("utm_campaign"),
      utm_term: pick("utm_term"),
      utm_content: pick("utm_content"),
      gclid: pick("gclid"),
      landing_page: pick("landing_page"),
      referrer: pick("referrer"),
    };
  } catch {
    return { ...EMPTY_FIRST_TOUCH };
  }
}

/**
 * The `attribution` object forms attach to their POST bodies: the stored
 * first-touch snapshot plus the submit-time page path. GA4 event tracking
 * reads the same payload shape for its own attribution parameters.
 */
export function getAttributionPayload(): AttributionPayload {
  if (typeof window === "undefined") return { ...EMPTY_FIRST_TOUCH, page_path: null };
  return { ...readFirstTouch(), page_path: window.location.pathname };
}
