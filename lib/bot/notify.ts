import { getResend } from "@/lib/resend";
import { getEmailShell } from "@/lib/email/shell";
import { escapeHtml } from "@/lib/escape-html";
import { countryDisplayName } from "@/lib/crm/derive";
import { BOT_INTENT_LABELS, type BotIntent } from "@/lib/bot/intents";
import type { Tables } from "@/types/database";

/**
 * Internal team notification for a qualified bot lead. Runs from the
 * background pipeline only (lib/bot/crm.ts botLeadAfterSync, called from the
 * sync sweep / after() fast path) — never from the webhook route, which
 * must stay under SalesIQ's 5-second response limit.
 */

const FROM_EMAIL = "GrowQR Bot <hello@growqr.ai>";

// Confirmed 2026-07-31, replacing the unverified "file@growqr.ai" from the
// original spec (flagged as a likely typo, since confirmed as one).
const NOTIFY_TO = ["sahil@growqr.ai", "support@growqr.ai"];

function row(label: string, value: string | null) {
  if (!value) return "";
  return `<p class="text-muted body-text" style="margin: 0 0 10px 0; font-size: 14px; line-height: 1.6;"><strong class="text-primary">${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`;
}

function buildEmail(lead: Tables<"bot_leads">, zohoLeadId: string): { subject: string; html: string } {
  const label = BOT_INTENT_LABELS[lead.intent as BotIntent] ?? lead.intent;
  const subject = `[GrowQR Bot] New ${label}`;
  const timestamp = new Date(lead.created_at).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  });

  const html = getEmailShell(`
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td class="outer-pad" align="center" style="padding: 24px;">
          <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td class="surface">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td class="hero mobile-pad" style="padding: 28px;">
                      <div style="color: #ffffff; font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 10px;">GrowQR Bot</div>
                      <h1 class="hero-title" style="margin: 0; color: #ffffff; font-size: 26px; line-height: 1.2;">New ${escapeHtml(label)}</h1>
                    </td>
                  </tr>
                  <tr>
                    <td class="mobile-pad" style="padding: 28px;">
                      <table role="presentation" class="card" width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td style="padding: 18px;">
                            ${row("Intent", label)}
                            ${row("Name", lead.name)}
                            ${row("Email", lead.email)}
                            ${row("Company", lead.company)}
                            ${row("Team size", lead.team_size)}
                            ${row("Country", countryDisplayName(lead.country_code))}
                            <div class="divider" style="height: 1px; margin: 10px 0 14px 0;"></div>
                            <p class="text-primary body-text" style="margin: 0 0 8px 0; font-size: 14px; line-height: 1.6; font-weight: 700;">Original message</p>
                            <p class="text-muted body-text" style="margin: 0 0 14px 0; font-size: 14px; line-height: 1.7;">${escapeHtml(lead.use_case ?? "—")}</p>
                            <div class="divider" style="height: 1px; margin: 0 0 14px 0;"></div>
                            ${row("CRM Lead ID", zohoLeadId)}
                            ${row("Timestamp", timestamp)}
                          </td>
                        </tr>
                      </table>
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 20px;">
                        <tr>
                          <td align="left">
                            <a class="cta" href="mailto:${escapeHtml(lead.email ?? "")}?subject=Re:%20GrowQR">Reply to ${escapeHtml(lead.name ?? "lead")}</a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `);

  return { subject, html };
}

/** Throws on failure — caller (botLeadAfterSync) logs the bot_events row. */
export async function sendBotLeadNotification(
  lead: Tables<"bot_leads">,
  zohoLeadId: string,
): Promise<void> {
  const { subject, html } = buildEmail(lead, zohoLeadId);
  await getResend().emails.send({
    from: FROM_EMAIL,
    to: NOTIFY_TO,
    subject,
    html,
  });
}
