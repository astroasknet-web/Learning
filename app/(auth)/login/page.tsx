import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { homeFor } from "@/lib/portal/auth";
import { captchaMode, turnstileSiteKey } from "@/lib/portal/captcha";
import { currentUser } from "@/lib/portal/guard";
import { OAUTH_ERRORS } from "@/lib/portal/oauth";
import { safeNext } from "@/lib/portal/security";
import { AuthSplit, SocialButtons } from "@/components/portal/auth-layout";
import { Notice } from "@/components/portal/auth-controls";
import { LoginForm } from "@/components/portal/forms";

export const metadata: Metadata = { title: "Log in | GrowQR", robots: { index: false, follow: true } };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const me = await currentUser();
  if (me) redirect(safeNext(sp.next, homeFor(me.role)));
  const next = safeNext(sp.next, "");
  const oauthError = sp.e ? OAUTH_ERRORS[sp.e] : undefined;
  const mode = captchaMode();
  return (
    <AuthSplit
      eyebrow="Welcome back"
      panel="login"
      title="Welcome back"
      subtitle={<>Log in to continue learning and see your saved resume and progress. New here? <Link href="/signup" className="font-semibold text-[#5b3fe0] underline underline-offset-2">Create a free account</Link></>}
    >
      {sp.reset ? <Notice kind="success">Your password was updated. Log in with the new one.</Notice> : null}
      {sp.out ? <Notice kind="success">You have been logged out.</Notice> : null}
      {oauthError ? <Notice>{oauthError}</Notice> : null}
      <SocialButtons next={next} />
      <LoginForm next={next} captcha={{ mode, siteKey: mode === "turnstile" ? turnstileSiteKey() : "" }} />
    </AuthSplit>
  );
}
