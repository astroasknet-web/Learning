import { getAttributionPayload } from "@/lib/attribution";

const NAVIGATION_TIMEOUT_MS = 800;

type Gtag = (...args: unknown[]) => void;

type AnalyticsWindow = Window & {
  gtag?: Gtag;
  /** Server-detected region (country + market_status), set once by an inline
   *  beforeInteractive script in app/layout.tsx from the same detectRegion()
   *  call that drives currency/CTA rendering — see gaRegion there. */
  __GA_REGION__?: { country?: string; market_status?: "live" | "waitlist" };
};

function getGtag(): Gtag | null {
  if (typeof window === "undefined") return null;
  const analyticsWindow = window as AnalyticsWindow;
  return typeof analyticsWindow.gtag === "function" ? analyticsWindow.gtag : null;
}

/** country/market_status for every event — read once, attached everywhere,
 *  so regional comparisons (GA4 Explorations, BigQuery) don't need a join. */
function regionEventParams(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const region = (window as AnalyticsWindow).__GA_REGION__;
  const params: Record<string, string> = {};
  if (region?.country) params.country = region.country;
  if (region?.market_status) params.market_status = region.market_status;
  return params;
}

/**
 * Single choke point for every GA4 event this site sends — no component
 * should ever call window.gtag directly. Always attaches page_path and the
 * visitor's region so events can be sliced by page and by market without
 * extra params at call sites.
 */
function trackEvent(name: string, params: Record<string, unknown> = {}): boolean {
  const gtag = getGtag();
  if (!gtag) return false;
  gtag("event", name, {
    page_path: window.location.pathname,
    ...regionEventParams(),
    ...params,
  });
  return true;
}

/**
 * The first-touch UTM snapshot (captured once per session by
 * AttributionCapture / lib/attribution.ts) attached to page_view and
 * generate_lead — a single source of truth for UTM attribution instead of a
 * second, independent capture mechanism.
 */
function utmEventParams(): Record<string, string> {
  const attribution = getAttributionPayload();
  const params: Record<string, string> = {};
  if (attribution.utm_source) params.utm_source = attribution.utm_source;
  if (attribution.utm_medium) params.utm_medium = attribution.utm_medium;
  if (attribution.utm_campaign) params.utm_campaign = attribution.utm_campaign;
  if (attribution.utm_term) params.utm_term = attribution.utm_term;
  if (attribution.utm_content) params.utm_content = attribution.utm_content;
  return params;
}

/**
 * SPA page_view — call on every client-side route change (see
 * PageViewTracker). The initial load's page_view already fires from the
 * gtag("config", ...) bootstrap in app/layout.tsx, so this only covers
 * navigations after that first load — never call it on mount.
 */
export function trackPageView(): void {
  if (typeof window === "undefined") return;
  trackEvent("page_view", {
    page_location: window.location.href,
    page_title: document.title,
    ...utmEventParams(),
  });
}

// ── CTA clicks ───────────────────────────────────────────────────────────────

/** What clicking the CTA actually does — lets one event name (app_cta_click)
 *  cover navigation, opening the waitlist modal, and opening the enterprise
 *  contact modal, instead of leaving the latter two untracked. */
export type CtaAction = "navigate" | "waitlist" | "modal";

export interface AppCtaEvent {
  ctaLabel: string;
  ctaLocation: string;
  /** Omit for actions that don't navigate (opening a modal in place). */
  destinationUrl?: string;
  ctaAction?: CtaAction;
}

function sendAppCtaEvent(event: AppCtaEvent, eventCallback?: () => void): boolean {
  const gtag = getGtag();
  if (!gtag) return false;

  gtag("event", "app_cta_click", {
    cta_label: event.ctaLabel,
    cta_location: event.ctaLocation,
    cta_action: event.ctaAction ?? "navigate",
    ...(event.destinationUrl ? { destination_url: event.destinationUrl } : {}),
    page_path: window.location.pathname,
    ...regionEventParams(),
    ...(eventCallback
      ? {
          event_callback: eventCallback,
          event_timeout: NAVIGATION_TIMEOUT_MS,
        }
      : {}),
  });

  return true;
}

/**
 * Records a CTA click without changing the browser's navigation. Use for
 * ordinary links whose native click behaviour should be preserved, and for
 * CTAs that open a modal in place (waitlist / enterprise contact) rather than
 * navigating — pass ctaAction: "waitlist" | "modal" for those.
 */
export function trackAppCta(event: AppCtaEvent): void {
  sendAppCtaEvent(event);
}

/**
 * Records an app-bound CTA and then navigates. The timeout guarantees that an
 * analytics/network issue can never leave the visitor stuck on the landing page.
 */
export function trackAppCtaAndNavigate(event: AppCtaEvent & { destinationUrl: string }): void {
  if (typeof window === "undefined") return;

  let hasNavigated = false;
  const navigate = () => {
    if (hasNavigated) return;
    hasNavigated = true;
    window.location.assign(event.destinationUrl);
  };

  const wasQueued = sendAppCtaEvent(event, navigate);
  if (!wasQueued) {
    navigate();
    return;
  }

  window.setTimeout(navigate, NAVIGATION_TIMEOUT_MS);
}

// ── Lead generation ──────────────────────────────────────────────────────────

export type LeadType =
  | "contact"
  | "newsletter"
  | "b2b_lead"
  | "seeker_waitlist"
  | "ambassador_apply"
  | "ambassador_waitlist"
  | "internship_apply"
  | "expert_intake"
  | "booking_confirmed";

/**
 * The single GA4 conversion event for every lead-generating action on the
 * site — GA4's recommended `generate_lead` event, distinguished by
 * `lead_type` rather than a differently-named custom event per form. Mark
 * generate_lead as a Key Event in GA4 once and every lead source is covered.
 */
export function trackGenerateLead(leadType: LeadType): void {
  trackEvent("generate_lead", {
    lead_type: leadType,
    ...utmEventParams(),
  });
}

// ── Multi-step form progress (genuine wizards only — not single-field forms) ─

export function trackFormStart(formName: string): void {
  trackEvent("form_start", { form_name: formName });
}

export function trackFormStepComplete(
  formName: string,
  stepName: string,
  stepNumber: number,
): void {
  trackEvent("form_step_complete", {
    form_name: formName,
    step_name: stepName,
    step_number: stepNumber,
  });
}

// ── App handoff attribution (prepared, not yet adopted) ─────────────────────

/**
 * Builds a destination URL for handing a visitor off to app.growqr.ai with
 * this site's first-touch UTM attribution, the CTA that sent them, and the
 * referring page attached as query params.
 *
 * NOT called anywhere yet — no CTA's destinationUrl is wrapped with this, so
 * redirect behavior today is unchanged. This exists so that adopting it later
 * is a one-line change per call site (`trackAppCtaAndNavigate({ ...,
 * destinationUrl: buildAppHandoffUrl(APP_SIGNUP_URL, "landing_hero") })`)
 * once the app side is ready to read and persist these params — see the
 * "Website side (pending)" / "App side (required)" items in the analytics
 * implementation summary before wiring this in.
 */
export function buildAppHandoffUrl(destinationUrl: string, ctaLocation: string): string {
  if (typeof window === "undefined") return destinationUrl;
  try {
    const url = new URL(destinationUrl);
    const attribution = getAttributionPayload();
    if (attribution.utm_source) url.searchParams.set("utm_source", attribution.utm_source);
    if (attribution.utm_medium) url.searchParams.set("utm_medium", attribution.utm_medium);
    if (attribution.utm_campaign) url.searchParams.set("utm_campaign", attribution.utm_campaign);
    if (attribution.utm_term) url.searchParams.set("utm_term", attribution.utm_term);
    if (attribution.utm_content) url.searchParams.set("utm_content", attribution.utm_content);
    url.searchParams.set("cta", ctaLocation);
    url.searchParams.set("ref", window.location.pathname);
    return url.toString();
  } catch {
    // Malformed destinationUrl (shouldn't happen — all call sites use fixed
    // constants) — degrade to the unmodified URL rather than break the redirect.
    return destinationUrl;
  }
}

// ── Section views (viewport-triggered, fire-once) ───────────────────────────

/**
 * A marketing section scrolled into view — e.g. the "Check Your Career
 * Readiness, Live" hero, so its view→click→lead funnel can be measured
 * end to end. Call once per mount (guard against re-firing on scroll back
 * into view at the call site, same pattern as PageViewTracker).
 */
export function trackSectionView(sectionName: string): void {
  trackEvent("section_view", { section_name: sectionName });
}

// ── Form submission failures ─────────────────────────────────────────────────

/**
 * Fired only on genuine submission failures (server/network error) — never
 * on client-side field validation, which is expected and not informative at
 * the scale GA4 operates on.
 */
export function trackFormError(formName: string, errorType: string): void {
  trackEvent("form_error", { form_name: formName, error_type: errorType });
}

/** A reader clicked a share control on a blog post. This records the click, not a completed share: the platforms do not report that. */
export type ShareMethod = "whatsapp" | "facebook" | "x" | "linkedin" | "telegram" | "pinterest" | "reddit" | "email" | "native" | "copy";
export function trackShare(method: ShareMethod, params: { article: string; category?: string; placement: "top" | "end" }): void {
  trackEvent(method === "copy" ? "copy_article_link" : `share_${method}`, { article_id: params.article, article_category: params.category ?? "", share_method: method, placement: params.placement });
}

// ── Course catalogue ───────────────────────────────────────

export type CatalogEvent = "course_catalog_view" | "course_search" | "course_search_zero_results" | "course_suggestion_select" | "course_filter_change" | "course_sort_change" | "course_card_open" | "course_enrol_click";

/**
 * Course catalogue interactions, through the same GA4 gate as every other event. Parameters are only what the student chose (a search phrase, a filter
 * name and value, a course slug) and counts: never an identity, an email or anything about payment.
 */
export function trackCatalog(name: CatalogEvent, params: Record<string, string | number | boolean> = {}): void {
  const clean: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(params)) clean[k] = typeof v === "string" ? v.slice(0, 80) : v;
  trackEvent(name, clean);
}

// ── Navigation ─────────────────────────────────────────────

export type NavEvent = "nav_menu_open" | "nav_link_click" | "nav_search_open" | "nav_search_select" | "nav_cta_click" | "nav_mobile_open";

/** Header and menu interactions, through the same GA4 gate as every other event: only the menu and link the visitor chose, never who they are. */
export function trackNav(name: NavEvent, params: Record<string, string> = {}): void {
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) clean[k] = v.slice(0, 80);
  trackEvent(name, clean);
}
