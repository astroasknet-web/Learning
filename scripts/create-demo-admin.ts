/**
 * Creates (or resets the password of) a READ-ONLY demo administrator login, for showing the admin dashboard to investors.
 * The account sees every admin screen but cannot change anything or download exports (see lib/portal/demo.ts).
 * Run `npm run portal:migrate` first (it adds users.is_demo).
 *
 *   DATABASE_URL=mysql://... npx tsx scripts/create-demo-admin.ts investors@example.com        create, or reset the password
 *   DATABASE_URL=mysql://... npx tsx scripts/create-demo-admin.ts investors@example.com --remove   delete the login and its sessions
 *
 * The password is generated here, printed once, and stored only as a bcrypt hash.
 */
import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import mysql from "mysql2/promise";
import { connectionConfig } from "../lib/portal/db";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
const password = (): string => Array.from({ length: 16 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const email = (process.argv[2] ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Give the demo login's email address, for example: investors@example.com");
  const db = await mysql.createConnection(connectionConfig(url));
  try {
    const [cols] = await db.query("SHOW COLUMNS FROM users LIKE 'is_demo'");
    if (!(cols as unknown[]).length) throw new Error("users.is_demo is missing: run `npm run portal:migrate` first");
    const [found] = await db.query("SELECT id, is_demo FROM users WHERE email = ?", [email]);
    const row = (found as Array<{ id: number; is_demo: number }>)[0];
    if (process.argv.includes("--remove")) {
      if (!row) return console.log("No such login.");
      if (!row.is_demo) throw new Error("That account is not a demo account, so it was left alone.");
      await db.query("DELETE FROM portal_sessions WHERE user_id = ?", [row.id]);
      await db.query("DELETE FROM users WHERE id = ?", [row.id]);
      return console.log(`Removed the demo login ${email}.`);
    }
    if (row && !row.is_demo) throw new Error("A real account already uses that email. Choose a different address for the demo login.");
    const pw = password();
    const hash = await bcrypt.hash(pw, 12);
    if (row) {
      await db.query("UPDATE users SET password_hash = ?, role = 'admin', is_demo = 1, email_verified_at = COALESCE(email_verified_at, NOW()) WHERE id = ?", [hash, row.id]);
      await db.query("DELETE FROM portal_sessions WHERE user_id = ?", [row.id]);
    } else {
      await db.query("INSERT INTO users (role, email, password_hash, name, email_verified_at, created_at, is_demo) VALUES ('admin', ?, ?, 'Investor Demo', NOW(), NOW(), 1)", [email, hash]);
    }
    console.log(`\nRead-only demo administrator\n  Sign in at: /login\n  Email:      ${email}\n  Password:   ${pw}\n\nShare the password securely. Re-run this command to change it; add --remove to delete the login.\n`);
  } finally {
    await db.end();
  }
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
