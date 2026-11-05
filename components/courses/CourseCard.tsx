import Link from "next/link";
import AddToCart from "@/components/pay/AddToCart";
import { formatMoney } from "@/lib/pay/money";
import { cardAction, type CardCourse, type CourseProgress } from "@/lib/market/catalog-card";
import { CourseThumb } from "./CourseThumb";
import CourseImage from "./CourseImage";

const ring = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep";

/**
 * One course on the catalogue. The whole card is one link (the title carries it, stretched over the card), so there are no nested links and a screen
 * reader hears each course once. The cover is decorative. The only separate control is Add to cart, raised above the stretched link.
 */
export default function CourseCard({ course, progress, onOpen }: { course: CardCourse; progress?: CourseProgress; onOpen?: (slug: string) => void }) {
  const act = cardAction(course, progress);
  const pct = progress ? Math.max(0, Math.min(100, progress.progress)) : 0;
  const price = course.price_minor ? formatMoney(course.price_minor, "INR").replace(/\.00$/, "") : null;
  return (
    <li className="group relative flex flex-col overflow-hidden rounded-2xl border border-black/[0.09] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.05)] transition-shadow duration-200 focus-within:shadow-[0_8px_24px_rgba(16,24,40,0.12)] hover:shadow-[0_8px_24px_rgba(16,24,40,0.12)] motion-safe:transition-transform motion-safe:hover:-translate-y-0.5">
      <div className="relative aspect-[16/9] overflow-hidden">
        {course.thumb ? <CourseImage course={course} className="motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:scale-[1.03]" /> : <CourseThumb course={course} className="motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:scale-[1.03]" />}
        {course.thumb ? null : <span className="absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold leading-none text-white backdrop-blur-sm">{course.cat_name}</span>}
        {progress?.status === "completed" ? <span className="absolute right-3 top-3 rounded-full bg-emerald-700 px-2.5 py-1 text-[11px] font-semibold leading-none text-white">Completed</span> : null}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="text-[12px] font-medium text-ink-3">{course.level_label}{course.badge ? <> &middot; {course.badge}</> : null}</p>
        <h3 className="mt-1 text-[16px] font-semibold leading-snug text-ink">
          <Link
            href={act.href}
            onClick={onOpen ? () => onOpen(course.slug) : undefined}
            className={`rounded after:absolute after:inset-0 after:z-0 after:content-[''] hover:underline underline-offset-2 ${ring}`}
          >
            {course.title}
          </Link>
        </h3>
        <p className="mt-1.5 line-clamp-2 text-[13.5px] leading-relaxed text-ink-3">{course.brief}</p>
        <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-ink-3" aria-label="Course details">
          {course.hours ? <li>{course.hours}</li> : null}
          {course.modules ? <li>{course.modules} modules</li> : null}
        </ul>
        {pct > 0 && progress?.status !== "completed" ? (
          <div className="mt-3" role="img" aria-label={`${pct} percent complete`}>
            <div className="h-1.5 overflow-hidden rounded-full bg-cream-3"><span className="block h-full rounded-full bg-orange-deep" style={{ width: `${pct}%` }} /></div>
          </div>
        ) : null}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-2 pt-4">
          <div className="min-w-0">
            {price ? <p className="text-[18px] font-bold leading-none text-ink">{price}</p> : null}
            <p className={`mt-1 inline-flex items-center gap-1.5 text-[12px] font-semibold ${course.here ? "text-emerald-800" : "text-ink-3"}`}>
              <span aria-hidden="true" className={`h-2 w-2 rounded-full ${course.here ? "bg-emerald-600" : "bg-black/25"}`} />
              {course.here ? "Lessons available" : "Lessons coming soon"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {course.here && price ? <span className="relative z-10"><AddToCart sku={`course-${course.slug}`} compact label="Add" /></span> : null}
            <span aria-hidden="true" className={`inline-flex min-h-[40px] items-center rounded-lg px-4 text-[13.5px] font-semibold ${act.primary ? "bg-orange-deep text-white group-hover:bg-ink" : "border border-black/[0.18] text-ink group-hover:bg-cream-3"}`}>{act.label}</span>
          </div>
        </div>
      </div>
    </li>
  );
}
