import { describe, expect, it } from "vitest";
import {
  EMAIL_REGEX,
  parseB2bLead,
  parseContact,
  parseNewsletter,
  parseSeekerWaitlist,
  sanitizeAttribution,
} from "@/lib/forms/schemas";

/**
 * Parity tests: every error message, status and normalization here matches
 * the contract the four API routes exposed before the shared-pipeline
 * refactor. If one of these fails, a frontend contract has changed.
 */

describe("EMAIL_REGEX", () => {
  it("accepts standard addresses", () => {
    expect(EMAIL_REGEX.test("jane.doe@growqr.ai")).toBe(true);
    expect(EMAIL_REGEX.test("x@y.co")).toBe(true);
  });

  it("rejects malformed addresses", () => {
    for (const bad of ["", "plain", "a@b", "a b@c.com", "a@b c.com", "@c.com"]) {
      expect(EMAIL_REGEX.test(bad)).toBe(false);
    }
  });
});

describe("parseContact", () => {
  const valid = {
    name: "jane doe",
    email: "jane@growqr.ai",
    message: "  Hello there  ",
    token: "tok",
  };

  it("requires name, email and message", () => {
    for (const missing of ["name", "email", "message"] as const) {
      const body: Record<string, unknown> = { ...valid };
      delete body[missing];
      expect(parseContact(body)).toEqual({
        ok: false,
        error: "Missing required fields",
        status: 400,
      });
    }
  });

  it("rejects non-string required fields as missing", () => {
    expect(parseContact({ ...valid, name: 42 })).toEqual({
      ok: false,
      error: "Missing required fields",
      status: 400,
    });
  });

  it("rejects invalid email format", () => {
    expect(parseContact({ ...valid, email: "not-an-email" })).toEqual({
      ok: false,
      error: "Invalid email format",
      status: 400,
    });
  });

  it("normalizes name, subject, message and type", () => {
    const result = parseContact(valid);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual({
      name: "Jane Doe",
      email: "jane@growqr.ai",
      subject: "General Inquiry",
      message: "Hello there",
      type: "general",
      token: "tok",
    });
  });

  it("tolerates explicit nulls on optional fields", () => {
    const result = parseContact({ ...valid, subject: null, type: null, token: null });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.subject).toBe("General Inquiry");
    expect(result.data.type).toBe("general");
    expect(result.data.token).toBeUndefined();
  });

  it("keeps a provided subject and sales type", () => {
    const result = parseContact({ ...valid, subject: " Pricing ", type: "sales" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.subject).toBe("Pricing");
    expect(result.data.type).toBe("sales");
  });

  it("defaults unknown type values to general", () => {
    const result = parseContact({ ...valid, type: "weird" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.type).toBe("general");
  });
});

describe("parseB2bLead", () => {
  const valid = {
    name: " Priya Nair ",
    email: "priya@razorpay.com",
    company: " Razorpay ",
    token: "tok",
  };

  it("requires name, email and company", () => {
    for (const missing of ["name", "email", "company"] as const) {
      const body: Record<string, unknown> = { ...valid };
      delete body[missing];
      expect(parseB2bLead(body)).toEqual({
        ok: false,
        error: "Missing required fields",
        status: 400,
      });
    }
  });

  it("treats whitespace-only required fields as missing", () => {
    expect(parseB2bLead({ ...valid, company: "   " })).toEqual({
      ok: false,
      error: "Missing required fields",
      status: 400,
    });
  });

  it("rejects invalid email format", () => {
    expect(parseB2bLead({ ...valid, email: "nope" })).toEqual({
      ok: false,
      error: "Invalid email format",
      status: 400,
    });
  });

  it("accepts the enterprise modal's real wire format with explicit nulls", () => {
    // The modal always sends `agent: agent ?? null` etc. — nulls, not absent
    // keys. Rejecting them 400'd every b2b submission (caught in the Phase 5
    // live drill).
    const result = parseB2bLead({
      name: "Priya Nair",
      email: "priya@razorpay.com",
      company: "Razorpay",
      teamSize: "51–200",
      message: null,
      agent: null,
      solution: "Enterprises",
      source: "/solutions/enterprises",
      token: "tok",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.agent).toBeNull();
    expect(result.data.solution).toBe("Enterprises");
  });

  it("still rejects null required fields as missing", () => {
    expect(parseB2bLead({ name: null, email: "a@b.co", company: "Acme" })).toEqual({
      ok: false,
      error: "Missing required fields",
      status: 400,
    });
  });

  it("trims required fields and nulls empty optional fields", () => {
    const result = parseB2bLead({ ...valid, teamSize: " 51–200 ", message: "  " });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual({
      name: "Priya Nair",
      email: "priya@razorpay.com",
      company: "Razorpay",
      teamSize: "51–200",
      message: null,
      agent: null,
      solution: null,
      source: null,
      token: "tok",
    });
  });
});

describe("parseSeekerWaitlist", () => {
  it("requires an email", () => {
    expect(parseSeekerWaitlist({})).toEqual({
      ok: false,
      error: "Email is required.",
      status: 400,
    });
    expect(parseSeekerWaitlist({ email: 42 })).toEqual({
      ok: false,
      error: "Email is required.",
      status: 400,
    });
  });

  it("rejects invalid email format", () => {
    expect(parseSeekerWaitlist({ email: "nope" })).toEqual({
      ok: false,
      error: "Enter a valid email address.",
      status: 400,
    });
  });

  it("lowercases and trims the email", () => {
    const result = parseSeekerWaitlist({ email: "  Jane@GrowQR.AI ", source: "navbar" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual({ email: "jane@growqr.ai", source: "navbar", token: undefined });
  });

  it("defaults source to null", () => {
    const result = parseSeekerWaitlist({ email: "jane@growqr.ai" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.source).toBeNull();
  });

  it("tolerates an explicit null source", () => {
    const result = parseSeekerWaitlist({ email: "jane@growqr.ai", source: null });
    expect(result.ok && result.data.source).toBeNull();
  });
});

describe("sanitizeAttribution", () => {
  const ALL_NULL = {
    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
    utm_term: null,
    utm_content: null,
    gclid: null,
    landing_page: null,
    referrer: null,
    page_path: null,
  };

  it("collapses a missing or malformed object to all nulls, never throwing", () => {
    for (const bad of [undefined, null, "utm_source=x", 42, ["a"], { utm_source: 42 }]) {
      expect(sanitizeAttribution(bad)).toEqual(ALL_NULL);
    }
  });

  it("passes allowlisted fields through trimmed", () => {
    const result = sanitizeAttribution({
      utm_source: " google ",
      utm_medium: "cpc",
      gclid: "abc123",
      landing_page: "/enterprise?utm_source=google",
      referrer: "https://www.google.com/",
      page_path: "/contact",
    });
    expect(result).toEqual({
      ...ALL_NULL,
      utm_source: "google",
      utm_medium: "cpc",
      gclid: "abc123",
      landing_page: "/enterprise?utm_source=google",
      referrer: "https://www.google.com/",
      page_path: "/contact",
    });
  });

  it("drops unknown keys instead of persisting attacker-chosen fields", () => {
    const result = sanitizeAttribution({ utm_source: "x", crm_sync_status: "synced" });
    expect(result).not.toHaveProperty("crm_sync_status");
    expect(result.utm_source).toBe("x");
  });

  it("accepts explicit nulls alongside real values (the client's wire format)", () => {
    // getAttributionPayload() always sends every key, absent ones as null —
    // rejecting nulls would silently discard the real values next to them.
    const result = sanitizeAttribution({ ...ALL_NULL, utm_source: "google" });
    expect(result.utm_source).toBe("google");
    expect(result.utm_medium).toBeNull();
  });

  it("nulls empty and whitespace-only values", () => {
    const result = sanitizeAttribution({ utm_source: "", referrer: "   " });
    expect(result.utm_source).toBeNull();
    expect(result.referrer).toBeNull();
  });

  it("caps oversized values (200 for params, 500 for URLs)", () => {
    const result = sanitizeAttribution({
      utm_campaign: "c".repeat(1000),
      landing_page: `/${"p".repeat(1000)}`,
    });
    expect(result.utm_campaign).toBe("c".repeat(200));
    expect(result.landing_page).toHaveLength(500);
  });
});

describe("parseNewsletter", () => {
  it("requires an email", () => {
    expect(parseNewsletter({})).toEqual({ ok: false, error: "Email is required", status: 400 });
  });

  it("rejects invalid email format", () => {
    expect(parseNewsletter({ email: "nope" })).toEqual({
      ok: false,
      error: "Invalid email format",
      status: 400,
    });
  });

  it("lowercases the email and defaults source to website", () => {
    const result = parseNewsletter({ email: "Jane@GrowQR.AI" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual({
      email: "jane@growqr.ai",
      name: null,
      source: "website",
      token: undefined,
    });
  });

  it("trims and caps source at 100 characters", () => {
    const result = parseNewsletter({ email: "jane@growqr.ai", source: ` ${"x".repeat(200)} ` });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.source).toBe("x".repeat(100));
  });

  it("nulls an empty name but keeps a real one", () => {
    const empty = parseNewsletter({ email: "jane@growqr.ai", name: "  " });
    expect(empty.ok && empty.data.name).toBeNull();
    const named = parseNewsletter({ email: "jane@growqr.ai", name: " Jane " });
    expect(named.ok && named.data.name).toBe("Jane");
  });
});
