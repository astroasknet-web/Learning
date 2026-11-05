# Running the portal on Hostinger (qrscore.mathstudy.in)

One Node app on Hostinger, built by GitHub, talking to a Hostinger MySQL database (see DATABASE-SETUP.md). The old PHP site is simply detached from the domain.

```
 you push to main ──> GitHub Actions: test + next build ──> branch `deploy` (a ready-to-run server)
                                                              │
 Hostinger Node app (was test.vidaara.org) pulls `deploy`, runs `node server.js`
                                                              │
 qrscore.mathstudy.in ──> that app ──> MySQL database (hPanel) + a storage folder for uploads
```

Why GitHub builds it: the build needs far more memory than a small Hostinger plan allows (the vidaara.org app has crashed on memory before). Hostinger only has to run the finished server.

## 1. One-time GitHub setup (repo `astroasknet-web/growqr.ai-final`)

1. **Settings -> Secrets and variables -> Actions -> New repository secret**, name `BUILD_ENV`, value = these lines (they are baked into the browser code, so only public values):
   ```
   NEXT_PUBLIC_RAZORPAY_KEY_ID=<rzp key id>
   NEXT_PUBLIC_TURNSTILE_SITE_KEY=<turnstile site key>
   ```
   Add any other `NEXT_PUBLIC_*` line from `migration/env.example` that you use.
2. **Settings -> Actions -> General -> Workflow permissions:** "Read and write permissions".
3. Push to `main` (or Actions -> "Build portal for Hostinger" -> Run workflow). It type-checks, runs the tests, builds, and force-pushes the result to the `deploy` branch (about 5 minutes, about 110 MB). Never edit `deploy` by hand.

## 2. Hostinger: turn the old test.vidaara.org Node app into the portal

hPanel wording differs a little between plans; the settings you need are these.

| Setting | Value |
|---|---|
| Repository | `astroasknet-web/growqr.ai-final` (Hostinger's GitHub connection must be allowed to read it; this repo is under the `astroasknet-web` account) |
| Branch | `deploy` |
| Framework / preset | Other / Node.js (not "Next.js": the build is already done) |
| Install command | leave empty (everything is inside the folder) |
| Build command | leave empty |
| Start command / entry file | `node server.js` |
| Node version | 20 or 22 |

If Hostinger insists on a build command, use `echo done`.

### Environment variables (Hostinger -> the app -> Environment)

| Name | Value |
|---|---|
| `HOSTNAME` | `0.0.0.0` (the server must listen on all addresses; Hostinger supplies `PORT`) |
| `SITE_MODE` | leave it out (the whole site is served from this host). `portal-only` is an optional mode that sends non-portal pages to `MARKETING_URL` |
| `MARKETING_URL` | only used with `SITE_MODE=portal-only` |
| `SITE_NOINDEX` | `1` while testing (adds "do not index"); remove at go-live |
| `PORTAL_APP_URL` | `https://qrscore.mathstudy.in` (no trailing path) |
| `DATABASE_URL` | `mysql://<user>:<password>@localhost:3306/<database>` from hPanel -> Databases (see `DATABASE-SETUP.md`) |
| `DATABASE_SSL` | `disable` when the database is on the same plan |
| `PORTAL_AUTO_MIGRATE` | `1` (on every start: builds missing tables, loads the course and university catalogues; safe to repeat) |
| `STORAGE_DIR` | folder for uploaded files, outside the app folder (for example `/home/<user>/growqr-storage`) |
| `PASSPORT_SIGNING_SEED` | at least 32 characters; the **same** value the PHP app used, or old passports stop verifying (any value is fine if nothing real exists) |
| `RESEND_API_KEY`, `PORTAL_MAIL_FROM` | outgoing email (verify the sending domain in Resend) |
| `CRON_SECRET` | a long random string (used by the scheduled job below) |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `NEXT_PUBLIC_RAZORPAY_KEY_ID` | payments (test keys are fine) |
| `TURNSTILE_SECRET_KEY` (runtime) and `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (put it in the GitHub `BUILD_ENV` secret, it is baked in at build) | bot check on signup/login. **Skip for testing**: with no site key the check is simply off |
| `PORTAL_ADMIN_EMAIL`, `CRM_VERIFY_*`, `LMS_WEBHOOK_SECRET`, `COURSES_BASE_URL` | optional, see `migration/env.example` |

Do **not** set `PORTAL_MFA_REQUIRE_STAFF=false` outside a laptop.

## 3. Point qrscore.mathstudy.in at the Node app

1. In hPanel remove (or rename) the `qrscore` subdomain from the PHP website so the name is free. The PHP files can stay on disk as a fallback.
2. Add `qrscore.mathstudy.in` as the domain of the Node app. If `mathstudy.in` DNS is at Hostinger this is automatic; otherwise create the DNS record Hostinger tells you to (A record to the Node app's IP, or the CNAME it shows).
3. Enable the free SSL certificate and wait for it to turn green.
4. Open `https://qrscore.mathstudy.in/api/health`. It should answer `{"ok":true,"database":"ok"}`.

## 4. Scheduled job (email queue, visa reminders, session cleanup)

hPanel -> Advanced -> Cron Jobs, every 10 minutes:

```
*/10 * * * * curl -s -H "Authorization: Bearer <CRON_SECRET>" https://qrscore.mathstudy.in/api/cron/portal > /dev/null
```

## 5. First admin

From your own computer (needs Node and a clone of the repo):

```
npx tsx scripts/portal-create-user.ts you@example.com "Your Name" admin --sql   # prints an INSERT to paste into phpMyAdmin (see DATABASE-SETUP.md)
```

It prints a one-time password; log in at `/login` and set up two-step login when asked.

## 6. Test checklist

1. `/api/health` ok; `/` goes to `/resume-score`; `/events` goes to `https://growqr.ai/events`.
2. Sign up as a student, confirm the email, score a resume at `/passport`, publish and open `/v/CODE`.
3. Log in as the admin: `/console` (queue, colleges, studio, abroad, analytics), `/crm`, `/counselor`.
4. Employer: post a role, approve it in `/console`, apply as a student.
5. `/study-abroad`, upload a document under `/abroad/documents`, verify it as admin.
6. Old link `/v.php?c=CODE` answers 308 to `/v/CODE`.
7. Razorpay test payment in Resume Studio (set the webhook to `https://qrscore.mathstudy.in/api/studio/webhook`).
8. Wait ten minutes: the cron call returns `{"status":"ok",...}` (check in the Hostinger cron log).

## 7. Updating and going back

- **Update:** push to `main`, wait for the green workflow, then press "Redeploy" (or let auto-deploy pull `deploy`).
- **Back to PHP:** detach the domain from the Node app and re-add the `qrscore` subdomain to the PHP site. The database is shared and every portal change is additive, so the PHP app keeps working.
- **Logs:** Hostinger -> the app -> Logs. Start-up prints `[portal] migrations: ...` and `[portal] catalogues: ...`.
- **"Application failed to start":** check that `HOSTNAME=0.0.0.0`, that Node is 20 or 22, and that the branch is `deploy` (not `main`).
- **Memory:** the running server needs roughly 200 to 300 MB. `DATABASE_POOL_MAX=3` lowers the connection use.

## 8. Going live later

Remove `SITE_NOINDEX`, and check the Resend domain, the Razorpay live keys and the real `PASSPORT_SIGNING_SEED`. When you later fold the portal into growqr.ai itself, the domain changes: use the "re-issue passports" button in `/console/analytics?tab=system` and keep this host as a redirect.

## 9. "The site still shows the old page / /api/health says database not configured"

Open `https://qrscore.mathstudy.in/api/health`. The `settings` part lists which variables the running app can see (true or false, never the values). If `SITE_MODE` and `DATABASE_URL` are `false`, Hostinger is not passing the dashboard variables to the app. Try, in this order:

1. Check they are saved on the **Node app's** Environment page (not on another site), then **Redeploy** (a restart alone may not pick them up).
2. Fallback that does not depend on the dashboard: in hPanel -> File Manager, open the app's folder (the one containing `server.js`) and create a file named `.env.production` with one `NAME=value` per line (the same names as the table in section 2). The app reads it at start-up, before the first request. Real environment variables, when present, win over the file. Restart the app afterwards. If a redeploy wipes the folder, create the file again; keep a copy of it somewhere safe, because it holds secrets.


## 10. Making the community, blog, events and experts pages show real content

Those pages read the main site's data. On this host they work only when it has the same settings as growqr.ai (Vercel -> the growqr.ai project -> Settings -> Environment Variables). Copy these, using the same names:

| Name | What it makes work |
|---|---|
| `BLOGFORGE_API_URL`, `BLOGFORGE_API_KEY`, `NEXT_PUBLIC_BLOGFORGE_URL`, `NEXT_PUBLIC_BLOGFORGE_SITE_SLUG` | the blog engine. Without them /blog shows a few sample posts ("demo mode") |
| `RESEND_API_KEY` | emails (event registration, expert booking) |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (build secret), `TURNSTILE_SECRET_KEY` | bot check on forms (add this host to the widget's allowed hostnames) |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID`, `NEXT_PUBLIC_ZOHO_SALESIQ_WIDGET_CODE` | optional: analytics and the chat widget |

Events, experts and the other site data now live in the same MySQL database as the portal (`DATABASE_URL`); uploads go to `STORAGE_DIR`.

## Preview builds from `dev`

Pushing to `dev` runs the same workflow but publishes to the branch **`deploy-dev`** (production `deploy` is never touched). For a test site, set the Hostinger app's **Branch** to `deploy-dev` instead of `deploy`. Never point Hostinger at `dev` or `main`: those hold source code, not a built server, so there is nothing for `node server.js` to run.
