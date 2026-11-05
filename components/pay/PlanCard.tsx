import Link from "next/link";
import { Card } from "@/components/portal/shell";
import { PLAN_COURSE_QUOTA, planCourses } from "@/lib/pay/plans";
import { pool, rows } from "@/lib/pay/db";
import { planRecommended } from "@/lib/pay/plan-recommend";
import { courseAction } from "@/app/courses/actions";

const day = (s: string | null): string => (s ? new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");

/** The student's plan on their dashboard: what they hold, until when, and the courses it includes. */
export default async function PlanCard({ userId }: { userId: number }) {
  const s = await planCourses(userId);
  const rec = s.plan ? await planRecommended(userId).catch(() => ({ scanned: false, list: [] as Array<{ slug: string }> })) : { scanned: false, list: [] as Array<{ slug: string }> };
  const want = [...new Set([...s.picked, ...rec.list.map((x) => x.slug)])];
  const titles = want.length ? await rows<{ slug: string; title: string }>(pool, "SELECT slug, title FROM courses WHERE slug IN ($1)", [want]) : [];
  const title = (slug: string): string => titles.find((t) => t.slug === slug)?.title ?? slug;

  if (!s.plan) {
    return (
      <Card title="Your plan">
        <p className="text-[15px] text-ink-2"><b>Free</b>. You can read what is in every course. A paid plan includes courses and more: Pro {PLAN_COURSE_QUOTA.pro} course, Silver {PLAN_COURSE_QUOTA.silver}, Gold {PLAN_COURSE_QUOTA.gold}, chosen from your resume-scan recommendations, plus the full Vedic Mathematics course.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/pricing" className="inline-flex min-h-[48px] items-center rounded-lg bg-orange px-5 text-[15px] font-semibold text-white hover:bg-orange-dark">See plans</Link>
          <Link href="/courses" className="inline-flex min-h-[48px] items-center rounded-lg border border-black/[0.15] px-5 text-[15px] font-semibold text-ink hover:bg-cream-2">Browse courses</Link>
        </div>
      </Card>
    );
  }
  return (
    <Card title="Your plan">
      <p className="text-[15px] text-ink-2"><b>{s.plan.name}</b>{s.plan.expiresAt ? <> · active until {day(s.plan.expiresAt)}</> : null}</p>
      <div id="plan-courses">
        <h3 className="mt-4 text-[14px] font-semibold text-ink">Your recommended courses: choose {s.plan.courseQuota} ({s.picked.length} of {s.plan.courseQuota} chosen)</h3>
        <p className="mt-1 text-[13px] text-ink-3">Your plan courses are chosen from the courses recommended after your resume scan.</p>
        {!rec.scanned ? (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[14px] text-amber-900">Scan your resume to get your recommended courses. <Link href="/passport" className="font-semibold underline">Scan my resume</Link></p>
        ) : (
          <ul className="mt-2 divide-y divide-black/[0.07] text-[15px]">
            {rec.list.map((x) => {
              const idx = s.picked.indexOf(x.slug);
              const chosen = idx >= 0;
              return (
                <li key={x.slug} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <Link href={`/courses/${x.slug}`} className="font-medium text-ink underline underline-offset-2">{title(x.slug)}</Link>
                  {chosen ? <span className={`text-[13px] ${idx < s.plan!.courseQuota ? "text-emerald-700" : "text-amber-700"}`}>{idx < s.plan!.courseQuota ? "Chosen · open" : "Not in your current plan"}</span>
                    : s.left > 0 ? <form action={courseAction}><input type="hidden" name="act" value="pick" /><input type="hidden" name="slug" value={x.slug} /><input type="hidden" name="back" value="/account" /><button type="submit" className="inline-flex min-h-[40px] items-center rounded-lg bg-emerald-700 px-4 text-[14px] font-semibold text-white hover:bg-emerald-800">Choose</button></form>
                    : <span className="text-[13px] text-ink-4">All choices used</span>}
                </li>
              );
            })}
          </ul>
        )}
        {s.picked.filter((p) => !rec.list.some((x) => x.slug === p)).map((slug) => (
          <p key={slug} className="mt-2 text-[14px]"><Link href={`/courses/${slug}`} className="font-medium text-ink underline underline-offset-2">{title(slug)}</Link> <span className="text-emerald-700">· chosen earlier</span></p>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-3 text-[14px]">
        <Link href="/my-courses" className="inline-flex min-h-[44px] items-center rounded-lg bg-ink px-4 font-semibold text-white">My courses and progress</Link>
        <Link href="/vedic-math" className="inline-flex min-h-[44px] items-center rounded-lg border border-black/[0.15] px-4 font-semibold text-ink hover:bg-cream-2">Vedic Mathematics (all 30 modules)</Link>
        <Link href="/billing" className="inline-flex min-h-[44px] items-center rounded-lg border border-black/[0.15] px-4 font-semibold text-ink hover:bg-cream-2">Billing</Link>
      </div>
    </Card>
  );
}
