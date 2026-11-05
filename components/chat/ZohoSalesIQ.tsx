"use client";

import { Suspense, useEffect } from "react";
import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { useCountry, useCurrency } from "@/components/layout/CurrencyProvider";
import { useAuthFlag } from "@/lib/useAuthFlag";
import { getAttributionPayload } from "@/lib/attribution";
import { solutionFromPath } from "@/lib/bot/clientContext";

const configuredWidgetCode =
  process.env.NEXT_PUBLIC_ZOHO_SALESIQ_WIDGET_CODE?.trim();

const widgetCode =
  configuredWidgetCode && /^siq[A-Za-z0-9._-]+$/.test(configuredWidgetCode)
    ? configuredWidgetCode
    : null;

/**
 * Loads the Zoho SalesIQ website chatbot when its public widget code is set.
 * Never loads on /admin routes — the dashboard is a staff tool, and a
 * visitor-facing sales chat has no place in it.
 * The external script is deferred until after hydration so it does not delay
 * the application's initial render.
 *
 * Also pushes the minimal visitor context the webhook bot's intent router
 * reads (lib/bot/context.ts GrowQRVisitorContext) via
 * $zoho.salesiq.visitor.info() — see docs/salesiq-bot/CONTEXT_SCHEMA.ts.
 * Deliberately only these eight fields per the approved scope; do not add
 * more without updating the schema doc first.
 */
function VisitorContext() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const country = useCountry();
  const currency = useCurrency();
  const loggedIn = useAuthFlag();

  useEffect(() => {
    if (!widgetCode) return;
    // Only the /agents Individual/Business toggle's "mode" param carries a
    // meaning solutionFromPath() understands (see lib/bot/clientContext.ts) —
    // append just that, not the full raw query string, so `page` stays clean
    // and doesn't duplicate the utm_source/utm_campaign fields sent below.
    const modeParam = searchParams.get("mode") === "enterprise" ? "enterprise" : null;
    const page = modeParam ? `${pathname}?mode=${modeParam}` : pathname;
    const { solution, audience } = solutionFromPath(page);
    const attribution = getAttributionPayload();
    const context = {
      page,
      audience,
      solution,
      country,
      currency,
      utm_source: attribution.utm_source,
      utm_campaign: attribution.utm_campaign,
      logged_in: loggedIn,
    };

    // The widget script loads async, so `$zoho.salesiq.visitor` may not
    // exist yet on the very first render (e.g. right after landing) — set
    // it as the ready callback for that case, and also call it directly for
    // the common case where the widget is already up (route changes after
    // the first load). Both are guarded; a widget-lifecycle miss here is a
    // missing-context degradation, not a broken chat.
    try {
      const zoho = (window as unknown as { $zoho?: Record<string, unknown> }).$zoho;
      const salesiq = zoho?.salesiq as
        | { ready?: () => void; visitor?: { info?: (v: object) => void } }
        | undefined;
      if (salesiq) {
        salesiq.ready = () => salesiq.visitor?.info?.(context);
        salesiq.visitor?.info?.(context);
      }
    } catch {
      // Widget not ready / shape unexpected — non-fatal, see comment above.
    }
  }, [pathname, searchParams, country, currency, loggedIn]);

  return null;
}

/** Routes the visitor chatbot must never appear on. */
function isSuppressedPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

export default function ZohoSalesIQ() {
  const pathname = usePathname() || "";
  const suppressed = isSuppressedPath(pathname);

  // Not rendering the <Script> tags is enough for a fresh load of an admin
  // route, but Zoho appends its launcher directly to <body> — so if the widget
  // came up on a public page and the visitor then navigated client-side into
  // /admin, unmounting the scripts would leave that launcher on screen. Hide
  // it through the widget's own API for that case.
  useEffect(() => {
    if (!suppressed) return;
    try {
      const zoho = (window as unknown as { $zoho?: Record<string, unknown> }).$zoho;
      const salesiq = zoho?.salesiq as
        | { floatbutton?: { visible?: (state: string) => void } }
        | undefined;
      salesiq?.floatbutton?.visible?.("hide");
    } catch {
      // Widget absent or shape unexpected — nothing to hide.
    }
  }, [suppressed]);

  if (!widgetCode || suppressed) {
    return null;
  }

  return (
    <>
      <Script id="zoho-salesiq-init" strategy="afterInteractive">
        {
          "window.$zoho=window.$zoho||{};window.$zoho.salesiq=window.$zoho.salesiq||{ready:function(){}};"
        }
      </Script>
      <Script
        id="zsiqscript"
        src={`https://salesiq.zohopublic.in/widget?wc=${encodeURIComponent(widgetCode)}`}
        strategy="afterInteractive"
      />
      {/* VisitorContext reads useSearchParams() (the /agents ?mode= toggle) —
          Next.js requires a Suspense boundary around that. */}
      <Suspense fallback={null}>
        <VisitorContext />
      </Suspense>
    </>
  );
}
