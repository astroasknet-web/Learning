"use server";

import { redirect } from "next/navigation";
import { adminGate } from "../gate";
import { isTicketNo, replySchema } from "@/lib/support/model";
import { staffAssign, staffReply, staffSetPriority, staffSetStatus } from "@/lib/support/store";

/** The team's side of support. Every action re-checks that the caller is a signed-in administrator with two-step login on. */
const text = (fd: FormData, k: string): string => (typeof fd.get(k) === "string" ? String(fd.get(k)) : "");
const go = (no: string, key: "e" | "ok", msg: string): never => redirect(`/console/support/${no}?${key}=${encodeURIComponent(msg)}`);

async function staff(no: string) {
  if (!isTicketNo(no)) redirect("/console/support");
  const me = await adminGate(`/console/support/${no}`);
  return { id: me.id, name: me.name, email: me.email };
}

export async function replyStaffAction(fd: FormData): Promise<void> {
  const no = text(fd, "no");
  const me = await staff(no);
  const parsed = replySchema.safeParse({ body: text(fd, "body") });
  if (!parsed.success) go(no, "e", parsed.error.issues[0]?.message ?? "Write a reply.");
  else {
    const r = await staffReply(me, no, parsed.data.body, text(fd, "internal") === "1", text(fd, "status") || undefined);
    go(no, r.ok ? "ok" : "e", r.ok ? (text(fd, "internal") === "1" ? "Internal note added." : "Reply sent to the customer.") : r.error);
  }
}

export async function statusStaffAction(fd: FormData): Promise<void> {
  const no = text(fd, "no");
  const me = await staff(no);
  const r = await staffSetStatus(me, no, text(fd, "status"));
  go(no, r.ok ? "ok" : "e", r.ok ? "Status updated." : r.error);
}

export async function priorityStaffAction(fd: FormData): Promise<void> {
  const no = text(fd, "no");
  const me = await staff(no);
  const r = await staffSetPriority(me, no, text(fd, "priority"));
  go(no, r.ok ? "ok" : "e", r.ok ? "Priority updated." : r.error);
}

export async function assignStaffAction(fd: FormData): Promise<void> {
  const no = text(fd, "no");
  const me = await staff(no);
  const id = Number(text(fd, "assigned_to"));
  const r = await staffAssign(me, no, Number.isInteger(id) && id > 0 ? id : null);
  go(no, r.ok ? "ok" : "e", r.ok ? "Assignment updated." : r.error);
}
