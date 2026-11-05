import { describe, it, expect, vi, afterEach } from "vitest";
import {
  parseGrowqrProfileId,
  growqrProfileUrl,
  buildPrefill,
  buildProfileSummary,
  fetchGrowqrProfile,
  type GrowqrProfile,
} from "./growqr-profile";

const ID = "f9adf776-0e2f-481e-9f46-9b2689589559";

describe("parseGrowqrProfileId", () => {
  it("accepts a full profile URL", () => {
    expect(parseGrowqrProfileId(`https://app.growqr.ai/p/${ID}`)).toBe(ID);
  });

  it("accepts a schemeless URL, a query string, and a trailing slash", () => {
    expect(parseGrowqrProfileId(`app.growqr.ai/p/${ID}`)).toBe(ID);
    expect(parseGrowqrProfileId(`https://app.growqr.ai/p/${ID}?utm_source=x`)).toBe(ID);
    expect(parseGrowqrProfileId(`https://app.growqr.ai/p/${ID}/`)).toBe(ID);
  });

  it("accepts a bare id and normalises case", () => {
    expect(parseGrowqrProfileId(ID.toUpperCase())).toBe(ID);
  });

  it("rejects a profile path on another host", () => {
    expect(parseGrowqrProfileId(`https://evil.example.com/p/${ID}`)).toBeNull();
    expect(parseGrowqrProfileId(`https://app.growqr.ai.evil.com/p/${ID}`)).toBeNull();
  });

  it("rejects non-profile paths and malformed ids", () => {
    expect(parseGrowqrProfileId("https://app.growqr.ai/p/not-a-uuid")).toBeNull();
    expect(parseGrowqrProfileId(`https://app.growqr.ai/u/${ID}`)).toBeNull();
    expect(parseGrowqrProfileId("https://www.linkedin.com/in/someone")).toBeNull();
    expect(parseGrowqrProfileId("")).toBeNull();
    expect(parseGrowqrProfileId("   ")).toBeNull();
  });
});

const PROFILE: GrowqrProfile = {
  id: ID,
  first_name: "Alex",
  last_name: "Mate",
  headline: "Senior Software Engineer at Cognizant",
  institution: "University of California",
  q_score: 77.51,
  skills: ["Product Strategy", "SQL", "Figma"],
  education_entries: [
    { institution: "Old College", field_of_study: "Physics", end_date: "2016-05" },
    { institution: "University of California", field_of_study: "Computer Science", end_date: "2020-01" },
  ],
  linkedin_url: "https://www.linkedin.com/in/alex-mate",
  public_email: "alex@growqr.demo",
};

describe("buildPrefill", () => {
  it("maps the six fields that have a profile equivalent", () => {
    expect(buildPrefill(PROFILE)).toEqual({
      fullName: "Alex Mate",
      email: "alex@growqr.demo",
      college: "University of California",
      course: "Computer Science",
      graduationYear: "2020",
      skills: "Product Strategy, SQL, Figma",
      linkedin: "https://www.linkedin.com/in/alex-mate",
    });
  });

  it("picks the most recent education entry, not the first", () => {
    expect(buildPrefill(PROFILE).course).toBe("Computer Science");
  });

  it("drops a linkedin value that isn't an http(s) URL", () => {
    expect(buildPrefill({ ...PROFILE, linkedin_url: "alex-mate" }).linkedin).toBe("");
  });

  it("returns empty strings rather than throwing on a sparse profile", () => {
    expect(buildPrefill({ id: ID })).toEqual({
      fullName: "", email: "", college: "", course: "",
      graduationYear: "", skills: "", linkedin: "",
    });
  });
});

describe("buildProfileSummary", () => {
  it("exposes only the trimmed shape, never the raw profile", () => {
    const summary = buildProfileSummary(PROFILE);
    expect(summary.url).toBe(growqrProfileUrl(ID));
    expect(summary.name).toBe("Alex Mate");
    expect(summary.rqScore).toBe(77.51);
    expect(Object.keys(summary).sort()).toEqual(
      ["avatarUrl", "headline", "id", "name", "prefill", "rqScore", "url"]
    );
  });

  it("nulls a non-numeric q_score", () => {
    expect(buildProfileSummary({ id: ID, q_score: null }).rqScore).toBeNull();
  });
});

/** Rebuilds the way Next.js escapes its flight payload into the HTML. */
function pageWithProfile(profile: unknown, { split = false } = {}) {
  const flight = `5:["$","$L10",null,${JSON.stringify({ profile, profileUrl: "x" })}]`;
  const chunks = split
    ? [flight.slice(0, Math.floor(flight.length / 2)), flight.slice(Math.floor(flight.length / 2))]
    : [flight];

  return chunks
    .map((c) => `<script>self.__next_f.push([1,${JSON.stringify(c)}])</script>`)
    .join("");
}

describe("fetchGrowqrProfile", () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubFetch(status: number, body: string) {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      status,
      ok: status >= 200 && status < 300,
      text: async () => body,
    }));
  }

  it("extracts the profile from the flight payload", async () => {
    stubFetch(200, pageWithProfile(PROFILE));
    const result = await fetchGrowqrProfile(ID);
    expect(result.status).toBe("ok");
    if (result.status === "ok") expect(result.profile.first_name).toBe("Alex");
  });

  it("extracts a profile split across two pushes", async () => {
    stubFetch(200, pageWithProfile(PROFILE, { split: true }));
    const result = await fetchGrowqrProfile(ID);
    expect(result.status).toBe("ok");
  });

  it("survives braces and quotes inside string values", async () => {
    const tricky = { ...PROFILE, summary: 'He said "hi" { not a brace } \\ end' };
    stubFetch(200, pageWithProfile(tricky));
    const result = await fetchGrowqrProfile(ID);
    expect(result.status).toBe("ok");
    if (result.status === "ok") expect(result.profile.summary).toBe(tricky.summary);
  });

  it("reports not_found on a 404", async () => {
    stubFetch(404, "");
    expect((await fetchGrowqrProfile(ID)).status).toBe("not_found");
  });

  it("reports not_found for a malformed id without making a request", async () => {
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);
    expect((await fetchGrowqrProfile("nope")).status).toBe("not_found");
    expect(spy).not.toHaveBeenCalled();
  });

  it("reports unavailable when the id in the payload doesn't match", async () => {
    stubFetch(200, pageWithProfile({ ...PROFILE, id: "00000000-0000-0000-0000-000000000000" }));
    expect((await fetchGrowqrProfile(ID)).status).toBe("unavailable");
  });

  it("reports unavailable when the payload has no profile at all", async () => {
    stubFetch(200, "<html><body>nothing here</body></html>");
    expect((await fetchGrowqrProfile(ID)).status).toBe("unavailable");
  });

  it("reports unavailable when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    expect((await fetchGrowqrProfile(ID)).status).toBe("unavailable");
  });

  // The user-service JSON endpoint is tried first; the page scrape above only
  // runs because these stubs have no `json` method, which is exactly the
  // fall-through the two-source design relies on.
  it("prefers the user-service JSON endpoint and never scrapes the page", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => PROFILE,
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchGrowqrProfile(ID);
    expect(result.status).toBe("ok");
    if (result.status === "ok") expect(result.profile.first_name).toBe("Alex");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/users/public/");
  });

  it("refuses a JSON body whose id is not the one requested", async () => {
    // A mismatched id means we are holding someone else's profile. Falling
    // back to the scrape (which also fails here) is right; returning it is not.
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ ...PROFILE, id: "00000000-0000-0000-0000-000000000000" }),
      text: async () => "",
    }));
    expect((await fetchGrowqrProfile(ID)).status).toBe("unavailable");
  });

  it("falls back to the page scrape when the API answers unusably", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ status: 500, ok: false })
      .mockResolvedValueOnce({ status: 200, ok: true, text: async () => pageWithProfile(PROFILE) });
    vi.stubGlobal("fetch", fetchMock);

    expect((await fetchGrowqrProfile(ID)).status).toBe("ok");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("trusts a 404 from the API without scraping the page", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ status: 404, ok: false });
    vi.stubGlobal("fetch", fetchMock);
    expect((await fetchGrowqrProfile(ID)).status).toBe("not_found");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
