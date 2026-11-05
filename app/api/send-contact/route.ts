import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/data/server";
import { getEmailShell } from "@/lib/email/shell";
import { emailLogo } from "@/lib/email/logo";
import { escapeHtml } from "@/lib/escape-html";
import { getResend } from "@/lib/resend";
import { createLogger } from "@/lib/log";
import { createFormRoute } from "@/lib/forms/handler";
import { parseContact, type ContactSubmission } from "@/lib/forms/schemas";
import { SITE_URL } from "@/lib/seo";
import { currentUser } from "@/lib/portal/guard";
import { humanCheck } from "@/lib/portal/captcha";

const FROM_EMAIL = "GrowQR | Support <hello@growqr.ai>";
const TEAM_EMAIL = "support@growqr.ai";

const log = createLogger("send-contact");

function buildTeamNotificationEmail(data: {
  inquiryType: string;
  name: string;
  email: string;
  subjectLine: string;
  formattedMessage: string;
}) {
  const { inquiryType, name, email, subjectLine, formattedMessage } = data;
  return getEmailShell(`
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td class="outer-pad" align="center" style="padding: 24px;">
          <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td class="surface">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td class="hero mobile-pad" style="padding: 28px;">
                      <div style="color: #ffffff; font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 10px;">GrowQR Contact</div>
                      <h1 class="hero-title" style="margin: 0; color: #ffffff; font-size: 26px; line-height: 1.2;">New contact form submission</h1>
                    </td>
                  </tr>
                  <tr>
                    <td class="mobile-pad" style="padding: 28px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td style="padding-bottom: 14px;"><span class="chip">${inquiryType}</span></td>
                        </tr>
                      </table>

                      <table role="presentation" class="card" width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td style="padding: 18px;">
                            <p class="text-muted body-text" style="margin: 0 0 10px 0; font-size: 14px; line-height: 1.6;"><strong class="text-primary">Name:</strong> ${name}</p>
                            <p class="text-muted body-text" style="margin: 0 0 10px 0; font-size: 14px; line-height: 1.6;"><strong class="text-primary">Email:</strong> <a href="mailto:${email}" style="color: #ff6b35; text-decoration: none;">${email}</a></p>
                            <p class="text-muted body-text" style="margin: 0 0 14px 0; font-size: 14px; line-height: 1.6;"><strong class="text-primary">Subject:</strong> ${subjectLine}</p>
                            <div class="divider" style="height: 1px; margin: 0 0 14px 0;"></div>
                            <p class="text-primary body-text" style="margin: 0 0 8px 0; font-size: 14px; line-height: 1.6; font-weight: 700;">Message</p>
                            <p class="text-muted body-text" style="margin: 0; font-size: 14px; line-height: 1.7;">${formattedMessage}</p>
                          </td>
                        </tr>
                      </table>

                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 20px;">
                        <tr>
                          <td align="left">
                            <a class="cta" href="mailto:${email}?subject=Re:%20${encodeURIComponent(subjectLine)}">Reply to ${name}</a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding: 12px 8px 0 8px;">
                <p class="text-muted" style="margin: 0; font-size: 12px;">This notification was generated from the GrowQR contact form.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `);
}

function buildUserConfirmationEmail(data: {
  name: string;
  subjectLine: string;
}) {
  const { name, subjectLine } = data;
  return getEmailShell(`
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td class="outer-pad" align="center" style="padding: 24px;">
          <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td align="center" style="padding: 6px 0 16px 0;">
                ${emailLogo({ width: 140, align: "center" })}
              </td>
            </tr>
            <tr>
              <td class="surface mobile-pad" style="padding: 28px;">
                <h1 class="text-primary hero-title" style="margin: 0 0 12px 0; font-size: 28px; line-height: 1.2;">Thanks for reaching out, ${name}.</h1>
                <p class="text-muted body-text" style="margin: 0 0 18px 0; font-size: 16px; line-height: 1.7;">
                  We received your message and our team will respond shortly.
                </p>

                <table role="presentation" class="card" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 18px;">
                  <tr>
                    <td style="padding: 16px;">
                      <p class="text-primary" style="margin: 0 0 6px 0; font-size: 13px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase;">Message summary</p>
                      <p class="text-muted body-text" style="margin: 0; font-size: 14px; line-height: 1.6;"><strong class="text-primary">Subject:</strong> ${subjectLine}</p>
                    </td>
                  </tr>
                </table>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td align="left">
                      <a class="cta" href="${SITE_URL}">Visit GrowQR</a>
                    </td>
                  </tr>
                </table>

                <div class="divider" style="margin: 20px 0 0 0; padding-top: 16px;">
                  <p class="text-muted" style="margin: 0; font-size: 12px; line-height: 1.6;">
                    GrowQR Support Team<br />
                    support@growqr.ai
                  </p>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `);
}

function buildEmails(data: ContactSubmission): Array<Promise<unknown>> {
  const safeName = escapeHtml(data.name);
  const subjectLine = escapeHtml(data.subject);
  // Strip CR/LF from anything placed in an email Subject header, as hygiene
  // against header-injection attempts (Resend's API is not raw-SMTP, so this
  // is defense-in-depth, not a live hole).
  const headerSubject = data.subject.replace(/[\r\n]+/g, " ").trim();
  const resend = getResend();

  return [
    resend.emails.send({
      from: FROM_EMAIL,
      to: TEAM_EMAIL,
      subject: `New Contact Form: ${headerSubject}`,
      html: buildTeamNotificationEmail({
        inquiryType: data.type === "sales" ? "Sales Enquiry" : "General Enquiry",
        name: safeName,
        email: escapeHtml(data.email),
        subjectLine,
        formattedMessage: escapeHtml(data.message).replace(/\n/g, "<br>"),
      }),
    }),
    resend.emails.send({
      from: FROM_EMAIL,
      to: data.email,
      subject: `We received your message - GrowQR`,
      html: buildUserConfirmationEmail({ name: safeName, subjectLine }),
    }),
  ];
}

// POST /api/send-contact — backs the /contact page form.
export const POST = createFormRoute<ContactSubmission>({
  key: "send-contact",
  // Only signed-in members can write to us, and the message always carries the member's own name and email.
  gate: async (_req, body) => {
    const me = await currentUser();
    if (!me) return NextResponse.json({ error: "Please log in to send us a message." }, { status: 401 });
    return { body: { ...((body && typeof body === "object" ? body : {}) as Record<string, unknown>), name: me.name, email: me.email } };
  },
  // Every message also needs the human check (picture code, or Turnstile / proof of work when the site is set up for them).
  humanCheck: async (body) => {
    const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
    const fd = new FormData();
    for (const k of ["captchaToken", "captcha", "cf-turnstile-response", "pow"]) fd.set(k, typeof b[k] === "string" ? (b[k] as string) : "");
    return humanCheck(fd, "contact");
  },
  turnstile: {
    label: "Contact",
    errorMessage: "Security check failed. Please try again.",
  },
  parse: parseContact,
  // Persist after server-side Turnstile verification and fail closed: the UI
  // must never report success when the message was not captured. created_at
  // is stamped by the DB default.
  persist: async (data, meta) => {
    const admin = createAdminClient();
    const { data: inserted, error } = await admin
      .from("contact_messages")
      .insert({
        name: data.name,
        email: data.email,
        subject: data.subject,
        message: data.message,
        type: data.type,
        country_code: meta.countryCode,
        ...meta.attribution,
        // General enquiries are support traffic, not leads (locked decision
        // A1): soft-skip so the row keeps its attribution and stays
        // requeueable, but never syncs to the CRM. Sales enquiries queue.
        crm_sync_status: data.type === "general" ? "skipped" : "pending",
      })
      .select("id")
      .single();
    if (error) {
      log.error("insert error:", error);
      return NextResponse.json(
        { error: "Could not save your message. Please try again." },
        { status: 500 }
      );
    }
    // The sync engine claims on status, so a 'skipped' general enquiry
    // triggering the hook is a harmless not_claimed no-op.
    return { crmRowId: inserted.id };
  },
  crmSource: "contact_messages",
  sideEffects: buildEmails,
  successBody: { success: true, message: "Emails sent successfully" },
  failureMessage: "Failed to send email",
});
