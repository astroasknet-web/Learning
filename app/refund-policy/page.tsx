import type { Metadata } from "next";
import PageShell from "@/components/layout/PageShell";
import RefundPage from "@/components/pages/RefundPage";
import { canonicalUrl, OG_IMAGE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Refund & Cancellation Policy | GrowQR",
  description:
    "How GrowQR handles free trials, subscription cancellations, auto-renewal, and refund requests.",
  alternates: { canonical: canonicalUrl("/refund-policy") },
  openGraph: {
    title: "Refund & Cancellation Policy | GrowQR",
    description:
      "How GrowQR handles free trials, subscription cancellations, auto-renewal, and refund requests.",
    url: canonicalUrl("/refund-policy"),
    images: [OG_IMAGE],
  },
};

export default function RefundPolicyRoute() {
  return <PageShell><RefundPage /></PageShell>;
}
