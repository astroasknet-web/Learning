> **Note (October 2026):** the database is now MySQL on Hostinger and Supabase has been removed. Where this page mentions Supabase or Postgres, read [DATABASE-SETUP.md](DATABASE-SETUP.md) instead. The rest is kept as the history of the move.

# qrscore (PHP) into test.vidaara.org (Next.js): migration plan

Goal: move every qrscore application (scoring engine, Skill Passport, Resume Studio, internships, courses, study abroad, Overseas CRM, analytics, admin) into the Node/Next.js codebase in `test.vidaara.org`, so GrowQR is one app.

Folders in `D:\GROWQR\GROWQR FINAL AFTER INTEGRATION`:
- `qrscore\`: the PHP application (the source being ported; unchanged).
- `test.vidaara.org\`: the Next.js application (the destination). New code lives under `lib/qrscore/` and, from later phases, under `app/`.
- `FONTEND DESIGNS\`: homepage design options.

## Method (applies to every phase)

1. Port module by module, keeping the PHP file names and structure recognisable, so the two can be compared.
2. **Prove equality with the PHP original.** Pure logic is tested against "golden" results produced by the PHP code itself (`scripts/qrscore-golden.php`). A phase is done only when the TypeScript output equals the PHP output on the same inputs.
3. Keep the same database. The PHP app uses Supabase Postgres with migrations in `supabase/migrations`. The Next app talks to the same schema, so data does not need converting and both apps can run side by side during the move.
4. Switch traffic page by page, not all at once. A PHP page is retired only after its Next.js replacement is live and verified.

## Phases

| # | Phase | Status |
|---|---|---|
| 1 | **Scoring engine** (text extraction, resume check, 5-section scorer, profile, recommendations, learned model) in `lib/qrscore/` | **Done.** 338 tests, TypeScript equals PHP on 333 inputs |
| 2 | Data layer: Postgres access, config, migrations runner, storage (Supabase Storage) | **Mostly done:** `lib/portal/db.ts`; every PHP migration is now in `supabase/migrations` (no table-name clashes with the marketing site's migrations); `lib/market/storage.ts` (private Supabase Storage or local disk). Migrations runner (`npm run portal:migrate`) and scheduled jobs (`/api/cron/portal`) done in phase 8. Still to do: OCR |
| 3 | Accounts: login, signup, sessions, two-step login (TOTP), roles, captcha, mail | **Done.** Same `users` table and password hashes; 1051 tests green; production build passes; full flow verified in a browser |
| 4a | Skill Passport: score and save a resume, publish a signed QR-verifiable passport, public page and verifier, key documents | **Done.** 1,065 tests; signs with the same key as PHP and each app verifies the other's credentials |
| 4b | Resume Studio: 45 templates, live scoring, JD tailoring, before/after, DOCX/PDF export, Pro plan (INR 199 lifetime) with Razorpay | **Done.** `lib/studio/`, `app/(portal)/studio/`, `app/api/studio/*`; 15 parity tests vs PHP (catalogue, normalize, import, text, 180 renders, DOCX, scorer, JD match, diff) + 7 database tests; browser-verified |
| 5 | Marketplace: internships (search, apply), courses, employers | **Done** (admin approval of roles waits for phase 7). `lib/market/`, `app/internships`, `app/courses`, `app/(portal)/{employer,applications,my-courses}`; job search proven equal to PHP on 53 queries + 68 suggestions; 1,104 tests; browser-verified |
| 6 | Study abroad (profile, matches, documents vault, visa, funds) and the Overseas CRM (leads, pipeline, verification, reports) | **Done.** `lib/abroad/`, `app/abroad`, `app/study-abroad`, `app/universities`, `app/(portal)/abroad/*` (6a/6b, parity-tested vs PHP); `lib/crm/`, `app/(portal)/crm/*`, `app/file/[token]`, `app/api/crm/pay` (6c, 122 database tests); browser-verified |
| 7 | Admin: analytics, colleges, studio plans, CRM team access, role review queue, counselor pages | **Done.** `app/(portal)/console/*`, `app/(portal)/counselor/*`, `lib/admin/`; 1,154 tests green; production build passes; browser-verified |
| 8 | Cut-over: redirects from old URLs, tracking, scheduled jobs, migrations runner, public free score, college directory, retire PHP | **Built and verified locally** (1,161 tests, build passes). Nothing deployed. Runbook: `CUTOVER.md` |

## Decisions taken (6 Oct 2026)

1. **Accounts:** keep the existing `users` table. Password hashes (bcrypt), two-step-login secrets and recovery codes are read exactly as the PHP app wrote them, so nobody resets a password and existing authenticator enrolments keep working.
2. **Database:** one Supabase project for the merged app. Open: which of the two existing projects becomes it (the schema migrations are idempotent, so either works; the PHP migrations must be copied into this repo's `supabase/migrations` before the switch).
3. **Hosting:** still to confirm that the Node host runs scheduled jobs (visa reminders, CRM sync, mail flush).

## Phase 3 notes (accounts)

- Code: `lib/portal/` (db, crypto, password, totp, security, session, mail, auth, guard), pages in `app/(portal)/` (login, login/mfa, signup, forgot-password, reset-password, verify-email, account, account/mfa), components in `components/portal/`.
- Both apps can run on the same data at once. Sessions are separate (the PHP session cookie is not shared), so a person logs in once per app until cut-over.
- Needs these settings on the Node host: `DATABASE_URL` (Supabase pooler string), `PORTAL_APP_URL`, optionally `RESEND_API_KEY` + `PORTAL_MAIL_FROM`, Turnstile keys (already used by the site). See `migration/env.example`.
- Apply `supabase/migrations/20261008000001_portal_sessions.sql` once (the Supabase GitHub integration or the SQL editor).
- Staff accounts: `DATABASE_URL=... npx tsx scripts/portal-create-user.ts email "Name" admin`.
- The existing site admin (`/admin`, Supabase Auth) is untouched and separate.
- The pages do not yet use the site's navigation bar; `/account` is a placeholder landing page until the dashboards are ported.

## Phase 5 notes (marketplace)

- **Internships:** `/internships` (search with type-ahead, filters, sort, paging, save), `/internships/[slug]` (detail, match breakdown, apply), `/applications` (a student's stages and the employer's reasons). Search, synonyms, typo fix, suggestions and highlighting are `lib/market/job-search.ts`, a port of `JobSearch.php` checked against PHP by `php scripts/market-golden.php` + `lib/market/market.test.ts`.
- **Applying:** server-checked (student, email confirmed, one per role, live role, note/answer/phone/start date/consent, a real PDF or DOCX of at most 5 MB by extension AND file signature). The file goes to `lib/market/storage.ts` under a random name; the pass-through "use my Skill Passport resume" keeps a text snapshot. Each step writes an `application_events` row and queues the emails (to the student and the employer).
- **Employers:** `/employer` (hiring board by stage, resume download, move a candidate; every rejection needs a reason), `/employer/post` (server-side rules: minimum stipend 1,000 remote / 2,000 on-site, 2-26 weeks, 1-20 openings, 80+ character description, 1+ skills), `/employer/resume/[id]` (only the applicant, the owning employer or an admin; opening it marks the application Viewed). A new role is `pending`. **Nothing approves it yet:** the admin review queue is phase 7 (`jobs.setStatus` and `notify.roleDecided` are ready).
- **Courses:** `/courses` (search, filters, career paths, popular), `/courses/[slug]`, `/my-courses` (checkpoints, completion tiers self / certificate / verified, certificate link only on allowed https hosts), `/api/lms-webhook` (signed, 5 minute window, replay-proof). The 116-course catalogue is `lib/market/data/courses.json`; load it with `npx tsx scripts/courses-sync.ts`. Course cards use a gradient cover in the category colours (the PHP app drew an SVG per course).
- **A bug found in the PHP app:** its course filter "audience" (`aud=Fresher` etc.) uses MySQL's `FIND_IN_SET`, which does not exist in Postgres, so that filter errors on Supabase. The Node version uses `string_to_array`. Worth fixing in PHP too if it stays live for a while.
- **Not yet ported:** the admin review queue and Verified-stipend badge tool (phase 7), the sample-job seeder (`Jobs::seedSamples`, only for demos), the homepage featured-courses block, course-art SVGs.
- **Date columns** now come back from `lib/portal/db.ts` as plain `YYYY-MM-DD` strings, like timestamps already did.
- **Local test database:** if tests start failing with "server closed the connection unexpectedly" (PGlite after many dropped PHP connections), restart it: `node node_modules/@electric-sql/pglite-socket/dist/scripts/server.js -d ./data -p 54329 -m 10` in `C:\Users\pc\pglite-test`.

## Phase 4b notes (Resume Studio)

- **Where it lives:** server logic in `lib/studio/` (templates, resume-data, renderer, job-match, diff, docx, scorer, store, access, pay, api), pages `/studio` and `/studio/edit/[id]`, downloads `/studio/export?v=ID&fmt=print|docx|txt`, JSON endpoints `/api/studio/{live,save,compare,pay,webhook}`.
- **The front end is the PHP app's own vanilla JS and CSS** (`public/studio/`), with only the endpoint URLs changed. `studio-base.css` supplies the theme classes (buttons, panels, score ring) that the PHP site-wide stylesheet used to provide, scoped to `.studio-root`.
- **Same tables, same rules:** the `studio_*` tables are unchanged (migration copied to `supabase/migrations/20261006000001_studio.sql`, idempotent). Free plan = 8 templates plus one saved update per 24 h (checked inside a transaction holding a row lock on the user); Pro = all 45, lifetime INR 199. A grant made by either app is seen by the other.
- **Parity:** `php scripts/studio-golden.php` writes `lib/studio/__golden__/studio.json`; `lib/studio/studio.test.ts` requires identical output. Two deliberate approximations: PHP's `FILTER_VALIDATE_EMAIL/URL` are replaced by close JS validators, and the Word file is compared on its `document.xml` (the zip bytes differ).
- **CSRF** for the JSON endpoints is the session's own token (`_csrf` in the body), compared in constant time. Rate limits are per session and held in memory (per server process).
- **Razorpay:** set `RAZORPAY_KEY_ID/SECRET/WEBHOOK_SECRET` and register `https://<domain>/api/studio/webhook`. The CRM verification fee will plug into the same webhook with `pay.setUnknownOrderHandler()` when the CRM is ported (phase 6).
- **Not yet ported from the PHP Studio:** the Skill Passport promo card for Studio and the admin tools that grant or revoke Pro (admin phase). `access.grant` and `access.revoke` exist for them.
- **Tests:** `vitest.config.ts` now runs test files one at a time, because the local test database (PGlite) serves one connection and several suites start PHP against it.

## Phase 4a notes (Skill Passport)

- Code: `lib/portal/passport/` (credential, share, profile, resumes, qr), pages `/passport`, `/passport/share`, public `/v/[code]` (+ `credential.jwt`, `credential.json`), `/verify`, `/.well-known/did.json`, `/.well-known/jwks.json`.
- **Signing key.** Set `PASSPORT_SIGNING_SEED` on the Node host to the PHP app's seed (`passport.signing_seed` in its config.php, or the contents of `storage/passport-signing.key` on the PHP host). Same seed gives the same key (`kid`), so every passport already issued still verifies. A test proves this against the PHP code.
- **Old QR codes** printed from the PHP app point at `.../v.php?c=CODE`. At cut-over add a redirect `/v.php?c=CODE` to `/v/CODE` (phase 8). New credentials point at `/v/CODE`.
- **Moving domain:** after changing `PORTAL_APP_URL`, run `share.reissueAll()` (re-signs every public passport for the new address; old copies stay verifiable).
- Not in this step: keeping the original uploaded file (needs the storage phase), course and internship suggestions on the passport page (marketplace phase), the upload malware screen (`Scanner.php`, arrives with file storage). Text and scores are kept; files are read in memory only.

## Phase 1 notes (scoring engine)

- Location: `test.vidaara.org/lib/qrscore/` (see `README.md` there).
- PDF reading uses pdf.js (`unpdf`), DOCX uses `fflate`. The PHP engine could also call Poppler and Tesseract OCR when the host allowed it; scanned PDFs are therefore not read yet (they are refused with a clear message). OCR is a separate task.
- Differences between PCRE (PHP) and JavaScript regular expressions were handled deliberately (whitespace, byte vs character matching, Unicode word boundaries). Edge-case variants (en/em dashes, no-break spaces, curly quotes, CRLF, Hindi, emoji, upper case) are part of the parity test.

## Phase 6 notes (study abroad and the Overseas CRM)

- **Study abroad (6a/6b):** `lib/abroad/` ports Abroad, AbroadStore, Vault, Scanner, Counsel, Loans, Funds, Visa, MockInterview and the privacy export/erase. Fit scoring, ranking, EMI/loan rules, funds coverage, visa readiness and the mock-interview scorer are proven equal to PHP by golden files (`php scripts/abroad-golden.php`, `scripts/abroad2-golden.php`). Pages: `/study-abroad`, `/study-abroad/[country]`, `/universities/[slug]`, and for students `/abroad` (profile, matches, documents, visa, funds, loans, interview, export).
- **Documents** are private (bucket "vault"), type-checked by file signature, scanned (ClamAV when `CLAMAV_HOST`/`CLAMAV_PORT` are set, heuristics otherwise) and opened only through 5-minute signed links; every open is audited.
- **Overseas CRM (6c):** `lib/crm/` (access, leads, path, docs, verify, money, verify-pay, reports, gate). Pages `/crm` (today), `/crm/leads` (list, board, filters, manager CSV import), `/crm/leads/[id]` (everything about one lead), `/crm/reports` (+ `/crm/reports/csv`), `/crm/team` (admin only), `/crm/denied`, `/crm/doc/[id]` (staff download, audited). Student side, no login: `/file/[token]` (progress, uploads, request verification, pay) with `/file/[token]/doc/[id]` and `/api/crm/pay`.
- **Student-paid verification:** nothing goes to the partner until the fee is paid. Fee = `CRM_VERIFY_BASE_INR` + `CRM_VERIFY_PER_DOC_INR` per document; partner name `CRM_VERIFY_PROVIDER`. Online payment reuses the Razorpay keys and the shared `/api/studio/webhook` (unknown orders are handed to the CRM).
- **Forms and `act`:** do not rely on the clicked button's `name`/`value` inside a Server Action form (the value was missing in the Browser pane). Use a hidden `act` field, or a `<select name="act">`.
- **`no-referrer` breaks Server Actions:** browsers then send `Origin: null`, which Next rejects. The student file page uses `same-origin`.
- **Bugs found in the PHP app:** `FIND_IN_SET` in the university level filter (Abroad::universities) and the course audience filter does not exist in Postgres. Visa readiness counted visa keys instead of steps (fixed in the port).

## Phase 7 notes (admin)

- **Where:** `/console` (administrators only, two-step login required). Tabs: review queue for employer-posted roles (approve, optionally "Verified stipend" badge, or reject; the employer is emailed), colleges (approve, reject, merge duplicates with a similarity match equal to PHP `similar_text`/`levenshtein`), Resume Studio plans (grant or end Pro by student email, recent payments), study-abroad operations (verify documents, move applications, assign counselors, mark arrived, audit trail) and analytics.
- **Analytics** (`/console/analytics`, `lib/admin/analytics.ts`): overview, users, internships, courses, study abroad, resumes, e-books, colleges and system tabs, with 7/30/90/365 day ranges, previous-period trends, server-drawn SVG charts (`components/admin/charts.tsx`) and a browser-side CSV export per table. Each query is wrapped, so one failing section shows empty. The system tab replaces the PHP config checklist with environment checks and has the "re-issue passports after a domain change" action.
- **Traffic numbers need a recorder.** Nothing in the Next app writes `analytics_events` yet (PHP `Tracker::view` / `go.php`). The dashboard reads the same table, so old PHP rows show; page-view recording and the MathStudy click redirect are part of phase 8. The top-pages, course-views and country-views queries match the new Next paths (`/courses/<slug>`, `/study-abroad/<key>`, `/internships/<slug>`), the PHP-era `.php` paths are matched for internships only.
- **Counselors:** `/counselor` (caseload and the waiting list), `/counselor/student/[id]` (profile, funds, visa, documents, applications, internal notes), `/counselor/mock/[id]` (read a practice interview, send feedback). A counselor can only open students assigned to them; admins can open any. The PHP `counselor-*.php` pages map to these.
- **Not ported (by design):** the PHP "private showcase link" for the engine score report (that report lives with the PHP engine), the export token (`export.php`/`diag.php` do not exist here).
- **Admin accounts for local testing:** create a user with role `admin`, verified email and a bcrypt hash; set `PORTAL_MFA_REQUIRE_STAFF=false` locally only.

## Phase 8 notes (cut-over)

- **Old addresses:** `legacy-redirects.ts` (wired into `next.config.ts`) maps every PHP page to its new page with a 308, moving ids and slugs from the query string into the path (`/v.php?c=CODE` -> `/v/CODE`, `/internship.php?s=X` -> `/internships/X`, `/crm-file.php?t=T` -> `/file/T`, ...). The original query string is also carried over (harmless).
- **Traffic recording:** `PortalViewBeacon` (root layout) posts each route change to `/api/t`; `lib/portal/events.ts` stores it in `analytics_events` (no IP, no user agent, daily-rotating visitor hash; bots, staff pages and endpoints skipped). `/go?c=placement&p=/shop/...` records the click and redirects to `MATHSTUDY_URL` with `utm_*` (fixed host, validated path: no open redirect).
- **Scheduled jobs:** `GET /api/cron/portal` (Bearer `CRON_SECRET`, fails closed) queues visa reminders, flushes the mail queue and deletes expired sessions; scheduled every 10 minutes in `vercel.json`.
- **Migrations:** `npm run portal:migrate [-- --status]` applies pending `supabase/migrations/2026*.sql` and records them in `schema_meta` like PHP did.
- **Colleges:** `/api/colleges/suggest` and a datalist picker on the student signup form (`components/portal/college-field.tsx`); an unlisted college plus a chosen state is filed as pending (`lib/portal/colleges.ts`, port of `Institutions::submit`; 3 different people promote it, or an admin approves it in `/console/colleges`).
- **Public free score:** `/resume-score` (upload or paste, score + three focus areas + sign-up funnel; stores to `qr_submissions`; the text is imported into the new passport after sign-up, via `pending_resume` in the session). `/passport/qr` downloads the passport QR (SVG or PNG).
- **Not ported:** see the table in `CUTOVER.md` section 5.
