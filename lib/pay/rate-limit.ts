import { fails, recordFail } from "@/lib/portal/security";

/**
 * A small sliding-window limiter on the shared `auth_throttle` table. Returns true when the call is allowed (and counts it).
 * Use a bucket per action and per caller, for example `pay:order:ip:1.2.3.4`.
 */
export async function allow(bucket: string, max: number, windowMinutes: number): Promise<boolean> {
  if ((await fails(bucket, windowMinutes)) >= max) return false;
  await recordFail(bucket);
  return true;
}
