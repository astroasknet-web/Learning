import { one } from "../portal/db";
import { appUrl, send } from "../portal/mail";

/** Transactional email events for the marketplace (port of the application and posting events in Portal\Notify). Every variable is escaped by the template. */
export async function applicationCreated(appId: number): Promise<void> {
  const a = await one<Record<string, string | number | null>>(
    `SELECT a.id, a.match_score, s.id AS sid, s.name AS sname, s.email AS semail, i.title, i.slug, c.name AS company, o.name AS oname, o.email AS oemail
     FROM applications a JOIN users s ON s.id = a.student_id JOIN internships i ON i.id = a.internship_id
     JOIN companies c ON c.id = i.company_id LEFT JOIN users o ON o.id = c.owner_user_id WHERE a.id = $1`,
    [appId],
  );
  if (!a) return;
  await send({ email: String(a.semail), name: String(a.sname) }, `Application sent: ${a.title}`, "Your application is in", [
    `We sent your application for ${a.title} at ${a.company}.`,
    "You can follow every stage on your applications page. If the employer rejects you, you will see the reason there.",
  ], ["Track my application", await appUrl("applications")], "application_sent");
  if (a.oemail) {
    await send({ email: String(a.oemail), name: String(a.oname) }, `New applicant: ${a.title}`, `New applicant for ${a.title}`, [
      `${a.sname} applied to your role${a.match_score !== null ? ` with a ${Number(a.match_score)}% match.` : "."}`,
      "Open your dashboard to read their note, view the resume and move them to the next stage.",
    ], ["Review applicants", await appUrl("employer")], "new_applicant");
  }
}

export async function statusChanged(appId: number, status: string, note: string): Promise<void> {
  if (status === "Viewed" || status === "Applied") return; // too noisy for email; visible on the dashboard
  const a = await one<Record<string, string>>(
    `SELECT s.name AS sname, s.email AS semail, i.title, c.name AS company
     FROM applications a JOIN users s ON s.id = a.student_id JOIN internships i ON i.id = a.internship_id JOIN companies c ON c.id = i.company_id WHERE a.id = $1`,
    [appId],
  );
  if (!a) return;
  const lines: Record<string, string> = {
    Shortlisted: `Good news: ${a.company} shortlisted you for ${a.title}.`,
    Interview: `${a.company} wants to interview you for ${a.title}.`,
    Offered: `Congratulations! ${a.company} made you an offer for ${a.title}.`,
    Hired: `You are hired. ${a.company} confirmed you for ${a.title}.`,
    Rejected: `${a.company} decided not to move forward with your application for ${a.title}.`,
  };
  const paras = [lines[status] ?? `Your application status changed to ${status}.`];
  if (note.trim() !== "") paras.push((status === "Rejected" ? "Their reason: " : "Note from the employer: ") + note);
  if (status === "Rejected") paras.push("This is feedback on one role, not on you. Your Skill Passport shows which skills to strengthen for the next one.");
  await send({ email: a.semail, name: a.sname }, status === "Rejected" ? `Update on your application: ${a.title}` : `${status}: ${a.title}`, "Application update", paras, ["See my applications", await appUrl("applications")], "status_" + status.toLowerCase());
}

export async function roleSubmitted(jobId: number): Promise<void> {
  const j = await one<Record<string, string>>("SELECT i.title, o.name AS oname, o.email AS oemail FROM internships i JOIN companies c ON c.id = i.company_id JOIN users o ON o.id = c.owner_user_id WHERE i.id = $1", [jobId]);
  if (!j) return;
  await send({ email: j.oemail, name: j.oname }, `We received your role: ${j.title}`, "Your role is in review", [
    `Thanks for posting ${j.title}. Our team reviews every listing, usually within one business day. We will email you as soon as it is live.`,
  ], ["Open dashboard", await appUrl("employer")], "role_submitted");
  const admin = process.env.PORTAL_ADMIN_EMAIL ?? "";
  if (admin) {
    await send({ email: admin, name: "Admin" }, `Role awaiting review: ${j.title}`, "New role to review", [`${j.title} is waiting in the review queue.`], ["Open review queue", await appUrl("admin")], "admin_review");
  }
}

export async function roleDecided(jobId: number, approved: boolean): Promise<void> {
  const j = await one<Record<string, string>>("SELECT i.title, i.slug, o.name AS oname, o.email AS oemail FROM internships i JOIN companies c ON c.id = i.company_id JOIN users o ON o.id = c.owner_user_id WHERE i.id = $1", [jobId]);
  if (!j) return;
  const to = { email: j.oemail, name: j.oname };
  if (approved) {
    await send(to, `Your role is live: ${j.title}`, "Your role is live", [`${j.title} is now visible to students. Applicants will appear on your dashboard, ranked by match.`], ["View listing", await appUrl(`internships/${j.slug}`)], "role_live");
  } else {
    await send(to, `Update on your role: ${j.title}`, "We could not approve this role", [
      `${j.title} was not approved. Check that the stipend, duration and description are clear and accurate, then post it again.`,
    ], ["Post again", await appUrl("employer/post")], "role_rejected");
  }
}
