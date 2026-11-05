"use server";

import { redirect } from "next/navigation";
import { putSessionData } from "@/lib/portal/session";
import { reprocess, resetConfig, saveConfig, saveTopic, type Result } from "@/lib/mathstudio/admin";
import { adminGate } from "../gate";

const s = (fd: FormData, k: string): string => String(fd.get(k) ?? "").trim();
const n = (fd: FormData, k: string): number => Number(s(fd, k));
async function done(r: Result, back: string): Promise<never> { await putSessionData({ console_flash: [r.ok ? "ok" : "err", r.message] }); redirect(back); }

export async function configAction(fd: FormData): Promise<void> {
  const me = await adminGate("/console/math/settings");
  if (s(fd, "reset")) return done(await resetConfig(me.id), "/console/math/settings");
  const weights = { mastery: n(fd, "w_mastery"), accuracy: n(fd, "w_accuracy"), efficiency: n(fd, "w_efficiency"), consistency: n(fd, "w_consistency") };
  await done(await saveConfig(me.id, {
    weights, priorStrength: n(fd, "priorStrength"), priorMean: n(fd, "priorMean"), recencyHalfLifeDays: n(fd, "recencyHalfLifeDays"),
    evidence: { preliminary: n(fd, "ev_preliminary"), developing: n(fd, "ev_developing"), strong: n(fd, "ev_strong") },
    bands: { support: n(fd, "b_support"), developing: n(fd, "b_developing"), secure: n(fd, "b_secure") },
    maxWeaknesses: n(fd, "maxWeaknesses"), freeTopics: n(fd, "freeTopics"), minCohort: n(fd, "minCohort"), defaultStudyMinutes: n(fd, "defaultStudyMinutes"),
  }), "/console/math/settings");
}

export async function topicAction(fd: FormData): Promise<void> {
  const me = await adminGate("/console/math/settings");
  await done(await saveTopic(me.id, { id: s(fd, "id"), name: s(fd, "name"), area: s(fd, "area"), position: n(fd, "position"), active: s(fd, "active") === "1" }), "/console/math/settings");
}

export async function reprocessAction(): Promise<void> {
  const me = await adminGate("/console/math");
  await done(await reprocess(me.id), "/console/math");
}
