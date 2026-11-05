import { describe, it, expect } from "vitest";
import { serializeJsonLd } from "./json-ld";

describe("serializeJsonLd", () => {
  it("escapes </script> so a bio/title cannot break out of the tag", () => {
    const out = serializeJsonLd({
      description: "</script><script>alert(document.cookie)</script>",
    });
    expect(out).not.toContain("</script>");
    expect(out).not.toContain("<script>");
    expect(out).toContain("\\u003c");
    // Still round-trips to the original value — search engines see it unchanged.
    expect(JSON.parse(out).description).toBe(
      "</script><script>alert(document.cookie)</script>",
    );
  });

  it("escapes angle brackets and ampersands", () => {
    const out = serializeJsonLd({ a: "<", b: ">", c: "&" });
    expect(out).not.toMatch(/[<>&]/);
    expect(JSON.parse(out)).toEqual({ a: "<", b: ">", c: "&" });
  });

  it("escapes U+2028 and U+2029 line separators", () => {
    const out = serializeJsonLd({ x: "a b c" });
    expect(out).toContain("\\u2028");
    expect(out).toContain("\\u2029");
    expect(JSON.parse(out).x).toBe("a b c");
  });

  it("leaves ordinary structured data semantically unchanged", () => {
    const data = {
      "@context": "https://schema.org",
      "@type": "Person",
      name: "Jane Doe",
      description: "Career coach & mentor",
    };
    expect(JSON.parse(serializeJsonLd(data))).toEqual(data);
  });
});
