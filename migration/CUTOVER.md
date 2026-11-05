> **Note (October 2026):** the database is now MySQL on Hostinger and Supabase has been removed. Where this page mentions Supabase or Postgres, read [DATABASE-SETUP.md](DATABASE-SETUP.md) instead. The rest is kept as the history of the move.

# Cut-over runbook: qrscore (PHP) -> test.vidaara.org (Next.js)

Status: phases 1-8 are built and verified locally. Nothing has been deployed. This is the order to follow on the day.

## 0. Before you start

- **Database.** The Next app and the PHP app read the same Postgres. Pick the Supabase project (still open) and run, once:
  `DATABASE_URL=... npm run portal:migrate -- --status` then `npm run portal:migrate`. It applies `supabase/migrations/2026*.sql` that are not yet recorded in `schema_meta`, all idempotent. The marketing migrations (0001-0045) stay with the Supabase CLI.
- **Keep the same secrets or old links break.** `schema_meta.app_secret` lives in the database, so signed document links and sessions' HMACs carry over. `PASSPORT_SIGNING_SEED` must be the PHP `passport.signing_seed` value, otherwise every issued passport shows as signed by an unknown key.
- **Environment (Vercel):** `DATABASE_URL`, `PORTAL_APP_URL` (final https address, no path), `RESEND_API_KEY`, `PORTAL_MAIL_FROM`, `PASSPORT_SIGNING_SEED`, `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (private file storage; without them files go to local disk, which Vercel does not keep), `RAZORPAY_KEY_ID/SECRET/WEBHOOK_SECRET`, `CRON_SECRET`, `MATHSTUDY_URL`, `PORTAL_ADMIN_EMAIL`, `CRM_VERIFY_*`, `COURSES_BASE_URL`, `LMS_WEBHOOK_SECRET`. Leave `PORTAL_MFA_REQUIRE_STAFF` unset (staff must use two-step login).
- **Storage.** The PHP app's files are in the private buckets `resumes` and `vault`. The Next app uses the same bucket names and file names, so nothing is copied when both use the same Supabase project. If the PHP app was on local disk, upload `storage/` into those buckets first.

## 1. Check on a preview deployment

Log in as an admin (create one with `scripts/portal-create-user.ts`), then walk this list:

1. `/login`, two-step login, `/account`.
2. `/console` (queue, colleges, studio, abroad, analytics), `/crm`, `/counselor`.
3. A student: `/passport` (score a resume), publish, open `/v/CODE`, `/verify`, download `/passport/qr`.
4. `/resume-score` (logged out) then sign up: the score appears in the new passport.
5. `/internships`, apply; `/employer` approve in `/console`.
6. `/study-abroad`, `/abroad/*`; a CRM student link `/file/TOKEN`.
7. `curl -H "Authorization: Bearer $CRON_SECRET" https://HOST/api/cron/portal` returns `{"status":"ok",...}`.
8. Old links: `/v.php?c=CODE`, `/internship.php?s=SLUG`, `/login.php` each answer 308 to the new page.

## 2. Webhooks and schedulers

- **Razorpay:** change the webhook URL to `https://HOST/api/studio/webhook` (one URL serves Studio and CRM verification payments). Same secret as `RAZORPAY_WEBHOOK_SECRET`. Send a test event from the dashboard.
- **Cron:** `vercel.json` runs `/api/cron/portal` every 10 minutes (mail queue, visa reminders, expired sessions). Vercel's free plan only allows daily crons; on that plan call the URL from any scheduler (cron-job.org, GitHub Actions) with the bearer header.
- **LMS:** point the course-completion callback at `https://HOST/api/lms-webhook`.

## 3. Switch

1. Lower the DNS TTL a day before.
2. Put the PHP site in read-only for 10 minutes (or accept that writes in that window are lost) so the two apps do not write at the same moment.
3. Point the domain at Vercel. The old `.php` addresses are redirected by `legacy-redirects.ts`, including the signed QR codes already printed (`/v.php?c=CODE` -> `/v/CODE`) and the student CRM links (`/crm-file.php?t=TOKEN` -> `/file/TOKEN`).
4. Watch `/console/analytics?tab=system` (setup checklist) and `/console/analytics` (page views start counting through `/api/t`).

## 4. Rollback

Point the domain back at the PHP host. The schemas are shared and every Next migration is additive, so PHP keeps working. Sessions are separate (`portal_sessions` vs PHP sessions): people log in again.

## 5. What did NOT move (and what to do)

| PHP page | Status |
|---|---|
| `score.php`, `tracker.php` (private engine showcase) | Not ported. The old addresses redirect to the public `/resume-score`. Keep the PHP copy if you still want to show the full report to seniors. |
| `resume-check.php` (instant "is this a resume?" while choosing a file) | Not ported. The server still refuses non-resumes; only the early hint is missing. |
| `resume-file.php` (download your own original resume) | Not ported: the Next app keeps the extracted text and score, not the original file (same as phase 4a). |
| `export.php`, `label.php`, `diag.php`, `setup-admin.php`, `captcha.php` | Not ported by design (use `scripts/portal-create-user.ts`; Turnstile replaces the image captcha). |
| OCR for scanned PDFs | Not ported. Scanned PDFs are refused with a clear message; paste the text instead. |
| `save-internship.php`, `course-action.php`, `abroad-action.php`, `logout.php` | These were POST handlers; their forms now live inside the Next pages. |

## 6. After the switch (a week later)

- Check `/console/analytics?tab=system`: failed emails 0, rate-limit events normal.
- Retire the PHP host; keep a database backup and the `qrscore` repo archived.
