import type { Metadata } from "next";
import { homeFor, isVerified, userForVerifyToken } from "@/lib/portal/auth";
import { currentUser } from "@/lib/portal/guard";
import { confirmEmailAction } from "@/app/(portal)/actions";
import { AuthSplit } from "@/components/portal/auth-layout";
import { GradientButton, Notice } from "@/components/portal/auth-controls";
import { ResendVerification } from "@/components/portal/forms";

export const metadata: Metadata = { title: "Confirm your email | GrowQR" };
export const dynamic = "force-dynamic";

/**
 * Two steps on purpose: the emailed link only SHOWS a confirm button. Mail scanners and link previewers fetch links with GET,
 * so confirming needs a deliberate POST (the button).
 */
export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const me = await currentUser();
  const home = me ? homeFor(me.role) : "/login";
  const homeLabel = me ? "Go to my account" : "Log in";
  const btn = "flex min-h-[52px] w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#7857ff] to-[#2bb8ea] px-6 text-[15px] font-semibold text-white shadow-[0_14px_30px_-14px_rgba(120,87,255,0.8)] hover:brightness-110";

  if (sp.done) {
    return (
      <AuthSplit eyebrow="Your account" title="Email confirmed">
        <Notice kind="success">Your email is verified. You can now {me?.role === "employer" ? "post roles" : "apply to internships"} on GrowQR.</Notice>
        <a href={home} className={btn}>{homeLabel}</a>
      </AuthSplit>
    );
  }

  const token = sp.token ?? "";
  const user = await userForVerifyToken(token);
  if (user && isVerified(user)) {
    return (
      <AuthSplit eyebrow="Your account" title="Already confirmed">
        <Notice kind="success">This email address is already verified.</Notice>
        <a href={home} className={btn}>{homeLabel}</a>
      </AuthSplit>
    );
  }
  if (user) {
    return (
      <AuthSplit eyebrow="Your account" title="Confirm your email" subtitle={<>Confirm <b>{user.email}</b> to finish setting up your account.</>}>
        <form action={confirmEmailAction}>
          <input type="hidden" name="token" value={token} />
          <GradientButton pendingText="Confirming...">Confirm my email</GradientButton>
        </form>
      </AuthSplit>
    );
  }
  return (
    <AuthSplit eyebrow="Your account" title="This link has expired">
      <p className="text-[14px] text-ink-3 mb-5">Confirmation links work once and last 24 hours. {me ? (isVerified(me) ? "" : "We can send you a new one.") : "Log in and we can send you a new one."}</p>
      {me && !isVerified(me) ? <ResendVerification /> : <a href={home} className={btn}>{homeLabel}</a>}
    </AuthSplit>
  );
}
