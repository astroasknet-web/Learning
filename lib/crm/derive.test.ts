import { describe, expect, it } from "vitest";
import {
  countryDisplayName,
  deriveB2bAudience,
  deriveLeadSource,
  deriveWaitlistAudience,
  emailDomainHeuristic,
  regionForCountryCode,
  splitName,
  teamSizeToEmployees,
} from "@/lib/crm/derive";
import type { AttributionPayload } from "@/lib/forms/schemas";

const attribution = (overrides: Partial<AttributionPayload> = {}): AttributionPayload => ({
  utm_source: null,
  utm_medium: null,
  utm_campaign: null,
  utm_term: null,
  utm_content: null,
  gclid: null,
  landing_page: null,
  referrer: null,
  page_path: null,
  ...overrides,
});

describe("splitName", () => {
  it("splits on the last space", () => {
    expect(splitName("Priya Nair")).toEqual({ firstName: "Priya", lastName: "Nair" });
    expect(splitName("Juan Carlos de la Cruz")).toEqual({
      firstName: "Juan Carlos de la",
      lastName: "Cruz",
    });
  });

  it("puts a single token into the required Last_Name", () => {
    expect(splitName("Cher")).toEqual({ firstName: null, lastName: "Cher" });
  });

  it("collapses messy whitespace", () => {
    expect(splitName("  Jane   Doe  ")).toEqual({ firstName: "Jane", lastName: "Doe" });
  });
});

describe("regionForCountryCode", () => {
  it("maps the four named regions", () => {
    expect(regionForCountryCode("IN")).toBe("India");
    expect(regionForCountryCode("US")).toBe("USA");
    expect(regionForCountryCode("AE")).toBe("UAE");
    expect(regionForCountryCode("SG")).toBe("Singapore");
  });

  it("collapses everything else (incl. live countries and null) to Other", () => {
    expect(regionForCountryCode("TR")).toBe("Other");
    expect(regionForCountryCode("CH")).toBe("Other");
    expect(regionForCountryCode(null)).toBe("Other");
  });
});

describe("countryDisplayName", () => {
  it("returns exact live picklist strings for every live country", () => {
    // The 13 live countries (lib/currency.ts) must all resolve — the
    // waitlist's regional promise depends on them.
    expect(countryDisplayName("IN")).toBe("India");
    expect(countryDisplayName("AE")).toBe("United Arab Emirates");
    expect(countryDisplayName("TR")).toBe("Türkiye");
    expect(countryDisplayName("GE")).toBe("Georgia");
    expect(countryDisplayName("LK")).toBe("Sri Lanka");
    expect(countryDisplayName("NP")).toBe("Nepal");
    expect(countryDisplayName("TH")).toBe("Thailand");
    expect(countryDisplayName("BR")).toBe("Brazil");
    expect(countryDisplayName("AR")).toBe("Argentina");
    expect(countryDisplayName("MT")).toBe("Malta");
    expect(countryDisplayName("NO")).toBe("Norway");
    expect(countryDisplayName("SE")).toBe("Sweden");
    expect(countryDisplayName("CH")).toBe("Switzerland");
  });

  it("omits (nulls) unmapped codes instead of guessing a picklist value", () => {
    expect(countryDisplayName("ZZ")).toBeNull();
    expect(countryDisplayName(null)).toBeNull();
  });
});

describe("deriveLeadSource (priority order)", () => {
  it("gclid or paid medium → Paid Ads, beating every other signal", () => {
    expect(deriveLeadSource(attribution({ gclid: "x" }))).toBe("Paid Ads");
    expect(deriveLeadSource(attribution({ utm_medium: "cpc", utm_source: "linkedin" }))).toBe(
      "Paid Ads",
    );
    expect(deriveLeadSource(attribution({ utm_medium: "paid_social" }))).toBe("Paid Ads");
  });

  it("utm_medium=email → Email Campaign", () => {
    expect(deriveLeadSource(attribution({ utm_medium: "email" }))).toBe("Email Campaign");
  });

  it("organic social sources → Social Media", () => {
    expect(deriveLeadSource(attribution({ utm_source: "LinkedIn" }))).toBe("Social Media");
    expect(deriveLeadSource(attribution({ utm_source: "x" }))).toBe("Social Media");
  });

  it("partner tagging → Partner", () => {
    expect(deriveLeadSource(attribution({ utm_source: "partner" }))).toBe("Partner");
    expect(deriveLeadSource(attribution({ utm_medium: "partnership" }))).toBe("Partner");
  });

  it("search-engine referrer without UTMs → Organic Search", () => {
    expect(deriveLeadSource(attribution({ referrer: "https://www.google.com/" }))).toBe(
      "Organic Search",
    );
    expect(deriveLeadSource(attribution({ referrer: "https://duckduckgo.com/?q=growqr" }))).toBe(
      "Organic Search",
    );
  });

  it("external non-search referrer (or utm_medium=referral) → Referral", () => {
    expect(deriveLeadSource(attribution({ referrer: "https://news.ycombinator.com/item" }))).toBe(
      "Referral",
    );
    expect(deriveLeadSource(attribution({ utm_medium: "referral" }))).toBe("Referral");
  });

  it("no signals, internal referrer, or malformed referrer → Website", () => {
    expect(deriveLeadSource(attribution())).toBe("Website");
    expect(deriveLeadSource(attribution({ referrer: "https://growqr.ai/enterprise" }))).toBe(
      "Website",
    );
    expect(deriveLeadSource(attribution({ referrer: "not a url" }))).toBe("Website");
  });
});

describe("deriveB2bAudience", () => {
  it("any RQ agent → Enterprise / Enterprise / Q-Skale", () => {
    expect(deriveB2bAudience("RQ-Rita", null)).toEqual({
      audience: "Enterprise",
      businessUnit: "Enterprise",
      productInterest: "Q-Skale",
    });
  });

  it("maps every solution label", () => {
    expect(deriveB2bAudience(null, "GrowQR Enterprise")).toEqual({
      audience: "Enterprise",
      businessUnit: "Enterprise",
      productInterest: "Q-Skale",
    });
    expect(deriveB2bAudience(null, "Startups")).toEqual({
      audience: "Enterprise",
      businessUnit: "Enterprise",
      productInterest: "Q-Skale",
    });
    expect(deriveB2bAudience(null, "Recruiters")).toEqual({
      audience: "Recruiter",
      businessUnit: "Talent",
      productInterest: "Q-Kalyber",
    });
    expect(deriveB2bAudience(null, "Institutes")).toEqual({
      audience: "Institute",
      businessUnit: "EdTech",
      productInterest: "Q-Kampus",
    });
  });

  it("never fabricates for unknown labels", () => {
    expect(deriveB2bAudience(null, "Something New")).toEqual({
      audience: null,
      businessUnit: null,
      productInterest: null,
    });
    expect(deriveB2bAudience(null, null)).toEqual({
      audience: null,
      businessUnit: null,
      productInterest: null,
    });
  });
});

describe("deriveWaitlistAudience", () => {
  it("student slugs → Student / Individual / Q-Ryze", () => {
    expect(deriveWaitlistAudience("students-hero")).toEqual({
      audience: "Student",
      businessUnit: "Individual",
      productInterest: "Q-Ryze",
    });
    expect(deriveWaitlistAudience("students-pricing")).toEqual({
      audience: "Student",
      businessUnit: "Individual",
      productInterest: "Q-Ryze",
    });
  });

  it("professional slugs → Professional / Individual / Q-Ryze", () => {
    for (const slug of ["professionals-hero", "consultants-pricing"]) {
      expect(deriveWaitlistAudience(slug)).toEqual({
        audience: "Professional",
        businessUnit: "Individual",
        productInterest: "Q-Ryze",
      });
    }
  });

  it("coach slugs → Coach / Talent / Q-Kalyber — the one non-Individual persona", () => {
    for (const slug of ["coaches-hero", "coaches-pricing"]) {
      expect(deriveWaitlistAudience(slug)).toEqual({
        audience: "Coach",
        businessUnit: "Talent",
        productInterest: "Q-Kalyber",
      });
    }
  });

  it("freelancer slugs → Freelancer / Individual / Q-Ryze", () => {
    for (const slug of ["freelancers-hero", "freelancers-pricing"]) {
      expect(deriveWaitlistAudience(slug)).toEqual({
        audience: "Freelancer",
        businessUnit: "Individual",
        productInterest: "Q-Ryze",
      });
    }
  });

  it("generic CTAs with no page context stay empty — unknown is honest", () => {
    for (const slug of [
      "navbar",
      "navbar-mobile",
      "homepage-hero",
      "homepage-pricing",
      "roadmaps-cta",
      "final-cta",
      "journey-cta",
      null,
    ]) {
      expect(deriveWaitlistAudience(slug)).toEqual({
        audience: null,
        businessUnit: null,
        productInterest: null,
      });
    }
  });

  it("a generic CTA falls back to the persona page the visitor was reading", () => {
    // The navbar CTA is global: without this, reading /solutions/coaches and
    // clicking "Book a Call" in the header lost the audience entirely.
    expect(deriveWaitlistAudience("navbar", "/solutions/coaches")).toEqual({
      audience: "Coach",
      businessUnit: "Talent",
      productInterest: "Q-Kalyber",
    });
    expect(deriveWaitlistAudience("homepage-hero", "/solutions/students")).toEqual({
      audience: "Student",
      businessUnit: "Individual",
      productInterest: "Q-Ryze",
    });
    expect(deriveWaitlistAudience("final-cta", "/solutions/freelancers")).toEqual({
      audience: "Freelancer",
      businessUnit: "Individual",
      productInterest: "Q-Ryze",
    });
    expect(deriveWaitlistAudience("navbar-mobile", "/solutions/professionals")).toEqual({
      audience: "Professional",
      businessUnit: "Individual",
      productInterest: "Q-Ryze",
    });
  });

  it("page fallback tolerates trailing slashes, query strings, case and nesting", () => {
    for (const path of [
      "/solutions/coaches/",
      "/solutions/coaches?utm_source=x",
      "/Solutions/Coaches",
      "/solutions/coaches/pricing",
    ]) {
      expect(deriveWaitlistAudience("navbar", path)).toEqual({
        audience: "Coach",
        businessUnit: "Talent",
        productInterest: "Q-Kalyber",
      });
    }
  });

  it("agent and ai-* pages carry the same weak Professional signal", () => {
    for (const path of ["/agents/vera", "/ai-resume-expert"]) {
      expect(deriveWaitlistAudience("navbar", path)).toEqual({
        audience: "Professional",
        businessUnit: "Individual",
        productInterest: "Q-Ryze",
      });
    }
  });

  it("an explicit CTA slug always outranks the page it was clicked on", () => {
    // A student CTA embedded on the coaches page is still a student.
    expect(deriveWaitlistAudience("students-hero", "/solutions/coaches")).toEqual({
      audience: "Student",
      businessUnit: "Individual",
      productInterest: "Q-Ryze",
    });
  });

  it("a generic CTA on a page with no persona stays empty", () => {
    for (const path of ["/", "/about", "/events", "/solutions", null]) {
      expect(deriveWaitlistAudience("navbar", path)).toEqual({
        audience: null,
        businessUnit: null,
        productInterest: null,
      });
    }
  });

  it("agent CTAs → weak Professional signal", () => {
    for (const slug of ["vera-hero", "agent-final-cta", "agent-story", "sage-hero"]) {
      expect(deriveWaitlistAudience(slug)).toEqual({
        audience: "Professional",
        businessUnit: "Individual",
        productInterest: "Q-Ryze",
      });
    }
  });
});

describe("emailDomainHeuristic", () => {
  it("consumer domains → B2C with NO company", () => {
    // null, never a placeholder: Zoho creates an Account from Company, and
    // Accounts.Account_Name is not unique, so any placeholder would merge
    // unrelated consumers into one shared Account on conversion.
    expect(emailDomainHeuristic("jane@gmail.com")).toEqual({
      segment: "B2C",
      company: null,
    });
    expect(emailDomainHeuristic("JANE@OUTLOOK.COM")).toEqual({
      segment: "B2C",
      company: null,
    });
  });

  it("work domains → B2B with the domain standing in for the company", () => {
    expect(emailDomainHeuristic("priya@razorpay.com")).toEqual({
      segment: "B2B",
      company: "razorpay.com",
    });
  });
});

describe("teamSizeToEmployees", () => {
  it("maps the modal's exact en-dash strings", () => {
    expect(teamSizeToEmployees("1–50")).toBe(50);
    expect(teamSizeToEmployees("51–200")).toBe(200);
    expect(teamSizeToEmployees("201–1,000")).toBe(1000);
    expect(teamSizeToEmployees("1,000+")).toBe(1001);
  });

  it("returns null for unknown or missing values instead of guessing", () => {
    expect(teamSizeToEmployees("1-50")).toBeNull(); // hyphen, not the form's en dash
    expect(teamSizeToEmployees(null)).toBeNull();
  });
});
