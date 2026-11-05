import type { Metadata } from "next";
import PageShell from "@/components/layout/PageShell";
import PricingPlans from "@/components/pricing/PricingPlans";
import { canonicalUrl, OG_IMAGE } from "@/lib/seo";
import { planStacks } from "@/lib/pay/plan-value-prices";

const TITLE = "Student Packages and Pricing | GrowQR";
const DESC = "Free, Pro, Silver and Gold packages for students, from ₹0. Courses, mock tests, Resume Studio, internships and study abroad help.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: canonicalUrl("/pricing") },
  openGraph: { title: TITLE, description: DESC, url: canonicalUrl("/pricing"), images: [OG_IMAGE] },
};

export default function PricingRoute() {
  return <PageShell><PricingPlans stacks={planStacks()} /></PageShell>;
}
