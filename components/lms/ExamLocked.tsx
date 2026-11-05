import Link from "next/link";
import { MarketShell } from "@/components/market/shell";
import ExamPaywall from "./ExamPaywall";
import type { ExamAccess } from "@/lib/lms/exam-access";

/** A whole page in its locked state: the title of what the visitor asked for, and the purchase card. Nothing of the lesson or test is rendered. */
export default function ExamLocked({ access, title, back }: { access: ExamAccess; title: string; back: { href: string; label: string } }) {
  return (
    <MarketShell user={null} active="courses">
      <nav aria-label="Breadcrumb" className="mb-4 text-[13px] text-ink-3"><Link href="/exam-prep" className="underline">Exam prep</Link> / <Link href={back.href} className="underline">{back.label}</Link></nav>
      <h1 className="mb-6 text-[26px] font-bold leading-tight tracking-tight text-ink sm:text-[34px]">{title}</h1>
      <ExamPaywall access={access} />
    </MarketShell>
  );
}
