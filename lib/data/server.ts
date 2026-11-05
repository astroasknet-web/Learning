import { databaseConfigured } from "@/lib/portal/db";
import { createDataClient, type DataClient } from "./client";
import { storage } from "./storage";

/**
 * True when the database is configured (DATABASE_URL). Lets read paths degrade gracefully (return empty data) instead of throwing on
 * a deploy that has no database yet. The functions below still throw when it is missing, so write paths fail loudly rather than
 * silently dropping data when they do expect a database.
 */
export function isDatabaseConfigured(): boolean {
  return databaseConfigured();
}

let client: DataClient | null = null;

/** The server-side client for the marketing tables (forms, applications, bookings, the chat bot, the admin log). */
export function createAdminClient(): DataClient {
  if (!databaseConfigured()) throw new Error("DATABASE_URL is not set");
  return (client ??= createDataClient(storage));
}

/** Kept for call sites that used the public-key client for tables with open insert rules. Every write goes through the server now. */
export function createAnonServerClient(): DataClient {
  return createAdminClient();
}
