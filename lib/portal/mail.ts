import "server-only";
import { headers } from "next/headers";
import { all, run } from "./db";

/**
 * Outbox-backed mail for the portal (port of Portal\Mailer.php and the account messages of Portal\Notify.php).
 * Every message is stored in mail_outbox first (same table the PHP app uses), then delivered after the response is sent.
 * Delivery: Resend when RESEND_API_KEY is set (the site already uses it); otherwise rows are marked "logged" and nothing
 * leaves the server, which is what you want on a developer machine.
 *
 * Environment: RESEND_API_KEY, PORTAL_MAIL_FROM (default "GrowQR <no-reply@growqr.ai>"), PORTAL_APP_URL (public origin used in links).
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clean = (s: string) => s.replace(/[\r\n]+/g, " ").trim(); // header-injection guard
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");

export async function appUrl(path = ""): Promise<string> {
  let base = (process.env.PORTAL_APP_URL ?? "").replace(/\/+$/, "");
  if (!base) {
    try {
      const h = await headers();
      const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "localhost").replace(/[^a-z0-9.\-:]/gi, "");
      base = `${h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https")}://${host}`;
    } catch {
      base = "http://localhost:3000";
    }
  }
  return base + "/" + path.replace(/^\/+/, "");
}

export interface Recipient {
  email: string;
  name: string;
}

/** Store a message for delivery. Never throws. */
export async function queueMail(to: Recipient, subject: string, html: string, text: string, kind: string): Promise<void> {
  try {
    if (!EMAIL_RE.test(to.email)) return;
    await run("INSERT INTO mail_outbox (to_email, to_name, subject, html, text_body, kind, status, created_at) VALUES ($1,$2,$3,$4,$5,$6,'pending',NOW())", [
      to.email, clean(to.name).slice(0, 120), clean(subject).slice(0, 255), html, text, kind,
    ]);
    scheduleFlush();
  } catch (e) {
    console.error("[mail] queue failed:", (e as Error).message);
  }
}

function scheduleFlush(): void {
  // Deliver after the response has been sent, so a slow mail API never slows a page.
  import("next/server")
    .then(({ after }) => after(() => flushMail()))
    .catch(() => void flushMail());
}

interface OutboxRow {
  id: number;
  to_email: string;
  to_name: string;
  subject: string;
  html: string;
  text_body: string;
  attempts: number;
}

/** Deliver pending messages (up to 10). Safe to call repeatedly. */
export async function flushMail(): Promise<void> {
  try {
    const rows = await all<OutboxRow>("SELECT id, to_email, to_name, subject, html, text_body, attempts FROM mail_outbox WHERE status = 'pending' AND attempts < 3 ORDER BY id ASC LIMIT 10");
    for (const m of rows) await deliver(m);
  } catch (e) {
    console.error("[mail] flush failed:", (e as Error).message);
  }
}

async function deliver(m: OutboxRow): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    await run("UPDATE mail_outbox SET status = 'logged', attempts = attempts + 1, sent_at = NOW() WHERE id = $1", [m.id]);
    return;
  }
  try {
    const from = process.env.PORTAL_MAIL_FROM ?? "GrowQR <no-reply@growqr.ai>";
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [m.to_name ? `${m.to_name.replace(/[<>"]/g, "")} <${m.to_email}>` : m.to_email], subject: m.subject, html: m.html, text: m.text_body, headers: { "Auto-Submitted": "auto-generated" } }),
    });
    if (!res.ok) throw new Error(`Resend HTTP ${res.status}`);
    await run("UPDATE mail_outbox SET status = 'sent', attempts = attempts + 1, sent_at = NOW(), error = NULL WHERE id = $1", [m.id]);
  } catch (e) {
    await run("UPDATE mail_outbox SET attempts = attempts + 1, status = CASE WHEN attempts + 1 >= 3 THEN 'failed' ELSE 'pending' END, error = $1 WHERE id = $2", [(e as Error).message.slice(0, 250), m.id]);
  }
}

// ---- account messages ---------------------------------------------------------------------------------------------

function render(heading: string, paras: string[], cta?: [string, string], footnote = ""): { html: string; text: string } {
  const p = paras.map((x) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155">${esc(x)}</p>`).join("");
  const btn = cta
    ? `<p style="margin:24px 0"><a href="${esc(cta[1])}" style="display:inline-block;background:#4338ca;color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;padding:14px 28px;border-radius:12px">${esc(cta[0])}</a></p>` +
      `<p style="margin:0 0 16px;font-size:13px;line-height:1.5;color:#64748b">Button not working? Paste this link into your browser:<br><a href="${esc(cta[1])}" style="color:#4338ca;word-break:break-all">${esc(cta[1])}</a></p>`
    : "";
  const note = footnote ? `<p style="margin:16px 0 0;font-size:13px;line-height:1.5;color:#64748b">${esc(footnote)}</p>` : "";
  const html =
    `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(heading)}</title></head>` +
    `<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">` +
    `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9"><tr><td align="center" style="padding:32px 16px">` +
    `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px">` +
    `<tr><td style="padding:0 0 16px;font-size:22px;font-weight:800;letter-spacing:-.02em;color:#0f172a">Grow<span style="color:#4338ca">QR</span></td></tr>` +
    `<tr><td style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:32px">` +
    `<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#0f172a">${esc(heading)}</h1>${p}${btn}${note}</td></tr>` +
    `<tr><td style="padding:20px 8px;font-size:12px;line-height:1.6;color:#94a3b8;text-align:center">You are receiving this because of activity on your GrowQR account. This is a service message, not marketing.</td></tr>` +
    `</table></td></tr></table></body></html>`;
  const text = heading + "\n\n" + paras.join("\n\n") + (cta ? `\n\n${cta[0]}: ${cta[1]}` : "") + (footnote ? `\n\n${footnote}` : "") + "\n\n-- GrowQR";
  return { html, text };
}

export async function send(user: Recipient, subject: string, heading: string, paras: string[], cta: [string, string] | undefined, kind: string, foot = ""): Promise<void> {
  const { html, text } = render(heading, paras, cta, foot);
  await queueMail(user, subject, html, text, kind);
}

const first = (name: string) => name.trim().split(" ")[0] || "there";

/** Welcome plus the email-verification link in one message. */
export async function welcomeEmail(user: Recipient, role: string, verifyToken: string | null): Promise<void> {
  const f = first(user.name);
  const intro =
    role === "employer"
      ? "Your employer account is ready. Post your first role and our team will review it, usually within one business day."
      : role === "teacher"
        ? "Your teacher account is ready. Create a class, share its join code with your students, and set them courses and practice tests."
        : role === "parent"
          ? "Your parent account is ready. Ask your child for their learner code (in their My classes page) to follow their progress."
          : "Your student account is ready. Applying is free and always will be; we never charge placement fees.";
  if (verifyToken !== null) {
    await send(user, "Confirm your email to start on GrowQR", `Welcome, ${f}. Confirm your email`, [
      intro,
      `One last step: confirm that this is your email address. You can browse right away, and confirming unlocks ${role === "employer" ? "posting roles." : "applying to internships."}`,
      "This link expires in 24 hours.",
    ], ["Confirm my email", await appUrl(`verify-email?token=${verifyToken}`)], "welcome", "If you did not create a GrowQR account, you can ignore this email.");
    return;
  }
  await send(user, "Welcome to GrowQR", `Welcome, ${f}`, [intro], undefined, "welcome");
}

export async function verifyEmail(user: Recipient, token: string): Promise<void> {
  await send(user, "Confirm your email address", "Confirm your email", ["Use the button below to confirm that this is your email address. The link expires in 24 hours."], ["Confirm my email", await appUrl(`verify-email?token=${token}`)], "verify", "If you did not ask for this, you can ignore this email.");
}

export async function resetRequested(user: Recipient, token: string, minutes: number): Promise<void> {
  await send(user, "Reset your GrowQR password", "Reset your password", [
    "We received a request to reset the password for your account. Use the button below to choose a new one.",
    `This link works once and expires in ${minutes} minutes.`,
  ], ["Choose a new password", await appUrl(`reset-password?token=${token}`)], "reset", "If you did not ask for this, you can ignore this email. Your password will not change.");
}

export async function passwordChanged(user: Recipient): Promise<void> {
  await send(user, "Your GrowQR password was changed", "Your password was changed", [
    "The password for your GrowQR account was just changed.",
    "If this was you, there is nothing more to do. If it was not, reset your password immediately and contact us.",
  ], ["Reset password", await appUrl("forgot-password")], "password_changed");
}
