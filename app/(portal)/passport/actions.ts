"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { extractFile, ExtractError } from "@/lib/qrscore/extract";
import { gateMessage, isScored, scoreExtraction, scoreText } from "@/lib/qrscore";
import { requireUser } from "@/lib/portal/guard";
import { clientIp, audit, fails, recordFail } from "@/lib/portal/security";
import * as passport from "@/lib/portal/passport/profile";
import * as resumes from "@/lib/portal/passport/resumes";
import * as share from "@/lib/portal/passport/share";

/** Server Actions for the student's Skill Passport. Every one re-checks that the caller is a signed-in student. */
export interface PassportState {
  error?: string;
  message?: string;
  ok?: boolean;
}

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_PER_HOUR = 20;

/** Score a resume (file or pasted text), save it as the student's passport and keep it in their history. */
export async function scoreResumeAction(_prev: PassportState, fd: FormData): Promise<PassportState> {
  const me = await requireUser("student");
  const bucket = `score:${me.id}`;
  if ((await fails(bucket, 60)) >= MAX_PER_HOUR) return { error: "You have scored a lot of resumes this hour. Please try again a little later." };
  await recordFail(bucket);

  const pasted = String(fd.get("resume_text") ?? "").trim();
  const file = fd.get("resume");
  const hasFile = file instanceof File && file.size > 0;
  try {
    let result;
    let name: string | null = null;
    let info: { name: string; mime: string; size: number } | undefined;
    if (hasFile) {
      if (file.size > MAX_BYTES) return { error: "File too large. Maximum size is 5 MB." };
      const ext = (file.name.split(".").pop() ?? "").toLowerCase();
      if (!["pdf", "docx", "txt"].includes(ext)) return { error: "Upload a .pdf, .docx or .txt file." };
      name = file.name.replace(/[^\p{L}\p{N}_ .\-()]+/gu, "_").slice(0, 160);
      info = { name, mime: file.type || "application/octet-stream", size: file.size };
      // When the browser already read the PDF and sent its text, that text is scored and the file is just the original.
      result = pasted !== "" ? scoreText(pasted) : scoreExtraction(await extractFile(new Uint8Array(await file.arrayBuffer()), name));
    } else if (pasted !== "") {
      result = scoreText(pasted);
    } else {
      return { error: "Upload a resume or paste its text." };
    }
    if (!isScored(result)) {
      await resumes.recordRejection(me.id, name ?? "", result.gate, hasFile ? (name!.split(".").pop() ?? "") : "pasted", await clientIp());
      return { error: gateMessage(result.gate) };
    }
    if (result.extraction.text_length < 80) return { error: "We could not read enough text from this file. It may be a scanned PDF. Paste the text instead, or upload a DOCX or text-based PDF." };
    const text = result.extraction.text;
    await passport.saveResult(me.id, result, name, text);
    await resumes.saveAccepted(me.id, result, text, info);
    await audit(me.id, me.id, "passport.score", String(result.overall.score));
  } catch (e) {
    if (e instanceof ExtractError) return { error: e.message };
    console.error("[passport] scoring failed:", (e as Error).message);
    return { error: "Something went wrong while scoring. Please try again." };
  }
  revalidatePath("/passport");
  return { ok: true, message: "Your Skill Passport has been updated." };
}

export async function deleteResumeAction(fd: FormData): Promise<void> {
  const me = await requireUser("student");
  await resumes.remove(me.id, Number(fd.get("id") ?? 0));
  revalidatePath("/passport");
}

export async function publishPassportAction(_prev: PassportState, fd: FormData): Promise<PassportState> {
  const me = await requireUser("student");
  try {
    await share.publish(me.id, me.name, {
      name_style: String(fd.get("name_style") ?? "first_initial"),
      show_score: true, // the score is the heart of a passport
      show_skills: fd.get("show_skills") === "on",
      show_courses: fd.get("show_courses") === "on",
      show_college: fd.get("show_college") === "on",
    });
    await audit(me.id, me.id, "passport.publish", "");
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath("/passport/share");
  return { ok: true, message: "Your passport is public. Share the link or QR code at the top of this page." };
}

export async function withdrawPassportAction(): Promise<void> {
  const me = await requireUser("student");
  await share.withdraw(me.id);
  await audit(me.id, me.id, "passport.withdraw", "");
  redirect("/passport/share?withdrawn=1");
}
