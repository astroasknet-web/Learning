import type { AttributionPayload } from "@/lib/forms/schemas";

/**
 * Pure derivation tables: website signals → Zoho Lead field values.
 *
 * Single source of truth for every mapping (blueprint §6.5/§6.6). All values
 * are Zoho picklist DISPLAY values, verified against the live org's
 * getFields output on 2026-07-23 — Zoho matches picklists on display value,
 * and a renamed picklist silently keeps its legacy actual_value, so display
 * values here are the only convention that round-trips. The Phase 6 drift
 * check compares these constants against live getFields before any picklist
 * edit.
 */

// ── Picklist display values (verified live) ─────────────────────────────────

export type Audience =
  | "Student"
  | "Professional"
  | "Coach"
  | "Freelancer"
  | "Recruiter"
  | "Institute"
  | "Enterprise";

export type BusinessUnit = "Individual" | "Talent" | "EdTech" | "Enterprise";

export type ProductInterest = "Q-Ryze" | "Q-Kalyber" | "Q-Kampus" | "Q-Skale";

export type Segment = "B2B" | "B2C";

export type Region = "India" | "USA" | "UAE" | "Singapore" | "Other";

export type LeadSource =
  | "Website"
  | "Referral"
  | "Organic Search"
  | "Social Media"
  | "Email Campaign"
  | "Paid Ads"
  | "Partner";

export interface AudienceInterest {
  audience: Audience | null;
  businessUnit: BusinessUnit | null;
  productInterest: ProductInterest | null;
}

const NO_AUDIENCE: AudienceInterest = {
  audience: null,
  businessUnit: null,
  productInterest: null,
};

/**
 * THE mapping table. Business Unit and Product Interest are both functions of
 * Audience — never derived independently, never sent without an Audience — so
 * every caller resolves an Audience and expands it here. Changing GrowQR's
 * segmentation means editing this table and nothing else.
 */
export const AUDIENCE_MAP: Record<
  Audience,
  { businessUnit: BusinessUnit; productInterest: ProductInterest }
> = {
  Student: { businessUnit: "Individual", productInterest: "Q-Ryze" },
  Professional: { businessUnit: "Individual", productInterest: "Q-Ryze" },
  Freelancer: { businessUnit: "Individual", productInterest: "Q-Ryze" },
  // A coach sells to and develops other people, so they buy the talent product
  // rather than the individual one — the one persona on this form whose
  // Business Unit is not Individual.
  Coach: { businessUnit: "Talent", productInterest: "Q-Kalyber" },
  Recruiter: { businessUnit: "Talent", productInterest: "Q-Kalyber" },
  Institute: { businessUnit: "EdTech", productInterest: "Q-Kampus" },
  Enterprise: { businessUnit: "Enterprise", productInterest: "Q-Skale" },
};

/** Audience → the full triple. A null audience yields all-null (fields omitted). */
export function expandAudience(audience: Audience | null): AudienceInterest {
  if (!audience) return NO_AUDIENCE;
  return { audience, ...AUDIENCE_MAP[audience] };
}

// ── Name splitting ──────────────────────────────────────────────────────────

/**
 * Zoho requires Last_Name. Split on the last space; a single token becomes
 * the last name with no first name (honest for mononyms and the safest
 * default for a required field).
 */
export function splitName(fullName: string): { firstName: string | null; lastName: string } {
  const trimmed = fullName.trim().replace(/\s+/g, " ");
  const lastSpace = trimmed.lastIndexOf(" ");
  if (lastSpace === -1) return { firstName: null, lastName: trimmed };
  return { firstName: trimmed.slice(0, lastSpace), lastName: trimmed.slice(lastSpace + 1) };
}

// ── Country → Region + Country picklist ─────────────────────────────────────

/** ISO-3166 alpha-2 → Region picklist. Everything unmapped collapses to Other. */
export function regionForCountryCode(code: string | null): Region {
  switch (code) {
    case "IN":
      return "India";
    case "US":
      return "USA";
    case "AE":
      return "UAE";
    case "SG":
      return "Singapore";
    default:
      return "Other";
  }
}

/**
 * The live Country field is a PICKLIST of exact display names, so free-form
 * names (e.g. Intl.DisplayNames output) risk per-country rejections. This
 * curated map covers the 13 live countries plus major markets, with strings
 * verbatim from the live picklist; unmapped codes omit Country entirely —
 * Region still records "Other" and the raw ISO code stays in the database.
 */
const COUNTRY_DISPLAY_NAMES: Record<string, string> = {
  // Live countries (lib/currency.ts LIVE_COUNTRIES)
  IN: "India",
  AE: "United Arab Emirates",
  TR: "Türkiye",
  GE: "Georgia",
  LK: "Sri Lanka",
  NP: "Nepal",
  TH: "Thailand",
  BR: "Brazil",
  AR: "Argentina",
  MT: "Malta",
  NO: "Norway",
  SE: "Sweden",
  CH: "Switzerland",
  // Major markets
  US: "United States",
  SG: "Singapore",
  GB: "United Kingdom",
  CA: "Canada",
  AU: "Australia",
  NZ: "New Zealand",
  DE: "Germany",
  FR: "France",
  NL: "Netherlands",
  ES: "Spain",
  IT: "Italy",
  PT: "Portugal",
  IE: "Ireland",
  PL: "Poland",
  PK: "Pakistan",
  BD: "Bangladesh",
  ID: "Indonesia",
  MY: "Malaysia",
  PH: "Philippines",
  VN: "Vietnam",
  JP: "Japan",
  KR: "South Korea",
  CN: "China",
  HK: "Hong Kong S.A.R.",
  SA: "Saudi Arabia",
  QA: "Qatar",
  KW: "Kuwait",
  OM: "Oman",
  BH: "Bahrain",
  EG: "Egypt",
  NG: "Nigeria",
  KE: "Kenya",
  ZA: "South Africa",
  MX: "Mexico",
  IL: "Israel",
};

export function countryDisplayName(code: string | null): string | null {
  return code ? (COUNTRY_DISPLAY_NAMES[code] ?? null) : null;
}

// ── Lead_Source (UTM-aware, priority-ordered — §6.6) ────────────────────────

const PAID_MEDIUMS = new Set(["cpc", "ppc", "paid", "paid_social"]);
const SOCIAL_SOURCES = new Set(["linkedin", "facebook", "instagram", "twitter", "x", "youtube"]);
const SEARCH_ENGINE_HOSTS = [
  "google.",
  "bing.",
  "duckduckgo.",
  "search.yahoo.",
  "baidu.",
  "yandex.",
  "ecosia.",
];

function referrerHost(referrer: string | null): string | null {
  if (!referrer) return null;
  try {
    return new URL(referrer).hostname.toLowerCase();
  } catch {
    return null;
  }
}

const isSearchEngine = (host: string): boolean =>
  SEARCH_ENGINE_HOSTS.some((prefix) => host.startsWith(prefix) || host.includes(`.${prefix}`));

export function deriveLeadSource(attribution: AttributionPayload): LeadSource {
  const source = attribution.utm_source?.toLowerCase() ?? null;
  const medium = attribution.utm_medium?.toLowerCase() ?? null;

  if (attribution.gclid || (medium && PAID_MEDIUMS.has(medium))) return "Paid Ads";
  if (medium === "email") return "Email Campaign";
  if (source && SOCIAL_SOURCES.has(source)) return "Social Media";
  if (source === "partner" || medium === "partnership") return "Partner";

  const host = referrerHost(attribution.referrer);
  if (medium === "referral") return "Referral";
  if (host && !host.endsWith("growqr.ai")) {
    return isSearchEngine(host) ? "Organic Search" : "Referral";
  }
  return "Website";
}

// ── Enterprise modal: solution / agent → Audience + Product_Interest ────────

const SOLUTION_AUDIENCES: Record<string, Audience> = {
  "GrowQR Enterprise": "Enterprise",
  Enterprises: "Enterprise",
  Startups: "Enterprise",
  Recruiters: "Recruiter",
  Institutes: "Institute",
};

/**
 * B2B enquiry attribution: a hidden `agent` (RQ-*) or `solution` label. Every
 * enterprise agent enquiry is an Enterprise lead; the specific agent name goes
 * into the Description for sales context, not into a field.
 */
export function deriveB2bAudience(
  agent: string | null,
  solution: string | null,
): AudienceInterest {
  if (agent) return expandAudience("Enterprise");
  if (solution) return expandAudience(SOLUTION_AUDIENCES[solution] ?? null);
  return NO_AUDIENCE;
}

// ── Seeker waitlist: CTA slug + page → Audience (best-effort, never fabricated) ──

/** Generic CTAs that say nothing about who the visitor is. */
const UNKNOWN_WAITLIST_SLUGS = new Set([
  "navbar",
  "navbar-mobile",
  "homepage-hero",
  "homepage-pricing",
  "roadmaps-cta",
  "final-cta",
  "journey-cta",
]);

/**
 * Persona landing pages → Audience. Read only when the CTA slug itself is
 * generic: the navbar and hero buttons are global, so someone reading
 * /solutions/coaches who clicks "Book a Call" in the navbar arrives as
 * `navbar` and would otherwise lose an audience the page states outright.
 * Matched on the path prefix so nested and trailing-slash routes still hit.
 */
const WAITLIST_PAGE_AUDIENCE: ReadonlyArray<[string, Audience]> = [
  ["/solutions/students", "Student"],
  ["/solutions/professionals", "Professional"],
  ["/solutions/coaches", "Coach"],
  ["/solutions/freelancers", "Freelancer"],
];

/** The page's own persona, or null when the page says nothing. */
function audienceFromPagePath(pagePath: string | null): Audience | null {
  if (!pagePath) return null;
  const path = pagePath.split("?")[0].replace(/\/+$/, "").toLowerCase() || "/";
  const match = WAITLIST_PAGE_AUDIENCE.find(
    ([prefix]) => path === prefix || path.startsWith(`${prefix}/`),
  );
  if (match) return match[1];
  // Individual-agent pages carry the same weak Professional signal the
  // `agent-*`/`vera-*` CTA slugs already do (blueprint §6.5).
  if (path.startsWith("/agents/") || path.startsWith("/ai-")) return "Professional";
  return null;
}

/**
 * Resolve who a waitlist signup is, from the CTA they clicked and — when that
 * CTA is generic — the page they were reading. An unrecognised signal stays
 * null: an empty Audience is honest, a guessed one is not.
 */
export function deriveWaitlistAudience(
  sourceSlug: string | null,
  pagePath: string | null = null,
): AudienceInterest {
  if (!sourceSlug || UNKNOWN_WAITLIST_SLUGS.has(sourceSlug)) {
    // Generic CTA: the page is the only signal left, and usually a better one.
    return expandAudience(audienceFromPagePath(pagePath));
  }
  if (sourceSlug.startsWith("students")) return expandAudience("Student");
  if (sourceSlug.startsWith("coaches")) return expandAudience("Coach");
  if (sourceSlug.startsWith("freelancers")) return expandAudience("Freelancer");
  // Everything else is Professional: the explicit professionals/consultants
  // CTAs, and the individual-agent CTAs (`${agent}-hero`, `agent-*`, `vera-*`)
  // where someone exploring a personal AI agent is a weak Professional signal
  // (blueprint §6.5) — still better than nothing for routing.
  return expandAudience("Professional");
}

// ── Contact form: email-domain heuristic (no company field on that form) ────

const CONSUMER_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  "yahoo.com",
  "ymail.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "mail.com",
  "gmx.com",
  "zoho.com",
  "rediffmail.com",
  "yandex.com",
]);

/**
 * A consumer address resolves to NO company at all (null), not a placeholder.
 *
 * This is load-bearing for lead conversion, not cosmetics. Zoho builds
 * Account_Name from the Lead's Company, and Accounts.Account_Name is not
 * unique — so the old `company: "Individual"` convention meant converting any
 * two consumers either merged them into one shared "Individual" Account or
 * created duplicates by that name. An empty Company is the documented Zoho
 * signal for "create a Contact and no Account", which is exactly the B2C
 * policy: Lead → Contact only.
 *
 * For a business domain the bare domain still stands in for the company until
 * sales verifies on first touch.
 */
export function emailDomainHeuristic(email: string): {
  segment: Segment;
  company: string | null;
} {
  const domain = email.trim().toLowerCase().split("@").pop() ?? "";
  if (!domain || CONSUMER_EMAIL_DOMAINS.has(domain)) {
    return { segment: "B2C", company: null };
  }
  return { segment: "B2B", company: domain };
}

// ── Team size → No_of_Employees ─────────────────────────────────────────────

/**
 * The enterprise modal's exact option strings (en-dashes included) → an
 * integer for Zoho's No_of_Employees. Upper bound of each band; 1001 marks
 * the open-ended band. Unknown strings map to null rather than a guess.
 */
const TEAM_SIZE_EMPLOYEES: Record<string, number> = {
  "1–50": 50,
  "51–200": 200,
  "201–1,000": 1000,
  "1,000+": 1001,
};

export function teamSizeToEmployees(teamSize: string | null): number | null {
  return teamSize ? (TEAM_SIZE_EMPLOYEES[teamSize] ?? null) : null;
}

// ── Drift-check contract ────────────────────────────────────────────────────

/**
 * Everything the payload builders can ever send, for the drift check
 * (scripts/crm-drift-check.ts) to verify against live getFields output.
 * If a value leaves this file, it must leave here too — the check compares
 * these, not the functions.
 */
export const CRM_FIELD_EXPECTATIONS = {
  /** Picklist fields → every display value we can emit. */
  picklists: {
    Lead_Status: ["New"],
    Lead_Source: [
      "Website",
      "Referral",
      "Organic Search",
      "Social Media",
      "Email Campaign",
      "Paid Ads",
      "Partner",
    ],
    Segment: ["B2B", "B2C"],
    Region: ["India", "USA", "UAE", "Singapore", "Other"],
    Audience: [
      "Student",
      "Professional",
      "Coach",
      "Freelancer",
      "Recruiter",
      "Institute",
      "Enterprise",
    ],
    Business_Unit: ["Individual", "Talent", "EdTech", "Enterprise"],
    Product_Interest: ["Q-Ryze", "Q-Kalyber", "Q-Kampus", "Q-Skale"],
    Country: Object.values(COUNTRY_DISPLAY_NAMES),
  } as Record<string, readonly string[]>,
  /** Non-picklist fields the payload writes — must exist on the module. */
  requiredFields: [
    "First_Name",
    "Last_Name",
    "Email",
    "Company",
    "No_of_Employees",
    "Description",
    "UTM_Source",
    "UTM_Medium",
    "UTM_Campaign",
    "UTM_Term",
    "UTM_Content",
    "Google_Click_ID",
    "Landing_Page_URL",
  ] as readonly string[],
} as const;
