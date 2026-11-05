import Link from "next/link";
import { staticCategories, type StaticCourseFull } from "@/lib/market/static-catalogue";
import { isNative } from "@/lib/market/lessons";

/** Course detail from the catalogue file. Shown while the database is not connected; enrolment and progress need it. */
export default function StaticCourseDetail({ c }: { c: StaticCourseFull }) {
  const cat = staticCategories().find((x) => x.key === c.cat);
  const facts: [string, string][] = [["Total time", c.hours], ["Modules", String(c.modules)], ["Pace", `${c.weeks} @ ${c.pace}`], ["Level", c.levelLabel], ["You earn", c.badge || "Certificate"]];
  return (
    <div>
      <nav aria-label="Breadcrumb" className="mb-4 text-[13px] text-ink-3"><Link href="/" className="underline">Home</Link> / <Link href="/courses" className="underline">Courses</Link> / <Link href={`/courses?cat=${c.cat}`} className="underline">{cat?.name ?? c.cat}</Link></nav>
      <h1 className="mt-4 text-[26px] font-bold leading-tight tracking-tight text-ink sm:text-[32px]">{c.title}</h1>
      <p className="mt-1 max-w-3xl text-[16px] text-ink-3">{c.brief}</p>
      <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {facts.map(([k, v]) => <li key={k} className="rounded-xl border border-black/[0.08] bg-white px-4 py-3"><span className="block text-[12px] text-ink-4">{k}</span><b className="text-[15px] text-ink">{v}</b></li>)}
      </ul>
      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="min-w-0 space-y-6">
          <article className="rounded-2xl border border-black/[0.08] bg-white p-5 shadow-card sm:p-7">
            <h2 className="mb-3 text-[20px] font-bold text-ink">What you will learn</h2>
            <ul className="list-disc space-y-1 pl-5 text-[15px] text-ink-2">{c.learn.map((l) => <li key={l}>{l}</li>)}</ul>
            {c.handsOn ? <><h3 className="mb-1 mt-5 text-[16px] font-semibold text-ink">Hands-on project</h3><p className="text-[15px] text-ink-2">{c.handsOn}</p></> : null}
            {c.outcome ? <><h3 className="mb-1 mt-5 text-[16px] font-semibold text-ink">After this course</h3><p className="text-[15px] text-ink-2">{c.outcome}</p></> : null}
          </article>
          <article className="rounded-2xl border border-black/[0.08] bg-white p-5 shadow-card sm:p-7">
            <h2 className="mb-3 text-[20px] font-bold text-ink">Is it right for you?</h2>
            {c.bestFor ? <><h3 className="mb-1 text-[16px] font-semibold text-ink">Best for</h3><p className="text-[15px] text-ink-2">{c.bestFor}</p></> : null}
            {c.prereq ? <><h3 className="mb-1 mt-4 text-[16px] font-semibold text-ink">Prerequisites</h3><p className="text-[15px] text-ink-2">{c.prereq}</p></> : null}
          </article>
        </div>
        <aside aria-label="Start this course" className="space-y-3 rounded-2xl border border-black/[0.08] bg-white p-5 shadow-card">
          <h2 className="text-[18px] font-bold text-ink">{isNative(c.slug) ? "Lessons run on GrowQR" : "Lessons coming soon"}</h2>
          <p className="text-[14px] text-ink-3">{isNative(c.slug) ? "Enrolment, quizzes and progress tracking open as soon as the learning platform is connected." : "The lessons for this course are being added to GrowQR. Start one that is ready, or study for an exam for free."}</p>
          {isNative(c.slug) ? null : <Link href="/exam-prep" className="flex min-h-[48px] w-full items-center justify-center rounded-lg bg-orange-deep text-[15px] font-semibold text-white hover:bg-ink">Free exam prep</Link>}
          <Link href="/courses" className="flex min-h-[48px] w-full items-center justify-center rounded-lg border border-black/[0.15] text-[15px] font-semibold hover:bg-cream-2">Back to all courses</Link>
        </aside>
      </div>
    </div>
  );
}
