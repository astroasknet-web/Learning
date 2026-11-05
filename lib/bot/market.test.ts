import { describe, expect, it } from "vitest";
import { marketAvailabilityFor } from "@/lib/bot/market";
import { detectNamedCountry, countryDisplayName } from "@/lib/countries";

/**
 * Deterministic — no I/O, no model. This is the regression guard for the
 * live-confirmed 2026-08-03 bug: a visitor whose own market was live asked
 * "is it live in the USA?" and the AI answered "GrowQR is available in the
 * US," which is false. These pin the fix at the level it actually needs to
 * be pinned: the plain isLiveCountry() lookup, same as the landing pages.
 */

describe("detectNamedCountry", () => {
  it("finds the live countries", () => {
    expect(detectNamedCountry("is it live in India")).toBe("IN");
    expect(detectNamedCountry("do you support the UAE")).toBe("AE");
    expect(detectNamedCountry("what about Turkey")).toBe("TR");
  });

  it("finds common non-live countries under multiple aliases", () => {
    expect(detectNamedCountry("is it live in the USA")).toBe("US");
    expect(detectNamedCountry("is it live in the United States")).toBe("US");
    expect(detectNamedCountry("available in America")).toBe("US");
    expect(detectNamedCountry("what about the UK")).toBe("GB");
    expect(detectNamedCountry("live in Britain")).toBe("GB");
  });

  it("prefers the longer, more specific alias over a shorter overlap", () => {
    expect(detectNamedCountry("is it live in the United Arab Emirates")).toBe("AE");
  });

  it("returns null when no country is named", () => {
    expect(detectNamedCountry("is it live here")).toBeNull();
    expect(detectNamedCountry("can someone help me")).toBeNull();
  });

  it("never matches the pronoun 'us'", () => {
    expect(detectNamedCountry("can you help us")).toBeNull();
    expect(detectNamedCountry("is it live for us")).toBeNull();
  });

  it("does not match bare 'georgia' — collides with the US state", () => {
    expect(detectNamedCountry("is it live in Georgia")).toBeNull();
  });
});

describe("countryDisplayName", () => {
  it("maps known codes to a friendly name", () => {
    expect(countryDisplayName("IN")).toBe("India");
    expect(countryDisplayName("US")).toBe("the US");
  });

  it("falls back to the raw code for an unmapped one", () => {
    expect(countryDisplayName("ZZ")).toBe("ZZ");
  });

  it("passes null/undefined through as null", () => {
    expect(countryDisplayName(null)).toBeNull();
    expect(countryDisplayName(undefined)).toBeNull();
  });
});

describe("marketAvailabilityFor", () => {
  it("answers live for a live country, regardless of phrasing", () => {
    for (const q of ["is it live in India", "is GrowQR live in India", "is GrowQR available in India"]) {
      const result = marketAvailabilityFor(q);
      expect(result?.isLive).toBe(true);
      expect(result?.code).toBe("IN");
      expect(result?.reply).toBe("Yes, GrowQR is live in India. You can sign up at growqr.ai.");
    }
  });

  it("answers not-live for the US — the exact bug this fixes", () => {
    const result = marketAvailabilityFor("Is it live in the USA?");
    expect(result?.isLive).toBe(false);
    expect(result?.code).toBe("US");
    expect(result?.reply).toBe(
      "GrowQR isn't live in the US yet. You can join the waitlist at growqr.ai and we'll email you when it opens.",
    );
  });

  it("never claims a non-live country is available", () => {
    for (const q of [
      "is it live in the UK",
      "is it live in Canada",
      "is GrowQR live in Germany",
      "is GrowQR available in Pakistan",
    ]) {
      expect(marketAvailabilityFor(q)?.isLive).toBe(false);
    }
  });

  it("requires BOTH a country name and an availability-shaped question", () => {
    // Country named, but nothing availability-shaped about it.
    expect(marketAvailabilityFor("my recruiter is based in the US")).toBeNull();
    expect(marketAvailabilityFor("I studied in India for my degree")).toBeNull();
    // Availability-shaped, but no country named.
    expect(marketAvailabilityFor("is it live here")).toBeNull();
    expect(marketAvailabilityFor("do you support recruiters")).toBeNull();
  });

  it("does not fire on unrelated product questions", () => {
    expect(marketAvailabilityFor("what agents do you have")).toBeNull();
    expect(marketAvailabilityFor("how much does it cost")).toBeNull();
  });
});
