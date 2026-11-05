import { after, NextRequest, NextResponse } from "next/server";
import { rateLimit, rateLimited } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";
import { isDatabaseConfigured } from "@/lib/data/server";
import { createLogger } from "@/lib/log";
import { sanitizeAttribution, type AttributionPayload, type ParseResult } from "@/lib/forms/schemas";
import { syncLeadToZoho } from "@/lib/crm/sync";
import type { CrmSourceKey } from "@/lib/crm/sources";

/**
 * Shared pipeline for the lead-capture API routes:
 *
 *   rate limit → parse/validate → Turnstile → persist (fail closed)
 *   → best-effort side effects (emails) → success response
 *
 * Every form follows this exact sequence so cross-cutting concerns
 * (attribution capture, CRM sync hooks) land here once instead of in
 * each route. Route-specific behaviour — validation messages, insert
 * logic, duplicate handling, emails — stays in the route via config.
 */
/**
 * Request context the pipeline derives for every submission, independent of
 * the user-entered fields. Persist callbacks that store CRM attribution read
 * it as their second argument; routes that don't need it just ignore it.
 */
export interface SubmissionMeta {
  /**
   * ISO-3166 alpha-2 country, read server-side from Vercel's geo header —
   * server truth, never spoofable form data. Same precedence as
   * lib/currency.server.ts: FORCE_COUNTRY (local pin) → x-vercel-ip-country
   * → x-country (manual override for testing). Null when undetectable.
   */
  countryCode: string | null;
  /** Sanitized first-touch attribution from the optional `attribution` body key. */
  attribution: AttributionPayload;
}

/** Successful persist result carrying the new row's id for CRM sync. */
export interface PersistedRow {
  crmRowId: string | number;
}

const COUNTRY_CODE_REGEX = /^[A-Z]{2}$/;

function countryFromRequest(req: NextRequest): string | null {
  const raw =
    process.env.FORCE_COUNTRY ??
    req.headers.get("x-vercel-ip-country") ??
    req.headers.get("x-country");
  const code = raw?.trim().toUpperCase() ?? "";
  return COUNTRY_CODE_REGEX.test(code) ? code : null;
}

export interface FormRouteConfig<T extends { token?: string }> {
  /** Rate-limit bucket + log scope. MUST keep the route's historical key. */
  key: string;
  turnstile: {
    /** Label used in Turnstile verification logs. */
    label: string;
    /** Exact 403 message this route has always returned. */
    errorMessage: string;
  };
  /**
   * Optional sign-in gate, run before anything else is read. Return a NextResponse to stop (for example a 401), or the body to use
   * (for example with the name and email replaced by the signed-in member's own).
   */
  gate?: (req: NextRequest, body: unknown) => Promise<NextResponse | { body: unknown }>;
  /** Optional replacement for the Cloudflare Turnstile check (for example the portal's picture code). Return false to refuse with the 403 message. */
  humanCheck?: (body: unknown) => Promise<boolean>;
  /** Validate and normalize the JSON body (see lib/forms/schemas.ts). */
  parse: (body: unknown) => ParseResult<T>;
  /**
   * Persist the submission. Fail closed: return a NextResponse (e.g. 409
   * duplicate, 500 insert error) to stop the pipeline. On success return
   * null, or the new row's id when the route participates in CRM sync.
   */
  persist: (data: T, meta: SubmissionMeta) => Promise<NextResponse | PersistedRow | null>;
  /**
   * CRM sync source for this route (lib/crm/sources.ts). When set and persist
   * returned a row id, the row is synced post-response via next/server after()
   * — the fast path; the reconciliation cron is the durability layer. The
   * CRM_SYNC_ENABLED kill switch is enforced inside the sync engine.
   */
  crmSource?: CrmSourceKey;
  /** Post-persistence effects (emails). Failures are logged, never fatal. */
  sideEffects?: (data: T) => Array<Promise<unknown>>;
  /** Exact body returned on success. */
  successBody: Record<string, unknown>;
  /** Exact 500 message for unexpected errors. */
  failureMessage: string;
}

export function createFormRoute<T extends { token?: string }>(config: FormRouteConfig<T>) {
  const log = createLogger(config.key);

  return async function POST(req: NextRequest): Promise<NextResponse> {
    const limit = await rateLimit(req, { key: config.key, limit: 5, windowMs: 10 * 60_000 });
    if (!limit.ok) return rateLimited(limit.retryAfterSec);

    try {
      let body: unknown = await req.json().catch(() => ({}));
      if (config.gate) {
        const g = await config.gate(req, body);
        if (g instanceof NextResponse) return g;
        body = g.body;
      }

      const parsed = config.parse(body);
      if (!parsed.ok) {
        return NextResponse.json({ error: parsed.error }, { status: parsed.status });
      }

      // Demo mode: with no database configured (e.g. a preview deployment)
      // there is nowhere to persist and no Turnstile secret to verify against,
      // so accept the validated submission and return the normal success
      // response without storing or emailing. Reactivates fully once the keys
      // are set — no code change.
      if (!isDatabaseConfigured()) {
        log.info("demo mode (no database): submission accepted without persistence");
        return NextResponse.json(config.successBody);
      }

      const human = config.humanCheck ? await config.humanCheck(body) : await verifyTurnstile(parsed.data.token, config.turnstile.label);
      if (!human) {
        return NextResponse.json({ error: config.turnstile.errorMessage }, { status: 403 });
      }

      const meta: SubmissionMeta = {
        countryCode: countryFromRequest(req),
        attribution: sanitizeAttribution((body as { attribution?: unknown })?.attribution),
      };

      const persisted = await config.persist(parsed.data, meta);
      if (persisted instanceof NextResponse) return persisted;

      if (config.sideEffects) {
        // Building the promises can throw too (e.g. getResend() without an
        // API key) — a persisted submission must never surface as a failure.
        try {
          const results = await Promise.allSettled(config.sideEffects(parsed.data));
          for (const result of results) {
            if (result.status === "rejected") log.error("side effect failed:", result.reason);
          }
        } catch (error) {
          log.error("side effects failed:", error);
        }
      }

      if (config.crmSource && persisted) {
        const { crmSource } = config;
        const { crmRowId } = persisted;
        // Post-response fast path. Best-effort by design: a cold shutdown
        // mid-sync leaves the row 'pending'/'syncing' for the cron to drain.
        after(async () => {
          try {
            await syncLeadToZoho(crmSource, crmRowId);
          } catch (error) {
            log.error("crm sync hook failed:", error);
          }
        });
      }

      return NextResponse.json(config.successBody);
    } catch (error) {
      // Log the detail; never hand internals to the caller.
      log.error("unexpected error:", error);
      return NextResponse.json({ error: config.failureMessage }, { status: 500 });
    }
  };
}
