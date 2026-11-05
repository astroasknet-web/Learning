/**
 * Applies the portal's database migrations (db/migrations/2026*.sql) that this database has not seen yet.
 * See migration/DATABASE-SETUP.md.
 *
 *   DATABASE_URL=mysql://... npx tsx scripts/portal-migrate.ts            apply what is pending
 *   DATABASE_URL=mysql://... npx tsx scripts/portal-migrate.ts --status   only list applied / pending
 */
import { runPortalMigrations } from "../lib/portal/migrate";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const status = process.argv.includes("--status");
  const r = await runPortalMigrations(url, { statusOnly: status });
  for (const f of r.all) console.log(`${status ? (r.pending.includes(f) ? "  PENDING " : "  applied ") : r.applied.includes(f) ? "applied now " : "in place    "}${f}`);
  if (status) console.log(`${r.all.length - r.pending.length} applied, ${r.pending.length} pending`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
