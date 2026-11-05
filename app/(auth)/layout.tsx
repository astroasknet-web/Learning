import type { Metadata } from "next";

// Sign-in and account recovery pages have their own full-screen frame (no site navigation or footer) and are not for search engines.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: "same-origin", // keeps links in reset/verify emails from leaking to other sites; "no-referrer" would make browsers send "Origin: null" on form posts, which Next.js rejects
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
