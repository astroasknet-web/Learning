import type { Metadata } from "next";
import SiteChrome from "@/components/layout/SiteChrome";

// Account pages are for people, not search engines.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: "same-origin", // keeps links in reset/verify emails from leaking to other sites; "no-referrer" would make browsers send "Origin: null" on form posts, which Next.js rejects
};

// Every account page sits between the main site's navigation bar (with the Apps menu) and its footer.
export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return <SiteChrome>{children}</SiteChrome>;
}
