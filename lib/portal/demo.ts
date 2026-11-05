/**
 * Read-only demo accounts (for example an administrator login shown to investors).
 * The edge middleware stamps every request with `x-gq-block-demo` ("1" or "0") so the server never trusts anything the browser sends.
 * A demo account is treated as signed out on a request that would change data (any method other than GET or HEAD, which covers every
 * Server Action) or that would download data in bulk (exports and CSV files).
 */
export const BLOCK_DEMO_HEADER = "x-gq-block-demo";

const BULK = /(^|\/)(export|csv)(\/|$)/i;

export function blocksDemo(method: string, pathname: string): boolean {
  const m = method.toUpperCase();
  if (m !== "GET" && m !== "HEAD") return true;
  return BULK.test(pathname);
}
