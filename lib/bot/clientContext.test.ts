import { describe, expect, it } from "vitest";
import { solutionFromPath } from "./clientContext";

describe("solutionFromPath", () => {
  it.each([
    ["/solutions/students", "students", "Student"],
    ["/solutions/professionals", "professionals", "Professional"],
    ["/solutions/freelancers", "freelancers", "Professional"],
    ["/solutions/coaches", "coaches", "Professional"],
    ["/solutions/consultants", "consultants", "Professional"],
    ["/solutions/institutes", "institutes", "Institute"],
    ["/solutions/recruiters", "recruiters", "Recruiter"],
    ["/solutions/enterprises", "enterprises", "Enterprise"],
    ["/solutions/startups", "startups", "Enterprise"],
  ])("maps %s -> solution=%s audience=%s", (path, solution, audience) => {
    expect(solutionFromPath(path)).toEqual({ solution, audience });
  });

  it.each([
    "/enterprise",
    "/enterprise/ai-recruiter",
    "/enterprise/attrition-predictor",
    "/enterprise/brand-builder",
    "/enterprise/capability-builder",
    "/enterprise/interviewer",
    "/enterprise/onboarding-co-pilot",
    "/enterprise/opportunity-finder",
    "/enterprise/outsourcing-manager",
    "/enterprise/workforce-analyst",
  ])("maps every /enterprise/* page to Enterprise: %s", (path) => {
    expect(solutionFromPath(path)).toEqual({ solution: "enterprises", audience: "Enterprise" });
  });

  /**
   * The agents directory (components/agents/directory/AgentsDirectory.tsx)
   * has an Individual/Business toggle that used to be invisible client-only
   * React state — the chatbot's website context is built purely from the
   * URL, so a visitor who switched to Business on /agents was
   * indistinguishable from one viewing individual agents (wrong pricing
   * answer, no Enterprise tag on any resulting lead). Fixed by making the
   * toggle write an explicit ?mode=enterprise/?mode=individual query param
   * on the same route, which this function now reads.
   */
  it("maps /agents?mode=enterprise to Enterprise", () => {
    expect(solutionFromPath("/agents?mode=enterprise")).toEqual({ solution: "enterprises", audience: "Enterprise" });
  });

  it("does not guess an audience for /agents in individual mode (explicit or bare) or other unmapped pages", () => {
    for (const path of ["/agents", "/agents?mode=individual", "/", "/experts", "/about"]) {
      expect(solutionFromPath(path)).toEqual({ solution: null, audience: null });
    }
  });

  /**
   * Someone exploring a personal AI agent (ai-resume-expert, ai-interviewer,
   * …) is the same B2C visitor as one on /solutions/professionals — just a
   * different page family for the same audience. Reuses the "professionals"
   * bucket rather than a new one.
   */
  it.each([
    "/ai-brand-builder",
    "/ai-interviewer",
    "/ai-learning-curator",
    "/ai-opportunity-finder",
    "/ai-resume-expert",
    "/ai-roleplay-coach",
    "/ai-skill-trainer",
  ])("maps every individual agent page to Professional: %s", (path) => {
    expect(solutionFromPath(path)).toEqual({ solution: "professionals", audience: "Professional" });
  });

  it("does not treat an arbitrary mode value or an unrelated query param on /agents as enterprise", () => {
    expect(solutionFromPath("/agents?mode=business")).toEqual({ solution: null, audience: null });
    expect(solutionFromPath("/agents?utm_source=linkedin")).toEqual({ solution: null, audience: null });
  });

  it("ignores a stray query string on pages that already resolve from the path alone", () => {
    expect(solutionFromPath("/solutions/recruiters?utm_source=linkedin")).toEqual({
      solution: "recruiters",
      audience: "Recruiter",
    });
  });
});
