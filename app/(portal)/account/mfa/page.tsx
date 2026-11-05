import type { Metadata } from "next";
import { mfaRequiredFor } from "@/lib/portal/auth";
import { requireUser } from "@/lib/portal/guard";
import { safeNext } from "@/lib/portal/security";
import { getSession, putSessionData } from "@/lib/portal/session";
import * as totp from "@/lib/portal/totp";
import { Alert, AuthShell, LinkText } from "@/components/portal/ui";
import { MfaDisableForm, MfaEnableForm } from "@/components/portal/forms";

export const metadata: Metadata = { title: "Two-step verification | GrowQR" };
export const dynamic = "force-dynamic";

export default async function MfaPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await requireUser();
  const sp = await searchParams;
  const s = await getSession();
  const required = mfaRequiredFor(me);
  const back = safeNext(sp.next, "/account");

  if (me.mfa_enabled_at) {
    return (
      <AuthShell title="Two-step verification" subtitle="Status: on" wide>
        <p className="text-[14px] text-ink-3 mb-5">You will be asked for a code each time you log in.</p>
        {required ? (
          <Alert kind="info">Staff accounts cannot turn this off.</Alert>
        ) : (
          <>
            <h2 className="text-[15px] font-semibold text-ink mb-3">Turn it off</h2>
            <MfaDisableForm />
          </>
        )}
        <p className="mt-5 text-center text-[13px]"><LinkText href={back}>Back</LinkText></p>
      </AuthShell>
    );
  }

  // The secret is kept in the signed-in session, so the same key shows until it is confirmed.
  let secret = String(s?.data.mfa_setup_secret ?? "");
  if (!secret) {
    secret = totp.newSecret();
    await putSessionData({ mfa_setup_secret: secret });
  }
  const spaced = secret.replace(/(.{4})/g, "$1 ").trim();

  return (
    <AuthShell title="Set up two-step verification" subtitle="Protect your account with an authenticator app." wide>
      {sp.required ? <Alert kind="info">Accounts that handle student documents must turn on two-step verification before continuing.</Alert> : null}
      <ol className="list-decimal pl-5 space-y-3 text-[14px] text-ink-2 mb-6">
        <li>Install an authenticator app (Google Authenticator, Microsoft Authenticator, Authy or 1Password).</li>
        <li>
          Add a new account and choose <b>enter a setup key</b>. Account: <b className="break-all">{me.email}</b>. Key (time-based):
          <p className="my-2 font-mono text-[17px] tracking-wider break-all text-ink">{spaced}</p>
          <span className="text-ink-4 text-[13px]">On a phone with the app installed you can also <a className="text-orange-dark underline" href={totp.uri(secret, me.email)}>open the setup link</a>.</span>
        </li>
        <li>Enter the 6-digit code the app shows to confirm.</li>
      </ol>
      <MfaEnableForm />
    </AuthShell>
  );
}
