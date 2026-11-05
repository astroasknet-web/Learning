import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Tables } from "@/types/database";

const searchContactByEmail = vi.fn();
const upsertLead = vi.fn();

vi.mock("@/lib/crm/zoho-client", () => ({
  searchContactByEmail: (...args: unknown[]) => searchContactByEmail(...args),
  upsertLead: (...args: unknown[]) => upsertLead(...args),
  createLeadTask: vi.fn(),
  createLeadNote: vi.fn(),
  createContactTask: vi.fn(),
  createContactNote: vi.fn(),
  updateTask: vi.fn(),
}));

vi.mock("@/lib/data/server", () => ({ createAdminClient: vi.fn() }));

const { resolveBookingPerson } = await import("@/lib/crm/call-booking");
const { buildCallBookingPayload } = await import("@/lib/crm/payload");

const booking = (overrides: Partial<Tables<"call_bookings">> = {}): Tables<"call_bookings"> =>
  ({
    id: "b1",
    created_at: "2026-08-04T10:00:00Z",
    updated_at: "2026-08-04T10:00:00Z",
    cal_uid: "abc123",
    cal_booking_id: 1,
    cal_event_type_id: 6292341,
    rescheduled_from_uid: null,
    last_event_at: "2026-08-04T10:00:00Z",
    last_trigger_event: "BOOKING_CREATED",
    email: "jane@acme.com",
    attendee_name: "Jane Sharma",
    attendee_timezone: "Asia/Kolkata",
    company: "Acme Ltd",
    team_size: "51–200",
    title: "15 Min Intro Call",
    start_time: "2026-08-10T09:00:00Z",
    end_time: "2026-08-10T09:15:00Z",
    meeting_url: "https://app.cal.com/video/abc123",
    status: "booked",
    booked_at: "2026-08-04T10:00:00Z",
    rescheduled_at: null,
    cancelled_at: null,
    cancellation_reason: null,
    is_disposable_email: false,
    responses: null,
    raw_payload: null,
    intent_id: null,
    source: "b2b-enterprise-modal",
    country_code: "IN",
    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
    utm_term: null,
    utm_content: null,
    gclid: null,
    landing_page: null,
    referrer: null,
    page_path: "/solutions/recruiters",
    zoho_lead_id: null,
    zoho_contact_id: null,
    crm_record_type: null,
    crm_sync_status: "pending",
    crm_synced_at: null,
    crm_sync_error: null,
    crm_sync_attempts: 0,
    events_count: 1,
    zoho_task_id: null,
    zoho_task_created: false,
    zoho_notes_count: 0,
    notifications_count: 0,
    zoho_notes_pending: true,
    notifications_pending: true,
    ...overrides,
  }) as Tables<"call_bookings">;

beforeEach(() => {
  searchContactByEmail.mockReset();
  upsertLead.mockReset();
});

describe("resolveBookingPerson", () => {
  it("attaches to an existing Contact and never creates a Lead", async () => {
    searchContactByEmail.mockResolvedValue("contact-1");

    const result = await resolveBookingPerson({ Email: "jane@acme.com" } as never);

    expect(result).toEqual({ type: "contact", id: "contact-1", action: "update" });
    // The whole point of D4: an existing customer must not reappear as a Lead.
    expect(upsertLead).not.toHaveBeenCalled();
  });

  it("upserts a Lead when no Contact exists", async () => {
    searchContactByEmail.mockResolvedValue(null);
    upsertLead.mockResolvedValue({ id: "lead-1", action: "insert" });

    const result = await resolveBookingPerson({ Email: "new@acme.com" } as never);

    expect(result).toEqual({ type: "lead", id: "lead-1", action: "insert" });
  });

  it("propagates a Contact-search failure instead of creating a Lead", async () => {
    // THE failure that matters. Swallowing this and falling through to
    // upsertLead would manufacture the duplicate the search exists to prevent;
    // throwing requeues the row for the cron instead.
    searchContactByEmail.mockRejectedValue(new Error("429 rate limited"));

    await expect(resolveBookingPerson({ Email: "jane@acme.com" } as never)).rejects.toThrow(
      "429",
    );
    expect(upsertLead).not.toHaveBeenCalled();
  });
});

describe("buildCallBookingPayload", () => {
  it("maps a B2B booking with company and team size", () => {
    const payload = buildCallBookingPayload(booking());

    expect(payload).toMatchObject({
      Email: "jane@acme.com",
      First_Name: "Jane",
      Last_Name: "Sharma",
      Company: "Acme Ltd",
      Segment: "B2B",
      Audience: "Recruiter",
      Business_Unit: "Talent",
      Product_Interest: "Q-Kalyber",
      No_of_Employees: 200,
      Lead_Source: "Website",
      Region: "India",
      Country: "India",
    });
    expect(payload?.Description).toContain("Booked a 15-minute intro call via Cal.com");
    expect(payload?.Description).toContain("https://app.cal.com/video/abc123");
  });

  it("falls back to the email-domain company when Cal collected none", () => {
    const payload = buildCallBookingPayload(booking({ company: null }));
    expect(payload?.Company).toBe("acme.com");
  });

  it("sends no Company for a consumer address with no company", () => {
    // Nothing truthful to send: Cal collected no company and a consumer domain
    // yields none either. Previously this shipped the placeholder "Individual",
    // which would have converted into a shared Account.
    const payload = buildCallBookingPayload(
      booking({ company: null, email: "jane@gmail.com" }),
    );
    expect(payload).not.toHaveProperty("Company");
  });

  it("sends no Company for a B2C booking off a consumer surface", () => {
    const payload = buildCallBookingPayload(
      booking({ company: null, email: "jane@gmail.com", source: "seeker-waitlist-modal" }),
    );
    expect(payload?.Segment).toBe("B2C");
    expect(payload).not.toHaveProperty("Company");
  });

  it("keeps Company when Segment is omitted entirely", () => {
    // A consumer-surface booking from a BUSINESS email omits Segment so as not
    // to downgrade an existing B2B Lead. That record is not B2C and must keep
    // its Company — which is why the guard tests `=== "B2C"`, not `!== "B2B"`.
    const payload = buildCallBookingPayload(
      booking({ company: null, email: "priya@acme.com", source: "seeker" }),
    );
    expect(payload).not.toHaveProperty("Segment");
    expect(payload?.Company).toBe("acme.com");
  });

  it("BLANKS a consumer audience on a B2B booking rather than omitting it", () => {
    // The bot_leads#17 defect: a business action taken from a B2C page resolved
    // a real-but-wrong consumer audience. Explicit null is required so a stale
    // value from an earlier visit cannot survive on the merged Lead.
    const payload = buildCallBookingPayload(
      booking({ page_path: "/solutions/professionals" }),
    );
    expect(payload?.Segment).toBe("B2B");
    expect(payload).toHaveProperty("Audience", null);
    expect(payload).toHaveProperty("Business_Unit", null);
    expect(payload).toHaveProperty("Product_Interest", null);
  });

  it("keeps a consumer audience on a seeker booking", () => {
    const payload = buildCallBookingPayload(
      booking({
        source: "seeker-waitlist-modal",
        page_path: "/solutions/professionals",
        email: "jane@gmail.com",
        company: null,
      }),
    );
    expect(payload?.Segment).toBe("B2C");
    expect(payload?.Audience).toBe("Professional");
  });

  it("never downgrades a work-email lead from a seeker booking", () => {
    // Asymmetry: a B2C surface must not send Segment=B2C for a work address,
    // or one stray consumer click would demote a real enterprise Lead.
    const payload = buildCallBookingPayload(
      booking({ source: "seeker-waitlist-modal", email: "jane@acme.com" }),
    );
    expect(payload).not.toHaveProperty("Segment");
  });

  it("excludes disposable addresses from the CRM", () => {
    expect(buildCallBookingPayload(booking({ is_disposable_email: true }))).toBeNull();
  });

  it("excludes a cancellation that never reached Zoho", () => {
    // Otherwise we would create a Lead for a call that will not happen.
    expect(
      buildCallBookingPayload(booking({ status: "cancelled", zoho_lead_id: null })),
    ).toBeNull();
  });

  it("still syncs a cancellation for a booking already in Zoho", () => {
    const payload = buildCallBookingPayload(
      booking({ status: "cancelled", zoho_lead_id: "lead-1" }),
    );
    expect(payload).not.toBeNull();
    expect(payload?.Description).toContain("status: cancelled");
  });

  it("still syncs a booking from an unregistered event type", () => {
    // Deliberately NOT skipped: one stale id in CAL_EVENT_TYPES must not
    // silently withhold every real lead from the CRM.
    const payload = buildCallBookingPayload(booking({ cal_event_type_id: 999999 }));
    expect(payload).not.toBeNull();
    expect(payload?.Description).toContain("Booked a call via Cal.com");
  });

  it("carries UTM attribution through to the Lead", () => {
    const payload = buildCallBookingPayload(
      booking({
        utm_source: "linkedin",
        utm_medium: "cpc",
        utm_campaign: "q3-enterprise",
        gclid: "abc",
        landing_page: "/enterprise-solutions?utm_source=linkedin",
      }),
    );
    expect(payload).toMatchObject({
      UTM_Source: "linkedin",
      UTM_Medium: "cpc",
      UTM_Campaign: "q3-enterprise",
      Google_Click_ID: "abc",
      Lead_Source: "Paid Ads",
      Landing_Page_URL: "https://growqr.ai/enterprise-solutions?utm_source=linkedin",
    });
  });
});
