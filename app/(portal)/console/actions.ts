"use server";

import { redirect } from "next/navigation";
import { one } from "@/lib/portal/db";
import { putSessionData } from "@/lib/portal/session";
import * as AB from "@/lib/abroad/store";
import * as CN from "@/lib/abroad/counsel";
import * as IN from "@/lib/admin/institutions";
import * as JB from "@/lib/market/jobs";
import * as NT from "@/lib/market/notify";
import * as PS from "@/lib/portal/passport/share";
import * as SA from "@/lib/studio/access";
import { adminGate } from "./gate";

/** Administrator Server Actions. Each one re-checks the admin gate; the page that rendered the form proves nothing. */
const flash = (kind: "ok" | "err", text: string) => putSessionData({ console_flash: [kind, text] });
const s = (fd: FormData, k: string): string => String(fd.get(k) ?? "").trim();
const n = (fd: FormData, k: string): number => parseInt(s(fd, k), 10) || 0;

export async function roleDecisionAction(fd: FormData): Promise<void> {
  await adminGate("/console");
  const id = n(fd, "id");
  const act = s(fd, "act");
  const job = id ? await JB.byId(id) : null;
  if (!job || job.status !== "pending" || !["approve", "reject"].includes(act)) await flash("err", "That role is no longer waiting for review.");
  else {
    await JB.setStatus(id, act === "approve" ? "live" : "rejected");
    await NT.roleDecided(id, act === "approve");
    if (act === "approve" && fd.get("escrow")) await JB.setBadge(id, "Verified stipend");
    await flash("ok", act === "approve" ? "Role approved and live." : "Role rejected.");
  }
  redirect("/console");
}

export async function collegeAction(fd: FormData): Promise<void> {
  const me = await adminGate("/console/colleges");
  const id = n(fd, "id");
  const act = s(fd, "act");
  if (id && act === "approve") {
    await IN.approve(id, me.id);
    await flash("ok", "College approved and now searchable.");
  } else if (id && act === "reject") {
    await IN.reject(id, me.id);
    await flash("ok", "College rejected.");
  } else if (id && act === "merge") {
    await (await IN.mergeInto(id, n(fd, "target"), me.id) ? flash("ok", "Merged. Students who typed it now show the existing college.") : flash("err", "Could not merge that one."));
  }
  redirect("/console/colleges");
}

export async function studioPlanAction(fd: FormData): Promise<void> {
  await adminGate("/console/studio");
  const email = s(fd, "email").toLowerCase();
  const user = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? await one<{ id: number; name: string }>("SELECT id, name FROM users WHERE email = $1 AND role = 'student'", [email]) : null;
  if (!user) await flash("err", "No student account has that email.");
  else if (s(fd, "act") === "grant") {
    const days = s(fd, "days") === "" ? SA.LIFETIME_DAYS : Math.max(1, Math.min(366, n(fd, "days")));
    await SA.grant(user.id, "admin", null, 0, days);
    await flash("ok", `Pro access granted to ${user.name}${days >= SA.LIFETIME_DAYS ? " for life." : ` for ${days} days.`}`);
  } else if (s(fd, "act") === "revoke") {
    await SA.revoke(user.id);
    await flash("ok", `Pro access ended for ${user.name}.`);
  }
  redirect("/console/studio");
}

export async function abroadOpsAction(fd: FormData): Promise<void> {
  const me = await adminGate("/console/abroad");
  const act = s(fd, "act");
  const id = n(fd, "id");
  let err: string | null = null;
  let msg = "Done.";
  if (act === "doc_verify" || act === "doc_reject") {
    err = await CN.reviewDoc(me.id, id, act === "doc_verify", s(fd, "reason"));
    msg = act === "doc_verify" ? "Document verified." : "Document rejected and the student was notified.";
  } else if (act === "assign") {
    const cid = n(fd, "counselor_id");
    err = await CN.assign(n(fd, "user_id"), cid > 0 ? cid : null, me.id);
    msg = "Counselor assignment saved.";
  } else if (["to_applied", "to_draft", "to_offer", "to_declined"].includes(act)) {
    err = await AB.adminMove(id, act.slice(3), me.id, s(fd, "note"), s(fd, "offer_type"));
    msg = "Application updated and the student was notified.";
  } else if (act === "alumni") {
    err = await AB.markAlumni(n(fd, "user_id"), me.id);
    msg = "Marked as arrived.";
  } else err = "Unknown action.";
  await flash(err ? "err" : "ok", err ?? msg);
  redirect("/console/abroad");
}

export async function reissuePassportsAction(): Promise<void> {
  await adminGate("/console/analytics");
  const count = await PS.reissueAll();
  redirect(`/console/analytics?tab=system&reissued=${count}`);
}
