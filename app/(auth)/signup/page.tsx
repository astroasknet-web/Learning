import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { homeFor } from "@/lib/portal/auth";
import { captchaMode, turnstileSiteKey } from "@/lib/portal/captcha";
import { currentUser } from "@/lib/portal/guard";
import { OAUTH_ERRORS } from "@/lib/portal/oauth";
import { AuthSplit, RoleTabs, SocialButtons } from "@/components/portal/auth-layout";
import { Notice } from "@/components/portal/auth-controls";
import { SignupForm } from "@/components/portal/forms";

export const metadata: Metadata = { title: "Create your account | GrowQR" };
export const dynamic = "force-dynamic";

const COPY = {
  student: ["Create your free account", "Applying is free. We never charge placement fees."],
  employer: ["Hire on GrowQR", "Post roles and meet verified students."],
  teacher: ["Create your teacher account", "Run a class, set courses and practice tests, and read a gradebook."],
  parent: ["Create your parent account", "Follow your child's learning with their learner code."],
} as const;

export default async function SignupPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const me = await currentUser();
  if (me) redirect(homeFor(me.role));
  const role = sp.role === "employer" || sp.role === "teacher" || sp.role === "parent" ? sp.role : "student";
  const [title, sub] = COPY[role];
  const mode = captchaMode();
  const oauthError = sp.e ? OAUTH_ERRORS[sp.e] : undefined;
  return (
    <AuthSplit
      eyebrow="Join GrowQR"
      panel="signup"
      title={title}
      subtitle={<>{sub} Already registered? <Link href="/login" className="font-semibold text-[#5b3fe0] underline underline-offset-2">Log in</Link></>}
    >
      <RoleTabs role={role} />
      {oauthError ? <Notice>{oauthError}</Notice> : null}
      {role === "employer" ? <Notice kind="info">Employers sign up with a work email so we can verify the company.</Notice> : <SocialButtons role={role} verb="Sign up" />}
      <SignupForm role={role} captcha={{ mode, siteKey: mode === "turnstile" ? turnstileSiteKey() : "" }} />
    </AuthSplit>
  );
}
