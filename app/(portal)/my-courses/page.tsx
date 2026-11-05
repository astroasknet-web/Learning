import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/portal/guard";
import * as courses from "@/lib/market/courses";
import * as learning from "@/lib/market/learning";
import * as lessons from "@/lib/market/lessons";
import PlanCard from "@/components/pay/PlanCard";
import MyPrepCard from "@/components/pay/MyPrepCard";
import { accessFor } from "@/lib/pay/course-access";
import { CourseFlash, CourseTracker, Cover } from "@/components/market/course-parts";
import { PortalPage } from "@/components/portal/shell";

export const metadata: Metadata = { title: "My courses | GrowQR" };
export const dynamic = "force-dynamic";

export default async function MyCoursesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await requireUser("student");
  const sp = await searchParams;
  const rows = await learning.forUser(me.id);
  // A course can sit here without being open: its plan lapsed, or it was never paid for. Progress is kept; the lessons stay closed until it is.
  const open = new Set((await Promise.all(rows.map(async (r) => ((await accessFor(me.id, r.slug)) !== null ? r.slug : null)))).filter((x): x is string => x !== null));
  const groups: Record<string, learning.MyCourse[]> = { "In progress": [], Enrolled: [], Completed: [] };
  for (const r of rows) groups[r.status === "completed" ? "Completed" : r.status === "in_progress" ? "In progress" : "Enrolled"].push(r);
  const counted = rows.filter((r) => r.status === "completed" && (r.tier === "certificate" || r.tier === "verified")).length;

  return (
    <PortalPage user={me} active="courses" title="My courses" subtitle="Track your progress. Completed courses with a certificate count toward your Skill Passport." wide="full">
      <CourseFlash c={sp.c} e={sp.e} />
      <div className="mb-6"><PlanCard userId={me.id} /></div>
      <MyPrepCard userId={me.id} />
      <dl className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[["Enrolled", rows.length, "courses"], ["In progress", groups["In progress"].length + groups.Enrolled.length, "to finish"], ["Completed", groups.Completed.length, "courses"], ["Counting toward matches", counted, "with certificate or verified"]].map(([k, v, s]) => (
          <div key={String(k)} className="bg-white rounded-2xl border border-black/[0.08] shadow-card p-5"><dt className="text-[13px] text-ink-4">{k}</dt><dd className="text-[24px] font-bold text-ink">{v}</dd><dd className="text-[13px] text-ink-3">{s}</dd></div>
        ))}
      </dl>
      {!rows.length ? (
        <div className="bg-white rounded-2xl border border-black/[0.08] p-8 text-center">
          <h2 className="text-[18px] font-semibold text-ink">You have not enrolled in a course yet</h2>
          <p className="text-[14px] text-ink-3 mt-1 mb-4">Pick a course, work through its lessons and pass each module quiz. Completed courses count toward your Skill Passport.</p>
          <Link href="/courses" className="inline-flex items-center min-h-[44px] px-5 rounded-lg bg-orange hover:bg-orange-dark text-white font-semibold text-[14px]">Browse {await courses.total()} courses</Link>
        </div>
      ) : null}
      {Object.entries(groups).map(([label, list]) =>
        list.length ? (
          <section key={label} className="mb-8" aria-labelledby={`g-${label.replace(" ", "-")}`}>
            <h2 id={`g-${label.replace(" ", "-")}`} className="text-[20px] font-bold text-ink mb-3">{label} ({list.length})</h2>
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              {list.map((e) => (
                <article key={e.id} className="bg-white rounded-2xl border border-black/[0.08] shadow-card p-4">
                  <Cover c={e} slug={e.slug} />
                  <h3 className="text-[16px] font-semibold text-ink mt-3"><Link href={`/courses/${e.slug}`} className="hover:underline">{e.title}</Link></h3>
                  {lessons.isNative(e.slug) && !open.has(e.slug) ? (
                    <>
                      <p className="mt-3 rounded-xl bg-amber-50 p-3.5 text-[14px] text-amber-900">Locked. Your progress ({e.progress}%) is saved. Buy this course, or renew a plan that includes it, to carry on.</p>
                      <p className="mt-2 text-[14px]"><Link className="underline text-orange-dark" href={`/courses/${e.slug}`}>See options</Link></p>
                    </>
                  ) : lessons.isNative(e.slug) ? (
                    <>
                      <CourseTracker course={e} e={e} back="/my-courses" />
                      <p className="mt-2 text-[14px]"><Link className="underline text-orange-dark" href={`/courses/${e.slug}/learn`}>{e.status === "completed" ? "Revisit" : "Continue"} lessons</Link></p>
                    </>
                  ) : (
                    <p className="mt-3 rounded-xl bg-cream-2 p-3.5 text-[14px] text-ink-3">Lessons for this course are coming soon on GrowQR.</p>
                  )}
                </article>
              ))}
            </div>
          </section>
        ) : null,
      )}
    </PortalPage>
  );
}
