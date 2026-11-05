import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card } from "@/components/portal/shell";
import { entitlementsFor } from "@/lib/pay/entitlements";
import { EXAM_PREP } from "@/lib/pay/course-fees";

/** The exam-preparation products and Maths Olympiad classes the student has bought, each with a link into it. Nothing shows until they own one. */
export default async function MyPrepCard({ userId }: { userId: number }) {
  const list = (await entitlementsFor(userId).catch(() => [])).filter((e) => e.kind === "course" && e.status === "active");
  const items: Array<{ ref: string; title: string; href: string }> = [];
  for (const e of list) {
    const exam = EXAM_PREP.find((x) => x.slug === e.ref);
    if (exam) items.push({ ref: e.ref, title: exam.title, href: `/exam-prep/${exam.hub}` });
    else if (/^imo-class-\d+$/.test(e.ref)) items.push({ ref: e.ref, title: e.title || `Class ${e.ref.slice(10)} Maths Olympiad`, href: `/olympiad/imo/class-${e.ref.slice(10)}` });
  }
  if (!items.length) return null;
  return (
    <Card title="My exam prep and Olympiad">
      <ul className="divide-y divide-black/[0.07]">
        {items.map((i) => (
          <li key={i.ref}><Link href={i.href} className="flex min-h-[52px] items-center justify-between gap-3 py-2 font-semibold text-ink hover:text-orange-deep">{i.title}<ArrowRight className="h-4 w-4 shrink-0" aria-hidden /></Link></li>
        ))}
      </ul>
    </Card>
  );
}
