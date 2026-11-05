"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { databaseConfigured, run } from "@/lib/portal/db";
import { isVerified } from "@/lib/portal/auth";
import { currentUser } from "@/lib/portal/guard";
import { safeNext } from "@/lib/portal/security";
import * as passport from "@/lib/portal/passport/profile";
import * as apps from "@/lib/market/applications";
import * as jobs from "@/lib/market/jobs";
import * as saved from "@/lib/market/saved";
import * as storage from "@/lib/market/storage";

/** Save / unsave an internship (students only). A signed-out visitor is sent to log in and brought back. */
export async function toggleSavedAction(fd: FormData): Promise<void> {
  const back = safeNext(String(fd.get("back") ?? ""), "/internships");
  const me = await currentUser();
  if (!me) redirect(`/login?next=${encodeURIComponent(back)}`);
  if (me.role !== "student") redirect(back);
  const id = parseInt(String(fd.get("id") ?? ""), 10);
  if (Number.isFinite(id) && id > 0) await saved.toggle(me.id, id);
  redirect(back);
}

export interface ApplyState {
  ok?: boolean;
  error?: string;
  fields?: Partial<Record<"note" | "answer" | "phone" | "avail" | "resume" | "consent", string>>;
  values?: { note: string; answer: string; phone: string; avail: string };
}

const MAX_BYTES = 5 * 1024 * 1024;
const startsWith = (b: Uint8Array, sig: number[]): boolean => sig.every((x, i) => b[i] === x);

/** Apply to an internship. Students only, email confirmed, once per role; every rule is checked here, not just in the browser. */
export async function applyAction(slug: string, _prev: ApplyState, fd: FormData): Promise<ApplyState> {
  if (!databaseConfigured()) return { error: "Applications are not available right now." };
  const me = await currentUser();
  if (!me || me.role !== "student") redirect(`/login?next=${encodeURIComponent(`/internships/${slug}`)}`);
  const job = await jobs.bySlug(slug.replace(/[^a-z0-9-]/g, ""), me);
  if (!job) return { error: "We could not find that internship." };

  const values = { note: String(fd.get("note") ?? "").trim(), answer: String(fd.get("answer") ?? "").trim(), phone: String(fd.get("phone") ?? "").trim(), avail: String(fd.get("avail") ?? "") };
  const fields: NonNullable<ApplyState["fields"]> = {};
  let error: string | undefined;
  if (job.status !== "live") error = "This internship is not open for applications.";
  else if (!isVerified(me)) error = "Please confirm your email address before applying.";
  else if (await apps.existing(job.id, me.id)) error = "You have already applied to this internship.";
  if (error) return { error, values };

  const len = (s: string) => Array.from(s).length;
  if (len(values.note) < 50) fields.note = "Write at least 50 characters so the employer can see your intent.";
  else if (len(values.note) > 1500) fields.note = "Keep it under 1,500 characters.";
  if (len(values.answer) < 20) fields.answer = "Please answer the screening question in a few sentences.";
  else if (len(values.answer) > 1000) fields.answer = "Keep the answer under 1,000 characters.";
  if (!/^[0-9+\-\s]{10,15}$/.test(values.phone)) fields.phone = "Enter a valid phone number (10 to 15 digits).";
  if (!["immediate", "2weeks", "1month"].includes(values.avail)) fields.avail = "Choose when you can start.";
  if (!fd.get("consent")) fields.consent = "Please confirm that the details are yours and accurate.";

  const profile = await passport.profile(me.id);
  let storedFile: string | null = null;
  let storedName: string | null = null;
  let resumeText: string | null = null;
  let bytes: Uint8Array | null = null;
  let ext = "";
  const file = fd.get("resume");
  if (file instanceof File && file.size > 0) {
    ext = (file.name.split(".").pop() ?? "").toLowerCase();
    bytes = new Uint8Array(await file.arrayBuffer());
    // The extension must be pdf or docx AND the first bytes must really be that kind of file.
    const real = (ext === "pdf" && startsWith(bytes, [0x25, 0x50, 0x44, 0x46])) || (ext === "docx" && startsWith(bytes, [0x50, 0x4b]));
    if (!real) fields.resume = "Upload a real PDF or DOCX file.";
    else if (file.size > MAX_BYTES) fields.resume = "File is larger than 5 MB.";
    else {
      storedFile = randomBytes(16).toString("hex") + "." + ext; // random name; the original name is never used on disk
      storedName = file.name.replace(/[^\p{L}\p{N}_ .\-()]+/gu, "_").slice(0, 160);
    }
  } else if (fd.get("use_passport")) {
    const text = profile ? await resumeTextOf(me.id) : "";
    if (!text) fields.resume = "You have no resume saved in your Skill Passport yet. Upload a file or score your resume first.";
    else {
      resumeText = text;
      storedName = profile?.resume_name || "Skill Passport resume";
    }
  } else {
    fields.resume = 'Upload a resume or tick "Use my Skill Passport resume".';
  }
  if (Object.keys(fields).length) return { fields, values };

  if (storedFile !== null && bytes) {
    const mime = ext === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    if (!(await storage.put("resumes", storedFile, bytes, mime))) return { fields: { resume: "We could not save your file. Please try again." }, values };
  }
  const m = passport.match(job.skills, profile);
  const id = await apps.apply(job.id, me.id, { note: values.note, answer: values.answer, phone: values.phone, avail: values.avail, file: storedFile, file_name: storedName, resume_text: resumeText, match: m.score });
  if (id === null) return { error: "You have already applied to this internship.", values };
  await run("UPDATE student_profiles SET phone = $1 WHERE user_id = $2", [values.phone, me.id]);
  return { ok: true };
}

async function resumeTextOf(uid: number): Promise<string> {
  const { val } = await import("@/lib/portal/db");
  return (await val<string>("SELECT resume_text FROM student_profiles WHERE user_id = $1", [uid])) ?? "";
}
