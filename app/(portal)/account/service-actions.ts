"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/portal/guard";
import { claimService } from "@/lib/pay/services";

/** Ask for one of the plan's included services. The plan, the count left and the duplicate check are all decided on the server in claimService. */
export async function claimServiceAction(fd: FormData): Promise<void> {
  const me = await requireUser("student");
  const r = await claimService({ id: me.id, name: me.name, email: me.email }, String(fd.get("service") ?? ""), String(fd.get("note") ?? ""));
  redirect(`/account?${r.ok ? `svc=ok&t=${encodeURIComponent(r.ticketNo)}` : `svc=err&e=${encodeURIComponent(r.error)}`}#services`);
}
