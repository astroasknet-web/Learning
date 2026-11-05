import { describe, it, expect } from "vitest";
import { rateLimit } from "./rate-limit";

// These exercise the in-memory fallback: the test env has no Upstash vars set,
// so rateLimit() uses the per-instance limiter.

function reqFrom(ip: string): Request {
  return new Request("https://example.test/", { headers: { "x-forwarded-for": ip } });
}

describe("rateLimit (in-memory fallback)", () => {
  it("allows up to `limit` requests then blocks with a positive retry-after", async () => {
    const opts = { key: "test-allow-then-block", limit: 3, windowMs: 60_000 };
    const req = reqFrom("1.1.1.1");
    expect((await rateLimit(req, opts)).ok).toBe(true);
    expect((await rateLimit(req, opts)).ok).toBe(true);
    expect((await rateLimit(req, opts)).ok).toBe(true);
    const blocked = await rateLimit(req, opts);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("counts each client IP independently", async () => {
    const opts = { key: "test-per-ip", limit: 1, windowMs: 60_000 };
    expect((await rateLimit(reqFrom("2.2.2.2"), opts)).ok).toBe(true);
    expect((await rateLimit(reqFrom("2.2.2.2"), opts)).ok).toBe(false);
    // A different IP has its own fresh bucket.
    expect((await rateLimit(reqFrom("3.3.3.3"), opts)).ok).toBe(true);
  });

  it("keeps separate namespaces per key", async () => {
    const a = { key: "test-ns-a", limit: 1, windowMs: 60_000 };
    const b = { key: "test-ns-b", limit: 1, windowMs: 60_000 };
    const req = reqFrom("4.4.4.4");
    expect((await rateLimit(req, a)).ok).toBe(true);
    // Same IP, different key → not blocked by the first key's bucket.
    expect((await rateLimit(req, b)).ok).toBe(true);
  });
});
