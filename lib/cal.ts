/**
 * Cal.com booking link + the vocabularies the booking pipeline is keyed on.
 *
 * Cal owns everything about scheduling — availability, slots, timezone
 * conversion, the calendar invite, the meeting link, and the attendee's own
 * confirmation and reminder emails. This repo only listens (see
 * app/api/cal/webhook/route.ts) and never writes to Cal.
 */

export const CAL_ORIGIN = "https://cal.com";
export const CAL_LINK = "growqr/15-min-intro-call"; // path on CAL_ORIGIN
export const CAL_BOOKING_URL = `${CAL_ORIGIN}/${CAL_LINK}`;

// ── Booking sources ─────────────────────────────────────────────────────────

/**
 * Which surface a booking was started from. A CLOSED vocabulary, on purpose:
 * free-text sources turn into unusable analytics within a couple of months,
 * once three people have written "enterprise-page", "Enterprise Page" and
 * "enterprise_cta" for the same button.
 *
 * Enforced three times over — this union (compile time), a zod enum on
 * /api/cal/intent (request time), and a CHECK constraint on booking_intents
 * (write time, migration 0015). Adding a surface means touching all three.
 */
export const BOOKING_SOURCES = [
  "b2b-enterprise-modal", // EnterpriseContactModal, both placements
  "enterprise-hero", // EnterpriseSolutionsPage hero CTA
  "enterprise-final-cta", // EnterpriseSolutionsPage closing CTA
  "brand-intelligence", // BrandIntelligenceSection walkthrough CTA
  "persona-cta", // lib/persona-content.ts secondary CTA
  "seeker-waitlist-modal", // SeekerWaitlistModal — B2C (locked decision D1)
] as const;

export type BookingSource = (typeof BOOKING_SOURCES)[number];

/**
 * The B2C surface. Everything else is a business enquiry.
 *
 * This drives the asymmetry in buildCallBookingPayload: a B2B booking may
 * correct a Lead's classification upward (forcing Segment=B2B and blanking a
 * contradicting consumer Audience), but a B2C booking must never drag an
 * existing B2B Lead back down. See lib/crm/payload.ts for the full reasoning
 * and the production defect (bot_leads#17) that established the rule.
 */
const B2C_SOURCES: ReadonlySet<BookingSource> = new Set<BookingSource>([
  "seeker-waitlist-modal",
]);

/** True only for a known B2B surface — an unknown source is never assumed B2B. */
export const isB2bSource = (source: string | null): boolean =>
  isKnownSource(source) && !B2C_SOURCES.has(source);

/**
 * True only for a surface we KNOW is consumer-facing.
 *
 * Deliberately not the inverse of isB2bSource: a booking whose source is
 * missing (beacon blocked, link shared) is unknown, not consumer. Notification
 * routing uses this one so an unattributed booking still reaches the business
 * team — missing a real B2B call because attribution failed is far worse than
 * one extra CC on a consumer booking.
 */
export const isB2cSource = (source: string | null): boolean =>
  isKnownSource(source) && B2C_SOURCES.has(source);

export const isKnownSource = (value: string | null): value is BookingSource =>
  BOOKING_SOURCES.includes(value as BookingSource);

// ── Event types ─────────────────────────────────────────────────────────────

export interface CalEventType {
  slug: string;
  /** Human label used in notification subjects and the CRM Description. */
  label: string;
  durationMins: number;
}

/**
 * Registry keyed on Cal's numeric event type id (the number in the dashboard
 * URL: app.cal.com/event-types/<id>).
 *
 * The pipeline is deliberately generic rather than hardwired to the 15-minute
 * call. Nothing downstream — the ledger, the idempotency key, the ordering
 * guard, the attribution join, the CRM path — inspects the event type at all;
 * only human-readable copy does. So supporting a future 30-minute call, a
 * founder call or a partnership call costs one entry here plus one webhook in
 * that event type's own Cal dashboard tab (webhooks are per-event-type),
 * instead of a migration to backfill event context onto existing rows and a
 * hunt for every hardcoded "15-minute" string.
 */
export const CAL_EVENT_TYPES: Readonly<Record<number, CalEventType>> = {
  6292341: {
    slug: "15-min-intro-call",
    label: "15-minute intro call",
    durationMins: 15,
  },
};

/**
 * An unregistered event type is NEVER dropped: the booking is still recorded
 * and the team is still notified (with Cal's own title), and only the CRM sync
 * is skipped. A new event type someone creates in the dashboard therefore
 * shows up as a visible gap rather than as silent data loss.
 */
export function calEventType(id: number | null | undefined): CalEventType | null {
  return id != null ? (CAL_EVENT_TYPES[id] ?? null) : null;
}

export const eventTypeLabel = (id: number | null | undefined): string =>
  calEventType(id)?.label ?? "call";

// ── Booking URL ─────────────────────────────────────────────────────────────

/**
 * GrowQR people who join every B2B call alongside the host.
 *
 * Sahil owns the Cal event type, so he is the HOST and is on the invite by
 * definition — he must never appear here, or Cal would list him twice.
 * Everyone in this list is added as a prefilled GUEST, which is what puts them
 * on the calendar invite and gives them the Meet link directly.
 *
 * Why prefill rather than co-hosts: cal.com/growqr/... is a personal event
 * type, and a personal event type has exactly one host — real co-hosts need a
 * Cal Teams plan and a team event type. That path also carries a cost nobody
 * expects, which is that collective scheduling intersects everyone's
 * calendars, so bookable slots shrink to when all three are free. On an
 * inbound intro call that quietly costs more bookings than the extra attendee
 * is worth.
 *
 * The trade-off accepted here: a prefilled guest is a DEFAULT, not an
 * enforcement — it is visible on the booking form and the booker can delete
 * it. Enforcement is only available via the Teams path above.
 */
export const B2B_CALL_GUESTS = ["pranav@growqr.ai", "kanika@growqr.ai"] as const;

/**
 * GrowQR people who join every B2C call alongside the host.
 *
 * Ruchi runs the consumer conversations, the same way Kanika runs the business
 * ones — so the split here mirrors the split the whole booking pipeline is
 * already keyed on (isB2bSource / isB2cSource), rather than introducing a
 * second, separate notion of who owns a call.
 *
 * Kept deliberately shorter than B2B_CALL_GUESTS. A student booking a call has
 * no reason to see a wall of internal addresses on the booking form, and the
 * B2B list carries a second name only because a business call has a second
 * internal stakeholder. Everything in the B2B note above applies equally here:
 * these are prefilled GUESTS on a personal event type, so they are a default
 * the booker can still delete, not an enforcement.
 */
export const B2C_CALL_GUESTS = ["ruchi@growqr.ai"] as const;

/**
 * The link a CalButton points at.
 *
 * `source` and `intent` are HIDDEN booking questions on the Cal event type —
 * Cal prefills a question from a query parameter matching its identifier, and
 * echoes the answer back in the webhook's `responses`. That round trip is the
 * only way page context and first-touch attribution survive the hop to an
 * off-site booking page (see lib/cal/intent.ts and migration 0015).
 */
export function buildCalBookingUrl(params: {
  source: BookingSource;
  intentId?: string | null;
}): string {
  const url = new URL(CAL_BOOKING_URL);
  url.searchParams.set("source", params.source);
  if (params.intentId) url.searchParams.set("intent", params.intentId);
  // Repeated `guests` params, not one comma-joined value — that is the shape
  // Cal's prefill expects for more than one address.
  // isB2bSource and isB2cSource are both strict — an UNKNOWN source (beacon
  // blocked, link shared out of context) matches neither and gets no guests,
  // which is the existing behaviour and stays deliberate: guessing wrong here
  // puts the wrong colleague on a customer's calendar invite.
  if (isB2bSource(params.source)) {
    for (const guest of B2B_CALL_GUESTS) url.searchParams.append("guests", guest);
  } else if (isB2cSource(params.source)) {
    for (const guest of B2C_CALL_GUESTS) url.searchParams.append("guests", guest);
  }
  return url.toString();
}
