import { SITE_URL } from "@/lib/seo";

/** Structured data for one practice test page: a LearningResource plus its breadcrumb trail. */
export function testJsonLd(o: { exam: string; examLabel: string; n: number; name: string; minutes: number; questions: number }): object {
  const url = `${SITE_URL}/practice-tests/${o.exam}/${o.n}`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "LearningResource", name: o.name, url, inLanguage: "en", learningResourceType: "Practice test", timeRequired: `PT${o.minutes}M`, numberOfQuestions: o.questions, educationalUse: "assessment", isAccessibleForFree: true, provider: { "@type": "Organization", name: "GrowQR", url: SITE_URL } },
      { "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "Practice tests", item: `${SITE_URL}/practice-tests` },
        { "@type": "ListItem", position: 2, name: o.examLabel, item: `${SITE_URL}/practice-tests/${o.exam}` },
        { "@type": "ListItem", position: 3, name: o.name },
      ] },
    ],
  };
}
