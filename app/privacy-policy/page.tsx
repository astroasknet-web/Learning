import type { Metadata } from "next";
import PageShell from "@/components/layout/PageShell";
import PrivacyPage from "@/components/pages/PrivacyPage";
import { canonicalUrl, OG_IMAGE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Privacy Policy | GrowQR",
  description: "Learn how GrowQR collects, uses, and protects your data under India's DPDP Act.",
  alternates: { canonical: canonicalUrl("/privacy-policy") },
  openGraph: {
    title: "Privacy Policy | GrowQR",
    description: "Learn how GrowQR collects, uses, and protects your data under India's DPDP Act.",
    url: canonicalUrl("/privacy-policy"),
    images: [OG_IMAGE],
  },
};

export default function PrivacyPolicyRoute() {
  return <PageShell><PrivacyPage /></PageShell>;
}
