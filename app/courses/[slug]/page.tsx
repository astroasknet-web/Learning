import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { databaseConfigured } from "@/lib/portal/db";
import * as passport from "@/lib/portal/passport/profile";
import * as courses from "@/lib/market/courses";
import * as jobs from "@/lib/market/jobs";
import * as learning from "@/lib/market/learning";
import AddToCart from "@/components/pay/AddToCart";
import { planCourses } from "@/lib/pay/plans";
import { buyHref, canStudy, courseFee, courseSku } from "@/lib/pay/course-access";
import { planRecommended } from "@/lib/pay/plan-recommend";
import { hasThumb, thumbFull, thumbSmall } from "@/lib/market/thumbs";
import { formatMoney } from "@/lib/pay/money";
import * as lessons from "@/lib/market/lessons";
import { JobCard } from "@/components/market/job-card";
import { CourseCard, CourseFlash, CourseTracker, Cover } from "@/components/market/course-parts";
import { currentViewer, MarketShell } from "@/components/market/shell";
import { courseAction } from "../actions";
import { serializeJsonLd } from "@/lib/json-ld";
import { SITE_URL } from "@/lib/seo";
import { landingJsonLd, landingMetadata } from "@/lib/learn/course-seo";
import { UniversityCourseSections } from "@/components/learn/UniversityCourseSections";
import StaticCourseDetail from "@/components/market/StaticCourseDetail";
import { staticCourse } from "@/lib/market/static-catalogue";

export const dynamic = "force-dynamic";
const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9-]/g, "");

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  if (!databaseConfigured()) { const sc = staticCourse(clean((await params).slug)); return { title: sc ? `${sc.title} | GrowQR` : "Course | GrowQR", description: sc?.brief }; }
  const c = await courses.bySlug(clean((await params).slug));
  if (!c) return { title: "Course not found | GrowQR", robots: { index: false, follow: true } };
  const rich = lessons.nativeCourse(c.slug);
  const landing = rich ? landingMetadata(rich, c.slug) : null;
  if (landing) return landing; // university programme courses carry their own SEO block
  const image = hasThumb(c.slug) ? [{ url: `${SITE_URL}${thumbFull(c.slug)}`, width: 1920, height: 1080, alt: `${c.title} course` }] : undefined;
  return {
    title: `${c.title} Course | GrowQR`,
    description: Array.from(`${c.brief} ${c.hours}, ${c.modules} modules, certificate and badge.`).slice(0, 155).join(""),
    alternates: { canonical: `${SITE_URL}/courses/${c.slug}` },
    robots: { index: true, follow: true },
    ...(image ? { openGraph: { title: `${c.title} Course | GrowQR`, url: `${SITE_URL}/courses/${c.slug}`, type: "website" as const, images: image }, twitter: { card: "summary_large_image" as const, images: [image[0].url] } } : {}),
  };
}

export default async function CoursePage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const slug = clean((await params).slug);
  const sp = await searchParams;
  const me = await currentViewer();
  if (!databaseConfigured()) {
    const sc = staticCourse(slug);
    if (!sc) notFound();
    return <MarketShell user={null} active="courses"><StaticCourseDetail c={sc} /></MarketShell>;
  }
  const course = slug ? await courses.bySlug(slug) : null;
  if (!course) notFound();
  const isStudent = me?.role === "student";
  const profile = isStudent ? await passport.profile(me!.id) : null;
  const enrol = profile ? await learning.find(me!.id, course.id) : null;
  const self = `/courses/${course.slug}`;
  const native = lessons.isNative(course.slug);
  const start = `${self}/learn`; // only used when the course is taught here
  const fee = native || course.slug === "vedic-mathematics" ? await courseFee(course.slug) : null;
  const plan = me && isStudent ? await planCourses(me.id) : null;
  const recs = plan?.plan ? await planRecommended(me!.id).catch(() => ({ scanned: false, list: [] })) : null;
  const recommended = !!recs?.list.some((x) => x.slug === course.slug); // a plan course can be chosen only from the courses recommended after the resume scan
  const owned = await canStudy(me?.id ?? null, course.id, course.slug); // false only for a priced course the visitor has not paid for

  // Internships whose required skills this course teaches.
  const hay = (course.title + " " + course.learn.join(" ") + " " + course.brief).toLowerCase();
  const matching = (await jobs.live())
    .map((j) => ({ j, n: j.skills.filter((s) => Buffer.byteLength(s) >= 3 && hay.includes(s.toLowerCase())).length }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, 3)
    .map(({ j }) => ({ ...j, match: passport.match(j.skills, profile).score }));
  const related = await courses.related(course, 3);

  const rich = lessons.nativeCourse(course.slug);
  const jsonld = rich?.landing ? landingJsonLd(rich, course.slug, course) : {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Course", ...(hasThumb(course.slug) ? { image: `${SITE_URL}${thumbFull(course.slug)}` } : {}), name: course.title, description: course.brief, url: `${SITE_URL}${self}`, educationalLevel: course.level_label, timeRequired: course.hours, inLanguage: "en", provider: { "@type": "Organization", name: "GrowQR", sameAs: SITE_URL } },
      { "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: "Courses", item: `${SITE_URL}/courses` },
        { "@type": "ListItem", position: 3, name: course.cat_name, item: `${SITE_URL}/courses?cat=${course.category}` },
        { "@type": "ListItem", position: 4, name: course.title },
      ] },
    ],
  };
  const btn = "flex items-center justify-center min-h-[48px] rounded-lg font-semibold text-[15px] w-full";

  return (
    <MarketShell user={me} active="courses">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonld) }} />
      <nav aria-label="Breadcrumb" className="text-[13px] text-ink-3 mb-4"><Link href="/" className="underline">Home</Link> / <Link href="/courses" className="underline">Courses</Link> / <Link href={`/courses?cat=${course.category}`} className="underline">{course.cat_name}</Link></nav>
      {hasThumb(course.slug) ? (
        <div className="mx-auto w-full max-w-[880px] overflow-hidden rounded-2xl bg-cream-3 ring-1 ring-black/10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={thumbFull(course.slug)} srcSet={`${thumbSmall(course.slug)} 640w, ${thumbFull(course.slug)} 1920w`} sizes="(min-width: 960px) 880px, 100vw" width={1920} height={1080} alt={`${course.title} course thumbnail`} fetchPriority="high" decoding="async" className="block h-auto w-full" />
        </div>
      ) : <Cover c={course} slug={course.slug} />}
      <h1 className="text-[26px] sm:text-[32px] font-bold text-ink tracking-tight leading-tight mt-4">{course.title}</h1>
      <p className="text-[16px] text-ink-3 mt-1 max-w-3xl">{course.brief}</p>
      <ul className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-5">
        {[["Total time", course.hours], ["Modules", String(course.modules)], ["Pace", course.weeks ? `${course.weeks} @ ${course.pace}` : course.pace], ["Level", course.level_label], ["You earn", course.badge || "Certificate"]].map(([k, v]) => (
          <li key={k} className="bg-white rounded-xl border border-black/[0.08] px-4 py-3"><span className="block text-[12px] text-ink-4">{k}</span><b className="text-[15px] text-ink">{v}</b></li>
        ))}
      </ul>

      <div className="grid lg:grid-cols-[1fr_22rem] gap-6 mt-6 items-start">
        <div className="space-y-6 min-w-0">
          <article className="bg-white rounded-2xl border border-black/[0.08] shadow-card p-5 sm:p-7">
            <h2 className="text-[20px] font-bold text-ink mb-3">What you will learn</h2>
            <ul className="list-disc pl-5 space-y-1 text-[15px] text-ink-2">{course.learn.map((l) => <li key={l}>{l}</li>)}</ul>
            {course.hands_on ? (<><h3 className="text-[16px] font-semibold text-ink mt-5 mb-1">Hands-on project</h3><p className="text-[15px] text-ink-2">{course.hands_on}</p></>) : null}
            {course.outcome ? (<><h3 className="text-[16px] font-semibold text-ink mt-5 mb-1">After this course</h3><p className="text-[15px] text-ink-2">{course.outcome}</p></>) : null}
          </article>
          <article className="bg-white rounded-2xl border border-black/[0.08] shadow-card p-5 sm:p-7">
            <h2 className="text-[20px] font-bold text-ink mb-3">Is it right for you?</h2>
            {course.best_for ? (<><h3 className="text-[16px] font-semibold text-ink mb-1">Best for</h3><p className="text-[15px] text-ink-2">{course.best_for}</p></>) : null}
            {course.prereq ? (<><h3 className="text-[16px] font-semibold text-ink mt-4 mb-1">Prerequisites</h3><p className="text-[15px] text-ink-2">{course.prereq}</p></>) : null}
            {course.tag_list.length ? (<><h3 className="text-[16px] font-semibold text-ink mt-4 mb-2">Audience</h3><ul className="flex flex-wrap gap-2">{course.tag_list.map((t) => <li key={t} className="px-3 py-1.5 rounded-full bg-cream-3 text-[13px]">{t}</li>)}</ul></>) : null}
            <h3 className="text-[16px] font-semibold text-ink mt-4 mb-1">Included in every course</h3>
            <ul className="list-disc pl-5 space-y-1 text-[15px] text-ink-2"><li>Bite-sized lessons grouped into modules</li><li>Guided practice, short quizzes and one hands-on project</li><li>A certificate and a badge for your profile</li><li>Self-paced, lifetime access, mobile or desktop</li></ul>
          </article>
          {rich?.landing ? <UniversityCourseSections nc={rich} slug={course.slug} /> : null}
        </div>

        <aside aria-label="Start this course" id="progress" className="bg-white rounded-2xl border border-black/[0.08] shadow-card p-5 space-y-3">
          {native ? (
            <>
              <h2 className="text-[18px] font-bold text-ink">Ready to start?</h2>
              <p className="text-[14px] text-ink-3">Lessons, quizzes and the capstone run right here on GrowQR. Pass each module quiz to tick off your progress.</p>
              <CourseFlash c={sp.c} e={sp.e} />
              {!owned ? (
                <>
                  {plan?.plan ? (
                    <div className="rounded-xl border border-emerald-600/30 bg-emerald-50 p-3.5">
                      {plan.left > 0 && !recommended && !plan.picked.includes(course.slug) ? (
                        <>
                          <p className="text-[14px] font-semibold text-emerald-900">Your {plan.plan.name} plan includes {plan.plan.courseQuota} {plan.plan.courseQuota === 1 ? "course" : "courses"} from your resume-scan recommendations</p>
                          <p className="mt-0.5 text-[13px] text-emerald-900/80">{recs?.scanned ? "This course is not one of your recommendations. You can buy it below, or see the ones you can choose." : "Scan your resume to see the courses recommended for you, then choose from them."} <Link href={recs?.scanned ? "/account#plan-courses" : "/passport"} className="font-semibold underline">{recs?.scanned ? "My recommended courses" : "Scan my resume"}</Link></p>
                        </>
                      ) : plan.left > 0 ? (
                        <>
                          <p className="text-[14px] font-semibold text-emerald-900">Included in your {plan.plan.name} plan</p>
                          <p className="mt-0.5 text-[13px] text-emerald-900/80">You have {plan.left} of {plan.plan.courseQuota} course {plan.plan.courseQuota === 1 ? "pick" : "picks"} left. Use one here and start right away, at no extra cost.</p>
                          <form action={courseAction} className="mt-3"><input type="hidden" name="act" value="pick" /><input type="hidden" name="slug" value={course.slug} /><input type="hidden" name="back" value={self} /><button type="submit" className={`${btn} w-full bg-emerald-700 text-white hover:bg-emerald-800`}>Use my plan for this course</button></form>
                        </>
                      ) : (
                        <p className="text-[13px] text-emerald-900">You have used all {plan.plan.courseQuota} course {plan.plan.courseQuota === 1 ? "pick" : "picks"} in your {plan.plan.name} plan. {plan.plan.key !== "gold" ? "A higher plan includes more courses. " : ""}You can still buy this course below.</p>
                      )}
                    </div>
                  ) : null}
                  {fee ? (
                    <>
                      <p className="text-[28px] font-bold text-ink">{formatMoney(fee.amountMinor, "INR")}</p>
                      <p className="text-[13px] text-ink-3">One payment for this course. Lifetime access, certificate and badge.</p>
                      <Link className={`${btn} bg-orange-deep hover:bg-ink text-white`} href={buyHref(course.slug)}>Buy this course</Link>
                      <AddToCart sku={courseSku(course.slug)} className="w-full" />
                    </>
                  ) : <p className="text-[14px] text-ink-3">This course is not on sale right now.</p>}
                  {!plan?.plan ? <p className="text-[13px] text-ink-3">Or get a <Link href="/pricing" className="font-semibold underline">plan</Link> that includes courses.</p> : null}
                  <Link className={`${btn} border border-black/[0.15] hover:bg-cream-2`} href={start}>See what is inside</Link>
                </>
              ) : enrol ? (
                <>
                  <Link className={`${btn} bg-orange-deep hover:bg-ink text-white`} href={start}>{enrol.status === "completed" ? "Revisit the lessons" : "Continue learning"}</Link>
                  <CourseTracker course={course} e={enrol} back={self} />
                </>
              ) : (
                <>
                  {profile ? (
                    <form action={courseAction}><input type="hidden" name="act" value="enrol" /><input type="hidden" name="slug" value={course.slug} /><input type="hidden" name="back" value={self} /><button type="submit" className={`${btn} bg-orange-deep hover:bg-ink text-white`}>Enrol and track progress</button></form>
                  ) : !me ? (
                    <Link className={`${btn} bg-orange-deep hover:bg-ink text-white`} href={`/login?next=${encodeURIComponent(self)}`}>Log in to enrol and track progress</Link>
                  ) : null}
                  <Link className={`${btn} ${profile || !me ? "border border-black/[0.15] hover:bg-cream-2" : "bg-orange-deep hover:bg-ink text-white"}`} href={start}>Start the lessons</Link>
                </>
              )}
            </>
          ) : course.slug === "vedic-mathematics" ? (
            <>
              <h2 className="text-[18px] font-bold text-ink">Taught here on GrowQR</h2>
              <p className="text-[14px] text-ink-2">30 modules in three levels, in English and Hindi. Module 1 is free. The rest open with a Pro, Silver or Gold plan{fee ? ", or by buying the course" : ""}.</p>
              {fee ? <p className="text-[28px] font-bold text-ink">{formatMoney(fee.amountMinor, "INR")}</p> : null}
              {fee ? <Link className={`${btn} border border-black/[0.15] hover:bg-cream-2`} href={me ? buyHref(course.slug) : `/login?next=${encodeURIComponent(buyHref(course.slug))}`}>Buy the course</Link> : null}
              <Link className={`${btn} bg-orange-deep hover:bg-ink text-white`} href="/vedic-math">Open the Vedic Mathematics course</Link>
              <Link className={`${btn} border border-black/[0.15] hover:bg-cream-2`} href="/pricing">See plans</Link>
            </>
          ) : (
            <>
              <h2 className="text-[18px] font-bold text-ink">Lessons coming soon</h2>
              {course.fee_minor ? <p className="text-[14px] text-ink-2">Course fee: <b className="text-ink">{formatMoney(course.fee_minor, "INR").replace(/.00$/, "")}</b>. You can buy it as soon as the lessons are ready.</p> : null}
              <p className="text-[14px] text-ink-3">The lessons for this course are being added to GrowQR. In the meantime you can start one of the courses that is ready, or study for an exam for free.</p>
              <Link className={`${btn} bg-orange-deep hover:bg-ink text-white`} href="/courses?available=1">See courses you can start now</Link>
              <Link className={`${btn} border border-black/[0.15] hover:bg-cream-2`} href="/exam-prep">Exam prep</Link>
            </>
          )}
          <ul className="text-[14px] text-ink-2 space-y-1"><li>{course.hours}{course.weeks ? `, about ${course.weeks}` : ""}</li><li>{course.badge || "Certificate"}</li></ul>
        </aside>
      </div>

      {matching.length ? (
        <section className="mt-10" aria-labelledby="use-h"><h2 id="use-h" className="text-[20px] font-bold text-ink mb-4">Internships that use these skills</h2>
          <ul className="grid gap-4 md:grid-cols-3">{matching.map((j) => <JobCard key={j.id} job={j} back={self} />)}</ul></section>
      ) : null}
      {related.length ? (
        <section className="mt-10" aria-labelledby="rel-h"><h2 id="rel-h" className="text-[20px] font-bold text-ink mb-4">More in {course.cat_name}</h2>
          <ul className="grid sm:grid-cols-3 gap-4">{related.map((r) => <CourseCard key={r.slug} course={r} />)}</ul></section>
      ) : null}
    </MarketShell>
  );
}
