import type { Tables } from "@/types/database";
import type { AttributionPayload } from "@/lib/forms/schemas";
import { solutionFromPath } from "@/lib/bot/clientContext";
import { BOT_INTENT_LABELS, type BotIntent } from "@/lib/bot/intents";
import { eventTypeLabel, isB2bSource } from "@/lib/cal";
import {
  AUDIENCE_MAP,
  countryDisplayName,
  deriveB2bAudience,
  deriveLeadSource,
  deriveWaitlistAudience,
  emailDomainHeuristic,
  expandAudience,
  regionForCountryCode,
  splitName,
  teamSizeToEmployees,
  type Audience,
  type BusinessUnit,
  type LeadSource,
  type ProductInterest,
  type Region,
  type Segment,
} from "@/lib/crm/derive";

/**
 * the database row → Zoho Lead record, one builder per source. Field API names
 * and picklist display values verified against the live org (see derive.ts).
 *
 * Absent values are OMITTED rather than sent as null: on the upsert's update
 * path a null would blank the existing Zoho value, while an omitted field
 * leaves it untouched — repeat submissions must only ever add information.
 * A builder returning null means "this row is excluded by rule" and the sync
 * engine marks it 'skipped'.
 *
 * ONE deliberate, narrow exception to "omit, never blank": a bot lead escalating
 * into a B2B-qualifying intent with no resolvable Audience explicitly sends
 * `null` for Audience/Business_Unit/Product_Interest instead of omitting them —
 * see buildBotLeadPayload for why.
 */

export interface ZohoLeadRecord {
  Last_Name: string;
  First_Name?: string;
  Email: string;
  /**
   * Omitted entirely for B2C — see the guard in compact(). Optional because an
   * absent Company is what tells Zoho's lead conversion to create a Contact
   * with no Account.
   */
  Company?: string;
  Lead_Status: "New";
  Lead_Source: LeadSource;
  Region: Region;
  Segment?: Segment;
  Audience?: Audience | null;
  Business_Unit?: BusinessUnit | null;
  Product_Interest?: ProductInterest | null;
  Country?: string;
  No_of_Employees?: number;
  Description?: string;
  UTM_Source?: string;
  UTM_Medium?: string;
  UTM_Campaign?: string;
  UTM_Term?: string;
  UTM_Content?: string;
  Google_Click_ID?: string;
  Landing_Page_URL?: string;
}

/** Landing_Page_URL is a Zoho `website` field — it validates URL shape. */
const SITE_ORIGIN = "https://growqr.ai";

/** The attribution columns shared by all lead tables (written in Phase 3). */
type AttributedRow = Pick<
  Tables<"seeker_waitlist">,
  | "country_code"
  | "utm_source"
  | "utm_medium"
  | "utm_campaign"
  | "utm_term"
  | "utm_content"
  | "gclid"
  | "landing_page"
  | "referrer"
  | "page_path"
>;

const rowAttribution = (row: AttributedRow): AttributionPayload => ({
  utm_source: row.utm_source,
  utm_medium: row.utm_medium,
  utm_campaign: row.utm_campaign,
  utm_term: row.utm_term,
  utm_content: row.utm_content,
  gclid: row.gclid,
  landing_page: row.landing_page,
  referrer: row.referrer,
  page_path: row.page_path,
});

/** Geo + attribution block common to every builder. */
type CommonFields = Pick<
  ZohoLeadRecord,
  | "Lead_Status"
  | "Lead_Source"
  | "Region"
  | "Country"
  | "UTM_Source"
  | "UTM_Medium"
  | "UTM_Campaign"
  | "UTM_Term"
  | "UTM_Content"
  | "Google_Click_ID"
  | "Landing_Page_URL"
>;

function commonFields(row: AttributedRow): CommonFields {
  const attribution = rowAttribution(row);
  const landingPage = row.landing_page
    ? row.landing_page.startsWith("/")
      ? `${SITE_ORIGIN}${row.landing_page}`
      : row.landing_page
    : undefined;

  return {
    Lead_Status: "New",
    Lead_Source: deriveLeadSource(attribution),
    Region: regionForCountryCode(row.country_code),
    Country: countryDisplayName(row.country_code) ?? undefined,
    UTM_Source: row.utm_source ?? undefined,
    UTM_Medium: row.utm_medium ?? undefined,
    UTM_Campaign: row.utm_campaign ?? undefined,
    UTM_Term: row.utm_term ?? undefined,
    UTM_Content: row.utm_content ?? undefined,
    Google_Click_ID: row.gclid ?? undefined,
    Landing_Page_URL: landingPage,
  };
}

/**
 * Strip omitted (undefined) fields so they never reach the wire as nulls, and
 * enforce the one invariant every builder must honour: a B2C Lead carries NO
 * Company.
 *
 * The Company strip is the single choke point that makes the conversion policy
 * enforceable — B2B converts to Contact + Account + optional Deal, B2C converts
 * to a Contact only. Zoho decides whether to create an Account purely from
 * whether Company has a value, so withholding it here means no builder, now or
 * later, can produce a B2C Lead that would spawn an Account or a Deal. The
 * builders also omit it at source; this is the backstop, in the same
 * defense-in-depth spirit as buildContactSalesPayload's type check.
 *
 * Note the deliberate `=== "B2C"` rather than `!== "B2B"`: buildCallBookingPayload
 * omits Segment entirely when a consumer-surface booking carries a business
 * email, and that case must keep its Company (the email domain).
 */
function compact(record: ZohoLeadRecord): ZohoLeadRecord {
  const guarded: ZohoLeadRecord =
    record.Segment === "B2C" ? { ...record, Company: undefined } : record;

  return Object.fromEntries(
    Object.entries(guarded).filter(([, value]) => value !== undefined),
  ) as ZohoLeadRecord;
}

// ── Enterprise contact modal → B2B Lead ─────────────────────────────────────

export function buildB2bLeadPayload(row: Tables<"b2b_leads">): ZohoLeadRecord | null {
  const { firstName, lastName } = splitName(row.name);
  const { audience, businessUnit, productInterest } = deriveB2bAudience(row.agent, row.solution);

  const context = [
    `Submitted via enterprise contact form on ${row.page_path ?? "unknown page"}`,
    row.agent ? `agent: ${row.agent}` : null,
    row.solution ? `solution: ${row.solution}` : null,
    row.team_size ? `team size: ${row.team_size}` : null,
  ]
    .filter(Boolean)
    .join(" | ");

  return compact({
    ...commonFields(row),
    Last_Name: lastName,
    First_Name: firstName ?? undefined,
    Email: row.email,
    Company: row.company,
    Segment: "B2B",
    Audience: audience ?? undefined,
    Business_Unit: businessUnit ?? undefined,
    Product_Interest: productInterest ?? undefined,
    No_of_Employees: teamSizeToEmployees(row.team_size) ?? undefined,
    Description: row.message ? `— ${context} —\n\n${row.message}` : `— ${context} —`,
  });
}

// ── Contact form (type=sales only) → Lead ───────────────────────────────────

export function buildContactSalesPayload(row: Tables<"contact_messages">): ZohoLeadRecord | null {
  // Defense in depth: general enquiries are already 'skipped' at insert time
  // (locked decision A1); a requeued or hand-edited row must not slip through.
  if (row.type !== "sales") return null;

  const { firstName, lastName } = splitName(row.name);
  // No company field on this form — the email-domain heuristic stands in. A
  // consumer address yields no company at all, which keeps the Lead B2C-only.
  const { segment, company } = emailDomainHeuristic(row.email);

  const context = [
    `Submitted via contact form (sales) on ${row.page_path ?? "unknown page"}`,
    row.subject ? `subject: ${row.subject}` : null,
  ]
    .filter(Boolean)
    .join(" | ");

  return compact({
    ...commonFields(row),
    Last_Name: lastName,
    First_Name: firstName ?? undefined,
    Email: row.email,
    Company: company ?? undefined,
    Segment: segment,
    Description: `— ${context} —\n\n${row.message}`,
  });
}

// ── Seeker waitlist → B2C Lead ──────────────────────────────────────────────

export function buildSeekerWaitlistPayload(row: Tables<"seeker_waitlist">): ZohoLeadRecord | null {
  // page_path is the fallback signal: the navbar and hero CTAs are global, so
  // a persona landing page is often the only thing that says who this is.
  const { audience, businessUnit, productInterest } = deriveWaitlistAudience(
    row.source,
    row.page_path,
  );
  // Email-only form: the local part is an honest Last_Name placeholder —
  // sales can see at a glance the Lead is email-only (blueprint §6.3).
  const localPart = row.email.split("@")[0] || row.email;

  const context = [
    row.source ? `Joined seeker waitlist via '${row.source}' CTA` : "Joined seeker waitlist",
    row.page_path ? `on ${row.page_path}` : null,
  ]
    .filter(Boolean)
    .join(" ");

  return compact({
    ...commonFields(row),
    Last_Name: localPart,
    Email: row.email,
    // No Company: this source is B2C by definition, so the Lead must convert
    // to a Contact with no Account.
    Segment: "B2C",
    Audience: audience ?? undefined,
    Business_Unit: businessUnit ?? undefined,
    Product_Interest: productInterest ?? undefined,
    Description: `— ${context} —`,
  });
}

// ── SalesIQ bot qualification → B2B Lead ────────────────────────────────────

/** Bot intent → Audience. demo_request carries no fixed audience — the visitor's role isn't known from intent alone. */
const BOT_INTENT_AUDIENCE: Partial<Record<string, Audience>> = {
  recruiter_inquiry: "Recruiter",
  university_inquiry: "Institute",
  enterprise_inquiry: "Enterprise",
};

/**
 * Narrowing guard for the audience string solutionFromPath() returns. Those
 * values are authored to match the Audience union exactly, but they're typed
 * as plain strings, and a blind cast would let a future slug rename ship a
 * bad picklist value straight to Zoho.
 */
function asAudience(value: string | null): Audience | null {
  return value && value in AUDIENCE_MAP ? (value as Audience) : null;
}

/** Consumer audiences. Anything else that reaches CRM is a business lead. */
const B2C_AUDIENCES: ReadonlySet<Audience> = new Set<Audience>(["Student", "Professional"]);

/**
 * Audience for a bot lead: explicit intent first, page path second.
 *
 * Intent wins because "I'm a recruiter" is a stronger signal than whichever
 * page they happened to be standing on. The page is the fallback for the case
 * that broke in production: `demo_request` — what EVERY "Book a Demo" click
 * produces — has no entry in BOT_INTENT_AUDIENCE, so audience/business unit/
 * product interest all resolved null and were omitted by compact(). On a
 * repeat visit that meant the Lead silently kept its first visit's values: a
 * /solutions/recruiters demo request stayed filed as Institute/EdTech/
 * Q-Kampus from an earlier /solutions/institutes visit.
 *
 * Deliberately reuses solutionFromPath() — the same pathname → audience map
 * the website already sends to SalesIQ — rather than introducing a second
 * mapping table that could drift from it.
 */
function botLeadAudience(row: Tables<"bot_leads">): Audience | null {
  const fromIntent = BOT_INTENT_AUDIENCE[row.intent];
  if (fromIntent) return fromIntent;
  const page = row.last_page_path ?? row.page_path;
  // Homepage default (2026-08-03, confirmed): solutionFromPath("/") resolves
  // nothing, so a homepage chat's Audience/Business_Unit/Product_Interest
  // used to come through null/omitted (bot_leads#18 — "alex 1"). Homepage
  // organic chats default to Professional, which AUDIENCE_MAP already expands
  // to Business_Unit=Individual, Product_Interest=Q-Ryze. Scoped to the exact
  // homepage path only, not every unmapped page (e.g. /about stays null) —
  // narrower pages have no reliable "this is a consumer" signal the way the
  // homepage does. A B2B-qualifying intent still discards this back to null
  // below (isB2bQualifying), same as any other B2C page audience.
  if (page === "/") return "Professional";
  return page ? asAudience(solutionFromPath(page).audience) : null;
}

/**
 * Audience for a business-qualified action, with the consumer-page contradiction
 * removed.
 *
 * Extracted from buildBotLeadPayload so the booking builder cannot re-introduce
 * the defect that file documents at length (bot_leads#17): an action that proves
 * a business intent, taken from a B2C solution page, used to resolve a real but
 * WRONG consumer audience and drag Segment down with it. A second copy of that
 * rule is precisely how the original bug ended up two layers deep, so there is
 * now exactly one.
 *
 * Returns null for "no audience" and expects the caller to send an explicit
 * null (blank it) rather than omitting the field, so a stale value from an
 * earlier consumer visit cannot survive the correction.
 */
export function b2bSafeAudience(pagePath: string | null): Audience | null {
  const resolved = pagePath ? asAudience(solutionFromPath(pagePath).audience) : null;
  if (!resolved) return null;
  return B2C_AUDIENCES.has(resolved) ? null : resolved;
}

/**
 * A row with no email is a conversation that never finished qualifying —
 * excluded by rule, same convention as the other builders' null return.
 */
export function buildBotLeadPayload(row: Tables<"bot_leads">): ZohoLeadRecord | null {
  if (!row.email) return null;

  const { firstName, lastName } = splitName(row.name ?? row.email.split("@")[0] ?? row.email);
  const rawResolved = expandAudience(botLeadAudience(row));
  const { segment: emailSegment, company: fallbackCompany } = emailDomainHeuristic(row.email);

  /**
   * Any intent other than general_inquiry means the visitor completed (or is
   * escalating into) the company/team-size qualification form — explicit,
   * unambiguous evidence of a business inquiry. demo_request is audience-
   * agnostic by design (see botLeadAudience), so it falls back to the page the
   * visitor happened to be chatting from. That page can itself be a B2C
   * solution page (e.g. /solutions/professionals), which resolves a real,
   * valid B2C audience — one that flatly CONTRADICTS the qualification form
   * they just completed, not merely omits information.
   *
   * Reproduced live (bot_leads#17): visitor on /solutions/professionals typed
   * "demo" -> "instittute demo" as their use_case, answered a work email,
   * company "geow", team size 51-200. Page-derived audience resolved
   * "Professional" — a real value, so compact() sent it as-is — and Segment
   * followed it to "B2C". A business demo request, fully qualified with
   * company + team size, was filed and displayed as an individual consumer
   * lead. A second, narrower defect: when the page instead gives NOTHING
   * (e.g. chatting from the homepage), the unresolved audience used to be
   * OMITTED, letting a stale value from an unrelated earlier visit survive
   * the escalation.
   *
   * Fix: a B2C-shaped page audience (Student/Professional) is discarded
   * (treated the same as "unresolved") whenever the intent is B2B-qualifying,
   * and an unresolved audience is BLANKED (explicit null) rather than
   * omitted, so neither a wrong page-derived value nor a stale prior one can
   * survive a business qualification. Segment is forced B2B outright for
   * these intents — completing the form is stronger evidence than any page.
   * general_inquiry is untouched: it has no qualification form behind it, so
   * a B2C audience there is a real answer, not a contradiction.
   */
  const isB2bQualifying = row.intent !== "general_inquiry";
  const resolved =
    isB2bQualifying && rawResolved.audience && B2C_AUDIENCES.has(rawResolved.audience)
      ? { audience: null, businessUnit: null, productInterest: null }
      : rawResolved;

  const segment: Segment = isB2bQualifying
    ? "B2B"
    : resolved.audience
      ? (B2C_AUDIENCES.has(resolved.audience) ? "B2C" : "B2B")
      : emailSegment;

  const audience = resolved.audience ?? (isB2bQualifying ? null : undefined);
  const businessUnit = resolved.businessUnit ?? (isB2bQualifying ? null : undefined);
  const productInterest = resolved.productInterest ?? (isB2bQualifying ? null : undefined);

  // No landing_page/referrer/gclid columns on this table (bot conversations
  // don't carry them) — deriveLeadSource degrades gracefully on the missing
  // fields and still resolves a sane Lead_Source (Website, by default).
  const attribution: AttributionPayload = {
    utm_source: row.utm_source,
    utm_medium: row.utm_medium,
    utm_campaign: row.utm_campaign,
    utm_term: null,
    utm_content: null,
    gclid: null,
    landing_page: row.page_path,
    referrer: null,
    page_path: row.page_path,
  };

  const landingPage = row.page_path
    ? row.page_path.startsWith("/")
      ? `${SITE_ORIGIN}${row.page_path}`
      : row.page_path
    : undefined;

  // BOT_INTENT_LABELS reads better in the Description than the raw intent
  // value — this is a label swap on existing text, not a new CRM field or an
  // inferred value (the underlying intent is unchanged; see
  // feedback_crm_no_inferred_values).
  const intentLabel = BOT_INTENT_LABELS[row.intent as BotIntent] ?? row.intent;
  const context = [
    `Qualified via SalesIQ bot (${intentLabel})`,
    row.page_path ? `on ${row.page_path}` : null,
    row.designation ? `designation: ${row.designation}` : null,
    row.team_size ? `team size: ${row.team_size}` : null,
  ]
    .filter(Boolean)
    .join(" | ");

  return compact({
    Lead_Status: "New",
    Lead_Source: deriveLeadSource(attribution),
    Region: regionForCountryCode(row.country_code),
    Country: countryDisplayName(row.country_code) ?? undefined,
    UTM_Source: row.utm_source ?? undefined,
    UTM_Medium: row.utm_medium ?? undefined,
    UTM_Campaign: row.utm_campaign ?? undefined,
    Landing_Page_URL: landingPage,
    Last_Name: lastName,
    First_Name: firstName ?? undefined,
    Email: row.email,
    Company: row.company || fallbackCompany || undefined,
    Segment: segment,
    Audience: audience,
    Business_Unit: businessUnit,
    Product_Interest: productInterest,
    No_of_Employees: teamSizeToEmployees(row.team_size) ?? undefined,
    Description: row.use_case ? `— ${context} —\n\n${row.use_case}` : `— ${context} —`,
  });
}

// ── Cal.com booking → Lead ──────────────────────────────────────────────────

/**
 * Booking → Zoho Lead.
 *
 * Two exclusions, both using the established "builder returns null ⇒ the engine
 * marks the row 'skipped'" convention:
 *
 *   1. Disposable addresses. The booking, the calendar slot and the team
 *      notification are all still real — only the CRM record is withheld, so a
 *      throwaway address can't pollute the pipeline. See lib/cal/disposable.ts
 *      for why this is a flag and never a block.
 *   2. Cancellations that never reached Zoho. Syncing a Lead whose only event
 *      is "cancelled" would create a record for a call that will not happen.
 *      A cancellation of an ALREADY-synced booking is different and does sync —
 *      that one updates a Lead sales is already looking at.
 *
 * An unregistered Cal event type does NOT exclude the row. That was the
 * original plan (§13.8), and it was wrong: it would mean a single stale id in
 * CAL_EVENT_TYPES silently withholding every real lead from the CRM. A booking
 * from an unknown event type is still a person asking for a call, so it syncs
 * with a generic label and the gap shows up in the logs instead.
 */
export function buildCallBookingPayload(row: Tables<"call_bookings">): ZohoLeadRecord | null {
  if (row.is_disposable_email) return null;
  if (row.status === "cancelled" && !row.zoho_lead_id && !row.zoho_contact_id) return null;

  const { firstName, lastName } = splitName(row.attendee_name);
  const { segment: emailSegment, company: fallbackCompany } = emailDomainHeuristic(row.email);
  const isB2b = isB2bSource(row.source);

  /**
   * Segment, and the asymmetry that makes "seeker in January, enterprise rep in
   * July" resolve correctly.
   *
   * Because every source upserts on Email, a later booking lands on the SAME
   * Zoho Lead as an earlier one. A B2B booking may therefore correct a Lead
   * upward — it is direct evidence of a business enquiry. A B2C booking must
   * never do the reverse: sending Segment="B2C" from the seeker modal would
   * silently downgrade a genuine enterprise Lead the moment that person clicked
   * a consumer CTA. So the consumer path sends a Segment only when the email
   * itself also looks like a consumer address, and otherwise omits the field
   * entirely, leaving whatever is already on the record untouched.
   */
  const segment: Segment | undefined = isB2b
    ? "B2B"
    : emailSegment === "B2C"
      ? "B2C"
      : undefined;

  // Audience is page-derived. On a B2B surface a consumer-shaped audience is a
  // contradiction and is BLANKED (explicit null, not omitted) so a stale value
  // cannot survive; on a consumer surface it is a real answer and is kept.
  const resolved = isB2b
    ? expandAudience(b2bSafeAudience(row.page_path))
    : expandAudience(row.page_path ? asAudience(solutionFromPath(row.page_path).audience) : null);

  const blankWhenMissing = isB2b ? null : undefined;
  const label = eventTypeLabel(row.cal_event_type_id);
  const startIst = new Date(row.start_time).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  });

  const context = [
    `Booked a ${label} via Cal.com`,
    row.source ? `source: ${row.source}` : null,
    row.page_path ? `on ${row.page_path}` : null,
    `scheduled: ${startIst} IST`,
    row.status !== "booked" ? `status: ${row.status}` : null,
    row.team_size ? `team size: ${row.team_size}` : null,
  ]
    .filter(Boolean)
    .join(" | ");

  return compact({
    ...commonFields(row),
    Last_Name: lastName,
    First_Name: firstName ?? undefined,
    Email: row.email,
    // Company is required by the Leads Standard LAYOUT, not by Zoho itself
    // (system_mandatory is false) — so it can legitimately be absent once that
    // layout flag is cleared. Value order: Cal's Company answer when D3's
    // booking question is filled in, else the email domain, else nothing at all
    // for a consumer address.
    Company: row.company?.trim() || fallbackCompany || undefined,
    Segment: segment,
    Audience: resolved.audience ?? blankWhenMissing,
    Business_Unit: resolved.businessUnit ?? blankWhenMissing,
    Product_Interest: resolved.productInterest ?? blankWhenMissing,
    No_of_Employees: teamSizeToEmployees(row.team_size) ?? undefined,
    Description: row.meeting_url
      ? `— ${context} —\n\nMeeting link: ${row.meeting_url}`
      : `— ${context} —`,
  });
}
