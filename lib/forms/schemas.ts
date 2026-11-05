import { z } from "zod";
import { formatPersonName } from "@/lib/format-person-name";

/**
 * Validation for the four lead-capture forms.
 *
 * Each form has a zod schema for the raw request shape plus a `parseX`
 * function that applies the form's legacy validation rules and returns
 * either normalized data or the exact error message + status the route
 * has always produced — the route contracts are load-bearing (frontends
 * and tests match on them), so messages live here, not in the pipeline.
 */

/** Single source of truth for the email format check (was duplicated 4×). */
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── Attribution (optional `attribution` key on every form body) ─────────────

/**
 * First-touch marketing attribution captured client-side by
 * lib/attribution.ts and persisted alongside CRM-eligible submissions.
 * Every field is nullable: attribution is best-effort context and must
 * never affect whether a submission succeeds.
 */
export interface AttributionPayload {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  gclid: string | null;
  landing_page: string | null;
  referrer: string | null;
  page_path: string | null;
}

/** Abuse guard: UTM values have no business being longer than this. */
const MAX_PARAM_LENGTH = 200;
/** URLs (landing page, referrer, path) get a little more headroom. */
const MAX_URL_LENGTH = 500;

const attributionField = z.string().optional().nullable();

/** Allowlist: unknown keys in the attribution object are dropped by zod. */
const attributionRawSchema = z.object({
  utm_source: attributionField,
  utm_medium: attributionField,
  utm_campaign: attributionField,
  utm_term: attributionField,
  utm_content: attributionField,
  gclid: attributionField,
  landing_page: attributionField,
  referrer: attributionField,
  page_path: attributionField,
});

const EMPTY_ATTRIBUTION: AttributionPayload = {
  utm_source: null,
  utm_medium: null,
  utm_campaign: null,
  utm_term: null,
  utm_content: null,
  gclid: null,
  landing_page: null,
  referrer: null,
  page_path: null,
};

const capParam = (value: string | null | undefined, max: number): string | null => {
  const trimmed = value?.trim().slice(0, max);
  return trimmed ? trimmed : null;
};

/**
 * Sanitize a request's attribution object. Never throws and never rejects
 * the submission: anything malformed simply collapses to nulls, because a
 * user's message matters more than our marketing metadata.
 */
export function sanitizeAttribution(value: unknown): AttributionPayload {
  const raw = attributionRawSchema.safeParse(value);
  if (!raw.success) return { ...EMPTY_ATTRIBUTION };

  return {
    utm_source: capParam(raw.data.utm_source, MAX_PARAM_LENGTH),
    utm_medium: capParam(raw.data.utm_medium, MAX_PARAM_LENGTH),
    utm_campaign: capParam(raw.data.utm_campaign, MAX_PARAM_LENGTH),
    utm_term: capParam(raw.data.utm_term, MAX_PARAM_LENGTH),
    utm_content: capParam(raw.data.utm_content, MAX_PARAM_LENGTH),
    gclid: capParam(raw.data.gclid, MAX_PARAM_LENGTH),
    landing_page: capParam(raw.data.landing_page, MAX_URL_LENGTH),
    referrer: capParam(raw.data.referrer, MAX_URL_LENGTH),
    page_path: capParam(raw.data.page_path, MAX_URL_LENGTH),
  };
}

export type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number };

const fail = (error: string, status = 400): { ok: false; error: string; status: number } => ({
  ok: false,
  error,
  status,
});

/**
 * Raw bodies: shape/type checks only — content rules live in the parsers.
 * nullish, not optional: the forms send `field: null` for values they don't
 * have (e.g. the enterprise modal's `agent: agent ?? null`), and the legacy
 * routes accepted that. `.optional()` alone rejects null and 400s the whole
 * submission — a real regression caught in the Phase 5 live drill.
 */
const optionalString = z.string().nullish();

// ── Contact (/api/send-contact) ─────────────────────────────────────────────

const contactRawSchema = z.object({
  name: optionalString,
  email: optionalString,
  subject: optionalString,
  message: optionalString,
  type: optionalString,
  token: optionalString,
});

export interface ContactSubmission {
  name: string;
  email: string;
  subject: string;
  message: string;
  type: "general" | "sales";
  token?: string;
}

export function parseContact(body: unknown): ParseResult<ContactSubmission> {
  const raw = contactRawSchema.safeParse(body);
  if (!raw.success) return fail("Missing required fields");
  const { name, email, subject, message, type, token } = raw.data;

  if (!name || !email || !message) return fail("Missing required fields");

  const normalizedEmail = email.trim();
  if (!EMAIL_REGEX.test(normalizedEmail)) return fail("Invalid email format");

  return {
    ok: true,
    data: {
      name: formatPersonName(name),
      email: normalizedEmail,
      subject: (subject || "General Inquiry").trim(),
      message: message.trim(),
      type: type === "sales" ? "sales" : "general",
      token: token ?? undefined,
    },
  };
}

// ── B2B lead (/api/b2b-lead) ────────────────────────────────────────────────

const b2bLeadRawSchema = z.object({
  name: optionalString,
  email: optionalString,
  company: optionalString,
  teamSize: optionalString,
  message: optionalString,
  agent: optionalString,
  solution: optionalString,
  source: optionalString,
  token: optionalString,
});

export interface B2bLeadSubmission {
  name: string;
  email: string;
  company: string;
  teamSize: string | null;
  message: string | null;
  agent: string | null;
  solution: string | null;
  source: string | null;
  token?: string;
}

/** Trim an optional field; empty strings collapse to null (legacy contract). */
const trimToNull = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

export function parseB2bLead(body: unknown): ParseResult<B2bLeadSubmission> {
  const raw = b2bLeadRawSchema.safeParse(body);
  if (!raw.success) return fail("Missing required fields");

  const name = raw.data.name?.trim() ?? "";
  const email = raw.data.email?.trim() ?? "";
  const company = raw.data.company?.trim() ?? "";

  if (!name || !email || !company) return fail("Missing required fields");
  if (!EMAIL_REGEX.test(email)) return fail("Invalid email format");

  return {
    ok: true,
    data: {
      name,
      email,
      company,
      teamSize: trimToNull(raw.data.teamSize),
      message: trimToNull(raw.data.message),
      agent: trimToNull(raw.data.agent),
      solution: trimToNull(raw.data.solution),
      source: trimToNull(raw.data.source),
      token: raw.data.token ?? undefined,
    },
  };
}

// ── Seeker waitlist (/api/seeker-waitlist) ──────────────────────────────────

const seekerWaitlistRawSchema = z.object({
  email: optionalString,
  source: optionalString,
  token: optionalString,
});

export interface SeekerWaitlistSubmission {
  email: string;
  source: string | null;
  token?: string;
}

export function parseSeekerWaitlist(body: unknown): ParseResult<SeekerWaitlistSubmission> {
  const raw = seekerWaitlistRawSchema.safeParse(body);
  if (!raw.success) return fail("Email is required.");
  const { email, source, token } = raw.data;

  if (!email) return fail("Email is required.");

  const normalized = email.trim().toLowerCase();
  if (!EMAIL_REGEX.test(normalized)) return fail("Enter a valid email address.");

  return { ok: true, data: { email: normalized, source: source ?? null, token: token ?? undefined } };
}

// ── Newsletter (/api/send-newsletter-subscribe) ─────────────────────────────

const newsletterRawSchema = z.object({
  email: optionalString,
  name: optionalString,
  source: optionalString,
  token: optionalString,
});

export interface NewsletterSubmission {
  email: string;
  name: string | null;
  source: string;
  token?: string;
}

export function parseNewsletter(body: unknown): ParseResult<NewsletterSubmission> {
  const raw = newsletterRawSchema.safeParse(body);
  if (!raw.success) return fail("Email is required");
  const { email, name, source, token } = raw.data;

  if (!email) return fail("Email is required");

  const normalized = email.trim().toLowerCase();
  if (!EMAIL_REGEX.test(normalized)) return fail("Invalid email format");

  return {
    ok: true,
    data: {
      email: normalized,
      name: trimToNull(name),
      source: source?.trim().slice(0, 100) || "website",
      token: token ?? undefined,
    },
  };
}
