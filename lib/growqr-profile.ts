/**
 * GrowQR public-profile reader.
 *
 * Two sources, tried in order:
 *
 * 1. `GET api.growqr.ai/users/api/v1/users/public/{id}` — the user-service's
 *    public JSON endpoint. Unauthenticated, returns the whole profile
 *    including `q_score`, and is the supported contract.
 * 2. The profile page's React Server Component payload, scraped out of the
 *    HTML. This is what the module originally did, back when every route
 *    under the app's /api/* was behind Clerk middleware and 401'd. It stays
 *    as a fallback because it is already written and tested, and it keeps a
 *    candidate's application working through a user-service outage.
 *
 * A 404 or a good parse from (1) is authoritative and (2) is not attempted.
 * Only "the API did not answer usefully" falls through.
 *
 * Everything downstream — the parsing, the prefill mapping, the snapshot, and
 * every caller — is unaffected by which source answered.
 */

import type { Json } from "@/types/database";

export const GROWQR_APP_URL = (
  process.env.NEXT_PUBLIC_GROWQR_APP_URL || "https://app.growqr.ai"
).replace(/\/+$/, "");

/** Hosts we'll accept a profile link from. */
const ALLOWED_HOSTS = new Set(
  [new URL(GROWQR_APP_URL).host, "app.growqr.ai"].map((h) => h.toLowerCase())
);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * User-service base. Overridable so a staging deploy can point at a staging
 * user-service without touching the app URL, which is a separate host.
 */
const USER_API_BASE = (
  process.env.GROWQR_USER_API_URL || "https://api.growqr.ai/users/api/v1"
).replace(/\/+$/, "");

// Type alias rather than an interface on purpose: aliases get an implicit
// index signature, so a snapshot built from these stays assignable to `Json`.
export type GrowqrEducationEntry = {
  degree?: string | null;
  institution?: string | null;
  field_of_study?: string | null;
  start_date?: string | null;
  end_date?: string | null;
};

export interface GrowqrProfile {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  avatar_url?: string | null;
  headline?: string | null;
  summary?: string | null;
  institution?: string | null;
  location?: string | null;
  country?: string | null;
  target_role?: string | null;
  experience?: string | null;
  q_score?: number | null;
  skills?: string[] | null;
  education_entries?: GrowqrEducationEntry[] | null;
  linkedin_url?: string | null;
  public_email?: string | null;
  plan?: string | null;
  // Present on the JSON endpoint only. The scraped payload predates them, so
  // every consumer treats them as optional regardless of which source answered.
  industry?: string | null;
  job_type?: string | null;
  target_roles?: string[] | null;
  experience_entries?: GrowqrExperienceEntry[] | null;
  projects?: GrowqrProjectEntry[] | null;
  certifications?: GrowqrCertificationEntry[] | null;
  video_resume_url?: string | null;
}

export type GrowqrExperienceEntry = {
  company?: string | null;
  position?: string | null;
  location?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  is_current?: boolean | null;
  description?: string | null;
};

export type GrowqrProjectEntry = {
  name?: string | null;
  url?: string | null;
  description?: string | null;
  start_date?: string | null;
  end_date?: string | null;
};

export type GrowqrCertificationEntry = {
  name?: string | null;
  issuer?: string | null;
  date_obtained?: string | null;
  expiry_date?: string | null;
};

/**
 * Accepts a full profile URL or a bare profile UUID and returns the UUID.
 * Returns null for anything that isn't a GrowQR profile reference, including
 * links to other hosts (so a candidate can't pass off some other site's URL).
 */
export function parseGrowqrProfileId(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  if (UUID_RE.test(raw)) return raw.toLowerCase();

  let url: URL;
  try {
    url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
  } catch {
    return null;
  }

  if (!ALLOWED_HOSTS.has(url.host.toLowerCase())) return null;

  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length < 2 || segments[0] !== "p") return null;

  const id = segments[1];
  return UUID_RE.test(id) ? id.toLowerCase() : null;
}

export function growqrProfileUrl(id: string): string {
  return `${GROWQR_APP_URL}/p/${id}`;
}

/**
 * Walks a JSON object literal from its opening brace to the matching close,
 * respecting quoted strings and escapes. `s[start]` must be `{`.
 */
function sliceJsonObject(s: string, start: number): string | null {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < s.length; i++) {
    const ch = s[i];

    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }

    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }

  return null;
}

/**
 * Next.js streams its RSC payload as a series of
 * `self.__next_f.push([1,"<json-string-literal>"])` calls. Decoding each
 * literal and concatenating gives back the flight text, which is where the
 * profile object lives. Concatenating matters: a single object can be split
 * across two pushes.
 */
function decodeFlightPayload(html: string): string {
  const pushRe = /self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g;
  let out = "";
  let match: RegExpExecArray | null;

  while ((match = pushRe.exec(html)) !== null) {
    try {
      out += JSON.parse(match[1]) as string;
    } catch {
      // A malformed chunk shouldn't discard the ones that did parse.
    }
  }

  return out;
}

function extractProfile(html: string, expectedId: string): GrowqrProfile | null {
  const flight = decodeFlightPayload(html);
  const key = '"profile":';

  let from = 0;
  for (;;) {
    const keyIndex = flight.indexOf(key, from);
    if (keyIndex === -1) return null;
    from = keyIndex + key.length;

    const braceIndex = flight.indexOf("{", keyIndex + key.length);
    if (braceIndex === -1) return null;
    // Only accept a brace that directly follows the key, not one further along
    // belonging to some unrelated value.
    if (flight.slice(keyIndex + key.length, braceIndex).trim() !== "") continue;

    const objectText = sliceJsonObject(flight, braceIndex);
    if (!objectText) continue;

    try {
      const parsed = JSON.parse(objectText) as GrowqrProfile;
      if (typeof parsed?.id === "string" && parsed.id.toLowerCase() === expectedId) {
        return parsed;
      }
    } catch {
      // Not the object we're after; keep scanning.
    }
  }
}

export type FetchProfileResult =
  | { status: "ok"; profile: GrowqrProfile }
  | { status: "not_found" }
  | { status: "unavailable" };

/**
 * Fetches a public profile by id. `not_found` means the profile genuinely
 * doesn't exist (the app 404s on unknown ids), which is a real validation
 * failure. `unavailable` means we couldn't tell, which callers should treat
 * as soft: never block a submission because the app was briefly down.
 */
/**
 * Source 1: the user-service public JSON endpoint.
 *
 * Returns `unavailable` for anything that is not a clean, matching profile,
 * which is the signal to fall through to the page scrape. A 404 is passed
 * through as `not_found` because that IS an answer: the id is not a user.
 */
async function fetchFromUserApi(id: string): Promise<FetchProfileResult> {
  let res: Response;
  try {
    res = await fetch(`${USER_API_BASE}/users/public/${id}`, {
      headers: {
        "user-agent": "GrowQR-Careers/1.0 (+https://www.growqr.ai)",
        accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    return { status: "unavailable" };
  }

  if (res.status === 404) return { status: "not_found" };
  if (!res.ok) return { status: "unavailable" };

  let body: unknown;
  try {
    // `res.json` is not a function under some test doubles, and some edge
    // layers return HTML under a JSON content type, so this is guarded rather
    // than trusted.
    body = await res.json();
  } catch {
    return { status: "unavailable" };
  }

  if (!body || typeof body !== "object") return { status: "unavailable" };
  const profile = body as GrowqrProfile;

  // The endpoint echoes the id it resolved. A mismatch means we are holding
  // someone else's profile, which must never be attached to an application.
  if (typeof profile.id !== "string" || profile.id.toLowerCase() !== id.toLowerCase()) {
    return { status: "unavailable" };
  }

  return { status: "ok", profile };
}

/** Source 2: the profile page's RSC payload. The original implementation. */
async function fetchFromProfilePage(id: string): Promise<FetchProfileResult> {
  let res: Response;
  try {
    res = await fetch(growqrProfileUrl(id), {
      headers: {
        // Without a browser-ish UA some edge layers serve a challenge page.
        "user-agent": "GrowQR-Careers/1.0 (+https://www.growqr.ai)",
        accept: "text/html",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    return { status: "unavailable" };
  }

  if (res.status === 404) return { status: "not_found" };
  if (!res.ok) return { status: "unavailable" };

  let html: string;
  try {
    html = await res.text();
  } catch {
    return { status: "unavailable" };
  }

  const profile = extractProfile(html, id.toLowerCase());
  // The page rendered but we couldn't find the object: almost certainly the
  // app's payload shape changed, which is our problem, not the candidate's.
  return profile ? { status: "ok", profile } : { status: "unavailable" };
}

export async function fetchGrowqrProfile(id: string): Promise<FetchProfileResult> {
  if (!UUID_RE.test(id)) return { status: "not_found" };

  const fromApi = await fetchFromUserApi(id);
  // `ok` and `not_found` are both real answers. Only "no usable response" is
  // worth spending a second request on.
  if (fromApi.status !== "unavailable") return fromApi;

  return fetchFromProfilePage(id);
}

export interface GrowqrPrefill {
  fullName: string;
  email: string;
  college: string;
  course: string;
  graduationYear: string;
  skills: string;
  linkedin: string;
}

/** Pulls the newest education entry, falling back to the first one present. */
function primaryEducation(profile: GrowqrProfile): GrowqrEducationEntry | null {
  const entries = (profile.education_entries ?? []).filter(Boolean);
  if (!entries.length) return null;

  return [...entries].sort((a, b) => {
    const aEnd = (a.end_date ?? "").toString();
    const bEnd = (b.end_date ?? "").toString();
    return bEnd.localeCompare(aEnd);
  })[0];
}

/**
 * Maps profile fields onto form fields. Only the six that map cleanly are
 * here. Phone, Aadhaar, address, availability and the written answers have no
 * profile equivalent and stay manual by design.
 */
export function buildPrefill(profile: GrowqrProfile): GrowqrPrefill {
  const education = primaryEducation(profile);

  const fullName = [profile.first_name, profile.last_name]
    .map((part) => (part ?? "").trim())
    .filter(Boolean)
    .join(" ");

  const gradYearMatch = (education?.end_date ?? "").toString().match(/\d{4}/);

  const linkedin = (profile.linkedin_url ?? "").trim();

  return {
    fullName: fullName.slice(0, 200),
    email: (profile.public_email ?? "").trim().slice(0, 254),
    college: (profile.institution || education?.institution || "").trim().slice(0, 300),
    course: (education?.field_of_study ?? "").trim().slice(0, 200),
    graduationYear: gradYearMatch ? gradYearMatch[0] : "",
    skills: (profile.skills ?? []).filter(Boolean).join(", ").slice(0, 500),
    linkedin: /^https?:\/\//i.test(linkedin) ? linkedin.slice(0, 500) : "",
  };
}

/** The trimmed shape we hand to the browser. Never the raw profile. */
export interface GrowqrProfileSummary {
  id: string;
  url: string;
  name: string;
  headline: string;
  avatarUrl: string;
  rqScore: number | null;
  prefill: GrowqrPrefill;
}

export function buildProfileSummary(profile: GrowqrProfile): GrowqrProfileSummary {
  const prefill = buildPrefill(profile);

  return {
    id: profile.id,
    url: growqrProfileUrl(profile.id),
    name: prefill.fullName,
    headline: (profile.headline ?? "").trim().slice(0, 300),
    avatarUrl: (profile.avatar_url ?? "").trim(),
    rqScore: typeof profile.q_score === "number" ? profile.q_score : null,
    prefill,
  };
}

/**
 * The subset stored as `growqr_profile_snapshot`. Immutable once written: it
 * answers "what did this candidate look like when they applied", which the
 * live profile can no longer answer once they edit it.
 */
export function buildProfileSnapshot(profile: GrowqrProfile): Json {
  return {
    captured_at: new Date().toISOString(),
    id: profile.id,
    first_name: profile.first_name ?? null,
    last_name: profile.last_name ?? null,
    avatar_url: profile.avatar_url ?? null,
    headline: profile.headline ?? null,
    summary: profile.summary ?? null,
    institution: profile.institution ?? null,
    location: profile.location ?? null,
    country: profile.country ?? null,
    target_role: profile.target_role ?? null,
    experience: profile.experience ?? null,
    q_score: profile.q_score ?? null,
    skills: profile.skills ?? [],
    education_entries: profile.education_entries ?? [],
    linkedin_url: profile.linkedin_url ?? null,
    public_email: profile.public_email ?? null,
    plan: profile.plan ?? null,
  };
}

/**
 * The stored snapshot, read back. Every field is optional because the shape
 * is whatever `buildProfileSnapshot` wrote at the time the row was inserted,
 * and older rows predate later additions.
 */
export type GrowqrProfileSnapshot = {
  captured_at?: string | null;
  id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  avatar_url?: string | null;
  headline?: string | null;
  summary?: string | null;
  institution?: string | null;
  location?: string | null;
  country?: string | null;
  target_role?: string | null;
  experience?: string | null;
  q_score?: number | null;
  skills?: string[] | null;
  education_entries?: GrowqrEducationEntry[] | null;
  linkedin_url?: string | null;
  public_email?: string | null;
  plan?: string | null;
};

/** Narrows a `jsonb` column to the snapshot shape, or null if it isn't one. */
export function readProfileSnapshot(value: unknown): GrowqrProfileSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as GrowqrProfileSnapshot;
}

/** "Bachelor of Science, Computer Science, University of California (2016 to 2020)" */
export function formatEducationEntry(entry: GrowqrEducationEntry): string {
  const head = [entry.degree, entry.field_of_study, entry.institution]
    .map((part) => (part ?? "").trim())
    .filter(Boolean)
    .join(", ");

  const from = (entry.start_date ?? "").toString().match(/\d{4}/)?.[0];
  const to = (entry.end_date ?? "").toString().match(/\d{4}/)?.[0];
  const span = from && to ? `${from} to ${to}` : from || to || "";

  return span ? `${head} (${span})` : head;
}
