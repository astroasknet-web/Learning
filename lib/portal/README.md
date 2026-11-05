# lib/portal: accounts for students, employers and staff

Port of the PHP account code (`qrscore/src/Portal/Auth.php` and friends). It works on the SAME database tables, so existing accounts, password hashes and authenticator enrolments carry over.

| File | Purpose | PHP original |
|---|---|---|
| `db.ts` | Pooled Postgres access (`DATABASE_URL`) | `Db.php`, `PgPdo.php` |
| `auth.ts` | Register, throttled login, two-step codes, email verification, password reset | `Auth.php` |
| `session.ts` | Server-side sessions (`portal_sessions`), cookie `gq_session` | PHP sessions |
| `password.ts` | bcrypt (same `$2y$` format), password policy | `Auth::weakPassword` |
| `totp.ts`, `crypto.ts` | Authenticator codes; encryption of the secret at rest (key in `schema_meta.app_secret`) | `Totp.php`, `Crypto.php` |
| `security.ts` | Failed-attempt throttle, audit trail, safe redirects, client IP | `Auth` throttle, `AbroadStore::audit` |
| `mail.ts` | Outbox (`mail_outbox`) + Resend delivery; account emails | `Mailer.php`, `Notify.php` |
| `guard.ts` | `requireUser()`, `requireMfaIfStaff()` for pages | `Auth::require` |

Skill Passport: `passport/` (credential signing + verification, publishing, resumes, QR). Env: `PASSPORT_SIGNING_SEED` (same as PHP).

Pages: `app/(portal)/`. Forms use Server Actions (`app/(portal)/actions.ts`); Next.js checks the request origin, which is the CSRF protection.

Gotchas worth knowing
- Do not set `Referrer-Policy: no-referrer` on pages with forms: browsers then send `Origin: null` and Next.js rejects the post (it throws `Invalid URL`). The layout uses `same-origin`.
- Timestamps are `timestamp without time zone`; the connection sets the session zone to `DB_TIMEZONE` (default UTC). While the PHP app shares the database, both must use the same zone or token expiry will be off.
- Tests: `PORTAL_TEST_DATABASE_URL=postgres://... npx vitest run lib/portal` (the database tests are skipped without it; the PHP cross-checks run when `php` and `../qrscore` exist).
