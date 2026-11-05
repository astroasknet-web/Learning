import { describe, expect, it } from "vitest";
import type { Tables } from "@/types/database";
import {
  buildB2bLeadPayload,
  buildContactSalesPayload,
  buildSeekerWaitlistPayload,
  buildBotLeadPayload,
} from "@/lib/crm/payload";

/** Row factories: the CRM columns every lead table shares, all empty. */
const crmColumns = {
  country_code: null,
  utm_source: null,
  utm_medium: null,
  utm_campaign: null,
  utm_term: null,
  utm_content: null,
  gclid: null,
  landing_page: null,
  referrer: null,
  zoho_lead_id: null,
  crm_sync_status: "pending",
  crm_synced_at: null,
  crm_sync_error: null,
  crm_sync_attempts: 0,
};

const b2bRow = (overrides: Partial<Tables<"b2b_leads">> = {}): Tables<"b2b_leads"> => ({
  id: 1,
  name: "Priya Nair",
  email: "priya@razorpay.com",
  company: "Razorpay",
  team_size: "51–200",
  message: "We want to evaluate GrowQR for our team.",
  agent: null,
  solution: "GrowQR Enterprise",
  page_path: "/enterprise",
  created_at: "2026-07-23T10:00:00Z",
  ...crmColumns,
  ...overrides,
});

const contactRow = (
  overrides: Partial<Tables<"contact_messages">> = {},
): Tables<"contact_messages"> => ({
  id: "contact-1",
  name: "Jane Doe",
  email: "jane@acme.io",
  subject: "Pricing",
  message: "Tell me about enterprise pricing.",
  type: "sales",
  created_at: "2026-07-23T10:00:00Z",
  read: false,
  replied: false,
  page_path: "/contact",
  ...crmColumns,
  ...overrides,
});

const seekerRow = (
  overrides: Partial<Tables<"seeker_waitlist">> = {},
): Tables<"seeker_waitlist"> => ({
  id: 1,
  email: "jane.doe@gmail.com",
  source: "students-hero",
  created_at: "2026-07-23T10:00:00Z",
  page_path: "/solutions/students",
  ...crmColumns,
  ...overrides,
});

describe("buildB2bLeadPayload", () => {
  it("builds a complete B2B record with derived audience and employee count", () => {
    const record = buildB2bLeadPayload(
      b2bRow({ country_code: "IN", utm_source: "linkedin", landing_page: "/enterprise?x=1" }),
    );

    expect(record).toEqual({
      Last_Name: "Nair",
      First_Name: "Priya",
      Email: "priya@razorpay.com",
      Company: "Razorpay",
      Lead_Status: "New",
      Lead_Source: "Social Media",
      Segment: "B2B",
      Audience: "Enterprise",
      Business_Unit: "Enterprise",
      Product_Interest: "Q-Skale",
      Region: "India",
      Country: "India",
      No_of_Employees: 200,
      UTM_Source: "linkedin",
      Landing_Page_URL: "https://growqr.ai/enterprise?x=1",
      Description:
        "— Submitted via enterprise contact form on /enterprise | solution: GrowQR Enterprise | team size: 51–200 —\n\nWe want to evaluate GrowQR for our team.",
    });
  });

  it("omits absent fields entirely (nulls would blank Zoho values on update)", () => {
    const record = buildB2bLeadPayload(
      b2bRow({ team_size: null, message: null, solution: null, agent: null }),
    );

    expect(record).not.toBeNull();
    expect(Object.values(record!).every((v) => v !== undefined && v !== null)).toBe(true);
    expect(record).not.toHaveProperty("No_of_Employees");
    expect(record).not.toHaveProperty("Audience");
    expect(record).not.toHaveProperty("Business_Unit");
    expect(record).not.toHaveProperty("UTM_Source");
    expect(record).not.toHaveProperty("Country");
    expect(record!.Region).toBe("Other");
  });

  it("keeps the RQ agent in the description, not a field", () => {
    const record = buildB2bLeadPayload(b2bRow({ agent: "RQ-Rita", solution: null }));
    expect(record!.Audience).toBe("Enterprise");
    expect(record!.Business_Unit).toBe("Enterprise");
    expect(record!.Description).toContain("agent: RQ-Rita");
  });
});

describe("buildContactSalesPayload", () => {
  it("refuses non-sales rows — defense in depth under the insert-time skip rule", () => {
    expect(buildContactSalesPayload(contactRow({ type: "general" }))).toBeNull();
    expect(buildContactSalesPayload(contactRow({ type: null }))).toBeNull();
  });

  it("derives company and segment from the email domain", () => {
    const record = buildContactSalesPayload(contactRow());
    expect(record).toMatchObject({
      Company: "acme.io",
      Segment: "B2B",
      Last_Name: "Doe",
      First_Name: "Jane",
      Description: "— Submitted via contact form (sales) on /contact | subject: Pricing —\n\nTell me about enterprise pricing.",
    });
    expect(record).not.toHaveProperty("Audience");
  });

  it("marks consumer addresses B2C and sends no Company", () => {
    const record = buildContactSalesPayload(contactRow({ email: "jane@gmail.com" }));
    expect(record).toMatchObject({ Segment: "B2C" });
    expect(record).not.toHaveProperty("Company");
  });
});

describe("buildSeekerWaitlistPayload", () => {
  it("builds a B2C record with the email local part as Last_Name", () => {
    const record = buildSeekerWaitlistPayload(seekerRow({ country_code: "TR" }));

    expect(record).toEqual({
      Last_Name: "jane.doe",
      Email: "jane.doe@gmail.com",
      Lead_Status: "New",
      Lead_Source: "Website",
      Segment: "B2C",
      Audience: "Student",
      Business_Unit: "Individual",
      Product_Interest: "Q-Ryze",
      Region: "Other",
      Country: "Türkiye",
      Description: "— Joined seeker waitlist via 'students-hero' CTA on /solutions/students —",
    });
  });

  it("leaves audience empty for generic CTAs", () => {
    const record = buildSeekerWaitlistPayload(seekerRow({ source: "navbar", page_path: null }));
    expect(record).not.toHaveProperty("Audience");
    expect(record).not.toHaveProperty("Business_Unit");
    expect(record).not.toHaveProperty("Product_Interest");
    expect(record!.Description).toBe("— Joined seeker waitlist via 'navbar' CTA —");
  });

  it("recovers the audience from page_path when the CTA is generic", () => {
    // The global navbar CTA on a persona page: the slug says nothing, the page
    // says everything. Coach is the one persona that is not Individual/Q-Ryze.
    const record = buildSeekerWaitlistPayload(
      seekerRow({ source: "navbar", page_path: "/solutions/coaches" }),
    );

    expect(record).toMatchObject({
      Segment: "B2C",
      Audience: "Coach",
      Business_Unit: "Talent",
      Product_Interest: "Q-Kalyber",
    });
    // The B2C invariant must survive the new derivation: no Company, so Zoho
    // converts this Lead to a Contact with no Account.
    expect(record).not.toHaveProperty("Company");
  });
});

// ── The B2C conversion guard ────────────────────────────────────────────────

/**
 * Zoho creates an Account from the Lead's Company, and Accounts.Account_Name
 * is NOT unique — so a B2C Lead carrying any Company would convert into a
 * shared or duplicated Account. compact() strips Company on every B2C record
 * so the policy (B2B → Contact + Account + optional Deal, B2C → Contact only)
 * cannot be broken by a builder, present or future.
 */
describe("B2C guard: Company never survives on a B2C lead", () => {
  it("strips a Company a builder supplied alongside Segment=B2C", () => {
    // A general_inquiry bot lead from a consumer page: B2C, but the visitor
    // typed a company into the bot form, so the builder does supply one.
    const record = buildBotLeadPayload(
      botRow({
        intent: "general_inquiry",
        company: "Some Typed Company",
        email: "jane@gmail.com",
        page_path: "/solutions/students",
        last_page_path: "/solutions/students",
      }),
    );

    expect(record?.Segment).toBe("B2C");
    expect(record).not.toHaveProperty("Company");
  });

  it("keeps Company on a B2B lead", () => {
    const record = buildBotLeadPayload(botRow({ company: "GrowQR" }));
    expect(record?.Segment).toBe("B2B");
    expect(record?.Company).toBe("GrowQR");
  });

  // The third case — Segment omitted entirely must KEEP its Company — needs a
  // booking row, so it lives in call-booking.test.ts alongside that helper.
});

// ── Bot leads: audience must follow the page, not just the intent ───────────

const botRow = (overrides: Partial<Tables<"bot_leads">> = {}): Tables<"bot_leads"> => ({
  id: 1,
  conversation_id: "conv-1",
  conversation_ids: ["conv-1"],
  avuid: null,
  intent: "demo_request",
  use_case: "we want to speed up hiring",
  name: "Sahil Andhare",
  email: "sahil@growqr.ai",
  company: "GrowQR",
  designation: null,
  team_size: null,
  country_code: "IN",
  page_path: "/solutions/recruiters",
  last_page_path: "/solutions/recruiters",
  utm_source: null,
  utm_medium: null,
  utm_campaign: null,
  created_at: "2026-08-01T10:00:00Z",
  first_seen_at: "2026-08-01T10:00:00Z",
  last_visit_at: "2026-08-01T10:00:00Z",
  visit_count: 1,
  zoho_lead_id: null,
  crm_sync_status: "pending",
  crm_synced_at: null,
  crm_sync_error: null,
  crm_sync_attempts: 0,
  zoho_task_created: false,
  zoho_note_created: false,
  zoho_notes_count: 0,
  zoho_notes_pending: true,
  notification_sent: false,
  ...overrides,
});

describe("buildBotLeadPayload audience mapping", () => {
  /**
   * The production defect this fixes: "Book a Demo" produces intent
   * demo_request, which has no BOT_INTENT_AUDIENCE entry. Audience,
   * Business_Unit and Product_Interest all resolved null, compact() omitted
   * them, and the Zoho upsert therefore left an EARLIER visit's values in
   * place — a /solutions/recruiters demo request stayed filed as
   * Institute / EdTech / Q-Kampus.
   */
  it("derives recruiter metadata from the page when the intent is demo_request", () => {
    const payload = buildBotLeadPayload(botRow())!;
    expect(payload.Audience).toBe("Recruiter");
    expect(payload.Business_Unit).toBe("Talent");
    expect(payload.Product_Interest).toBe("Q-Kalyber");
    // The exact wrong values from the live lead — must not reappear.
    expect(payload.Product_Interest).not.toBe("Q-Kampus");
    expect(payload.Business_Unit).not.toBe("EdTech");
  });

  // These pages resolve a genuine B2B audience, so a demo_request completed
  // there is unaffected by the B2C-contradiction fix below — the page and the
  // qualification form agree.
  it.each([
    ["/solutions/institutes", "Institute", "EdTech", "Q-Kampus", "B2B"],
    ["/solutions/enterprises", "Enterprise", "Enterprise", "Q-Skale", "B2B"],
    ["/solutions/startups", "Enterprise", "Enterprise", "Q-Skale", "B2B"],
    ["/enterprise/ai-recruiter", "Enterprise", "Enterprise", "Q-Skale", "B2B"],
  ])("maps %s → %s", (page, audience, unit, product, segment) => {
    const payload = buildBotLeadPayload(
      botRow({ page_path: page, last_page_path: page }),
    )!;
    expect(payload.Audience).toBe(audience);
    expect(payload.Business_Unit).toBe(unit);
    expect(payload.Product_Interest).toBe(product);
    expect(payload.Segment).toBe(segment);
  });

  // A general_inquiry on a B2C page has no qualification form behind it, so
  // its page-derived audience is a real answer, not a contradiction — the fix
  // below must not touch this path.
  it.each([
    ["/solutions/students", "Student", "Individual", "Q-Ryze", "B2C"],
    ["/solutions/professionals", "Professional", "Individual", "Q-Ryze", "B2C"],
  ])("maps %s → %s for an organic (general_inquiry) chat", (page, audience, unit, product, segment) => {
    const payload = buildBotLeadPayload(
      botRow({ intent: "general_inquiry", page_path: page, last_page_path: page }),
    )!;
    expect(payload.Audience).toBe(audience);
    expect(payload.Business_Unit).toBe(unit);
    expect(payload.Product_Interest).toBe(product);
    expect(payload.Segment).toBe(segment);
  });

  /**
   * Reproduced live (bot_leads#17): visitor chatting from /solutions/
   * professionals typed "demo" -> "instittute demo", answered a work email,
   * company, and team size — completing the B2B qualification form. The
   * page-derived audience ("Professional") is a REAL value, not an absence,
   * so the old code sent it as-is and Segment followed it to B2C: a fully
   * qualified business demo request filed and displayed as an individual
   * consumer lead. A B2C page audience must not survive a completed B2B
   * qualification form, on ANY B2C-mapped page — Segment is forced B2B and
   * the contradicting audience is blanked, same treatment as an unresolved one.
   */
  it.each(["/solutions/students", "/solutions/professionals"])(
    "blanks a B2C page audience that contradicts a demo_request completed on %s",
    (page) => {
      const payload = buildBotLeadPayload(
        botRow({ intent: "demo_request", page_path: page, last_page_path: page }),
      )!;
      expect(payload.Segment).toBe("B2B");
      expect(payload.Audience).toBeNull();
      expect(payload.Business_Unit).toBeNull();
      expect(payload.Product_Interest).toBeNull();
    },
  );

  it("lets an explicit intent beat the page it was asked on", () => {
    // "I'm a recruiter" typed on an institutes page is a stronger signal than
    // the page itself.
    const payload = buildBotLeadPayload(
      botRow({ intent: "recruiter_inquiry", page_path: "/solutions/institutes" }),
    )!;
    expect(payload.Audience).toBe("Recruiter");
  });

  it("prefers the latest page over the first one on a return visit", () => {
    const payload = buildBotLeadPayload(
      botRow({ page_path: "/solutions/institutes", last_page_path: "/solutions/recruiters" }),
    )!;
    expect(payload.Audience).toBe("Recruiter");
  });

  /**
   * Reproduced live: a homepage B2C chat ("pricing", "which agents we have")
   * escalated to "demo" -> "institute demo" (work email, company, team size
   * all collected) never left the homepage, so the page-fallback resolves
   * nothing. A B2B-qualifying intent (anything but general_inquiry) must
   * still send an explicit null here rather than omitting — omitting would
   * let a stale, contradictory Audience from an earlier visit survive the
   * escalation, which is exactly what happened in production (a business
   * demo request stayed filed and displayed as an individual "Professional"
   * lead).
   */
  it("blanks (not omits) audience fields for a B2B-qualifying intent on an unmapped page", () => {
    const payload = buildBotLeadPayload(
      botRow({ intent: "demo_request", page_path: "/", last_page_path: "/" }),
    )!;
    expect(payload.Audience).toBeNull();
    expect(payload.Business_Unit).toBeNull();
    expect(payload.Product_Interest).toBeNull();
  });

  it("omits (does not blank) audience fields for a general_inquiry on an unmapped page", () => {
    const payload = buildBotLeadPayload(
      botRow({ intent: "general_inquiry", page_path: "/about", last_page_path: "/about" }),
    )!;
    expect(payload.Audience).toBeUndefined();
    expect(payload.Business_Unit).toBeUndefined();
    expect(payload.Product_Interest).toBeUndefined();
  });

  /**
   * Reproduced live (bot_leads#18 — "alex 1"): a homepage general_inquiry
   * chat left Audience/Business_Unit/Product_Interest all blank in Zoho,
   * since solutionFromPath("/") resolves nothing. Homepage organic chats now
   * default to Professional (confirmed default), which AUDIENCE_MAP expands
   * to Individual/Q-Ryze. Scoped to "/" only — /about and other unmapped
   * pages are unaffected (see the test above).
   */
  it("defaults a homepage general_inquiry chat to Professional/Individual/Q-Ryze", () => {
    const payload = buildBotLeadPayload(
      botRow({ intent: "general_inquiry", page_path: "/", last_page_path: "/" }),
    )!;
    expect(payload.Audience).toBe("Professional");
    expect(payload.Business_Unit).toBe("Individual");
    expect(payload.Product_Interest).toBe("Q-Ryze");
    expect(payload.Segment).toBe("B2C");
  });

  /**
   * The bot's team-size dropdown must speak the same vocabulary as
   * TEAM_SIZE_EMPLOYEES. ASCII hyphens ("11-50") shared zero keys with that
   * en-dash map, so No_of_Employees was silently null on every bot lead.
   */
  it("maps the team-size options the bot actually offers", () => {
    for (const [option, expected] of [
      ["1–50", 50],
      ["51–200", 200],
      ["201–1,000", 1000],
      ["1,000+", 1001],
    ] as const) {
      expect(buildBotLeadPayload(botRow({ team_size: option }))!.No_of_Employees).toBe(expected);
    }
  });

  it("still populates the fields that were never broken", () => {
    const payload = buildBotLeadPayload(botRow())!;
    expect(payload.Lead_Status).toBe("New");
    expect(payload.Lead_Source).toBe("Website");
    expect(payload.Region).toBe("India");
    expect(payload.Country).toBe("India");
    expect(payload.Company).toBe("GrowQR");
    expect(payload.Landing_Page_URL).toBe("https://growqr.ai/solutions/recruiters");
  });

  // "Enquire now" reposition (2026-08-03): demo_request is labeled and
  // described as an enquiry request, not a demo, everywhere a human reads it
  // — the internal intent value itself is unchanged.
  it("describes a demo_request lead as an Enquiry Request, not a Demo Request", () => {
    const payload = buildBotLeadPayload(botRow())!;
    expect(payload.Description).toContain("Enquiry Request");
    expect(payload.Description).not.toContain("Demo Request");
    expect(payload.Description).not.toContain("demo_request");
  });

  it("excludes a conversation that never captured an email", () => {
    expect(buildBotLeadPayload(botRow({ email: null }))).toBeNull();
  });
});
