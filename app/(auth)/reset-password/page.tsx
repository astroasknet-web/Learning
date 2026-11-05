import type { Metadata } from "next";
import Link from "next/link";
import { userForResetToken } from "@/lib/portal/auth";
import { AuthSplit } from "@/components/portal/auth-layout";
import { Notice } from "@/components/portal/auth-controls";
import { ResetForm } from "@/components/portal/forms";

export const metadata: Metadata = { title: "Choose a new password | GrowQR", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const BTN = "flex min-h-[52px] w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#7857ff] to-[#2bb8ea] px-6 text-[15px] font-semibold text-white shadow-[0_14px_30px_-14px_rgba(120,87,255,0.8)] hover:brightness-110";

export default async function ResetPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const token = (await searchParams).token ?? "";
  const user = await userForResetToken(token);
  if (!user) {
    return (
      <AuthSplit eyebrow="Account help" title="This link has expired">
        <Notice>Reset links work once and last 60 minutes. Request a new one and we will email it right away.</Notice>
        <Link href="/forgot-password" className={BTN}>Request a new link</Link>
        <p className="mt-6 text-center text-[13.5px]"><Link href="/login" className="font-semibold text-[#5b3fe0] underline underline-offset-2">Back to log in</Link></p>
      </AuthSplit>
    );
  }
  return (
    <AuthSplit eyebrow="Account help" title="Choose a new password" subtitle={<>for <b>{user.email}</b></>}>
      <ResetForm token={token} />
    </AuthSplit>
  );
}
