import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { GeistMono } from "geist/font/mono";
import { Poppins, Instrument_Serif } from "next/font/google";
import IconProvider from "@/components/layout/IconProvider";
import AttributionCapture from "@/components/layout/AttributionCapture";
import PageViewTracker from "@/components/layout/PageViewTracker";
import PortalViewBeacon from "@/components/layout/PortalViewBeacon";
import SmoothScroll from "@/components/layout/SmoothScroll";
import TopProgressBar from "@/components/layout/TopProgressBar";
import ZohoSalesIQ from "@/components/chat/ZohoSalesIQ";
import "./globals.css";
import { cn } from "@/lib/utils";
import { serializeJsonLd } from "@/lib/json-ld";
import { HomeModeProvider } from "@/components/layout/HomeMode";
import { CurrencyProvider } from "@/components/layout/CurrencyProvider";
import { SeekerWaitlistProvider } from "@/components/seeker/SeekerWaitlistModal";
import { detectRegion } from "@/lib/currency.server";
import { SITE_URL, OG_IMAGE } from "@/lib/seo";

// No hardcoded fallback: GA4 only loads when a validly-shaped measurement ID
// is configured, so local/dev/preview environments without the env var run
// with analytics off entirely rather than silently reporting into whichever
// ID a fallback would pick.
const configuredGaMeasurementId =
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim();
const gaMeasurementId =
  configuredGaMeasurementId && /^G-[A-Z0-9]+$/i.test(configuredGaMeasurementId)
    ? configuredGaMeasurementId
    : null;

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-poppins",
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#FF6A2F",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "GrowQR: One QR. One Identity. Unlocks Growth.",
  description: "Specialised AI agents. One QR. Your career edge, activated. The AI-driven proof-of-skill platform powering the future of readiness.",
  keywords: "GrowQR, GrowQR.ai, growqr ai, growqr platform, RQ-Score, proof of skill, skill verification, talent verification, workforce intelligence, AI talent platform, career readiness, QR code skills, enterprise talent, smart city workforce, not grok, not grow company, specialised AI agents, AI career Edge",
  authors: [{ name: "GrowQR" }],
  publisher: "GrowQR",
  metadataBase: new URL(SITE_URL),
  alternates: {
    canonical: `${SITE_URL}/`,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    title: "GrowQR: One QR. One Identity. Unlocks Growth.",
    description: "Specialised AI agents. One QR. Your career edge, activated.",
    type: "website",
    url: `${SITE_URL}/`,
    siteName: "GrowQR",
    images: [OG_IMAGE],
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    site: "@Growqr",
    creator: "@Growqr",
    title: "GrowQR.ai | Specialised AI Agents",
    description: "Specialised AI agents. One QR. Your career edge, activated.",
    // summary_large_image needs a ~1200x630 asset; logo.png is a 385x130
    // wordmark and was being rejected/letterboxed.
    images: [OG_IMAGE.url],
  },
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Detect the visitor's region (currency + whether we sell there) from Vercel
  // geolocation, server-side, so the whole app renders the right currency and
  // the right CTAs on first paint (no flicker).
  const region = await detectRegion();

  // GA4 country/market — set once from the same server-detected region, both
  // as a GA4 user property (session-level segments) and as window.__GA_REGION__
  // (read by lib/analytics.ts's trackEvent core so EVERY event — page_view,
  // app_cta_click, generate_lead, etc. — carries them as event parameters too,
  // without a client-side hook or a race against the gtag script loading).
  // Validated strictly (ISO 3166-1 alpha-2) before going into inline scripts,
  // since the country ultimately traces back to an HTTP header.
  const gaCountry = region.country && /^[A-Z]{2}$/.test(region.country) ? region.country : undefined;
  const gaRegion = {
    country: gaCountry,
    market_status: region.isLive ? "live" : "waitlist",
  };
  const gaUserProperties = JSON.stringify(gaRegion);

  return (
    <html
      lang="en"
      className={cn(poppins.variable, GeistMono.variable, instrumentSerif.variable, "font-sans")}
    >
      <head>
        {/* Preconnect to external origins — saves 200-400ms DNS lookup on mobile */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://app.growqr.ai" />

        {/* Structured Data / JSON-LD - Organization */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
             __html: serializeJsonLd({
              "@context": "https://schema.org",
              "@type": "Organization",
              "@id": `${SITE_URL}/#organization`,
              "name": "GrowQR",
              "alternateName": ["GrowQR.ai", "Grow QR", "GrowQR AI"],
              "url": SITE_URL,
              "logo": {
                "@type": "ImageObject",
                "url": `${SITE_URL}/logo.png`,
                // Real dimensions of public/logo.png — this previously
                // claimed 512x512 for a 385x130 wordmark.
                "width": 385,
                "height": 130
              },
              "image": `${SITE_URL}${OG_IMAGE.url}`,
              "description": "GrowQR provides specialised AI agents and the RQ-Score system, making talent visible, verified, and valuable.",
              "slogan": "One QR. Infinite Potential.",
              "foundingDate": "2024",
               "founder": {
                "@type": "Person",
                "name": "GrowQR Team"
              },
              "email": "support@growqr.ai",
              "sameAs": [
                "https://x.com/Growqr",
                "https://www.linkedin.com/company/growqr",
                "https://www.instagram.com/growqr.ai"
              ]
            })
          }}
        />

        {/* WebSite Schema */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: serializeJsonLd({
              "@context": "https://schema.org",
              "@type": "WebSite",
              "@id": `${SITE_URL}/#website`,
              "name": "GrowQR",
              "alternateName": "GrowQR.ai",
              "url": SITE_URL,
              "description": "The AI-driven proof-of-skill platform powering the future of readiness",
              "publisher": {
                "@id": `${SITE_URL}/#organization`
              },
              // No SearchAction: the site has no search endpoint, and this
              // previously advertised a "/?search=" sitelinks searchbox that
              // nothing on the site implements. Re-add only alongside a real
              // search route that actually reads the query param.
              "inLanguage": "en-US"
            })
          }}
        />

        {/* SoftwareApplication Schema */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: serializeJsonLd({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              "name": "GrowQR",
              "alternateName": ["GrowQR.ai", "GrowQR Platform", "RQ-Score Platform"],
              "description": "AI-driven proof-of-skill platform that provides RQ-Score and specialised AI agents for workforce intelligence.",
              "url": SITE_URL,
              "applicationCategory": "BusinessApplication",
              "operatingSystem": "Web",
              "offers": {
                "@type": "Offer",
                "price": "0",
                "priceCurrency": "USD",
                "availability": "ComingSoon"
              },
              "featureList": [
                "Specialised AI Agents",
                "RQ-Score skill verification",
                "QR code based skill profiles",
                "Enterprise workforce intelligence"
              ],
              "screenshot": `${SITE_URL}/logo.png`,
              "provider": {
                "@id": `${SITE_URL}/#organization`
              }
            })
          }}
        />
      </head>
      <body className="font-sans antialiased grain">
        {gaMeasurementId && (
          <Script
            id="ga-region"
            strategy="beforeInteractive"
            dangerouslySetInnerHTML={{
              __html: `window.__GA_REGION__=${gaUserProperties};`,
            }}
          />
        )}
        <IconProvider />
        <AttributionCapture />
        <PageViewTracker />
        <PortalViewBeacon />
        <CurrencyProvider value={region}>
          <HomeModeProvider>
            <SeekerWaitlistProvider>
              <TopProgressBar />
              <SmoothScroll />
              {children}
              <ZohoSalesIQ />
            </SeekerWaitlistProvider>
          </HomeModeProvider>
        </CurrencyProvider>
        {gaMeasurementId && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaMeasurementId)}`}
              strategy="afterInteractive"
            />
            <Script
              id="google-analytics"
              strategy="afterInteractive"
              dangerouslySetInnerHTML={{
                __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=window.gtag||gtag;gtag("js",new Date());gtag("set","user_properties",${gaUserProperties});gtag("config","${gaMeasurementId}");`,
              }}
            />
          </>
        )}
      </body>
    </html>
  );
}
