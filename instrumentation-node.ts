import { runPortalMigrations } from "./lib/portal/migrate";
import { seedCatalogues } from "./lib/portal/seed";

/**
 * Node-only start-up work (kept out of instrumentation.ts so the edge bundle never sees the database driver).
 *
 * 1. Some hosts (Hostinger among them) do not hand dashboard environment variables to a pre-built server. As a fallback, a file named
 *    `.env.production` (or `.env`) placed next to server.js is read here, before the first request. Real environment variables win.
 * 2. With PORTAL_AUTO_MIGRATE=1, the database schema and the course/university catalogues are brought up to date.
 */
export async function startup() {
  try {
    const { loadEnvConfig } = await import("@next/env");
    loadEnvConfig(process.cwd(), false);
  } catch (e) {
    console.error("[portal] could not read the .env file:", (e as Error).message);
  }
  if (process.env.PORTAL_AUTO_MIGRATE !== "1" || !process.env.DATABASE_URL) return;
  try {
    const r = await runPortalMigrations(process.env.DATABASE_URL);
    console.log(`[portal] migrations: ${r.applied.length} applied now, ${r.all.length - r.applied.length} already in place`);
    console.log(`[portal] catalogues: ${(await seedCatalogues()).join("; ")}`);
  } catch (e) {
    console.error("[portal] migrations failed:", (e as Error).message); // keep serving; the error is in the log
  }
}
