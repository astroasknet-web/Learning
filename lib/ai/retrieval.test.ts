import { describe, expect, it } from "vitest";
import { allKbArticles, kbCount, retrieveZohoDocs, zohoDocCount } from "@/lib/ai/retrieval";

describe("KB corpus", () => {
  it("loads the Answer Hub snapshot", () => {
    expect(kbCount()).toBeGreaterThan(0);
    expect(allKbArticles()[0]).toHaveProperty("text");
  });

  /**
   * Whole-corpus grounding is only valid to 50 articles (AI_FALLBACK_DESIGN.md
   * §4). kb:export enforces this at export time; this pins it at test time too,
   * so a snapshot committed by another route cannot quietly break the
   * assumption the prompt is built on.
   */
  it("is small enough for whole-corpus grounding", () => {
    expect(kbCount()).toBeLessThanOrEqual(50);
  });
});

describe("Zoho docs retrieval", () => {
  it("loads the docs snapshot", () => {
    expect(zohoDocCount()).toBeGreaterThan(0);
  });

  it("finds a platform page for a platform question", () => {
    const hits = retrieveZohoDocs("how does webhook authentication work");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].title.toLowerCase()).toContain("authentication");
    expect(hits[0].url).toContain("zoho.com");
  });

  it("returns an excerpt, not the whole page", () => {
    const [hit] = retrieveZohoDocs("webhook authentication signature");
    expect(hit.excerpt.length).toBeLessThanOrEqual(1000);
  });

  /**
   * The load-bearing test for this corpus. It documents ZOHO SALESIQ, not
   * GrowQR, so for ordinary visitor questions the correct result is NO MATCH.
   * If these start matching, the threshold is too low and the bot will begin
   * answering GrowQR questions out of Zoho's help pages.
   */
  it.each([
    "does growqr work with greenhouse ats",
    "how much does growqr cost",
    "can growqr help me get a job",
    "is growqr available in germany",
    "what is the rq score",
  ])("returns nothing for the GrowQR question %j", (question) => {
    expect(retrieveZohoDocs(question)).toEqual([]);
  });

  it("returns nothing for an empty query", () => {
    expect(retrieveZohoDocs("")).toEqual([]);
  });

  it("respects the k limit", () => {
    expect(retrieveZohoDocs("webhook bot handler message context", 1).length).toBeLessThanOrEqual(1);
  });
});
