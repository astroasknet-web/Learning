import { describe, expect, it } from "vitest";
import { chunkText, DEFAULTS, parseSettings, pickVoice } from "./read-aloud";

describe("read-aloud helpers", () => {
  it("keeps short text whole and splits long text under the limit", () => {
    expect(chunkText("  Hello   world. ")).toEqual(["Hello world."]);
    const long = Array.from({ length: 40 }, (_, i) => `Sentence number ${i} is here.`).join(" ");
    const chunks = chunkText(long, 100);
    expect(chunks.length).toBeGreaterThan(5);
    expect(chunks.every((c) => c.length <= 100)).toBe(true);
    expect(chunks.join(" ")).toBe(long);
  });
  it("splits one huge unbroken sentence at spaces", () => {
    const chunks = chunkText("word ".repeat(200).trim(), 50);
    expect(chunks.every((c) => c.length <= 50)).toBe(true);
    expect(chunkText("")).toEqual([]);
  });
  it("parses saved settings defensively", () => {
    expect(parseSettings(null)).toEqual(DEFAULTS);
    expect(parseSettings("{not json")).toEqual(DEFAULTS);
    expect(parseSettings(JSON.stringify({ fontscale: 99, rate: 7, contrast: "yes", dyslexia: true }))).toEqual({ ...DEFAULTS, fontscale: 3, dyslexia: true });
    expect(parseSettings(JSON.stringify({ rate: 1.5, voice: "Ravi" }))).toMatchObject({ rate: 1.5, voice: "Ravi" });
  });
  it("prefers the saved voice, then Indian English, then any English", () => {
    const v = [{ name: "A", lang: "en-US" }, { name: "B", lang: "en_IN" }, { name: "C", lang: "hi-IN" }];
    expect(pickVoice(v, "A")?.name).toBe("A");
    expect(pickVoice(v, "")?.name).toBe("B");
    expect(pickVoice([v[0], v[2]], "")?.name).toBe("A");
    expect(pickVoice([v[2]], "")).toBeNull();
    expect(pickVoice([], "")).toBeNull();
  });
});
