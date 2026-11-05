import Link from "next/link";
import { staticCategories, staticCourses } from "@/lib/market/static-catalogue";
import ExamPrepBanner from "./ExamPrepBanner";

/** The course list straight from the catalogue file, shown when the database is not connected. Browse only: enrolment needs the database. */
export default function StaticCatalogue({ cat }: { cat: string }) {
  const cats = staticCategories();
  const active = cats.find((c) => c.key === cat)?.key ?? "";
  const list = staticCourses().filter((c) => !active || c.cat === active);
  const name = (k: string) => cats.find((c) => c.key === k)?.name ?? k;
  return (
    <div>
      <h1 className="font-sans text-[clamp(1.8rem,4vw,2.6rem)] font-semibold text-ink">Courses</h1>
      <p className="mt-2 max-w-[44em] text-ink-3">{staticCourses().length} skill-based courses in {cats.length} categories. Enrolment opens as soon as the learning platform is connected.</p>
      <ExamPrepBanner />
      <nav aria-label="Course categories" className="mt-6 flex flex-wrap gap-2">
        <Link href="/courses" className={`rounded-full px-4 py-2 text-[0.88rem] font-semibold ring-1 ring-black/10 ${active ? "bg-white text-ink" : "bg-ink text-white"}`}>All ({staticCourses().length})</Link>
        {cats.map((c) => (
          <Link key={c.key} href={`/courses?cat=${c.key}`} className={`rounded-full px-4 py-2 text-[0.88rem] font-semibold ring-1 ring-black/10 ${active === c.key ? "bg-ink text-white" : "bg-white text-ink"}`}>{c.name} ({c.n})</Link>
        ))}
      </nav>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((c) => (
          <li key={c.slug}><Link href={`/courses/${c.slug}`} className="block h-full rounded-2xl border border-black/[0.08] bg-white p-5 shadow-card transition hover:-translate-y-1 hover:shadow-glow">
            <p className="text-[0.72rem] font-bold uppercase tracking-wider text-orange-dark">{name(c.cat)}</p>
            <h2 className="mt-1 text-[1.08rem] font-semibold leading-snug text-ink">{c.title}</h2>
            <p className="mt-2 text-[0.9rem] leading-relaxed text-ink-3">{c.brief}</p>
            <p className="mt-3 text-[0.8rem] text-ink-4">{c.levelLabel} · {c.hours} · {c.modules} modules</p></Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
