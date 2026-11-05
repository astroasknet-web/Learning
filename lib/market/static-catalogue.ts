import data from "./data/courses.json";

/**
 * Read-only view of the catalogue file (data/courses.json), used where the database is not available:
 * the homepage course strip and the /courses fallback. The database stays the source for enrolment and progress.
 */
export type StaticCourse = { slug: string; title: string; cat: string; levelLabel: string; hours: string; modules: number; brief: string };
export type StaticCategory = { key: string; name: string; c1: string; c2: string; n: number };

const courses = data.courses as unknown as StaticCourse[];
const cats = data.categories as unknown as Record<string, { name: string; c1?: string; c2?: string }>;

export const staticCourses = (): StaticCourse[] => courses;

export function staticCategories(): StaticCategory[] {
  return Object.entries(cats)
    .map(([key, c]) => ({ key, name: c.name, c1: c.c1 ?? "#7857ff", c2: c.c2 ?? "#35d9ff", n: courses.filter((x) => x.cat === key).length }))
    .filter((c) => c.n > 0);
}

/** One course from each of the first `n` categories that have courses, for a short featured strip. */
export function featuredCourses(keys: string[]): StaticCourse[] {
  return keys.map((k) => courses.find((c) => c.cat === k)).filter((c): c is StaticCourse => Boolean(c));
}

export type StaticCourseFull = StaticCourse & { level: string; tags: string[]; weeks: string; pace: string; badge: string; prereq: string; bestFor: string; learn: string[]; handsOn: string; outcome: string };

/** One course with every field, for the detail page used while the database is not connected. */
export function staticCourse(slug: string): StaticCourseFull | null {
  const c = (data.courses as unknown as StaticCourseFull[]).find((x) => x.slug === slug);
  return c ?? null;
}
