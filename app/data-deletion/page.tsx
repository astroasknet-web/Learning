import type { Metadata } from "next";
import PageShell from "@/components/layout/PageShell";
import DataDeletionPage from "@/components/pages/DataDeletionPage";
import { canonicalUrl, OG_IMAGE } from "@/lib/seo";

const DESCRIPTION =
  "How to request deletion of your GrowQR data, including data from a connected Instagram or LinkedIn account, what is deleted, and the processing timeline.";

export const metadata: Metadata = {
  title: "Data Deletion | GrowQR",
  description: DESCRIPTION,
  alternates: { canonical: canonicalUrl("/data-deletion") },
  openGraph: {
    title: "Data Deletion | GrowQR",
    description: DESCRIPTION,
    url: canonicalUrl("/data-deletion"),
    images: [OG_IMAGE],
  },
};

export default function DataDeletionRoute() {
  return <PageShell><DataDeletionPage /></PageShell>;
}
