import { createLogger } from "@/lib/log";

/**
 * Minimal Zoho CRM API client (self-client OAuth, .in data centre).
 *
 * The only file in lib/crm/ that talks HTTP: token refresh, auth headers and
 * error classification live here so everything above it stays pure. Access
 * tokens are cached in-memory per serverless instance (~1h TTL, refreshed 60s
 * early); a 401 forces one refresh + retry, because instances can outlive a
 * token revocation.
 */

const log = createLogger("zoho-client");

interface ZohoEnv {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  accountsBase: string;
  apiBase: string;
}

function zohoEnv(): ZohoEnv {
  const {
    ZOHO_CLIENT_ID: clientId,
    ZOHO_CLIENT_SECRET: clientSecret,
    ZOHO_REFRESH_TOKEN: refreshToken,
    ZOHO_ACCOUNTS_BASE: accountsBase,
    ZOHO_API_BASE: apiBase,
  } = process.env;
  if (!clientId || !clientSecret || !refreshToken || !accountsBase || !apiBase) {
    // Permanent: retrying cannot conjure missing configuration.
    throw new ZohoApiError("Zoho env vars are not configured", { retryable: false });
  }
  return { clientId, clientSecret, refreshToken, accountsBase, apiBase };
}

/**
 * Every failure surfaces as a ZohoApiError. `retryable` drives the sync
 * queue: retryable rows go back to 'failed' for the cron to retry; permanent
 * ones do too, but the distinction is logged for ops triage.
 */
export class ZohoApiError extends Error {
  readonly retryable: boolean;
  readonly status?: number;
  readonly code?: string;

  constructor(
    message: string,
    opts: { retryable: boolean; status?: number; code?: string; cause?: unknown },
  ) {
    super(message, { cause: opts.cause });
    this.name = "ZohoApiError";
    this.retryable = opts.retryable;
    this.status = opts.status;
    this.code = opts.code;
  }
}

/** 429 and 5xx are transient; everything else 4xx is a permanent request bug. */
const retryableStatus = (status: number): boolean => status === 429 || status >= 500;

let cachedToken: { value: string; expiresAt: number } | null = null;

/** Test hook: clears the module-level token cache. */
export function resetZohoTokenCache(): void {
  cachedToken = null;
}

async function getAccessToken(force = false): Promise<string> {
  if (!force && cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.value;
  }

  const env = zohoEnv();
  let res: Response;
  try {
    res = await fetch(`${env.accountsBase}/oauth/v2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: env.clientId,
        client_secret: env.clientSecret,
        refresh_token: env.refreshToken,
      }),
    });
  } catch (cause) {
    throw new ZohoApiError("Zoho token request failed (network)", { retryable: true, cause });
  }

  if (!res.ok) {
    throw new ZohoApiError(`Zoho token endpoint returned ${res.status}`, {
      retryable: retryableStatus(res.status),
      status: res.status,
    });
  }

  // Zoho returns HTTP 200 with an `error` body for a bad/revoked refresh
  // token — that is a permanent credential failure, not a retry candidate.
  const body = (await res.json()) as { access_token?: string; expires_in?: number; error?: string };
  if (!body.access_token) {
    throw new ZohoApiError(`Zoho token refresh rejected: ${body.error ?? "no access_token"}`, {
      retryable: false,
      code: body.error,
    });
  }

  const ttlMs = (body.expires_in ?? 3600) * 1000;
  cachedToken = { value: body.access_token, expiresAt: Date.now() + ttlMs - 60_000 };
  return body.access_token;
}

async function zohoFetch(path: string, init: RequestInit): Promise<Response> {
  const env = zohoEnv();
  const request = async (token: string) => {
    try {
      return await fetch(`${env.apiBase}${path}`, {
        ...init,
        headers: { ...init.headers, Authorization: `Zoho-oauthtoken ${token}` },
      });
    } catch (cause) {
      throw new ZohoApiError("Zoho API request failed (network)", { retryable: true, cause });
    }
  };

  let res = await request(await getAccessToken());
  if (res.status === 401) {
    // Cached token revoked or expired early — refresh once and retry.
    log.warn("401 from Zoho API, refreshing access token");
    res = await request(await getAccessToken(true));
  }
  return res;
}

export interface ZohoUpsertResult {
  /** Zoho record id — written back to the row as zoho_lead_id. */
  id: string;
  /** Whether the upsert created a new Lead or updated an existing one. */
  action: "insert" | "update";
}

interface ZohoRecordResponse {
  data?: Array<{
    code?: string;
    status?: string;
    action?: string;
    message?: string;
    details?: { id?: string; [key: string]: unknown };
  }>;
}

/**
 * Upsert one Lead keyed on Email. REQUIRED semantics (not a preference): a
 * retry after a lost write-back must land on the same Lead, and repeat
 * submissions from one person must update their Lead instead of duplicating.
 */
export async function upsertLead(record: Record<string, unknown>): Promise<ZohoUpsertResult> {
  const res = await zohoFetch("/crm/v8/Leads/upsert", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: [record], duplicate_check_fields: ["Email"] }),
  });

  if (!res.ok) {
    throw new ZohoApiError(`Zoho upsert returned ${res.status}`, {
      retryable: retryableStatus(res.status),
      status: res.status,
    });
  }

  const body = (await res.json()) as ZohoRecordResponse;
  const result = body.data?.[0];
  if (result?.code !== "SUCCESS" || !result.details?.id) {
    // Per-record rejection (INVALID_DATA, MANDATORY_NOT_FOUND, bad picklist
    // value…) arrives inside an HTTP 2xx — a permanent payload bug.
    throw new ZohoApiError(`Zoho rejected the record: ${result?.message ?? "unknown"}`, {
      retryable: false,
      code: result?.code,
    });
  }

  return {
    id: String(result.details.id),
    action: result.action === "update" ? "update" : "insert",
  };
}

export interface ZohoFieldMeta {
  api_name: string;
  data_type?: string;
  pick_list_values?: Array<{ display_value?: string }>;
}

/**
 * Lead-module field metadata (settings.fields.READ scope) — powers the
 * drift check that compares derive.ts constants against the live org.
 * Never called by the sync path.
 */
export async function getLeadFields(): Promise<ZohoFieldMeta[]> {
  const res = await zohoFetch("/crm/v8/settings/fields?module=Leads", { method: "GET" });
  if (!res.ok) {
    throw new ZohoApiError(`Zoho fields endpoint returned ${res.status}`, {
      retryable: retryableStatus(res.status),
      status: res.status,
    });
  }
  const body = (await res.json()) as { fields?: ZohoFieldMeta[] };
  if (!body.fields?.length) {
    throw new ZohoApiError("Zoho fields response was empty", { retryable: false });
  }
  return body.fields;
}

/**
 * Read one Lead's fields back — used by the smoke script (and later the
 * drift check) to verify what Zoho actually stored, never by the sync path.
 */
export async function getLead(id: string, fields: string[]): Promise<Record<string, unknown>> {
  const res = await zohoFetch(`/crm/v8/Leads/${id}?fields=${fields.join(",")}`, { method: "GET" });
  if (!res.ok) {
    throw new ZohoApiError(`Zoho get lead returned ${res.status}`, {
      retryable: retryableStatus(res.status),
      status: res.status,
    });
  }
  const body = (await res.json()) as { data?: Array<Record<string, unknown>> };
  const record = body.data?.[0];
  if (!record) throw new ZohoApiError(`Lead ${id} not found`, { retryable: false });
  return record;
}

/** Shared per-record response shape for the write endpoints below. */
async function parseWriteResponse(res: Response, what: string): Promise<string> {
  if (!res.ok) {
    throw new ZohoApiError(`Zoho ${what} returned ${res.status}`, {
      retryable: retryableStatus(res.status),
      status: res.status,
    });
  }
  const body = (await res.json()) as ZohoRecordResponse;
  const result = body.data?.[0];
  if (result?.code !== "SUCCESS" || !result.details?.id) {
    throw new ZohoApiError(`Zoho rejected the ${what}: ${result?.message ?? "unknown"}`, {
      retryable: false,
      code: result?.code,
    });
  }
  return String(result.details.id);
}

/**
 * Create a follow-up Task linked to a Lead via the polymorphic What_Id lookup
 * (`$se_module` disambiguates the related module). Bot-qualified leads get one
 * of these so a human owns the next step instead of the lead going cold.
 *
 * NOTE: this must be `What_Id`, not `Who_Id`. `Who_Id` is the Contact/Lead
 * *person* lookup and rejects a Lead id here with
 * `INVALID_DATA … $.data[0].Who_Id.id` — verified against the live org
 * 2026-08-01, after the original Who_Id version failed in production.
 */
export async function createLeadTask(params: {
  leadId: string;
  subject: string;
  dueDate: string; // YYYY-MM-DD
  description?: string;
}): Promise<string> {
  const res = await zohoFetch("/crm/v8/Tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      data: [
        {
          Subject: params.subject,
          What_Id: { id: params.leadId },
          $se_module: "Leads",
          Status: "Not Started",
          Priority: "High",
          Due_Date: params.dueDate,
          Description: params.description,
        },
      ],
    }),
  });
  return parseWriteResponse(res, "task");
}

/**
 * Update named fields on an EXISTING Lead, addressed by record id.
 *
 * Deliberately not upsertLead(): that matches on Email, so changing a
 * visitor's email through it would find no match and create a SECOND Lead,
 * leaving the original stranded under the old address. Addressing the record
 * by id renames the lead we already have, which is the whole point.
 */
export async function updateLead(id: string, fields: Record<string, unknown>): Promise<void> {
  const res = await zohoFetch(`/crm/v8/Leads/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: [fields] }),
  });
  await parseWriteResponse(res, "lead update");
}

/** Attach a Note to a Lead — the qualification transcript, for sales context. */
export async function createLeadNote(params: {
  leadId: string;
  title: string;
  content: string;
}): Promise<string> {
  const res = await zohoFetch(`/crm/v8/Leads/${params.leadId}/Notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      data: [{ Note_Title: params.title, Note_Content: params.content }],
    }),
  });
  return parseWriteResponse(res, "note");
}

// ── Contacts ────────────────────────────────────────────────────────────────

/**
 * Find an existing Contact by email.
 *
 * WHY THIS EXISTS: upsertLead's duplicate_check_fields works inside the Leads
 * module ONLY. Once a Lead is converted it becomes a Contact and disappears
 * from that search, so a later booking by the same person creates a brand-new
 * Lead for someone who is already a customer. Checking Contacts first is the
 * only way to prevent that duplicate (locked decision D4).
 *
 * Uses /search rather than COQL deliberately: the runtime credential's granted
 * scopes are ZohoCRM.modules.ALL + settings.ALL + users.ALL, with NO
 * ZohoCRM.coql.READ (verified against the live org 2026-08-04), so a COQL query
 * would 401 at runtime.
 *
 * Zoho answers 204 No Content for "no match" — an empty body, not an error.
 */
export async function searchContactByEmail(email: string): Promise<string | null> {
  const res = await zohoFetch(`/crm/v8/Contacts/search?email=${encodeURIComponent(email)}`, {
    method: "GET",
  });

  if (res.status === 204) return null;

  if (!res.ok) {
    // Deliberately throws rather than returning null. A null here would be read
    // as "no Contact exists" and fall through to creating a Lead — manufacturing
    // the exact duplicate this function exists to prevent. A transient 429 must
    // requeue the row, not silently change the outcome.
    throw new ZohoApiError(`Zoho contact search returned ${res.status}`, {
      retryable: retryableStatus(res.status),
      status: res.status,
    });
  }

  const body = (await res.json()) as { data?: Array<{ id?: string }> };
  const id = body.data?.[0]?.id;
  return id ? String(id) : null;
}

/**
 * Create a Task against a Contact.
 *
 * NOTE the lookup field differs from createLeadTask: Contacts are PEOPLE, so
 * they hang off `Who_Id`, while a Lead has to use `What_Id` + `$se_module`
 * (see the note on createLeadTask — the Lead version failed in production with
 * `INVALID_DATA … $.data[0].Who_Id.id` before it was corrected). Getting these
 * the wrong way round is the single most likely mistake in this file.
 */
export async function createContactTask(params: {
  contactId: string;
  subject: string;
  dueDate: string; // YYYY-MM-DD
  description?: string;
}): Promise<string> {
  const res = await zohoFetch("/crm/v8/Tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      data: [
        {
          Subject: params.subject,
          Who_Id: { id: params.contactId },
          $se_module: "Contacts",
          Status: "Not Started",
          Priority: "High",
          Due_Date: params.dueDate,
          Description: params.description,
        },
      ],
    }),
  });
  return parseWriteResponse(res, "contact task");
}

/** Attach a Note to a Contact — same role as createLeadNote, other module. */
export async function createContactNote(params: {
  contactId: string;
  title: string;
  content: string;
}): Promise<string> {
  const res = await zohoFetch(`/crm/v8/Contacts/${params.contactId}/Notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      data: [{ Note_Title: params.title, Note_Content: params.content }],
    }),
  });
  return parseWriteResponse(res, "contact note");
}

// ── Tasks ───────────────────────────────────────────────────────────────────

/**
 * Update an existing Task by id — used when a booked call is cancelled or moved.
 *
 * A cancelled call's follow-up Task is deferred and renamed rather than
 * deleted: the fact that somebody booked and then cancelled is exactly the kind
 * of history a salesperson wants on the record.
 */
export async function updateTask(id: string, fields: Record<string, unknown>): Promise<void> {
  const res = await zohoFetch(`/crm/v8/Tasks/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: [fields] }),
  });
  await parseWriteResponse(res, "task update");
}
