import { describe, expect, it } from "vitest";
import {
  B2B_CALL_GUESTS,
  B2C_CALL_GUESTS,
  BOOKING_SOURCES,
  buildCalBookingUrl,
  calEventType,
  eventTypeLabel,
  isB2bSource,
  isB2cSource,
  isKnownSource,
} from "@/lib/cal";

describe("booking sources", () => {
  it("recognises every declared source", () => {
    for (const source of BOOKING_SOURCES) expect(isKnownSource(source)).toBe(true);
  });

  it("rejects anything outside the closed vocabulary", () => {
    expect(isKnownSource("enterprise_page")).toBe(false);
    expect(isKnownSource(null)).toBe(false);
  });

  it("classifies the business surfaces as B2B", () => {
    expect(isB2bSource("b2b-enterprise-modal")).toBe(true);
    expect(isB2bSource("enterprise-hero")).toBe(true);
    expect(isB2cSource("b2b-enterprise-modal")).toBe(false);
  });

  it("classifies the seeker waitlist as B2C", () => {
    expect(isB2cSource("seeker-waitlist-modal")).toBe(true);
    expect(isB2bSource("seeker-waitlist-modal")).toBe(false);
  });

  it("treats an unknown or missing source as NEITHER B2B nor B2C", () => {
    // These two helpers are deliberately not inverses. A booking whose source
    // never arrived (blocked beacon, shared link) is unknown, not consumer —
    // which is what lets notification routing CC the business desk on it while
    // the CRM payload still refuses to assert a Segment it cannot prove.
    for (const value of [null, "who-knows"]) {
      expect(isB2bSource(value)).toBe(false);
      expect(isB2cSource(value)).toBe(false);
    }
  });
});

describe("event type registry", () => {
  it("resolves the live 15-minute call", () => {
    expect(calEventType(6292341)?.slug).toBe("15-min-intro-call");
    expect(eventTypeLabel(6292341)).toBe("15-minute intro call");
  });

  it("degrades to a generic label for an unregistered event type", () => {
    // Never throws and never excludes: a new event type created in the Cal
    // dashboard must still produce a booking and a notification.
    expect(calEventType(999999)).toBeNull();
    expect(eventTypeLabel(999999)).toBe("call");
    expect(eventTypeLabel(null)).toBe("call");
  });
});

describe("buildCalBookingUrl", () => {
  it("always carries the source, with or without an intent", () => {
    expect(buildCalBookingUrl({ source: "enterprise-hero" })).toContain(
      "source=enterprise-hero",
    );
    expect(
      buildCalBookingUrl({ source: "enterprise-hero", intentId: "abc-123" }),
    ).toContain("intent=abc-123");
  });

  // Cal prefills its guests field from the URL, which is how Pranav and Kanika
  // land on the calendar invite with the Meet link. Repeated params, not one
  // comma-joined value.
  it("prefills the B2B call guests on a business booking", () => {
    const url = new URL(buildCalBookingUrl({ source: "enterprise-hero" }));
    expect(url.searchParams.getAll("guests")).toEqual([
      "pranav@growqr.ai",
      "kanika@growqr.ai",
    ]);
  });

  // seeker-waitlist-modal is the one consumer surface (locked decision D1), and
  // Ruchi runs the consumer calls the way Kanika runs the business ones.
  it("prefills the B2C call guest on a consumer booking", () => {
    const url = new URL(buildCalBookingUrl({ source: "seeker-waitlist-modal" }));
    expect(url.searchParams.getAll("guests")).toEqual(["ruchi@growqr.ai"]);
  });

  // The two lists must never bleed into each other: a consumer booking that
  // prefilled the business guests (or the reverse) would put the wrong
  // colleague on a customer's calendar invite.
  it("keeps the B2B and B2C guest lists disjoint", () => {
    const b2b = new URL(buildCalBookingUrl({ source: "enterprise-hero" }));
    const b2c = new URL(buildCalBookingUrl({ source: "seeker-waitlist-modal" }));
    expect(b2b.searchParams.getAll("guests")).not.toContain("ruchi@growqr.ai");
    for (const guest of B2B_CALL_GUESTS) {
      expect(b2c.searchParams.getAll("guests")).not.toContain(guest);
    }
  });

  // An unattributed booking matches neither predicate, so it gets nobody --
  // guessing would put the wrong colleague on the invite.
  it("adds no guests when the source is unknown", () => {
    const url = new URL(
      buildCalBookingUrl({ source: "not-a-real-source" as never }),
    );
    expect(url.searchParams.getAll("guests")).toEqual([]);
  });

  // Sahil hosts, so the same duplicate-on-the-invite rule applies to both lists.
  it("never lists the host as a B2C guest", () => {
    expect(B2C_CALL_GUESTS).not.toContain("sahil@growqr.ai");
  });

  // Sahil owns the event type, so Cal already puts him on the invite as host.
  // Listing him as a guest too would duplicate him on every booking.
  it("never lists the host as a guest", () => {
    expect(B2B_CALL_GUESTS).not.toContain("sahil@growqr.ai");
  });
});
