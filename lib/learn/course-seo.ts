import type { Metadata } from "next";
import type { NativeCourse } from "@/lib/market/lessons";
import { OG_IMAGE, SITE_URL } from "@/lib/seo";

/**
 * SEO for university-programme courses (courses whose lesson file carries a `landing` block). One place builds the page metadata and the
 * schema.org graph so every such course (BBA, BCA, MCA, MBA...) gets the same treatment: a keyword title of at most 60 characters, a
 * 120-155 character description, canonical, Open Graph + Twitter cards, Course + CourseInstance + Offer + FAQPage + BreadcrumbList + glossary.
 */
const BRAND = "GrowQR";

export function fitTitle(parts: string[], max = 62): string {
  for (const p of parts) if (p.length <= max) return p;
  const last = parts[parts.length - 1];
  const cut = last.slice(0, max - 1);
  return cut.slice(0, Math.max(cut.lastIndexOf(" "), 20)) + "…";
}

export function landingMetadata(nc: NativeCourse, slug: string): Metadata | null {
  const L = nc.landing;
  if (!L) return null;
  const title = fitTitle([`${L.seo.title} | ${BRAND}`, L.seo.title]);
  const url = `${SITE_URL}/courses/${slug}`;
  return {
    title,
    description: Array.from(L.seo.description).slice(0, 155).join(""),
    keywords: L.seo.keywords,
    authors: [{ name: L.author.name }],
    alternates: { canonical: url },
    robots: { index: true, follow: true },
    openGraph: { type: "website", url, siteName: BRAND, title, description: L.seo.description, images: [OG_IMAGE] },
    twitter: { card: "summary_large_image", title, description: L.seo.description, images: [OG_IMAGE.url] },
  };
}

const iso = (h: number) => `PT${Math.max(1, Math.round(h))}H`;

export function landingJsonLd(nc: NativeCourse, slug: string, course: { title: string; brief: string; level_label: string; cat_name: string; category: string }) {
  const L = nc.landing!;
  const url = `${SITE_URL}/courses/${slug}`;
  const author = { "@type": "Person", name: L.author.name, worksFor: { "@type": "Organization", name: L.author.publisher } };
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Course", "@id": `${url}#course`, name: nc.title, description: L.seo.description, url, inLanguage: "en-IN", educationalLevel: course.level_label,
        timeRequired: iso(nc.hours), keywords: L.seo.keywords.join(", "), dateModified: L.updated, version: L.version, author,
        teaches: L.outcomes.map((o) => o.text), coursePrerequisites: L.prerequisites,
        provider: { "@type": "Organization", name: BRAND, sameAs: SITE_URL },
        hasCourseInstance: { "@type": "CourseInstance", courseMode: "online", courseWorkload: iso(nc.hours), inLanguage: "en-IN", instructor: author },
        hasPart: nc.modules.map((m, i) => ({ "@type": "LearningResource", position: i + 1, name: m.title, description: m.summary, url: `${url}/learn/${m.slug}`, timeRequired: iso(m.hours), learningResourceType: "Unit" })),
      },
      { "@type": "FAQPage", mainEntity: L.faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) },
      { "@type": "DefinedTermSet", name: `${nc.title}: key terms`, hasDefinedTerm: L.glossary.map((g) => ({ "@type": "DefinedTerm", name: g.term, description: g.definition })) },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: "Courses", item: `${SITE_URL}/courses` },
          { "@type": "ListItem", position: 3, name: course.cat_name, item: `${SITE_URL}/courses?cat=${course.category}` },
          { "@type": "ListItem", position: 4, name: nc.title },
        ],
      },
    ],
  };
}

/** Per-module (lesson page) metadata: "<module> | <short course> | GrowQR", never cut mid-word. */
export function moduleTitle(moduleTitleText: string, courseTitle: string): string {
  return fitTitle([`${moduleTitleText} | ${courseTitle} | ${BRAND}`, `${moduleTitleText} | ${BRAND}`, `${moduleTitleText}`]);
}

export function formatDate(iso8601: string): string {
  const d = new Date(`${iso8601}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso8601 : d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}
