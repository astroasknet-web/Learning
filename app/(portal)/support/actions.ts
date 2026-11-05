"use server";

import { redirect } from "next/navigation";
import { currentUser } from "@/lib/portal/guard";
import { newTicketSchema, ratingSchema, replySchema, isTicketNo } from "@/lib/support/model";
import { createTicket, rate, replyAsUser } from "@/lib/support/store";
import { humanCheck } from "@/lib/portal/captcha";

/** The person's side of support. Every action starts from the signed-in account: a ticket can only be raised, read or answered by its owner. */
async function me() {
  const u = await currentUser();
  if (!u) redirect("/login?next=" + encodeURIComponent("/support/new"));
  return { id: u.id, name: u.name, email: u.email };
}
const back = (path: string, key: "e" | "ok", text: string): never => redirect(`${path}${path.includes("?") ? "&" : "?"}${key}=${encodeURIComponent(text)}`);
const text = (fd: FormData, k: string): string => (typeof fd.get(k) === "string" ? String(fd.get(k)) : "");

export async function newTicketAction(fd: FormData): Promise<void> {
  const user = await me();
  if (!(await humanCheck(fd, "support-new"))) return back("/support/new", "e", "The security check was not right. Please try again with the new code.");
  const parsed = newTicketSchema.safeParse({ category: text(fd, "category"), subject: text(fd, "subject"), related_ref: text(fd, "related_ref"), body: text(fd, "body") });
  if (!parsed.success) back("/support/new", "e", parsed.error.issues[0]?.message ?? "Please check the form.");
  else {
    const r = await createTicket(user, parsed.data);
    if (!r.ok) back("/support/new", "e", r.error);
    else redirect(`/support/tickets/${r.no}?${r.duplicate ? "ok=" + encodeURIComponent("You already sent this ticket, so we opened it for you.") : "new=1"}`);
  }
}

export async function replyAction(fd: FormData): Promise<void> {
  const user = await me();
  const no = text(fd, "no");
  if (!isTicketNo(no)) redirect("/support/tickets");
  const path = `/support/tickets/${no}`;
  if (!(await humanCheck(fd, "support-reply"))) return back(path, "e", "The security check was not right. Please try again with the new code.");
  const parsed = replySchema.safeParse({ body: text(fd, "body") });
  if (!parsed.success) back(path, "e", parsed.error.issues[0]?.message ?? "Write your reply.");
  else {
    const r = await replyAsUser(user, no, parsed.data.body);
    if (!r.ok) back(path, "e", r.error);
    else redirect(`${path}?sent=1#latest`);
  }
}

export async function rateAction(fd: FormData): Promise<void> {
  const user = await me();
  const no = text(fd, "no");
  if (!isTicketNo(no)) redirect("/support/tickets");
  const path = `/support/tickets/${no}`;
  const parsed = ratingSchema.safeParse({ rating: text(fd, "rating"), comment: text(fd, "comment") });
  if (!parsed.success) back(path, "e", "Choose a rating from 1 to 5.");
  else {
    const r = await rate(user, no, parsed.data.rating, parsed.data.comment);
    back(path, r.ok ? "ok" : "e", r.ok ? "Thank you for the feedback." : r.error);
  }
}
