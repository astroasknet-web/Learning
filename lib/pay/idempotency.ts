import { first, exec, pool } from "./db";
import { sha256 } from "./ids";

/**
 * Idempotency for API calls that create something. The first call with a key stores its response; a repeat with the same key and the same
 * body returns that response without doing the work again; the same key with a different body is refused.
 */
export class IdempotencyConflict extends Error {
  constructor(public readonly code: "key_reuse" | "in_progress") {
    super(code === "key_reuse" ? "This idempotency key was used with a different request." : "A request with this key is still being processed.");
  }
}

export async function withIdempotency<T>(scope: string, key: string | null, body: unknown, work: () => Promise<{ status: number; body: T }>): Promise<{ status: number; body: T; replayed: boolean }> {
  if (!key) return { ...(await work()), replayed: false };
  if (!/^[A-Za-z0-9_\-:.]{8,100}$/.test(key)) throw new Error("Invalid Idempotency-Key");
  const hash = sha256(JSON.stringify(body));
  const inserted = await exec(pool, "INSERT IGNORE INTO pay_idempotency (scope, idem_key, request_hash) VALUES ($1,$2,$3)", [scope, key, hash]);
  if (inserted === 0) {
    const row = await first<{ request_hash: string; response: string | null; status_code: number | null }>(pool, "SELECT request_hash, response, status_code FROM pay_idempotency WHERE scope = $1 AND idem_key = $2", [scope, key]);
    if (!row) throw new IdempotencyConflict("in_progress");
    if (row.request_hash !== hash) throw new IdempotencyConflict("key_reuse");
    if (row.response === null || row.status_code === null) throw new IdempotencyConflict("in_progress");
    return { status: row.status_code, body: JSON.parse(row.response) as T, replayed: true };
  }
  try {
    const out = await work();
    await exec(pool, "UPDATE pay_idempotency SET response = $1, status_code = $2 WHERE scope = $3 AND idem_key = $4", [JSON.stringify(out.body), out.status, scope, key]);
    return { ...out, replayed: false };
  } catch (e) {
    await exec(pool, "DELETE FROM pay_idempotency WHERE scope = $1 AND idem_key = $2 AND response IS NULL", [scope, key]); // let the caller retry with the same key
    throw e;
  }
}
