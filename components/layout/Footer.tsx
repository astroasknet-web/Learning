import StandardFooter from "@/components/standard-footer/StandardFooter";
import { FOOTER } from "@/lib/footer.config";

/** The standard Yugty footer. Edit lib/footer.config.ts to change its content for this app. */
export default function Footer() {
  return <StandardFooter config={FOOTER} />;
}
