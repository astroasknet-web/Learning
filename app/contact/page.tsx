import type { Metadata } from "next";
import PageShell from "@/components/layout/PageShell";
import ContactPage from "@/components/pages/ContactPage";
import { currentUser } from "@/lib/portal/guard";
import { captchaMode, turnstileSiteKey } from "@/lib/portal/captcha";
import { canonicalUrl, OG_IMAGE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Contact Us | GrowQR",
  description: "Contact GrowQR for enterprise, partnership, or support enquiries.",
  alternates: { canonical: canonicalUrl("/contact") },
  openGraph: {
    title: "Contact Us | GrowQR",
    description: "Contact GrowQR for enterprise, partnership, or support enquiries.",
    url: canonicalUrl("/contact"),
    images: [OG_IMAGE],
  },
};

export const dynamic = "force-dynamic";

export default async function ContactRoute() {
  const me = await currentUser().catch(() => null);
  const mode = captchaMode();
  return <PageShell><ContactPage user={me ? { name: me.name, email: me.email } : null} captcha={{ mode, siteKey: mode === "turnstile" ? turnstileSiteKey() : "" }} /></PageShell>;
}