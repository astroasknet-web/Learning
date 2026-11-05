/**
 * Developer helper: print the current authenticator code for a setup key (what the phone app would show).
 *   npx tsx scripts/portal-totp.ts "ABCD EFGH ..."        current code
 *   npx tsx scripts/portal-totp.ts "ABCD EFGH ..." 1      the next 30-second code
 * Local testing only: never use it with a real person's key.
 */
import { code } from "../lib/portal/totp";

const secret = (process.argv[2] ?? "").replace(/\s+/g, "");
if (!secret) {
  console.error("Usage: npx tsx scripts/portal-totp.ts <setup key> [step offset]");
  process.exit(1);
}
console.log(code(secret, Math.floor(Date.now() / 30000) + Number(process.argv[3] ?? 0)));
