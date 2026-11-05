-- Read-only demo accounts (for example an administrator login shown to investors). A demo account can open every screen its role can,
-- but the server treats it as signed out on any request that would change or bulk-download data. See lib/portal/demo.ts.
ALTER TABLE users ADD COLUMN is_demo TINYINT NOT NULL DEFAULT 0;
