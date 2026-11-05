import { afterEach, describe, expect, it, vi } from "vitest";
import { buildFirstTouch, captureFirstTouch, getAttributionPayload } from "@/lib/attribution";

describe("buildFirstTouch", () => {
  it("extracts UTM parameters and gclid from the query string", () => {
    const result = buildFirstTouch({
      search: "?utm_source=google&utm_medium=cpc&utm_campaign=launch&gclid=abc123",
      pathname: "/enterprise",
      referrer: "https://www.google.com/",
    });
    expect(result).toEqual({
      utm_source: "google",
      utm_medium: "cpc",
      utm_campaign: "launch",
      utm_term: null,
      utm_content: null,
      gclid: "abc123",
      landing_page: "/enterprise?utm_source=google&utm_medium=cpc&utm_campaign=launch&gclid=abc123",
      referrer: "https://www.google.com/",
    });
  });

  it("nulls everything but the landing page on a bare direct visit", () => {
    const result = buildFirstTouch({ search: "", pathname: "/", referrer: "" });
    expect(result).toEqual({
      utm_source: null,
      utm_medium: null,
      utm_campaign: null,
      utm_term: null,
      utm_content: null,
      gclid: null,
      landing_page: "/",
      referrer: null,
    });
  });

  it("keeps non-UTM query params in the landing page but not as fields", () => {
    const result = buildFirstTouch({ search: "?ref=producthunt", pathname: "/", referrer: "" });
    expect(result.landing_page).toBe("/?ref=producthunt");
    expect(result.utm_source).toBeNull();
  });
});

/**
 * Browser-flow tests: run the storage wrapper against stubbed window /
 * sessionStorage globals (vitest runs in node).
 */
describe("first-touch storage flow", () => {
  function stubBrowser(opts: { search?: string; pathname?: string; referrer?: string } = {}) {
    const store = new Map<string, string>();
    vi.stubGlobal("window", {
      sessionStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
      },
      location: {
        search: opts.search ?? "",
        pathname: opts.pathname ?? "/",
      },
    });
    vi.stubGlobal("document", { referrer: opts.referrer ?? "" });
    return store;
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("captures once and never overwrites the first touch", () => {
    const store = stubBrowser({ search: "?utm_source=first", pathname: "/landing" });
    captureFirstTouch();

    // Simulate navigating to another UTM-tagged page in the same session.
    (window.location as { search: string; pathname: string }).search = "?utm_source=second";
    (window.location as { search: string; pathname: string }).pathname = "/other";
    captureFirstTouch();

    expect(store.size).toBe(1);
    const payload = getAttributionPayload();
    expect(payload.utm_source).toBe("first");
    expect(payload.landing_page).toBe("/landing?utm_source=first");
    // page_path is submit-time, not first-touch.
    expect(payload.page_path).toBe("/other");
  });

  it("degrades to null attribution when storage throws", () => {
    stubBrowser();
    window.sessionStorage.getItem = () => {
      throw new Error("storage disabled");
    };

    expect(() => captureFirstTouch()).not.toThrow();
    const payload = getAttributionPayload();
    expect(payload.utm_source).toBeNull();
    expect(payload.page_path).toBe("/");
  });

  it("ignores a corrupt stored value", () => {
    const store = stubBrowser();
    store.set("growqr.attribution.v1", "{not json");
    const payload = getAttributionPayload();
    expect(payload.utm_source).toBeNull();
  });

  it("returns all nulls during SSR (no window)", () => {
    expect(getAttributionPayload().page_path).toBeNull();
    expect(() => captureFirstTouch()).not.toThrow();
  });
});
