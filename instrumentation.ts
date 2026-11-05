/**
 * Runs once when the Node server starts. With PORTAL_AUTO_MIGRATE=1 the portal's database schema is brought up to date before the first
 * request (idempotent migrations, safe with several servers). Leave it unset where migrations are applied some other way.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startup } = await import("./instrumentation-node");
    await startup();
  }
}
