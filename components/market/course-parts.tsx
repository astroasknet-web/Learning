import { formatMoney } from "@/lib/pay/money";
import Link from "next/link";
import type { Course } from "@/lib/market/courses";
import { hasThumb, thumbSmall } from "@/lib/market/thumbs";
import { checkpoints, type Enrolment } from "@/lib/market/learning";
import { courseAction } from "@/app/courses/actions";
import { nativeCourse, isNative } from "@/lib/market/lessons";

const TIER_LABEL = { verified: "Verified", certificate: "Certificate linked", self: "Self-reported" } as const;
const TIER_CLS = { verified: "bg-emerald-50 text-emerald-800", certificate: "bg-teal-50 text-teal-800", self: "bg-cream-3 text-ink-3" } as const;

export function TierPill({ tier }: { tier: Enrolment["tier"] }) {
  return tier ? <span className={`px-2.5 py-1 rounded-full text-[12px] font-medium ${TIER_CLS[tier]}`}>{TIER_LABEL[tier]}</span> : null;
}

/** A gradient cover in the category's two colours (the PHP app drew an SVG per course; this keeps the same colour identity). */
export function Cover({ c, slug, children }: { c: Pick<Course, "c1" | "c2" | "cat_name" | "hours">; slug?: string; children?: React.ReactNode }) {
  if (slug && hasThumb(slug)) {
    return (
      <div className="relative aspect-[16/9] overflow-hidden rounded-xl bg-cream-3" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={thumbSmall(slug)} width={640} height={360} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
        <span className="absolute bottom-2 right-2 rounded-full bg-black/45 px-2.5 py-1 text-[12px] font-semibold text-white">{c.hours}</span>
        {children}
      </div>
    );
  }
  return (
    <div className="relative h-28 rounded-xl overflow-hidden text-white" style={{ background: `linear-gradient(135deg, ${c.c1}, ${c.c2})` }} aria-hidden="true">
      <span className="absolute left-3 top-3 text-[12px] font-semibold bg-black/25 rounded-full px-2.5 py-1">{c.cat_name}</span>
      <span className="absolute right-3 bottom-3 text-[12px] font-semibold bg-black/25 rounded-full px-2.5 py-1">{c.hours}</span>
      {children}
    </div>
  );
}

export function CourseCard({ course }: { course: Course }) {
  return (
    <li className="bg-white rounded-2xl border border-black/[0.08] shadow-card p-4 flex flex-col">
      <Cover c={course} slug={course.slug} />
      <h3 className="text-[16px] font-semibold text-ink leading-snug mt-3"><Link href={`/courses/${course.slug}`} className="hover:underline underline-offset-2">{course.title}</Link></h3>
      <p className="text-[13px] text-ink-3 mt-1 line-clamp-3">{course.brief}</p>
      <p className="text-[12px] text-ink-4 mt-auto pt-3">{course.level_label} &middot; {course.modules} modules &middot; {course.badge || "Certificate"}</p>
      <p className={`mt-2 text-[12px] font-semibold ${isNative(course.slug) ? "text-emerald-800" : "text-ink-3"}`}>{isNative(course.slug) ? "Lessons available now" : "Lessons coming soon"}{course.fee_minor ? <span className="ml-2 text-ink">{formatMoney(course.fee_minor, "INR").replace(/.00$/, "")}</span> : null}</p>
    </li>
  );
}

const inputCls = "w-full min-h-[44px] px-3 rounded-lg border border-black/[0.15] bg-white text-[14px]";

/** Progress tracker for one course: checkpoint form, certificate form and tier. */
export function CourseTracker({ course, e, back }: { course: Pick<Course, "slug" | "title" | "modules">; e: Enrolment; back: string }) {
  const total = checkpoints(course);
  const nc = nativeCourse(course.slug);
  if (nc) {
    // Taught on GrowQR: progress comes only from passing the module quizzes, so there is nothing to tick by hand and no certificate link to paste.
    return (
      <div id={`c-${course.slug}`} className="mt-3 rounded-xl bg-cream-2 p-3.5">
        <div className="flex items-center justify-between gap-2"><b className="text-[14px] text-ink">{e.progress}% complete</b><TierPill tier={e.tier} /></div>
        <div className="h-2 rounded-full bg-cream-3 overflow-hidden mt-2" role="img" aria-label={`${e.progress} percent complete`}><span className="block h-full bg-orange-deep rounded-full" style={{ width: `${e.progress}%` }} /></div>
        <ul className="mt-3 space-y-0.5">
          {Array.from({ length: total }, (_, i) => {
            const label = i === total - 1 ? nc.capstone.title : nc.modules[i]?.title ?? `Module ${i + 1}`;
            const href = `/courses/${course.slug}/learn/${i === total - 1 ? "capstone" : nc.modules[i]?.slug}`;
            return <li key={i} className="flex items-start gap-2 min-h-[32px] text-[14px] text-ink-2"><span aria-hidden="true" className={e.done.includes(i) ? "text-emerald-700" : "text-ink-3"}>{e.done.includes(i) ? "\u2713" : "\u25CB"}</span><span><span className="sr-only">{e.done.includes(i) ? "Completed: " : "Not yet: "}</span><Link href={href} className="hover:underline">{label}</Link></span></li>;
          })}
        </ul>
        {e.status === "completed" ? <p className="text-[13px] text-ink-3 mt-2">Complete. This counts toward your Skill Passport.</p> : null}
        {!e.verified ? <form action={courseAction} className="mt-2"><input type="hidden" name="act" value="unenrol" /><input type="hidden" name="slug" value={course.slug} /><input type="hidden" name="back" value={back} /><button type="submit" className="text-[13px] underline text-ink-3 min-h-[44px]">Leave this course</button></form> : null}
      </div>
    );
  }
  const locked = e.verified;
  const hidden = (act: string) => (
    <>
      <input type="hidden" name="act" value={act} /><input type="hidden" name="slug" value={course.slug} /><input type="hidden" name="back" value={back} />
    </>
  );
  return (
    <div id={`c-${course.slug}`} className="mt-3 rounded-xl bg-cream-2 p-3.5">
      <div className="flex items-center justify-between gap-2"><b className="text-[14px] text-ink">{e.progress}% complete</b><TierPill tier={e.tier} /></div>
      <div className="h-2 rounded-full bg-cream-3 overflow-hidden mt-2" role="img" aria-label={`${e.progress} percent complete`}><span className="block h-full bg-orange rounded-full" style={{ width: `${e.progress}%` }} /></div>

      <form action={courseAction} className="mt-3">
        {hidden("save")}
        <fieldset disabled={locked}>
          <legend className="sr-only">Checkpoints for {course.title}</legend>
          <ul className="space-y-0.5">
            {Array.from({ length: total }, (_, i) => (
              <li key={i}><label className="flex items-center gap-2.5 min-h-[40px] text-[14px] text-ink-2"><input type="checkbox" name="done" value={i} defaultChecked={e.done.includes(i)} />{i === total - 1 ? "Hands-on project" : `Module ${i + 1}`}</label></li>
            ))}
          </ul>
        </fieldset>
        {!locked ? <button type="submit" className="mt-2 min-h-[44px] px-4 rounded-lg bg-ink text-white text-[14px] font-semibold">Save progress</button> : <p className="text-[13px] text-ink-3 mt-2">Verified by the LMS. This record is locked.</p>}
      </form>

      {e.status === "completed" ? (
        <>
          {e.certificate_url ? <p className="mt-3 text-[14px]"><a className="underline text-orange-dark" href={e.certificate_url} target="_blank" rel="noopener noreferrer">View your certificate</a>{e.certificate_code ? <span className="text-ink-4"> ({e.certificate_code})</span> : null}</p> : null}
          {e.certificate_url === "" || !locked ? (
            <form action={courseAction} className="mt-3 space-y-2">
              {hidden("certificate")}
              <label htmlFor={`cu-${course.slug}`} className="block text-[13px] font-medium text-ink-2">{e.certificate_url === "" ? "Add your certificate link" : "Replace certificate link"}</label>
              <input id={`cu-${course.slug}`} name="cert_url" type="url" inputMode="url" placeholder="https://..." defaultValue={e.certificate_url} className={inputCls} />
              <label htmlFor={`cc-${course.slug}`} className="block text-[13px] font-medium text-ink-2">Certificate ID <span className="text-ink-4 font-normal">(optional)</span></label>
              <input id={`cc-${course.slug}`} name="cert_code" maxLength={60} defaultValue={e.certificate_code} className={inputCls} />
              <button type="submit" className="min-h-[44px] px-4 rounded-lg bg-orange hover:bg-orange-dark text-white text-[14px] font-semibold">Save certificate</button>
              <p className="text-[12px] text-ink-4">Without a certificate link a completion is shown as self-reported and does not raise your match scores.</p>
            </form>
          ) : null}
        </>
      ) : null}

      {!locked ? (
        <form action={courseAction} className="mt-3">{hidden("unenrol")}<button type="submit" className="text-[13px] underline text-ink-3 min-h-[44px]">Leave this course</button></form>
      ) : null}
    </div>
  );
}

const MSG: Record<string, string> = {
  enrolled: "You are enrolled. Pass each module quiz to complete it.",
  picked: "Done. This course is now part of your plan. Start the lessons and track your progress in My courses.",
  left: "You left this course.",
  saved: "Progress saved.",
  completed: "Course complete! It now counts toward your Skill Passport.",
  cert_ok: "Certificate linked. This course now counts toward your Skill Passport.",
  locked: "Progress in this course comes from the module quizzes and cannot be edited by hand.",
};

/** One-line status message after a course action (read from ?c= and ?e=). */
export function CourseFlash({ c, e }: { c?: string; e?: string }) {
  if ((c === "cert_err" || c === "pick_err") && e) return <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-[14px] text-red-800">{e}</p>;
  return c && MSG[c] ? <p role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-[14px] text-emerald-900">{MSG[c]}</p> : null;
}
