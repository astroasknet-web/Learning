import { first, pool, exec, txRetry, type Db } from "./db";
import { PayError } from "./orders";
import { planInfo } from "./plans";
import { PLAN_SERVICES, SERVICE_LABEL, WINDOW_DAYS, type Allowance, type ServiceKey } from "../market/plan-services";
import { createTicket } from "../support/store";

/**
 * Staff-delivered services that come with a plan (career counselling, expert resume review, ...). The count a plan allows is in
 * lib/market/plan-services.ts. Asking for one records a claim and opens a support ticket, so a person on the team picks it up and replies there.
 * A claim counts for the window it was made in (30 days or 365 days), so it renews by itself, and a lapsed plan has nothing left to ask for.
 */
export interface ServiceLine { key: ServiceKey; name: string; what: string; allowance: Allowance; used: number; left: number }

const isKey = (k: string): k is ServiceKey => Object.prototype.hasOwnProperty.call(SERVICE_LABEL, k);

async function usedIn(db: Db, userId: number, key: ServiceKey, per: Allowance["per"]): Promise<number> {
  const r = await first<{ n: number }>(db, "SELECT COUNT(*) AS n FROM plan_service_claims WHERE user_id = $1 AND service = $2 AND claimed_at > (NOW() - INTERVAL " + WINDOW_DAYS[per] + " DAY)", [userId, key]);
  return Number(r?.n ?? 0);
}

/** What the person's current plan includes and how much of it is left. Empty for the free plan and for Pro. */
export async function serviceLines(userId: number, db: Db = pool): Promise<ServiceLine[]> {
  const plan = await planInfo(userId, db);
  if (!plan) return [];
  const out: ServiceLine[] = [];
  for (const [k, a] of Object.entries(PLAN_SERVICES[plan.key]) as Array<[ServiceKey, Allowance]>) {
    const used = await usedIn(db, userId, k, a.per);
    out.push({ key: k, ...SERVICE_LABEL[k], allowance: a, used, left: Math.max(0, a.count - used) });
  }
  return out;
}

export type ClaimResult = { ok: true; ticketNo: string } | { ok: false; error: string };

/** Ask for one of the plan's included services. The claim is checked and written with the student's row locked, so quick double clicks cannot go over the count. */
export async function claimService(user: { id: number; name: string; email: string }, service: string, note = ""): Promise<ClaimResult> {
  if (!isKey(service)) return { ok: false, error: "That service is not part of the plan." };
  let claimId = 0;
  try {
    await txRetry(async (c) => {
      await first(c, "SELECT id FROM users WHERE id = $1 FOR UPDATE", [user.id]);
      const plan = await planInfo(user.id, c);
      if (!plan) throw new PayError("no_plan", "Your plan is not active. Choose a plan to use its included services.", 403);
      const a = (PLAN_SERVICES[plan.key] as Partial<Record<ServiceKey, Allowance>>)[service];
      if (!a) throw new PayError("not_included", `The ${plan.name} plan does not include this service.`, 403);
      if ((await usedIn(c, user.id, service, a.per)) >= a.count) throw new PayError("none_left", `You have used all ${a.count} of this service in your ${plan.name} plan for now. It renews ${a.per === "month" ? "every month" : "every year"}.`, 409);
      await exec(c, "INSERT INTO plan_service_claims (user_id, service) VALUES ($1,$2)", [user.id, service]);
      claimId = Number((await first<{ id: number }>(c, "SELECT MAX(id) AS id FROM plan_service_claims WHERE user_id = $1", [user.id]))?.id ?? 0);
    });
  } catch (e) {
    if (e instanceof PayError) return { ok: false, error: e.message };
    throw e;
  }
  const label = SERVICE_LABEL[service];
  const t = await createTicket({ id: user.id, name: user.name, email: user.email }, {
    category: service === "overseas-counselling" || service === "mock-visa-interview" || service === "expert-shortlist" ? "abroad" : "other",
    subject: `Included service: ${label.name}`,
    related_ref: `service-${service}`,
    body: `I would like to use my plan's included service: ${label.name}.\n${label.what}.${note.trim() ? `\n\nNote: ${note.trim().slice(0, 1000)}` : ""}`,
  });
  if (!t.ok || t.duplicate) {
    await exec(pool, "DELETE FROM plan_service_claims WHERE id = $1", [claimId]); // nothing reached the team, so nothing is used up
    return { ok: false, error: t.ok ? "You already asked for this today. Check your support tickets for the reply." : t.error };
  }
  await exec(pool, "UPDATE plan_service_claims SET ticket_no = $1 WHERE id = $2", [t.no, claimId]);
  return { ok: true, ticketNo: t.no };
}
