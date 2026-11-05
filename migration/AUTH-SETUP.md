# Sign-in setup: Google, LinkedIn and the human check

Login and sign-up work with **email and password out of the box**. Google and LinkedIn sign-in and Cloudflare Turnstile each need keys. Until a provider has its keys, its button is hidden on the live site.

## What protects the login

| Layer | What it does | Where |
|---|---|---|
| Human check | Every email sign-in, sign-up and password-reset form must pass it. Cloudflare Turnstile when its keys are set; otherwise a built-in proof-of-work check that runs by itself in the browser. Never fails open. | `lib/portal/captcha.ts` |
| Honeypot | A hidden field bots fill in. | `components/portal/auth-controls.tsx` |
| Rate limits | 5 wrong passwords per account and 25 per network per 15 minutes; 10 sign-ups per network; provider sign-ins 30 per network. | `lib/portal/auth.ts`, `oauth-accounts.ts` |
| Passwords | bcrypt hashes, a blocklist, no name or email inside, and a check against known data breaches (only the first 5 characters of a SHA-1 are sent, never the password). | `password.ts`, `pwned.ts` |
| Two-step login | Optional authenticator app for everyone; required for staff. Provider sign-in is refused for staff accounts. | `auth.ts` |
| Sessions | Random token in an httpOnly cookie, hashed in the database, 14 days absolute and 7 days idle, replaced at login. | `session.ts` |
| Provider sign-in | OAuth with a one-time `state` kept in the server session, PKCE for Google, only verified emails, and an unverified password account that gets linked has its password replaced and its sessions ended. | `oauth.ts`, `oauth-accounts.ts` |

## 1. Run the database migration

`PORTAL_AUTO_MIGRATE=1` applies `20261023000001_oauth_identities.sql` on the next start. It adds the `oauth_identities` table.

## 2. Google

1. Open https://console.cloud.google.com, create or choose a project, then **APIs and Services, OAuth consent screen**. Choose **External**, fill in the app name and support email, and add your domain. Scopes: `openid`, `email`, `profile`. Publish the app (move it out of "Testing") so any Google account can sign in.
2. **Credentials, Create credentials, OAuth client ID, Web application.**
3. **Authorised redirect URIs:** add one for each address you use, exactly:
   - `https://qrscore.mathstudy.in/auth/google/callback`
   - `https://www.growqr.ai/auth/google/callback` (when the main domain is ready)
4. Copy the client ID and client secret into the Hostinger app:

```
GOOGLE_CLIENT_ID=...apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=...
```

## 3. LinkedIn

1. Open https://www.linkedin.com/developers/apps and create an app (it needs a LinkedIn Page for the company).
2. On the **Products** tab, request **Sign In with LinkedIn using OpenID Connect**.
3. On the **Auth** tab, under **OAuth 2.0 settings**, add the redirect URLs:
   - `https://qrscore.mathstudy.in/auth/linkedin/callback`
   - `https://www.growqr.ai/auth/linkedin/callback`
4. Copy the client ID and primary client secret:

```
LINKEDIN_CLIENT_ID=...
LINKEDIN_CLIENT_SECRET=...
```

## 4. Cloudflare Turnstile (recommended)

1. In the Cloudflare dashboard open **Turnstile**, add a site for your domain, and choose **Managed**.
2. Add to the Hostinger app:

```
TURNSTILE_SITE_KEY=...
TURNSTILE_SECRET_KEY=...
```

Without these two the built-in human check is used, so login stays protected either way. To switch the check off while developing, set `PORTAL_CAPTCHA=off`. Never do that on the live site.

## 5. Redeploy and test

Add the variables, click **Redeploy**, then open `/login`:

- "Continue with Google" and "Continue with LinkedIn" appear once their keys are set.
- A failed or cancelled provider sign-in returns to `/login` with a clear message.
- `PORTAL_APP_URL` must be the public address (`https://qrscore.mathstudy.in`) so the redirect address matches what you registered.

## Notes

- A new provider account becomes a **student** (or a teacher or parent when chosen on the sign-up tab). **Employers** sign up with a work email on the form so the company can be verified. **Staff** accounts cannot use provider sign-in.
- A person who signs up with Google can still set a password later with **Forgot your password**.
- Optional: `PORTAL_PWNED_CHECK=off` turns off the data-breach password check.
