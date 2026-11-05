import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { pendingMfaUser } from "@/lib/portal/auth";
import { getSession } from "@/lib/portal/session";
import { AuthSplit } from "@/components/portal/auth-layout";
import { MfaLoginForm } from "@/components/portal/forms";

export const metadata: Metadata = { title: "Two-step verification | GrowQR", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function LoginMfaPage() {
  const s = await getSession();
  const pending = await pendingMfaUser(Number(s?.data.mfa_uid ?? 0) || null, Number(s?.data.mfa_t ?? 0) || null);
  if (!pending) redirect("/login");
  return (
    <AuthSplit eyebrow="Extra security" title="Two-step verification" subtitle="Enter the 6-digit code from your authenticator app, or one of your recovery codes.">
      <MfaLoginForm />
      <p className="mt-6 text-center text-[13.5px]"><Link href="/login" className="font-semibold text-[#5b3fe0] underline underline-offset-2">Start over</Link></p>
    </AuthSplit>
  );
}
