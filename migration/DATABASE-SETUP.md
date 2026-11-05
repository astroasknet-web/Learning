# Database setup on Hostinger (MySQL)

GrowQR now keeps **everything** in one MySQL database: accounts, courses and progress, the LMS, Resume Studio, internships, study abroad, the CRM, and the marketing forms, applications, bookings, events and chat-bot data. There is no Supabase and no second database.

You create an empty database in Hostinger once. The app builds every table by itself the first time it starts.

## What needs the database

| Works with no database | Needs the database |
|---|---|
| Blog, home page, exam prep, JEE, NEET, AP, mock exams, CAT/SAT/GRE/SSC/CTET, school Class 1 to 12, Olympiad, IELTS, Vedic Maths, the course catalogue pages | Sign up and log in, enrol and save progress, the lesson player, teachers, classes and parents, Resume Studio, Skill Passport, internships, study abroad, the admin area, every form (contact, internship, ambassador, newsletter, waitlists, B2B), events, expert bookings, the chat bot |

## Step by step

### 1. Create the database (hPanel)

1. Log in to hPanel and open **Websites**, then your site, then **Databases**, then **Management** (on some plans: **MySQL Databases**).
2. Under **Create a new MySQL database and database user**, fill in:
   - **MySQL database name**: for example `growqr` (Hostinger adds a prefix, so the full name looks like `u123456789_growqr`).
   - **MySQL username**: for example `growqr` (full name like `u123456789_growqr`).
   - **Password**: a long random one. Avoid `@ : / ? # %` in it, or the connection string in step 2 gets harder to write.
3. Click **Create**. Write down the three values: the **full database name**, the **full user name** and the **password**.
4. The host is `localhost` when the database and the Node app are on the same Hostinger plan. If hPanel shows a different **Host** or an IP address on the database page, use that instead.

### 2. Give the app the connection string

The connection string is one line:

```
DATABASE_URL=mysql://u123456789_growqr:YourPassword@localhost:3306/u123456789_growqr
```

If the password has special characters, replace them with their codes (`@` is `%40`, `:` is `%3A`, `/` is `%2F`, `#` is `%23`, `%` is `%25`).

In hPanel open the **Node.js** application, then **Environment variables**, and add these (then **Save and redeploy**):

```
DATABASE_URL=mysql://<user>:<password>@localhost:3306/<database>
DATABASE_SSL=disable
PORTAL_AUTO_MIGRATE=1
PORTAL_APP_URL=https://qrscore.mathstudy.in
PASSPORT_SIGNING_SEED=<32 or more random characters>
STORAGE_DIR=/home/<your hostinger user>/growqr-storage
HOSTNAME=0.0.0.0
```

- `DATABASE_SSL=disable` is right for a database on the same plan (the connection never leaves the server). Only remove it if the host is a different server.
- `STORAGE_DIR` is the folder for uploaded files (resumes, documents, event photos). Put it **outside** the app folder so a redeploy never deletes uploads. Create the folder in File Manager first.
- `PASSPORT_SIGNING_SEED` can be any long random text. Keep it: changing it later makes old passports stop verifying.

If the app starts but `/api/health` says the database is not configured, Hostinger is not passing dashboard variables to the app. Put the same lines in a file named `.env.production` next to `server.js` (File Manager), one `NAME=value` per line, and restart. A redeploy can wipe that folder, so keep a copy. `HOSTINGER.md` section 9 has the details.

### 3. Start the app and check it

1. Redeploy (or restart) the Node app.
2. Open `https://qrscore.mathstudy.in/api/health`. You should see `{"ok":true,"database":"ok", ...}`.
3. In the Hostinger **Logs** you should see two lines on the first start:
   `[portal] migrations: 16 applied now, 0 already in place` and `[portal] catalogues: ...`. That means all tables were created and the 121 courses and the university list were loaded. Open `/courses` to confirm the courses show.

Nothing else needs to be created by hand. phpMyAdmin (Databases, then **phpMyAdmin**) is only for looking at the data.

### 4. Create the first admin

Admins sign in at `/login` (the admin area at `/admin` uses the same login, and asks for a two-step code the first time).

Easiest way, with no database access from your computer:

1. On your computer, in the project folder, run:

   ```bash
   npx tsx scripts/portal-create-user.ts you@example.com "Your Name" admin --sql
   ```

2. It prints an `INSERT INTO users ...` statement and a one-time password. In hPanel open **phpMyAdmin**, pick your database, click the **SQL** tab, paste the statement and click **Go**.
3. Sign in at `/login` with that email and password, then set up the two-step code when asked.

(Alternative: in hPanel **Databases, Remote MySQL** add your own IP address, then run the same command without `--sql` and with `DATABASE_URL` set to the Hostinger host name shown there instead of `localhost`.)

### 5. Moving to the main domain later

The database is not tied to the test domain. When the site moves to `growqr.ai`:

1. In phpMyAdmin choose **Export** (Quick, SQL) on the test database and **Import** it into the live database, or simply point the live app at the same database.
2. Change `PORTAL_APP_URL` to the new address and update the Google, LinkedIn and Turnstile redirect and hostname settings (see `AUTH-SETUP.md`).
3. Copy the `STORAGE_DIR` folder across if people have uploaded files.

## What it needs

| Item | Requirement |
|---|---|
| Engine | MySQL 8, or MariaDB 10.5 or newer (what Hostinger shared and cloud plans provide). Needs InnoDB and `utf8mb4` |
| Size | Under 500 MB in the first year, apart from uploaded files |
| Connections | `DATABASE_POOL_MAX=3` is enough on small plans (default 5) |
| Time zone | Stored and shown in UTC. `DB_TIMEZONE` can override it (an offset like `+00:00`) |
| Files | Stored on disk under `STORAGE_DIR` (default `./storage`) |

Other settings, each for one feature: `RESEND_API_KEY` and `PORTAL_MAIL_FROM` (emails), `CRON_SECRET` (the 10-minute job), `RAZORPAY_*` (Resume Studio Pro and expert bookings), `ADZUNA_APP_ID` and `ADZUNA_APP_KEY` (internships from the web), `TURNSTILE_SECRET_KEY` (bot check).

## How the tables are managed

- All schema files are in `db/migrations/` (`2026*.sql`). The app runs the ones it has not seen before on start (when `PORTAL_AUTO_MIGRATE=1`), and records each in the `schema_meta` table. You can also run them by hand: `DATABASE_URL=... npm run portal:migrate` (add `-- --status` to only list).
- To change the schema later, add a new file with a later date in its name; never edit one that has already run.
- The marketing tables (forms, applications, bookings, events, the bot) are in `20261101000001_marketing.sql` and `20261101000002_events_incidents.sql`.

## Test it on your own computer

Any MySQL 8 or MariaDB server works. With an empty database called `growqr_test`:

```bash
DATABASE_SSL=disable DATABASE_URL=mysql://root@127.0.0.1:3306/growqr_test npm run portal:migrate
DATABASE_SSL=disable DATABASE_URL=mysql://root@127.0.0.1:3306/growqr_test npx tsx scripts/courses-sync.ts
DATABASE_SSL=disable PORTAL_TEST_DATABASE_URL=mysql://root@127.0.0.1:3306/growqr_test npx vitest run
```

Run the tests against a scratch database, never the live one.
