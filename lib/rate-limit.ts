import { NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Rate limiter with two backends:
//
//   - Upstash Redis (distributed) when UPSTASH_REDIS_REST_URL and
//     UPSTASH_REDIS_REST_TOKEN are set. This is the correct backend on Vercel,
//     where every serverless instance would otherwise keep its own counter.
//   - In-memory (per-instance) fallback otherwise, so local dev and any deploy
//     without Upstash configured keeps working exactly as before. The fallback
//     still stops one script hammering one endpoint on a single instance.
//
// Public API is unchanged except that rateLimit() is now async.

type Bucket = { count: number; resetAt: number };

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSec: number };

export type RateLimitOptions = {
  /** Namespace for the bucket, so routes don't share a counter. */
  key: string;
  limit: number;
  windowMs: number;
};

// ── Shared client IP resolution ─────────────────────────────────────────────

function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    // Vercel appends the real client IP as the first hop.
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

// ── Upstash (distributed) backend ───────────────────────────────────────────

const redis = (() => {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
})();

/** True when a distributed store is configured. */
export const usingDistributedRateLimit = redis !== null;

// One Ratelimit instance per (key, limit, window) combination.
const upstashLimiters = new Map<string, Ratelimit>();

function upstashLimiter(opts: RateLimitOptions): Ratelimit | null {
  if (!redis) return null;
  const cacheKey = `${opts.key}:${opts.limit}:${opts.windowMs}`;
  let rl = upstashLimiters.get(cacheKey);
  if (!rl) {
    const windowSec = Math.max(1, Math.ceil(opts.windowMs / 1000));
    rl = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(opts.limit, `${windowSec} s`),
      prefix: `rl:${opts.key}`,
      analytics: false,
    });
    upstashLimiters.set(cacheKey, rl);
  }
  return rl;
}

// ── In-memory (per-instance) fallback backend ───────────────────────────────

const buckets = new Map<string, Bucket>();

// A rotating-IP flood would otherwise grow `buckets` without bound.
const MAX_BUCKETS = 10_000;

function sweep(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  // Map iterates in insertion order, so the oldest keys come off first.
  // Trim to one below the cap: the caller may insert a bucket right after this.
  while (buckets.size >= MAX_BUCKETS) {
    const oldest = buckets.keys().next();
    if (oldest.done) break;
    buckets.delete(oldest.value);
  }
}

function inMemoryRateLimit(req: Request, opts: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const bucketKey = `${opts.key}:${clientIp(req)}`;
  const existing = buckets.get(bucketKey);

  if (!existing || existing.resetAt <= now) {
    buckets.set(bucketKey, { count: 1, resetAt: now + opts.windowMs });
    return { ok: true };
  }

  if (existing.count >= opts.limit) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)) };
  }

  existing.count += 1;
  return { ok: true };
}

// ── Public entry point ──────────────────────────────────────────────────────

export async function rateLimit(req: Request, opts: RateLimitOptions): Promise<RateLimitResult> {
  const rl = upstashLimiter(opts);
  if (rl) {
    try {
      const { success, reset } = await rl.limit(`${opts.key}:${clientIp(req)}`);
      if (success) return { ok: true };
      return { ok: false, retryAfterSec: Math.max(1, Math.ceil((reset - Date.now()) / 1000)) };
    } catch (error) {
      // Never let a rate-limiter outage take a route down: if Redis is briefly
      // unreachable, fall back to the in-memory limiter for this request.
      console.error("Upstash rate limit failed, falling back to in-memory:", error);
      return inMemoryRateLimit(req, opts);
    }
  }
  return inMemoryRateLimit(req, opts);
}

/** Canonical 429 so every rate-limited route answers identically. */
export function rateLimited(retryAfterSec: number) {
  return NextResponse.json(
    { error: "rate_limited", message: "Too many requests. Please try again shortly." },
    { status: 429, headers: { "Retry-After": String(retryAfterSec) } },
  );
}
