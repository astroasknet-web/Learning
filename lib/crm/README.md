# CRM Sync — Runbook

Website → Zoho CRM lead sync: architecture, operations, deployment, and
contracts. This is the single handover document for the integration.

## Architecture

```
Browser ── first-touch capture (sessionStorage, lib/attribution.ts) ──▶ form POST
  └▶ shared pipeline (lib/forms/handler.ts):
       rate-limit → zod parse (null-tolerant) → Turnstile (fail-closed)
       → INSERT (user fields + attribution + country + crm_sync_status)
       → 200 to user → after(): syncLeadToZoho          ← fast path (seconds)
                                        │
Vercel cron (daily) /api/cron/crm-sync ─┤                ← durability layer
  reaper (stale syncing → pending)      ▼
  drain pending/failed oldest-first   claim → build payload → Zoho upsert-on-Email
                                        → write back synced|failed (+attempts)
  └▶ alertOnStuckRows → one Resend digest/run when rows need a human
```

Module map (`lib/crm/`): `zoho-client.ts` (the only HTTP layer: OAuth
refresh + cache, 401-retry-once, retryable/permanent error taxonomy) ·
`derive.ts` (every mapping table; display values verified live) ·
`payload.ts` (row → Lead record; omits absent fields so upsert-updates never
blank data) · `sync.ts` (claim state machine + sweep) · `sources.ts`
(registry + kill switch) · `health.ts` (digest alerting) · `drift.ts`
(picklist drift comparator).

Source-of-truth contract: **the database owns website submissions · Zoho owns CRM
lifecycle · the app DB owns product/billing.** Zoho state is never mirrored
back into the database; machine writes must never overwrite human CRM actions.

## Environment contract

```
ZOHO_CLIENT_ID=            # self-client, api-console.zoho.in
ZOHO_CLIENT_SECRET=
ZOHO_REFRESH_TOKEN=        # scopes: ZohoCRM.modules.leads.ALL, ZohoCRM.settings.fields.READ
ZOHO_ACCOUNTS_BASE=https://accounts.zoho.in     # .in data centre — do not change
ZOHO_API_BASE=https://www.zohoapis.in
CRM_SYNC_ENABLED=true      # kill switch; anything else disables all Zoho calls
CRON_SECRET=               # bearer auth for /api/cron/crm-sync (fail-closed)
```

## Deployment checklist

1. Vercel env: the 5 `ZOHO_*` vars, `CRM_SYNC_ENABLED=true`, `CRON_SECRET`.
2. Merge/deploy the branch; `vercel.json` schedules the crons. **The Vercel
   Hobby plan caps crons at 2, once per day**, so both run daily. `*/15` is
   what this design assumes and needs a paid plan; see the cadence note below.
3. Post-deploy validation (in order):
   - `npm run crm:drift` locally → NO DRIFT.
   - Hit the cron URL with the bearer secret → `{status:"ok", summary, alert}`.
   - One real submission per enabled form → row `synced` + Lead in Zoho.
   - Kill-switch drill; forced-failure digest drill; credential-revocation
     drill (invalidate `ZOHO_REFRESH_TOKEN` in a preview env, watch the row
     fail with a token error, restore, requeue, watch it recover).
   - 48-hour soak: zero stuck `syncing`, zero unexplained `failed`.
4. Rotate the Zoho client secret after launch (it passed through chat during
   setup) — regenerate in api-console.zoho.in, update env, redeploy.

## Adding a form to the CRM (3 steps)

1. **Columns:** give its table the attribution + `crm_sync_*` columns
   (copy §2 of `db/migrations/20261101000001_marketing.sql`).
2. **Builder:** write `buildXPayload(row) → ZohoLeadRecord | null` in
   `payload.ts` (null = excluded by rule) and register the table in
   `sources.ts`.
3. **Route:** build it on `createFormRoute` with `crmSource` set and persist
   returning `{ crmRowId }`. Attribution and country come free from the
   pipeline. Then extend `CRM_FIELD_EXPECTATIONS` if new values are emitted,
   and run `crm:smoke`/`crm:drift`.

## Cross-module contracts (Phase 2 of the CRM programme — not built yet)

- **B2C lead closure:** on app signup, the app backend searches Leads by
  email and converts/closes the matching website Lead. The website never
  does this.
- **Contact pre-check:** before creating a Lead for an email that already
  exists as a Contact, attach a Note to the Contact instead (today a
  converted Contact resubmitting creates a fresh Lead — accepted, sales
  de-dupes on convert).
- **General enquiries → Zoho Cases/Desk**, not Leads (rows are already
  soft-skipped with full attribution, requeueable when this lands).
- **Newsletter** stays out of CRM (marketing-automation scope); its columns
  exist so inclusion is a registry entry away.
- **Cal.com bookings** are invisible to the CRM (external); Phase 2 option:
  Cal.com webhook → this same pipeline.

## The state machine

Every lead table (`b2b_leads`, `contact_messages`, `seeker_waitlist`) carries
`crm_sync_status`, CHECK-enforced in MySQL:

```
pending ──claim──▶ syncing ──▶ synced          (terminal, zoho_lead_id set)
   ▲                  │
   │                  └──▶ failed ──retry──▶ syncing …   (gives up at 5 attempts)
   └── reaper resets stale 'syncing' (>10 min)
skipped  = excluded by rule (newsletter table default; contact type=general)
legacy   = pre-integration row; never auto-synced
```

Two actors, race-free by construction: the **inline hook** (`after()` in the
form pipeline — fast path, seconds) and the **cron sweep**
(`/api/cron/crm-sync`, daily on Hobby — durability). The cron only touches rows
older than a 10-minute grace window; the claim is a conditional
`UPDATE … WHERE status IN ('pending','failed')`, and Zoho upserts on Email, so
even a double-fire cannot duplicate a Lead.

## Kill switch

`CRM_SYNC_ENABLED` (env). Anything but `true` → no Zoho call is ever made;
rows queue as `pending` and the cron drains them after re-enable. Zero data
loss. Per-source flags live in `lib/crm/sources.ts`.

## Alerting

After each sweep the cron emails **one digest per run** to
`support@growqr.ai` (via Resend) when any row needs a human:

| Reason | Meaning |
|---|---|
| `gave_up` | `failed` with `crm_sync_attempts >= 5` — retries exhausted; usually a permanent payload/credential problem (see `crm_sync_error`) |
| `stuck_syncing` | `syncing` older than 10 min *after* the reaper ran — the reaper itself is failing; investigate DB errors in the cron logs |

`failed` below the cap is normal retry traffic and never alerts.
**Known cadence:** the digest repeats once per cron run until the rows are
resolved — deliberate (stateless); if fatigue ever becomes real, the fix is an
`alerted_at` column, not a code tweak.

A dead Zoho credential shows up as: new rows `failed` with a token-refresh
error message → digest within one cron cycle once attempts hit 5, or
immediately visible via the health queries below.

## Health queries (phpMyAdmin SQL tab)

Status counts per table:

```sql
select 'b2b_leads' as t, crm_sync_status, count(*) from b2b_leads group by 1, 2
union all select 'contact_messages', crm_sync_status, count(*) from contact_messages group by 1, 2
union all select 'seeker_waitlist', crm_sync_status, count(*) from seeker_waitlist group by 1, 2
order by 1, 2;
```

Rows needing attention (what the digest reports):

```sql
select 'b2b_leads' as t, id::text, email, crm_sync_attempts, crm_sync_error, created_at
from b2b_leads
where (crm_sync_status = 'failed' and crm_sync_attempts >= 5)
   or (crm_sync_status = 'syncing' and created_at < now() - interval '10 minutes')
union all
select 'contact_messages', id::text, email, crm_sync_attempts, crm_sync_error, created_at
from contact_messages
where (crm_sync_status = 'failed' and crm_sync_attempts >= 5)
   or (crm_sync_status = 'syncing' and created_at < now() - interval '10 minutes')
union all
select 'seeker_waitlist', id::text, email, crm_sync_attempts, crm_sync_error, created_at
from seeker_waitlist
where (crm_sync_status = 'failed' and crm_sync_attempts >= 5)
   or (crm_sync_status = 'syncing' and created_at < now() - interval '10 minutes')
order by created_at;
```

Recent failures with reasons (triage view):

```sql
select id, email, crm_sync_attempts, crm_sync_error, created_at
from b2b_leads
where crm_sync_status = 'failed'
order by created_at desc limit 20;   -- swap table as needed
```

## Requeue recipe

After fixing the cause (payload bug, credential, Zoho edit), requeue a row so
the next cron run retries it:

```sql
update b2b_leads
set crm_sync_status = 'pending', crm_sync_attempts = 0, crm_sync_error = null
where id = <id> and crm_sync_status = 'failed';
```

Safe by design: upsert-on-Email means requeueing an already-synced person
updates their Lead instead of duplicating it. Never requeue `legacy` rows
without a decision — that gate exists on purpose.

## Drift check

```
npm run crm:drift
```

Read-only: compares every picklist display value and field `derive.ts` can
emit against live `getFields`. **Run it before any picklist edit in Zoho**,
and whenever rows fail with `INVALID_DATA`. Exit 1 + printed problems = fix
`derive.ts` or revert the Zoho change. Zoho matches on *display values*
(renamed picklists silently keep their legacy `actual_value`), so a UI rename
breaks writes with no warning — this script is the warning.

## Smoke test

```
npm run crm:smoke
```

Creates ONE clearly-marked live Lead (`ZZZ Smoke Test`,
`crm-smoke-test@growqr.ai`), proves upsert idempotency (insert → update, same
id), diffs every field, and tells you to delete it in the Zoho UI. Bypasses
the kill switch by calling the client directly — use deliberately.

## Structured logs (Vercel)

Grep-friendly scopes: `[crm-sync]` (per-row outcomes:
`table#id outcome=synced|failed|skipped action=… zoho_lead_id=…`),
`[cron/crm-sync]` (sweep summaries), `[crm-health]` (digest activity),
`[zoho-client]` (token refreshes).

## Drills

- **Kill switch:** set `CRM_SYNC_ENABLED=false`, submit a form → row stays
  `pending`, no Zoho call; re-enable → next cron run drains it.
- **Forced failure alert:** set an invalid `ZOHO_REFRESH_TOKEN` locally,
  submit → row `failed` with a token error; run the cron endpoint 5× (or set
  `crm_sync_attempts = 5` manually) → digest email arrives.
- **Credential recovery:** restore the token, requeue (recipe above) → row
  syncs on the next run.

## Risk register (as of handover)

| Risk | Posture |
|---|---|
| Zoho picklist rename breaks writes silently | `crm:drift` before any Zoho edit; INVALID_DATA failures alert via digest |
| Dead credential | Rows fail with token error → digest within cron cycles; recovery = fix env + requeue |
| Double-send race | Killed by claim + 10-min grace + non-overlapping cron; upsert-on-Email is the last line |
| `after()` best-effort on serverless | By design — the cron is the durability layer |
| Digest repeats each cron run while rows stuck | Deliberate/stateless; add `alerted_at` column if fatigue materialises |
| In-memory rate limiter resets on cold start | Accepted at current scale (D12); revisit at ad-spend scale |
| Placeholder convention (email local-part as Last_Name) | Documented above — sales must know it's a convention, not data |
| B2C Leads carry no Company | Deliberate: Zoho builds Account_Name from Company and it is not unique, so a placeholder would merge consumers into one shared Account on conversion. `compact()` strips Company whenever `Segment === "B2C"`. **Requires `Company` to be non-required on the Leads Standard layout.** |
| Lead/Contact collision (converted Contact resubmits → new Lead) | Accepted for Phase 1; pre-check contract recorded for Phase 2 |
| Resend outage blinds alerting | Accepted; second channel (Slack webhook) is a Phase 8 option |
| **Cron is daily, not `*/15` (Vercel Hobby cap)** | The inline `after()` hook still syncs in seconds, so only the *recovery* path is slower: a row stranded by a cold shutdown waits up to 24h instead of 15 min, and the reaper + stuck-row digest inherit that latency. No data is ever lost. Upgrading the Vercel plan and restoring `*/15` is the fix. |
| **`expert-reminders` cannot work on a daily cron** | It sends inside a 120-minute pre-session window, so one daily run only catches sessions in the 2h after it fires — every other session gets no reminder. Needs an external hourly scheduler (`CRON_SECRET` bearer) or day-ahead reminder semantics. |
