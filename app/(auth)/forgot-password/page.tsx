import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { homeFor } from "@/lib/portal/auth";
import { captchaMode, turnstileSiteKey } from "@/lib/portal/captcha";
import { currentUser } from "@/lib/portal/guard";
import { AuthSplit } from "@/components/portal/auth-layout";
import { ForgotForm } from "@/components/portal/forms";

export const metadata: Metadata = { title: "Reset your password | GrowQR", robots: { index: false, follow: true } };
export const dynamic = "force-dynamic";

export default async function ForgotPage() {
  const me = await currentUser();
  if (me) redirect(homeFor(me.role));
  const mode = captchaMode();
  return (
    <AuthSplit eyebrow="Account help" title="Reset your password" subtitle="Enter your email and we will send you a link to choose a new one.">
      <ForgotForm captcha={{ mode, siteKey: mode === "turnstile" ? turnstileSiteKey() : "" }} />
      <p className="mt-6 text-center text-[13.5px]"><Link href="/login" className="font-semibold text-[#5b3fe0] underline underline-offset-2">Back to log in</Link></p>
    </AuthSplit>
  );
}
