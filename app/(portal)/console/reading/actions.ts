"use server";

import { redirect } from "next/navigation";
import { putSessionData } from "@/lib/portal/session";
import { importDrafts, markReviewed, resetConfig, saveConfig, saveLevel, setPassageStatus, updateQuestion, type Result } from "@/lib/reading/admin";
import { adminGate } from "../gate";

/** Administrator actions for the Reading Studio. Each one re-checks the admin gate; the page that rendered the form proves nothing. */
const s = (fd: FormData, k: string): string => String(fd.get(k) ?? "").trim();
const n = (fd: FormData, k: string): number => Number(s(fd, k));
async function done(r: Result, back: string): Promise<never> {
  await putSessionData({ console_flash: [r.ok ? "ok" : "err", r.message] });
  redirect(back);
}

export async function passageStatusAction(fd: FormData): Promise<void> {
  const me = await adminGate("/console/reading/content");
  const id = n(fd, "id");
  const st = s(fd, "status");
  if (!["approved", "archived", "draft"].includes(st)) return done({ ok: false, message: "Unknown status." }, "/console/reading/content");
  await done(await setPassageStatus(me.id, id, st as "approved" | "archived" | "draft"), `/console/reading/content/${id}`);
}

export async function reviewAction(fd: FormData): Promise<void> {
  const me = await adminGate("/console/reading/content");
  const entity = s(fd, "entity") === "question" ? "question" : "passage";
  const id = n(fd, "id");
  const back = s(fd, "back").startsWith("/console/reading/") ? s(fd, "back") : "/console/reading/content";
  await done(await markReviewed(me.id, entity, id), back);
}

export async function questionAction(fd: FormData): Promise<void> {
  const me = await adminGate("/console/reading/content");
  const back = `/console/reading/content/${n(fd, "passage")}`;
  await done(await updateQuestion(me.id, { id: n(fd, "id"), stem: s(fd, "stem"), optionsText: String(fd.get("options") ?? ""), keyText: s(fd, "key"), explanation: s(fd, "explanation"), skill: s(fd, "skill"), qtype: s(fd, "qtype"), difficulty: n(fd, "difficulty"), expectedSecs: n(fd, "secs"), status: s(fd, "status") }), back);
}

export async function importAction(fd: FormData): Promise<void> {
  const me = await adminGate("/console/reading/content");
  const json = String(fd.get("json") ?? "").slice(0, 400_000);
  await done(await importDrafts(me.id, json, s(fd, "source") === "ai" ? "ai" : "authored"), "/console/reading/content");
}

export async function configAction(fd: FormData): Promise<void> {
  const me = await adminGate("/console/reading/settings");
  if (s(fd, "reset")) return done(await resetConfig(me.id), "/console/reading/settings");
  const weights = { comprehension: n(fd, "w_comprehension"), qa: n(fd, "w_qa"), inference: n(fd, "w_inference"), efficiency: n(fd, "w_efficiency"), vocabulary: n(fd, "w_vocabulary"), retention: n(fd, "w_retention") };
  await done(await saveConfig(me.id, {
    weights, bands: { support: n(fd, "b_support"), developing: n(fd, "b_developing"), progressing: n(fd, "b_progressing") },
    minSample: n(fd, "minSample"), highSample: n(fd, "highSample"), highPassages: n(fd, "highPassages"), safeguardBelow: n(fd, "safeguardBelow"), safeguardCap: n(fd, "safeguardCap"),
    freeDiagnostics: n(fd, "freeDiagnostics"), recallDelayHours: n(fd, "recallDelayHours"), minCohort: n(fd, "minCohort"), defaultStudyMinutes: n(fd, "defaultStudyMinutes"),
  }), "/console/reading/settings");
}

export async function levelAction(fd: FormData): Promise<void> {
  const me = await adminGate("/console/reading/settings");
  const create = s(fd, "create") === "1";
  await done(await saveLevel(me.id, { key: s(fd, "key"), name: s(fd, "name"), objective: s(fd, "objective"), position: n(fd, "position"), passPct: n(fd, "passPct"), minQuestions: n(fd, "minQuestions"), masterySize: n(fd, "masterySize"), active: s(fd, "active") === "1", timed: s(fd, "timed") === "1", objectivesText: fd.has("objectives") ? String(fd.get("objectives")) : undefined, lessonText: fd.has("lesson") ? String(fd.get("lesson")) : undefined, tipsText: fd.has("tips") ? String(fd.get("tips")) : undefined }, create), "/console/reading/settings");
}
