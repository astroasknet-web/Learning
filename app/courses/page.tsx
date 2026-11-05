import type { Metadata } from "next";
import Link from "next/link";
import { databaseConfigured } from "@/lib/portal/db";
import * as courses from "@/lib/market/courses";
import * as learning from "@/lib/market/learning";
import * as lessons from "@/lib/market/lessons";
import { parseQuery, hasFilters } from "@/lib/market/catalog-query";
import { runCatalog } from "@/lib/market/catalog-service";
import { freeCount, searchCatalog } from "@/lib/market/catalog-search";
import type { CourseProgress } from "@/lib/market/catalog-card";
import { toCard } from "@/lib/market/catalog-card-server";
import CatalogApp from "@/components/courses/CatalogApp";
import CourseCard from "@/components/courses/CourseCard";
import StaticCatalogue from "@/components/market/StaticCatalogue";
import ExamPrepBanner from "@/components/market/ExamPrepBanner";
import { currentViewer, MarketShell } from "@/components/market/shell";
import { serializeJsonLd } from "@/lib/json-ld";
import { SITE_URL } from "@/lib/seo";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined): string => (Array.isArray(v) ? v[0] ?? "" : v ?? "");
const focus = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep";

async function read(sp: SP) {
  const cats = (await courses.categories()).filter((c) => c.n > 0); // never show an empty field
  return { cats, q: parseQuery(sp, cats.map((c) => c.key)) };
}

export async function generateMetadata({ searchParams }: { searchParams: Promise<SP> }): Promise<Metadata> {
  if (!databaseConfigured()) return { title: "Courses | GrowQR" };
  const { cats, q } = await read(await searchParams);
  const total = await courses.total();
  const onlyField = q.cat.length === 1 && !q.q && !q.level.length && !q.len.length && !q.price.length && !q.aud.length && !q.available && !q.sort && q.page === 1 && q.size === 24;
  const fieldName = onlyField ? cats.find((c) => c.key === q.cat[0])?.name ?? "" : "";
  const title = fieldName ? `${fieldName} Courses | GrowQR` : q.q ? `Courses for “${q.q}” | GrowQR` : "Online Courses to Get Internship-Ready | GrowQR";
  const description = `Browse ${total} self-paced courses in data, AI, software, design, marketing and more. Search by skill or topic, filter by level, length and price, and add a hands-on project, certificate and badge to your Skill Passport.`;
  // The plain catalogue and a single field are the pages worth indexing. Searches, other filters and later pages are for people, not for the index.
  const index = !hasFilters(q) && !q.sort && q.page === 1 ? true : onlyField;
  return {
    title: q.page > 1 ? `Page ${q.page}: ${title}` : title,
    description,
    alternates: { canonical: `${SITE_URL}/courses${onlyField ? "?cat=" + q.cat[0] : ""}` },
    openGraph: { title, description, url: `${SITE_URL}/courses${onlyField ? "?cat=" + q.cat[0] : ""}`, type: "website" },
    robots: index ? { index: true, follow: true } : { index: false, follow: true },
  };
}

export default async function CoursesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const me = await currentViewer();
  if (!databaseConfigured()) return <MarketShell user={null} active="courses"><StaticCatalogue cat={one((await searchParams).cat)} /></MarketShell>;
  const { cats, q } = await read(await searchParams);
  const native = lessons.nativeSlugs();
  const [initial, free, hours] = await Promise.all([runCatalog(q), freeCount(), courses.totalHours()]);

  // What this student has already done, so each card can say Start, Continue or Review. Anyone else just sees View course.
  const progress: Record<string, CourseProgress> = {};
  if (me?.role === "student") for (const e of await learning.forUser(me.id)) progress[e.slug] = { status: e.status, progress: e.progress };

  const landing = !hasFilters(q) && q.page === 1 && !q.sort;
  const paths = landing ? await courses.paths() : [];
  const spot = landing ? (await courses.bySlugs(courses.FEATURED)).map((c) => toCard(c, lessons.isNative(c.slug))).slice(0, 8) : [];
  const live = landing ? (await courses.bySlugs(native)).map((c) => toCard(c, true)).slice(0, 6) : [];
  const freeCourses = landing && free > 0 ? (await searchCatalog({ ...q, price: ["free"], size: 6, page: 1 })).items.map((c) => toCard(c, lessons.isNative(c.slug))) : [];
  const continuing = landing ? Object.entries(progress).filter(([, p]) => p.status !== "completed").slice(0, 3) : [];
  const continuingCards = continuing.length ? (await courses.bySlugs(continuing.map(([s]) => s))).map((c) => toCard(c, lessons.isNative(c.slug))) : [];

  const fieldName = q.cat.length === 1 ? cats.find((c) => c.key === q.cat[0])?.name ?? "" : "";
  const itemList = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: fieldName ? `${fieldName} courses` : "Courses to get internship-ready",
    url: `${SITE_URL}/courses${fieldName ? "?cat=" + q.cat[0] : ""}`,
    mainEntity: { "@type": "ItemList", itemListElement: initial.items.map((c, i) => ({ "@type": "ListItem", position: i + 1, url: `${SITE_URL}/courses/${c.slug}`, name: c.title })) },
  };

  const section = (id: string, title: string, sub: string, cards: ReturnType<typeof toCard>[], cols = "lg:grid-cols-3") => cards.length ? (
    <section aria-labelledby={id} className="mt-12">
      <h2 id={id} className="text-[22px] font-bold text-ink">{title}</h2>
      <p className="mb-4 text-[14px] text-ink-3">{sub}</p>
      <ul className={`grid gap-5 sm:grid-cols-2 ${cols}`}>{cards.map((c) => <CourseCard key={c.slug} course={c} progress={progress[c.slug]} />)}</ul>
    </section>
  ) : null;

  const discovery = (
    <>
      <ExamPrepBanner />
      {section("continue-h", "Continue learning", "Pick up where you left off.", continuingCards)}
      {section("live-h", "Start learning today", "Full lessons, quizzes and a capstone, ready on GrowQR now.", live)}
      {section("free-h", "Free courses", "Taught here and free to take.", freeCourses)}
      {paths.length ? (
        <section aria-labelledby="paths-h" className="mt-12">
          <h2 id="paths-h" className="text-[22px] font-bold text-ink">Career paths</h2>
          <p className="mb-4 text-[14px] text-ink-3">An ordered ladder of courses toward a role.</p>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {paths.map((p) => (
              <li key={p.key} className="rounded-2xl border border-black/[0.08] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.05)]">
                <span aria-hidden="true" className="mb-3 block h-1.5 w-12 rounded-full" style={{ background: p.c1 }} />
                <h3 className="text-[16px] font-semibold text-ink">{p.title}</h3>
                <p className="text-[13px] text-ink-3">{p.tag}</p>
                <p className="mt-2 text-[12px] text-ink-3">{p.courses.length} courses &middot; {p.hours} hours</p>
                <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-[13.5px] text-ink-2">{p.courses.map((c) => <li key={c.slug}><Link href={`/courses/${c.slug}`} className={`rounded hover:underline ${focus}`}>{c.title}</Link></li>)}</ol>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {section("featured-h", "Featured courses", "Picked by the GrowQR team for getting internship-ready.", spot, "lg:grid-cols-4")}
    </>
  );

  return (
    <MarketShell user={me} active="courses">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(itemList) }} />
      <CatalogApp
        initialQuery={q}
        initial={initial}
        cats={cats}
        freeAvailable={free > 0}
        hours={hours}
        hereCount={native.length}
        progress={progress}
        discovery={discovery}
        heading={fieldName ? `${fieldName} courses` : "Learn the skills employers hire for"}
        intro={`${initial.all} self-paced courses across ${cats.length} fields. Learn at your own pace, pass short quizzes, finish a hands-on project and add the result to your Skill Passport.`}
      />
    </MarketShell>
  );
}
