import { describe, expect, it } from "vitest";
import { blocksDemo } from "./demo";

describe("read-only demo accounts", () => {
  it("lets pages be read", () => {
    for (const p of ["/console", "/console/payments", "/crm/leads", "/admin/registrations", "/support/tickets"]) {
      expect(blocksDemo("GET", p)).toBe(false);
      expect(blocksDemo("head", p)).toBe(false);
    }
  });
  it("blocks anything that changes data, including every server action (a POST)", () => {
    for (const m of ["POST", "PUT", "PATCH", "DELETE", "post"]) expect(blocksDemo(m, "/console")).toBe(true);
  });
  it("blocks bulk downloads even though they are GET requests", () => {
    for (const p of ["/abroad/export", "/crm/reports/csv", "/api/admin/applications/export", "/api/v1/admin/export", "/teacher/class/5/csv", "/api/admin/registrations/9/export"]) expect(blocksDemo("GET", p)).toBe(true);
  });
  it("does not block pages that merely contain the word", () => {
    expect(blocksDemo("GET", "/exports-policy")).toBe(false);
    expect(blocksDemo("GET", "/blog/csv-tips")).toBe(false);
  });
});
