import Link from "next/link";
import type { CSSProperties } from "react";
import { databaseConfigured } from "@/lib/portal/db";
import * as liveCourses from "@/lib/market/courses";
import { staticCategories, staticCourses } from "@/lib/market/static-catalogue";
import { EXAMS, FAQS, FEATURED, PATHS, QUICK, STUDIOS } from "@/lib/yugtylearning/content";
import { Faq, Nav, SectionHead, Ticker } from "./Chrome";
import CourseSearch from "./CourseSearch";
import LearnCosmos from "./LearnCosmos";

const ACCENT = { "--a": "#ffb02e", "--a2": "#ffd76a" } as CSSProperties;

/** Live count from the database when it is connected; the catalogue file otherwise. */
async function courseTotal(fallback: number): Promise<number> {
  if (!databaseConfigured()) return fallback;
  try {
    const n = await liveCourses.total();
    return n > 0 ? n : fallback;
  } catch {
    return fallback;
  }
}

export default async function LearnHome() {
  const courses = staticCourses();
  const total = await courseTotal(courses.length);
  const cats = staticCategories();
  const catBy = Object.fromEntries(cats.map((c) => [c.key, c]));
  const bySlug = (s: string) => courses.find((c) => c.slug === s);
  const featured = FEATURED.map(bySlug).filter((c): c is NonNullable<typeof c> => Boolean(c));
  const modules = courses.reduce((n, c) => n + (c.modules || 0), 0);

  return (
    <>
      <Nav />
      <main id="main-content" className="dv dv-learn" style={ACCENT}>
        <section className="dv-hero" id="top">
          <div className="dv-hero-copy">
            <p className="vl-kicker">YUGTYLEARNING · COURSES, CLASSES, PRACTICE</p>
            <h1 className="dv-h1">Build skills. Unlock potential.</h1>
            <p className="vl-lead">Courses, live online classes, exam preparation and practice studios that work together, with progress you can see. Start free, no card needed.</p>
            <CourseSearch quick={QUICK} />
            <div className="vl-cta-row">
              <Link className="vl-btn vl-btn-primary" href="/courses">Browse all courses</Link>
              <Link className="vl-btn vl-btn-ghost" href="#studios">Explore studios and classes</Link>
            </div>
          </div>
          <div className="dv-hero-vis dv-learn-vis">
            <canvas className="dv-canvas" data-hero="learn" aria-hidden="true" />
            <LearnCosmos />
          </div>
        </section>

        <Ticker items={[...STUDIOS.map((s) => s.name), ...EXAMS]} />
        <ul className="dv-stats dv-rv">
          <li><b data-count={total}>{total}</b><span>courses</span></li>
          <li><b data-count={cats.length}>{cats.length}</b><span>fields</span></li>
          <li><b data-count={modules}>{modules}</b><span>course modules</span></li>
          <li><b>1–12</b><span>school classes</span></li>
        </ul>

        <section className="dv-sec" id="courses">
          <SectionHead kicker="COURSES" title={<>Start with a course <em>that fits you.</em></>} text="Self-paced, with hands-on projects, a certificate and a badge at the end." />
          <ul className="yl-grid">
            {featured.map((c) => {
              const cat = catBy[c.cat];
              return (
                <li key={c.slug}>
                  <Link href={`/courses/${c.slug}`} className="yl-card dv-rv" style={{ "--c1": cat?.c1, "--c2": cat?.c2 } as CSSProperties}>
                    <i aria-hidden="true" />
                    <small>{cat?.name ?? "Course"}</small>
                    <h3>{c.title}</h3>
                    <p>{c.brief}</p>
                    <span className="yl-meta"><span>{c.levelLabel}</span><span>{c.hours}</span><span>{c.modules} modules</span></span>
                    <span className="dv-go">View course ↗</span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <nav className="yl-cats" aria-label="Browse by field">
            {cats.map((c) => (
              <Link key={c.key} href={`/courses?cat=${c.key}`}>{c.name} <small>{c.n}</small></Link>
            ))}
          </nav>
          <div className="vl-cta-row">
            <Link className="vl-btn vl-btn-ghost" href="/courses">See all {total} courses</Link>
          </div>
        </section>

        <section className="dv-sec" id="paths">
          <SectionHead kicker="CAREER PATHS" title={<>Courses in the <em>right order.</em></>} text="Pick a goal and follow the courses step by step." />
          <div className="yl-paths">
            {PATHS.map((p) => (
              <div key={p.title} className="yl-path dv-rv">
                <h3>{p.title}</h3>
                <p>{p.tag}</p>
                <ol>
                  {p.slugs.map(bySlug).filter((c): c is NonNullable<typeof c> => Boolean(c)).map((c) => (
                    <li key={c.slug}><Link href={`/courses/${c.slug}`}>{c.title}</Link></li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </section>

        <section className="dv-sec" id="studios">
          <SectionHead kicker="STUDIOS, CLASSES AND MORE" title={<>Learn it. Practise it. <em>Prove it.</em></>} text="Practice studios, school classes, live online classes and exam preparation, all under one account." />
          <div className="dv-bento">
            {STUDIOS.map((s) => (
              <Link key={s.name} href={s.href} className={`dv-tile dv-tile-${s.size} dv-rv`}>
                <span className="dv-tile-tag">{s.tag}</span>
                <h3>{s.name}</h3>
                <p>{s.text}</p>
                <span className="dv-go">Open ↗</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="dv-sec" id="exams">
          <SectionHead kicker="EXAM PREP" title={<>Mock tests for the exams <em>that matter.</em></>} text="Timed practice, marked instantly, with every mock test in one place." />
          <ul className="dv-exams dv-rv">
            {EXAMS.map((e) => (
              <li key={e}><Link href="/exam-prep">{e}</Link></li>
            ))}
          </ul>
          <div className="vl-cta-row">
            <Link className="vl-btn vl-btn-ghost" href="/practice-tests">Take a practice test</Link>
            <Link className="vl-btn vl-btn-ghost" href="/pricing">See plans</Link>
          </div>
        </section>

        <section className="dv-sec" id="faq">
          <SectionHead kicker="QUESTIONS" title="Good questions." />
          <Faq items={FAQS} />
        </section>

        <section className="dv-final dv-rv" aria-label="Get started">
          <h2>Build skills. Unlock potential.</h2>
          <div className="vl-cta-row vl-cta-center">
            <Link className="vl-btn vl-btn-primary" href="/signup">Start learning free</Link>
            <Link className="vl-btn vl-btn-ghost" href="/contact">Talk to us</Link>
          </div>
          <p className="dv-final-note">YugtyLearning</p>
        </section>
      </main>
    </>
  );
}
