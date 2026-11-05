"use server";

import { redirect } from "next/navigation";
import { putSessionData } from "@/lib/portal/session";
import * as DC from "@/lib/crm/docs";
import * as LD from "@/lib/crm/leads";
import * as VF from "@/lib/crm/verify";

/** Server Actions for the student's private file page. There is no login: the secret link in the form is the credential, so every action re-checks it. */
const windows = new Map<string, { t: number; n: number }>();
function slow(token: string): boolean {
  const now = Math.floor(Date.now() / 1000);
  let w = windows.get(token) ?? { t: now, n: 0 };
  if (now - w.t > 60) w = { t: now, n: 0 };
  w.n++;
  windows.set(token, w);
  if (windows.size > 5000) for (const [k, v] of windows) if (now - v.t > 60) windows.delete(k);
  return w.n > 20;
}

export async function fileAction(fd: FormData): Promise<void> {
  const token = String(fd.get("t") ?? "");
  const lead = /^[a-f0-9]{32}$/.test(token) ? await LD.findByToken(token) : null;
  if (!lead) redirect("/");
  const self = `/file/${token}`;
  let err: string | null = null;
  let msg = "Done.";
  let anchor = "";

  if (slow(token)) err = "Please slow down and try again in a minute.";
  else {
    switch (String(fd.get("act") ?? "")) {
      case "upload": {
        const file = fd.get("file");
        const type = String(fd.get("doc_type") ?? "");
        if (!(file instanceof File) || file.size === 0) err = "Choose a file to upload.";
        else {
          const r = await DC.upload(lead.id, type, { name: file.name, size: file.size, bytes: new Uint8Array(await file.arrayBuffer()) }, null);
          err = typeof r === "string" ? r : null;
          if (!err) await LD.log(lead.id, null, "system", `Student uploaded: ${DC.TYPES[type] ?? "document"}.`);
        }
        msg = "Document uploaded. Thank you.";
        anchor = "#dc-h";
        break;
      }
      case "delete": {
        const d = await DC.find(parseInt(String(fd.get("doc") ?? ""), 10) || 0);
        if (d && d.lead_id === lead.id && d.uploaded_by === null && d.status === "uploaded") {
          await DC.remove(d.id);
          msg = "Document removed.";
        } else err = "That document cannot be removed.";
        anchor = "#dc-h";
        break;
      }
      case "verify":
        if (String(fd.get("agree") ?? "") !== "1") err = "Please confirm that you understand the verification fee.";
        else [, err] = await VF.request(lead.id, fd.getAll("docs").map((x) => parseInt(String(x), 10) || 0), "student", null);
        msg = "Verification requested. Pay the fee below and your documents go to the verification partner.";
        anchor = "#verify";
        break;
      default:
        err = "Unknown action.";
    }
  }
  await putSessionData({ crmfile_flash: [err ? "err" : "ok", err ?? msg] });
  redirect(self + anchor);
}
