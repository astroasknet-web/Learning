import type { EventRow } from "@/features/events/types/event";
import type { Expert } from "@/features/experts/data/experts-data";

// Must match the host that actually serves the site: growqr.ai 308s to
// www.growqr.ai, and a canonical pointing at a redirect is discarded by
// Google — which is what left every page "duplicate without user-selected
// canonical" in Search Console. Keep this in sync with the Vercel domain
// config; never point it at a host that redirects.
export const SITE_URL = "https://www.growqr.ai";
const ORG_ID = `${SITE_URL}/#organization`;

/** "/experts/foo" -> "https://www.growqr.ai/experts/foo". Always pass an
 *  absolute-from-root path (leading slash), never a relative one. */
export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Alias of absoluteUrl for use in `alternates.canonical` — same value,
 *  named for the call site so it reads clearly in metadata blocks. */
export function canonicalUrl(path: string): string {
  return absoluteUrl(path);
}

/** Default social/preview card, 1200x630 (regenerate with the script in
 *  scripts/generate-og-image.mjs if the brand line changes).
 *
 *  Every page that declares its own `openGraph` MUST spread this in: Next
 *  replaces the parent `openGraph` object wholesale rather than merging it,
 *  so a page that sets only title/description/url silently ships with no
 *  og:image at all — which is how 39 pages ended up previewing as bare text
 *  cards on LinkedIn, X, Slack and in answer-engine citations. */
export const OG_IMAGE = {
  url: "/og-image.png",
  width: 1200,
  height: 630,
  alt: "GrowQR — One QR. One Identity. Unlocks Growth.",
} as const;

/** schema.org FAQPage from the same { q, a } shape already used by every
 *  FAQ component in the codebase. */
export function buildFaqSchema(faqs: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: f.a,
      },
    })),
  };
}

/** Known fixed UTC offsets for the timezones this app actually uses
 *  (see features/events/components/admin/EventForm.tsx default). Anything
 *  outside this map is omitted rather than guessed. */
const TZ_OFFSET: Record<string, string> = {
  "Asia/Kolkata": "+05:30",
  UTC: "+00:00",
};

/** "5:00 PM" / "17:00" -> "17:00:00", or null if unparseable. */
function parseTimeToHms(time: string | null): string | null {
  if (!time) return null;
  const m = time.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!m) return null;
  let hours = parseInt(m[1], 10);
  const minutes = m[2];
  const meridiem = m[3]?.toUpperCase();
  if (meridiem === "PM" && hours < 12) hours += 12;
  if (meridiem === "AM" && hours === 12) hours = 0;
  if (hours > 23) return null;
  return `${String(hours).padStart(2, "0")}:${minutes}:00`;
}

function buildEventDateTime(date: string, time: string | null, timezone: string | null): string {
  const hms = parseTimeToHms(time) ?? "00:00:00";
  const offset = timezone ? TZ_OFFSET[timezone] : undefined;
  return `${date}T${hms}${offset ?? ""}`;
}

/** schema.org Event, built from the same EventRow already fetched for
 *  generateMetadata / the page body — no extra data fetch. */
export function buildEventSchema(event: EventRow) {
  const url = absoluteUrl(`/events/${event.slug}`);
  const isOnline = event.event_mode === "online";

  const location = isOnline
    ? {
        "@type": "VirtualLocation",
        url: event.meeting_url ?? url,
      }
    : {
        "@type": "Place",
        name: event.venue ?? event.title,
        address: {
          "@type": "PostalAddress",
          ...(event.city ? { addressLocality: event.city } : {}),
          ...(event.country ? { addressCountry: event.country } : {}),
        },
      };

  const image = event.poster_url ?? event.speaker_image ?? absoluteUrl("/logo.png");

  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    ...(event.short_description ? { description: event.short_description } : {}),
    startDate: buildEventDateTime(event.event_date, event.start_time, event.timezone),
    ...(event.end_time
      ? { endDate: buildEventDateTime(event.event_date, event.end_time, event.timezone) }
      : {}),
    eventAttendanceMode: isOnline
      ? "https://schema.org/OnlineEventAttendanceMode"
      : "https://schema.org/OfflineEventAttendanceMode",
    eventStatus: "https://schema.org/EventScheduled",
    location,
    image,
    url,
    organizer: { "@id": ORG_ID },
    ...(event.speaker_name
      ? { performer: { "@type": "Person", name: event.speaker_name } }
      : {}),
  };
}

/** schema.org Person, built from the same Expert already fetched for
 *  generateMetadata / the page body. AggregateRating/Review are only
 *  attached when there's real review data — never emit a rating claim
 *  the page can't back up with actual reviews. */
export function buildPersonSchema(expert: Expert) {
  const url = absoluteUrl(`/experts/${expert.slug}`);
  const hasRealReviews = expert.reviewCount > 0 && expert.reviews.length > 0;

  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: expert.name,
    jobTitle: expert.role,
    description: expert.bio,
    image: expert.image,
    url,
    ...(hasRealReviews
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: expert.rating,
            reviewCount: expert.reviewCount,
          },
          review: expert.reviews.map((r) => ({
            "@type": "Review",
            author: { "@type": "Person", name: r.name },
            reviewRating: {
              "@type": "Rating",
              ratingValue: r.rating,
              bestRating: 5,
            },
            reviewBody: r.text,
          })),
        }
      : {}),
  };
}

/** schema.org BreadcrumbList. Pass page-relative paths ("/experts/foo");
 *  they're resolved to absolute URLs internally. */
export function buildBreadcrumbSchema(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}
