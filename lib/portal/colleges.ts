import "server-only";
import { createHash } from "node:crypto";
import { all, one, tx, val } from "./db";
import { COLLEGE_STATES } from "@/components/portal/college-states";
import { searchBundled } from "./college-list";
import { norm, similar, PROMOTE_AT, type Match } from "../admin/institutions";

/**
 * The student side of the college directory (port of Institutions::submit and college-suggest.php). A missing college is stored as
 * "pending" and joins the public search once PROMOTE_AT different people submit the same name and state, or an admin approves it.
 */
export const DAILY_LIMIT = 5;
export const STATES = COLLEGE_STATES;

/** Type-ahead: prefix matches first, then word-start, then anywhere; universities before colleges. */
export async function suggest(raw: string): Promise<Array<{ name: string; place: string }>> {
  const q = Array.from(raw.replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/g, " ").trim().toLowerCase()).slice(0, 60).join("");
  if (Array.from(q).length < 2) return [];
  const esc = q.replace(/[\\%_]/g, "\\$&");
  const rows = await all<{ name: string; state: string | null; district: string | null }>(
    `SELECT name, state, district FROM institutions WHERE status = 'approved' AND (name_norm LIKE $1 OR name_norm LIKE $2)
     ORDER BY (CASE WHEN name_norm LIKE $1 THEN 0 ELSE 1 END), (CASE WHEN kind = 'university' THEN 0 ELSE 1 END), length(name), name LIMIT 8`,
    [`${esc}%`, `% ${esc}%`],
  );
  const title = (s: string) => s.toLowerCase().replace(/\b\p{L}/gu, (m) => m.toUpperCase());
  return topUp(rows.map((r) => ({ name: r.name, place: [r.district ? title(r.district) : null, r.state].filter(Boolean).join(", ") })), raw);
}

/** Fill the dropdown from the bundled college list when the directory has fewer than 8 matches (or the database is not reachable). */
export function topUp(found: Array<{ name: string; place: string }>, raw: string): Array<{ name: string; place: string }> {
  if (found.length >= 8) return found;
  const seen = new Set(found.map((f) => norm(f.name)));
  for (const name of searchBundled(raw, 16)) {
    if (found.length >= 8) break;
    if (!seen.has(norm(name))) { seen.add(norm(name)); found.push({ name, place: "" }); }
  }
  return found;
}

export type SubmitResult = { status: "invalid" | "limit"; message: string } | { status: "similar"; matches: Match[] } | { status: "exists" | "pending" | "approved"; name: string };

/** Who is submitting: the signed-in user, or a hash of the visitor's address (someone still on the signup page). */
export const submitterKey = (userId: number | null, ip: string): string => (userId ? `u${userId}` : `i${createHash("sha256").update(`${ip}|growqr-college`).digest("hex").slice(0, 24)}`);

export async function submit(userId: number | null, ip: string, nameIn: string, state: string, cityIn: string, force = false): Promise<SubmitResult> {
  const name = nameIn.replace(/\s+/g, " ").trim();
  const city = cityIn.replace(/\s+/g, " ").trim();
  const okChars = /^[\p{L}\p{N} .,&()'\-/]+$/u;
  const len = (s: string) => Array.from(s).length;
  if (len(name) < 4 || len(name) > 120 || !okChars.test(name) || !/\p{L}{3}/u.test(name)) return { status: "invalid", message: "Enter the full name of your college (4 to 120 letters)." };
  if (!STATES.includes(state)) return { status: "invalid", message: "Choose the state your college is in." };
  if (city !== "" && (len(city) > 80 || !okChars.test(city))) return { status: "invalid", message: "The city name looks wrong." };
  const who = submitterKey(userId, ip);
  const recent = Number(await val("SELECT COUNT(*) FROM institution_submissions WHERE submitter = $1 AND created_at > LOCALTIMESTAMP(0) - INTERVAL '1 day'", [who]));
  if (recent >= DAILY_LIMIT) return { status: "limit", message: "You have added several colleges today. Please try again tomorrow." };

  const n = Array.from(norm(name)).slice(0, 255).join("");
  const exact = await one<{ name: string }>("SELECT name FROM institutions WHERE status = 'approved' AND name_norm = $1 AND state = $2 LIMIT 1", [n, state]);
  if (exact) return { status: "exists", name: exact.name };
  if (!force) {
    const matches = await similar(name, state);
    if (matches.length) return { status: "similar", matches };
  }
  const slug = `${Array.from(n.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")).slice(0, 80).join("")}~${state.replace(/[^A-Za-z]+/g, "").toLowerCase() || "in"}`.slice(0, 120);
  try {
    return await tx(async (c) => {
      const kind = /universit/i.test(name) ? "university" : "college";
      await c.query(
        `INSERT INTO institutions (source, source_id, name, name_norm, kind, state, district, status, submit_count) VALUES ('student', $1, $2, $3, $4, $5, $6, 'pending', 0) ON CONFLICT (source, source_id) DO NOTHING`,
        [slug, name.slice(0, 255), n, kind, state, city === "" ? null : city],
      );
      const row = (await c.query("SELECT id, name, status FROM institutions WHERE source = 'student' AND source_id = $1", [slug])).rows[0];
      if (!row || row.status === "rejected") return { status: "invalid" as const, message: "That college cannot be added. Please type the name in full on your profile instead." };
      await c.query("INSERT INTO institution_submissions (institution_id, submitter, typed_name) VALUES ($1, $2, $3) ON CONFLICT (institution_id, submitter) DO NOTHING", [row.id, who, name.slice(0, 255)]);
      const count = Number((await c.query("SELECT COUNT(*) AS n FROM institution_submissions WHERE institution_id = $1", [row.id])).rows[0].n);
      const status = row.status === "pending" && count >= PROMOTE_AT ? "approved" : String(row.status);
      await c.query("UPDATE institutions SET submit_count = $1, status = $2, updated_at = LOCALTIMESTAMP(0) WHERE id = $3", [count, status, row.id]);
      return { status: status === "approved" ? ("approved" as const) : ("pending" as const), name: String(row.name) };
    });
  } catch (e) {
    console.error("college submit:", (e as Error).message);
    return { status: "invalid", message: "Could not save that right now. You can still type the name in full." };
  }
}
