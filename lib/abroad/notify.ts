import { one } from "../portal/db";
import { appUrl, send } from "../portal/mail";

/** Study-abroad emails (port of the abroad events in Portal\Notify). Every variable is escaped by the template. */
type User = { email: string; name: string };
const userOf = (id: number) => one<User>("SELECT email, name FROM users WHERE id = $1", [id]);

export async function application(userId: number, app: { uni_name: string }, to: string, note: string): Promise<void> {
  const u = await userOf(userId);
  if (!u) return;
  const uni = app.uni_name;
  const texts: Record<string, [string, string]> = {
    draft: [`Action needed on your application to ${uni}`, "Our team sent your application back so you can fix a few things."],
    applied: [`Your application to ${uni} was submitted`, "Our team reviewed your documents and sent your application to the university."],
    offer: [`You have an offer from ${uni}`, `Good news: ${uni} made you an offer. Open your dashboard to read the details, compare options and respond.`],
    declined: [`Update on your application to ${uni}`, `The application to ${uni} was closed. You can still apply to other universities on your shortlist.`],
  };
  const t = texts[to];
  if (!t) return;
  const paras = [t[1]];
  if (note.trim() !== "") paras.push("Note from our team: " + note);
  await send(u, t[0], "Study abroad update", paras, ["Open my study-abroad dashboard", await appUrl("abroad")], "abroad_" + to);
}

export async function document(userId: number, label: string, verified: boolean, reason: string): Promise<void> {
  const u = await userOf(userId);
  if (!u) return;
  const l = label.toLowerCase();
  const paras = verified ? [`Your ${l} was verified.`] : [`Your ${l} could not be accepted.`, "Reason: " + (reason !== "" ? reason : "please upload a clearer copy."), "Upload a new file from your document vault."];
  await send(u, (verified ? "Document verified: " : "Document needs attention: ") + label, verified ? "Document verified" : "Document needs attention", paras, ["Open my documents", await appUrl("abroad/documents")], verified ? "abroad_doc_ok" : "abroad_doc_bad");
}

export async function visaReminder(userId: number, c: { uni_name: string; appointment_at: string; centre: string }, days: number): Promise<void> {
  const u = await userOf(userId);
  if (!u) return;
  const d = new Date(c.appointment_at.replace(" ", "T") + "Z");
  const when = d.toLocaleString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "UTC" });
  const paras = [
    `Your visa appointment for ${c.uni_name} is ${days === 1 ? "tomorrow" : "in about a week"}: ${when}${c.centre !== "" ? " at " + c.centre : ""} (local time at the centre).`,
    days === 1 ? "Carry your passport, the appointment confirmation and every document on your checklist. Arrive early." : "Check your readiness list and practise a mock interview while there is still time.",
  ];
  await send(u, `Visa appointment ${days === 1 ? "tomorrow" : "in a week"}`, "Visa appointment reminder", paras, ["Open my visa checklist", await appUrl("abroad/visa")], "visa_reminder_" + days);
}

export async function mockFeedback(userId: number, visa: string, counselor: string, sessionId: number): Promise<void> {
  const u = await userOf(userId);
  if (!u) return;
  await send(u, "Feedback on your mock interview", "Your counselor left feedback", [`${counselor} reviewed your ${visa} practice interview and left feedback for you.`], ["Read the feedback", await appUrl(`abroad/interview?s=${sessionId}`)], "mock_feedback");
}

export async function counselor(userId: number, counselorName: string): Promise<void> {
  const u = await userOf(userId);
  if (!u) return;
  await send(u, "Your study-abroad counselor: " + counselorName, "Meet your counselor", [
    `${counselorName} is now your study-abroad counselor and will review your documents and applications.`,
    "Keep your document vault up to date so they can move your applications forward quickly.",
  ], ["Open my journey", await appUrl("abroad")], "abroad_counselor");
}
